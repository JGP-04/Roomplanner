import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { SessionService } from "./auth.ts";
import { hashPassword, verifyPassword } from "./password.ts";

const credentialsSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform((value) => value.toLowerCase()),
  password: z.string().min(8),
});

const dummyPasswordHash = `scrypt$32768$8$1$${"A".repeat(22)}$${"A".repeat(86)}`;

export function registerAuthRoutes(
  app: FastifyInstance,
  database: Pool,
  sessions: SessionService,
): void {
  app.post("/api/auth/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const data = credentialsSchema.parse(request.body);
    const passwordHash = await hashPassword(data.password);
    try {
      const result = await database.query<{ id: string; email: string }>(
        "SELECT id, email FROM app_register_user($1, $2)",
        [data.email, passwordHash],
      );
      const user = result.rows[0];
      await sessions.create(user.id, reply);
      request.log.info({ event: "auth.register", userId: user.id }, "security event");
      return reply.code(201).send({ user });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        request.log.warn({ event: "auth.register_conflict" }, "security event");
        return reply.code(409).send({ error: "El correo ya está registrado" });
      }
      throw error;
    }
  });

  app.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const data = credentialsSchema.parse(request.body);
    const result = await database.query<{ id: string; email: string; password_hash: string }>(
      "SELECT id, email, password_hash FROM app_find_user_for_login($1)",
      [data.email],
    );
    const user = result.rows[0];
    const passwordIsValid = await verifyPassword(data.password, user?.password_hash ?? dummyPasswordHash);
    if (!user || !passwordIsValid) {
      request.log.warn({ event: "auth.login_failed" }, "security event");
      return reply.code(401).send({ error: "Credenciales inválidas" });
    }
    await sessions.create(user.id, reply);
    request.log.info({ event: "auth.login", userId: user.id }, "security event");
    return { user: { id: user.id, email: user.email } };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    await sessions.delete(request, reply);
    request.log.info({ event: "auth.logout" }, "security event");
    return { ok: true };
  });

  app.get("/api/auth/me", async (request) => ({ user: await sessions.getUser(request) }));
}
