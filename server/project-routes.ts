import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { projectPayloadSchema } from "../src/domain/project.ts";
import { SessionService } from "./auth.ts";
import { ProjectRepository } from "./project-repository.ts";

const idParamsSchema = z.object({ id: z.uuid() });

async function requireUser(request: FastifyRequest, reply: FastifyReply, sessions: SessionService) {
  const user = await sessions.getUser(request);
  if (!user) reply.code(401).send({ error: "Inicia sesión para continuar" });
  return user;
}

export function registerProjectRoutes(
  app: FastifyInstance,
  projects: ProjectRepository,
  sessions: SessionService,
): void {
  app.get("/api/projects", async (request, reply) => {
    const user = await requireUser(request, reply, sessions);
    if (!user) return;
    return { projects: await projects.list(user.id) };
  });

  app.get("/api/projects/:id", async (request, reply) => {
    const user = await requireUser(request, reply, sessions);
    if (!user) return;
    const { id } = idParamsSchema.parse(request.params);
    const project = await projects.findById(id, user.id);
    if (!project) return reply.code(404).send({ error: "Proyecto no encontrado" });
    return { project };
  });

  app.post("/api/projects", async (request, reply) => {
    const user = await requireUser(request, reply, sessions);
    if (!user) return;
    const payload = projectPayloadSchema.parse(request.body);
    const project = await projects.create(user.id, payload);
    return reply.code(201).send({ project });
  });

  app.put("/api/projects/:id", async (request, reply) => {
    const user = await requireUser(request, reply, sessions);
    if (!user) return;
    const { id } = idParamsSchema.parse(request.params);
    const payload = projectPayloadSchema.parse(request.body);
    const result = await projects.update(id, user.id, payload);
    if (result.status === "not-found") {
      return reply.code(404).send({ error: "Proyecto no encontrado" });
    }
    if (result.status === "conflict") {
      return reply.code(409).send({ error: "El proyecto cambió en otra pestaña; recárgalo antes de guardar" });
    }
    return { project: result.project };
  });
}
