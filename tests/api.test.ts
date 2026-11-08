import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { buildApp } from "../server/app.ts";

function databaseStub(): Pool {
  return {
    query: async () => ({ rows: [], rowCount: 1 }),
  } as unknown as Pool;
}

test("la API protege los proyectos y responde el health check", async (context) => {
  const app = await buildApp({
    frontendOrigins: ["http://127.0.0.1:5173"],
    host: "127.0.0.1",
    port: 3001,
  }, databaseStub());
  context.after(() => app.close());

  const unauthorized = await app.inject({ method: "GET", url: "/api/projects" });
  assert.equal(unauthorized.statusCode, 401);
  assert.deepEqual(unauthorized.json(), { error: "Inicia sesión para continuar" });

  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { ok: true });
  assert.equal(health.headers["cache-control"], "no-store");
  assert.equal(health.headers["x-content-type-options"], "nosniff");
  assert.match(health.headers["content-security-policy"] ?? "", /default-src 'none'/);
});

test("la API rechaza escrituras desde un origen no permitido", async (context) => {
  const app = await buildApp({
    frontendOrigins: ["http://127.0.0.1:5173"],
    host: "127.0.0.1",
    port: 3001,
  }, databaseStub());
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { origin: "https://malicioso.example" },
  });
  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), { error: "Origen no permitido" });
});
