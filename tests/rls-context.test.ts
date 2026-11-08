import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";
import { ProjectRepository } from "../server/project-repository.ts";

test("establece el propietario con alcance transaccional antes de consultar datos RLS", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: normalized, values });
      if (normalized.startsWith("SELECT id, title, updated_at")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;
  const projects = new ProjectRepository(pool, null);

  assert.deepEqual(await projects.list("owner-1"), []);
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls[1].sql, "SELECT set_config('app.user_id', $1, true)");
  assert.deepEqual(calls[1].values, ["owner-1"]);
  assert.match(calls[2].sql, /WHERE owner_id = \$1/);
  assert.equal(calls[3].sql, "COMMIT");
});

test("revierte la transacción y libera la conexión si una consulta falla", async () => {
  const calls: string[] = [];
  let released = false;
  const client = {
    async query(sql: string) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      calls.push(normalized);
      if (normalized.startsWith("SELECT id, title, updated_at")) throw new Error("database failure");
      return { rows: [], rowCount: 0 };
    },
    release() { released = true; },
  } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;

  await assert.rejects(() => new ProjectRepository(pool, null).list("owner-1"), /database failure/);
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.equal(released, true);
});
