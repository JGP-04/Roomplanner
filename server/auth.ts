import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
export { hashPassword, verifyPassword } from "./password.ts";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

function sessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-roomplannr_session" : "roomplannr_session";
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class SessionService {
  constructor(private readonly database: Pool) {}

  async create(userId: string, reply: FastifyReply): Promise<void> {
    const token = randomBytes(32).toString("base64url");
    const hashedToken = tokenHash(token);
    await this.database.query(
      "SELECT app_create_session($1, $2)",
      [userId, hashedToken],
    );
    reply.setCookie(sessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax",
      path: "/",
      maxAge: sessionLifetimeSeconds,
    });
  }

  async getUser(request: FastifyRequest): Promise<{ id: string; email: string } | null> {
    const token = request.cookies[sessionCookieName()];
    if (!token) return null;
    const result = await this.database.query<{ id: string; email: string }>(
      "SELECT id, email FROM app_get_session_user($1)",
      [tokenHash(token)],
    );
    return result.rows[0] ?? null;
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cookieName = sessionCookieName();
    const token = request.cookies[cookieName];
    if (token) {
      await this.database.query("SELECT app_delete_session($1)", [tokenHash(token)]);
    }
    reply.clearCookie(cookieName, {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax",
    });
  }
}
