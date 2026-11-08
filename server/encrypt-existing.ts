import "dotenv/config";
import pg, { type PoolClient } from "pg";
import { projectPayloadSchema, type CatalogItem, type ObjectInstance } from "../src/domain/project.ts";
import { ProjectEncryption } from "./project-encryption.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL es obligatorio para cifrar datos existentes");
const encryption = ProjectEncryption.fromEnvironment(process.env, true)!;
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, application_name: "roomplannr-encrypt-existing" });

async function encryptUserProjects(client: PoolClient, ownerId: string): Promise<number> {
  await client.query("SELECT set_config('app.user_id', $1, true)", [ownerId]);
  const projects = await client.query<{
    id: string;
    title: string;
    room: unknown;
    revision: number;
  }>(
    `SELECT id, title, room, revision FROM projects
     WHERE owner_id = $1 AND encrypted_payload IS NULL
     ORDER BY id FOR UPDATE`,
    [ownerId],
  );

  for (const project of projects.rows) {
    const catalog = await client.query<CatalogItem>(
      `SELECT id, name, kind, width, depth, height, color
       FROM catalog_items WHERE project_id = $1 ORDER BY name, id`,
      [project.id],
    );
    const instances = await client.query<{
      id: string;
      catalog_item_id: string;
      position: [number, number, number];
      rotation_y: number;
      scale: [number, number, number];
    }>(
      `SELECT id, catalog_item_id, position, rotation_y, scale
       FROM object_instances WHERE project_id = $1 ORDER BY id`,
      [project.id],
    );
    const payload = projectPayloadSchema.parse({
      title: project.title,
      room: project.room,
      revision: project.revision,
      catalog: catalog.rows,
      instances: instances.rows.map((instance): ObjectInstance => ({
        id: instance.id,
        catalogItemId: instance.catalog_item_id,
        position: instance.position,
        rotationY: instance.rotation_y,
        scale: instance.scale,
      })),
    });
    const encrypted = encryption.encrypt(project.id, ownerId, payload);
    await client.query(
      `UPDATE projects
       SET title = '[contenido cifrado]', room = '{}'::jsonb,
           encrypted_payload = $1, encryption_key_version = $2
       WHERE id = $3 AND owner_id = $4`,
      [encrypted.ciphertext, encrypted.keyVersion, project.id, ownerId],
    );
    await client.query("DELETE FROM object_instances WHERE project_id = $1", [project.id]);
    await client.query("DELETE FROM catalog_items WHERE project_id = $1", [project.id]);
  }
  return projects.rowCount ?? 0;
}

const client = await pool.connect();
let encryptedCount = 0;
try {
  const owners = await client.query<{ id: string }>("SELECT id FROM users ORDER BY id");
  for (const owner of owners.rows) {
    await client.query("BEGIN");
    try {
      encryptedCount += await encryptUserProjects(client, owner.id);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  process.stdout.write(`Proyectos cifrados: ${encryptedCount}\n`);
} finally {
  client.release();
  await pool.end();
}
