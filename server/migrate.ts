import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { pool } from "./db.ts";

const sqlDirectory = new URL("./sql/", import.meta.url);
const files = (await readdir(sqlDirectory)).filter((name) => /^\d+_[\w-]+\.sql$/.test(name)).sort();
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(762149031)");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
  const completed = new Set(applied.rows.map((row) => row.name));
  for (const file of files) {
    if (completed.has(file)) continue;
    await client.query(await readFile(new URL(file, sqlDirectory), "utf8"));
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    process.stdout.write(`Aplicada ${file}\n`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
