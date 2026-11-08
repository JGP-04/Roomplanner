import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL es obligatorio para ejecutar migraciones");

const applicationRole = process.env.DATABASE_APP_ROLE;
if (!applicationRole && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_APP_ROLE es obligatorio en producción");
}
if (applicationRole && !/^[a-z_][a-z0-9_]{0,62}$/i.test(applicationRole)) {
  throw new Error("DATABASE_APP_ROLE no es un identificador PostgreSQL válido");
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, application_name: "roomplannr-migrate" });

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
  if (applicationRole) {
    const quotedRole = `"${applicationRole}"`;
    const roleExists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [applicationRole]);
    if (!roleExists.rowCount) throw new Error(`El rol de aplicación ${applicationRole} no existe`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${quotedRole}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON projects, catalog_items, object_instances TO ${quotedRole}`);
    await client.query(`GRANT EXECUTE ON FUNCTION app_current_user_id() TO ${quotedRole}`);
    await client.query(`GRANT EXECUTE ON FUNCTION app_register_user(text, text) TO ${quotedRole}`);
    await client.query(`GRANT EXECUTE ON FUNCTION app_find_user_for_login(text) TO ${quotedRole}`);
    await client.query(`GRANT EXECUTE ON FUNCTION app_create_session(uuid, text) TO ${quotedRole}`);
    await client.query(`GRANT EXECUTE ON FUNCTION app_get_session_user(text) TO ${quotedRole}`);
    await client.query(`GRANT EXECUTE ON FUNCTION app_delete_session(text) TO ${quotedRole}`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
