import pg from "pg";

const databaseUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("APP_DATABASE_URL es obligatorio para iniciar el backend");
}

if (process.env.NODE_ENV === "production") {
  if (!process.env.APP_DATABASE_URL) {
    throw new Error("APP_DATABASE_URL es obligatorio en producción y debe usar un rol distinto al de migraciones");
  }
  if (process.env.APP_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("APP_DATABASE_URL no puede usar la cuenta propietaria de DATABASE_URL en producción");
  }
  const sslMode = new URL(process.env.APP_DATABASE_URL).searchParams.get("sslmode");
  if (sslMode !== "verify-full") {
    throw new Error("APP_DATABASE_URL debe usar sslmode=verify-full en producción");
  }
}

export const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  query_timeout: 12_000,
  application_name: "roomplannr-api",
});

export async function verifyRuntimeDatabaseRole(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  const result = await pool.query<{
    current_user: string;
    rolbypassrls: boolean;
    rolsuper: boolean;
    ssl: boolean;
  }>(
    `SELECT current_user, roles.rolsuper, roles.rolbypassrls, ssl.ssl
     FROM pg_roles roles
     JOIN pg_stat_ssl ssl ON ssl.pid = pg_backend_pid()
     WHERE roles.rolname = current_user`,
  );
  const role = result.rows[0];
  if (!role || role.rolsuper || role.rolbypassrls || !role.ssl) {
    throw new Error("La conexión de la API debe usar TLS y un rol sin SUPERUSER ni BYPASSRLS");
  }
}
