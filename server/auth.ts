import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyReply, FastifyRequest } from "fastify";
import { pool } from "./db.ts";

const scrypt = promisify(scryptCallback);
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const cookieName = "roomplannr_session";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex || expectedHex.length !== 128) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, reply: FastifyReply): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '7 days')",
    [tokenHash(token), userId],
  );
  reply.setCookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax",
    path: "/",
    maxAge: sessionLifetimeSeconds,
  });
}

export async function getSessionUser(request: FastifyRequest): Promise<{ id: string; email: string } | null> {
  const token = request.cookies[cookieName];
  if (!token) return null;
  const result = await pool.query<{ id: string; email: string }>(
    `SELECT u.id, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(token)],
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[cookieName];
  if (token) {
    await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
  }
  reply.clearCookie(cookieName, { path: "/" });
}
