import "dotenv/config";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { createSession, deleteSession, getSessionUser, hashPassword, verifyPassword } from "./auth.ts";
import { pool } from "./db.ts";
import {
  projectPayloadSchema,
  type CatalogItem,
  type ObjectInstance,
  type ProjectDocument,
  type ProjectPayload,
  type ProjectSummary,
  type Room,
} from "../src/domain/project.ts";

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173";
const port = Number(process.env.PORT ?? 3001);
if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_ORIGIN) {
  throw new Error("FRONTEND_ORIGIN es obligatorio en producción");
}
const app = Fastify({ logger: true, bodyLimit: 512 * 1024 });

await app.register(cookie);
await app.register(cors, { origin: frontendOrigin, credentials: true });
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

app.addHook("onRequest", async (request, reply) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    request.headers.origin &&
    request.headers.origin !== frontendOrigin
  ) {
    return reply.code(403).send({ error: "Origen no permitido" });
  }
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: "Datos inválidos", issues: error.issues });
  }
  if (typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" && error.statusCode < 500) {
    return reply.code(error.statusCode).send({ error: "message" in error && typeof error.message === "string" ? error.message : "Solicitud inválida" });
  }
  return reply.code(500).send({ error: "Error interno del servidor" });
});

const credentialsSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

const idParamsSchema = z.object({ id: z.uuid() });

async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await getSessionUser(request);
  if (!user) reply.code(401).send({ error: "Inicia sesión para continuar" });
  return user;
}

app.get("/api/health", async () => {
  await pool.query("SELECT 1");
  return { ok: true };
});

app.post("/api/auth/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
  const data = credentialsSchema.parse(request.body);
  const passwordHash = await hashPassword(data.password);
  try {
    const result = await pool.query<{ id: string; email: string }>(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [data.email, passwordHash],
    );
    const user = result.rows[0];
    await createSession(user.id, reply);
    return reply.code(201).send({ user });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return reply.code(409).send({ error: "El correo ya está registrado" });
    }
    throw error;
  }
});

app.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
  const data = credentialsSchema.parse(request.body);
  const result = await pool.query<{ id: string; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [data.email],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(data.password, user.password_hash))) {
    return reply.code(401).send({ error: "Credenciales inválidas" });
  }
  await createSession(user.id, reply);
  return { user: { id: user.id, email: user.email } };
});

app.post("/api/auth/logout", async (request, reply) => {
  await deleteSession(request, reply);
  return { ok: true };
});

app.get("/api/auth/me", async (request) => ({ user: await getSessionUser(request) }));

app.get("/api/projects", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const result = await pool.query<{ id: string; title: string; updated_at: Date }>(
    "SELECT id, title, updated_at FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 100",
    [user.id],
  );
  const projects: ProjectSummary[] = result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at.toISOString(),
  }));
  return { projects };
});

async function readProject(id: string, ownerId: string): Promise<ProjectDocument | null> {
  const projectResult = await pool.query<{
    id: string;
    title: string;
    room: Room;
    revision: number;
    updated_at: Date;
  }>(
    "SELECT id, title, room, revision, updated_at FROM projects WHERE id = $1 AND owner_id = $2",
    [id, ownerId],
  );
  const row = projectResult.rows[0];
  if (!row) return null;
  const [catalogResult, instancesResult] = await Promise.all([
    pool.query<CatalogItem>(
      `SELECT id, name, kind, width, depth, height, color
       FROM catalog_items WHERE project_id = $1 ORDER BY name, id`,
      [id],
    ),
    pool.query<{
      id: string;
      catalog_item_id: string;
      position: [number, number, number];
      rotation_y: number;
      scale: [number, number, number];
    }>(
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

app.get("/api/projects/:id", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = idParamsSchema.parse(request.params);
  const project = await readProject(id, user.id);
  if (!project) return reply.code(404).send({ error: "Proyecto no encontrado" });
  return { project };
});

async function replaceContents(client: import("pg").PoolClient, id: string, payload: ProjectPayload) {
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

app.post("/api/projects", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const payload = projectPayloadSchema.parse(request.body);
  const client = await pool.connect();
  let id: string;
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string }>(
      "INSERT INTO projects (owner_id, title, room) VALUES ($1, $2, $3::jsonb) RETURNING id",
      [user.id, payload.title, JSON.stringify(payload.room)],
    );
    id = result.rows[0].id;
    await replaceContents(client, id, payload);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return reply.code(201).send({ project: await readProject(id, user.id) });
});

app.put("/api/projects/:id", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = idParamsSchema.parse(request.params);
  const payload = projectPayloadSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const update = await client.query(
      `UPDATE projects SET title = $1, room = $2::jsonb, revision = revision + 1, updated_at = now()
       WHERE id = $3 AND owner_id = $4 AND revision = $5`,
      [payload.title, JSON.stringify(payload.room), id, user.id, payload.revision],
    );
    if (update.rowCount === 0) {
      await client.query("ROLLBACK");
      const exists = await pool.query("SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2", [id, user.id]);
      return reply.code(exists.rowCount ? 409 : 404).send({
        error: exists.rowCount ? "El proyecto cambió en otra pestaña; recárgalo antes de guardar" : "Proyecto no encontrado",
      });
    }
    await replaceContents(client, id, payload);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { project: await readProject(id, user.id) };
});

app.addHook("onClose", async () => {
  await pool.end();
});

try {
  await app.listen({ host: process.env.HOST ?? "127.0.0.1", port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
