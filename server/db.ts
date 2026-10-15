import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL es obligatorio para iniciar el backend");
}

export const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});
