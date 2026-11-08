import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { Pool } from "pg";
import { z } from "zod";
import { registerAuthRoutes } from "./auth-routes.ts";
import { SessionService } from "./auth.ts";
import type { ServerConfig } from "./config.ts";
import { ProjectRepository } from "./project-repository.ts";
import { registerProjectRoutes } from "./project-routes.ts";

function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      request.log.warn({ event: "request.validation_failed" }, "request rejected");
      return reply.code(400).send(process.env.NODE_ENV === "production"
        ? { error: "Datos inválidos" }
        : { error: "Datos inválidos", issues: error.issues });
    }
    if (
      typeof error === "object"
      && error !== null
      && "statusCode" in error
      && typeof error.statusCode === "number"
      && error.statusCode < 500
    ) {
      request.log.warn({ statusCode: error.statusCode }, "request rejected");
      const message = error.statusCode === 401
        ? "Inicia sesión para continuar"
        : error.statusCode === 403
          ? "Acceso no permitido"
          : error.statusCode === 404
            ? "Recurso no encontrado"
            : error.statusCode === 413
              ? "Los datos enviados son demasiado grandes"
              : error.statusCode === 429
                ? "Demasiadas solicitudes; inténtalo de nuevo en unos minutos"
                : "Solicitud inválida";
      return reply.code(error.statusCode).send({ error: message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Error interno del servidor" });
  });
}

export async function buildApp(config: ServerConfig, database: Pool): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 512 * 1024,
    logger: {
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
        censor: "[REDACTED]",
      },
    },
  });
  await app.register(cookie);
  const frontendOrigins = new Set(config.frontendOrigins);
  await app.register(cors, { origin: [...frontendOrigins], credentials: true });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    if (process.env.NODE_ENV === "production") {
      reply.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
    return payload;
  });

  app.addHook("onRequest", async (request, reply) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method)
      && request.headers.origin
      && !frontendOrigins.has(request.headers.origin)
    ) {
      return reply.code(403).send({ error: "Origen no permitido" });
    }
  });

  registerErrorHandler(app);
  const sessions = new SessionService(database);
  registerAuthRoutes(app, database, sessions);
  registerProjectRoutes(app, new ProjectRepository(database), sessions);

  app.get("/api/health", async () => {
    await database.query("SELECT 1");
    return { ok: true };
  });

  return app;
}
