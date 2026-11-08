import "dotenv/config";
import { buildApp } from "./app.ts";
import { readServerConfig } from "./config.ts";
import { pool, verifyRuntimeDatabaseRole } from "./db.ts";
import { ProjectEncryption } from "./project-encryption.ts";

const config = readServerConfig();
ProjectEncryption.fromEnvironment();
await verifyRuntimeDatabaseRole();
const app = await buildApp(config, pool);

app.addHook("onClose", async () => {
  await pool.end();
});

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exitCode = 1;
}
