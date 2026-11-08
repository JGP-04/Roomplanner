import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type {
  CatalogItem,
  ObjectInstance,
  ProjectDocument,
  ProjectPayload,
  ProjectSummary,
  Room,
} from "../src/domain/project.ts";
import { projectPayloadSchema } from "../src/domain/project.ts";
import { ProjectEncryption } from "./project-encryption.ts";

interface ProjectRow {
  id: string;
  title: string;
  room: Room;
  revision: number;
  updated_at: Date;
  encrypted_payload: Buffer | null;
  encryption_key_version: number | null;
}

interface InstanceRow {
  id: string;
  catalog_item_id: string;
  position: [number, number, number];
  rotation_y: number;
  scale: [number, number, number];
}

export type UpdateProjectResult =
  | { status: "updated"; project: ProjectDocument }
  | { status: "conflict" }
  | { status: "not-found" };

export class ProjectRepository {
  constructor(
    private readonly database: Pool,
    private readonly encryption = ProjectEncryption.fromEnvironment(),
  ) {}

  async list(ownerId: string): Promise<ProjectSummary[]> {
    return this.withUserTransaction(ownerId, async (client) => {
      const result = await client.query<{
        id: string;
        title: string;
        updated_at: Date;
        encrypted_payload: Buffer | null;
        encryption_key_version: number | null;
      }>(
        `SELECT id, title, updated_at, encrypted_payload, encryption_key_version
         FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 100`,
        [ownerId],
      );
      return result.rows.map((row) => ({
        id: row.id,
        title: row.encrypted_payload
          ? this.decrypt(row.id, ownerId, row.encrypted_payload, row.encryption_key_version).title
          : row.title,
        updatedAt: row.updated_at.toISOString(),
      }));
    });
  }

  async findById(id: string, ownerId: string): Promise<ProjectDocument | null> {
    return this.withUserTransaction(ownerId, (client) => this.readProject(client, id, ownerId));
  }

  async create(ownerId: string, payload: ProjectPayload): Promise<ProjectDocument> {
    const id = randomUUID();
    await this.withUserTransaction(ownerId, async (client) => {
      if (this.encryption) {
        const encrypted = this.encryption.encrypt(id, ownerId, payload);
        await client.query(
          `INSERT INTO projects (
             id, owner_id, title, room, encrypted_payload, encryption_key_version
           ) VALUES ($1, $2, '[contenido cifrado]', '{}'::jsonb, $3, $4)`,
          [id, ownerId, encrypted.ciphertext, encrypted.keyVersion],
        );
      } else {
        await client.query(
          "INSERT INTO projects (id, owner_id, title, room) VALUES ($1, $2, $3, $4::jsonb)",
          [id, ownerId, payload.title, JSON.stringify(payload.room)],
        );
        await this.replaceContents(client, id, payload);
      }
    });
    const project = await this.findById(id, ownerId);
    if (!project) throw new Error("El proyecto recién creado no pudo recuperarse");
    return project;
  }

  async update(id: string, ownerId: string, payload: ProjectPayload): Promise<UpdateProjectResult> {
    const status = await this.withUserTransaction(ownerId, async (client): Promise<"updated" | "conflict" | "not-found"> => {
      const encrypted = this.encryption?.encrypt(id, ownerId, { ...payload, revision: payload.revision + 1 });
      const update = encrypted
        ? await client.query(
          `UPDATE projects SET title = '[contenido cifrado]', room = '{}'::jsonb,
             encrypted_payload = $1, encryption_key_version = $2,
             revision = revision + 1, updated_at = now()
           WHERE id = $3 AND owner_id = $4 AND revision = $5`,
          [encrypted.ciphertext, encrypted.keyVersion, id, ownerId, payload.revision],
        )
        : await client.query(
          `UPDATE projects SET title = $1, room = $2::jsonb, revision = revision + 1, updated_at = now()
           WHERE id = $3 AND owner_id = $4 AND revision = $5`,
          [payload.title, JSON.stringify(payload.room), id, ownerId, payload.revision],
        );
      if (update.rowCount === 0) {
        const exists = await client.query("SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2", [id, ownerId]);
        return exists.rowCount ? "conflict" : "not-found";
      }
      if (encrypted) {
        await client.query("DELETE FROM object_instances WHERE project_id = $1", [id]);
        await client.query("DELETE FROM catalog_items WHERE project_id = $1", [id]);
      } else {
        await this.replaceContents(client, id, payload);
      }
      return "updated";
    });

    if (status !== "updated") return { status };
    const project = await this.findById(id, ownerId);
    if (!project) throw new Error("El proyecto actualizado no pudo recuperarse");
    return { status, project };
  }

  private async readProject(
    database: Pool | PoolClient,
    id: string,
    ownerId: string,
  ): Promise<ProjectDocument | null> {
    const projectResult = await database.query<ProjectRow>(
      `SELECT id, title, room, revision, updated_at, encrypted_payload, encryption_key_version
       FROM projects WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    const row = projectResult.rows[0];
    if (!row) return null;

    if (row.encrypted_payload) {
      const payload = this.decrypt(id, ownerId, row.encrypted_payload, row.encryption_key_version);
      return {
        ...payload,
        id: row.id,
        revision: row.revision,
        updatedAt: row.updated_at.toISOString(),
      };
    }

    const [catalogResult, instancesResult] = await Promise.all([
      database.query<CatalogItem>(
        `SELECT id, name, kind, width, depth, height, color
         FROM catalog_items WHERE project_id = $1 ORDER BY name, id`,
        [id],
      ),
      database.query<InstanceRow>(
        `SELECT id, catalog_item_id, position, rotation_y, scale
         FROM object_instances WHERE project_id = $1 ORDER BY id`,
        [id],
      ),
    ]);

    return {
      id: row.id,
      title: row.title,
      room: row.room,
      revision: row.revision,
      updatedAt: row.updated_at.toISOString(),
      catalog: catalogResult.rows,
      instances: instancesResult.rows.map((item): ObjectInstance => ({
        id: item.id,
        catalogItemId: item.catalog_item_id,
        position: item.position,
        rotationY: item.rotation_y,
        scale: item.scale,
      })),
    };
  }

  private decrypt(
    projectId: string,
    ownerId: string,
    ciphertext: Buffer,
    keyVersion: number | null,
  ): ProjectPayload {
    if (!this.encryption || keyVersion === null) {
      throw new Error("No hay una clave disponible para descifrar el proyecto");
    }
    return projectPayloadSchema.parse(this.encryption.decrypt(projectId, ownerId, ciphertext, keyVersion));
  }

  private async replaceContents(client: PoolClient, id: string, payload: ProjectPayload): Promise<void> {
    await client.query("DELETE FROM object_instances WHERE project_id = $1", [id]);
    await client.query("DELETE FROM catalog_items WHERE project_id = $1", [id]);
    await client.query(
      `INSERT INTO catalog_items (id, project_id, name, kind, width, depth, height, color)
       SELECT item.id, $1::uuid, item.name, item.kind, item.width, item.depth, item.height, item.color
       FROM jsonb_to_recordset($2::jsonb) AS item(
         id uuid, name text, kind text, width double precision, depth double precision,
         height double precision, color text
       )`,
      [id, JSON.stringify(payload.catalog)],
    );
    await client.query(
      `INSERT INTO object_instances (id, project_id, catalog_item_id, position, rotation_y, scale)
       SELECT item.id, $1::uuid, item."catalogItemId", item.position, item."rotationY", item.scale
       FROM jsonb_to_recordset($2::jsonb) AS item(
         id uuid, "catalogItemId" uuid, position jsonb, "rotationY" double precision, scale jsonb
       )`,
      [id, JSON.stringify(payload.instances)],
    );
  }

  private async withUserTransaction<T>(
    ownerId: string,
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [ownerId]);
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
