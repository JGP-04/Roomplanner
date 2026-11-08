import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { buildApp } from "../server/app.ts";
import { verifyPassword } from "../server/password.ts";

interface StoredUser {
  id: string;
  email: string;
  password_hash: string;
}

function createAuthDatabase() {
  const users = new Map<string, StoredUser>();
  let nextUser = 1;
  const database = {
    async query(sql: string, values: unknown[] = []) {
      const statement = sql.replace(/\s+/g, " ").trim();
      if (statement.startsWith("SELECT id, email FROM app_register_user")) {
        const email = String(values[0]);
        if (users.has(email)) throw Object.assign(new Error("duplicate"), { code: "23505" });
        const user = { id: `user-${nextUser++}`, email, password_hash: String(values[1]) };
        users.set(email, user);
        return { rows: [{ id: user.id, email: user.email }], rowCount: 1 };
      }
      if (statement.startsWith("SELECT id, email, password_hash FROM app_find_user_for_login")) {
        const user = users.get(String(values[0]));
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }
      if (
        statement.startsWith("SELECT app_create_session")
        || statement.startsWith("SELECT app_delete_session")
      ) return { rows: [], rowCount: 0 };
      if (statement === "SELECT 1") return { rows: [{ "?column?": 1 }], rowCount: 1 };
      throw new Error(`Consulta inesperada en la prueba: ${statement}`);
    },
  } as unknown as Pool;
  return { database, users };
}

test("registro y login funcionan desde la vista previa y nunca guardan la contraseña", async (context) => {
  const { database, users } = createAuthDatabase();
  const app = await buildApp({
    frontendOrigins: ["http://127.0.0.1:5173", "http://127.0.0.1:4173"],
    host: "127.0.0.1",
    port: 3001,
  }, database);
  context.after(() => app.close());

  const password = "ocho-123";
  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    headers: { origin: "http://127.0.0.1:4173" },
    payload: { email: " Persona@Example.com ", password },
  });
  assert.equal(registration.statusCode, 201);
  assert.match(registration.headers["set-cookie"] ?? "", /HttpOnly/i);

  const stored = users.get("persona@example.com");
  assert.ok(stored);
  assert.notEqual(stored.password_hash, password);
  assert.equal(stored.password_hash.includes(password), false);
  assert.equal(await verifyPassword(password, stored.password_hash), true);

  const wrongLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: "http://127.0.0.1:4173" },
    payload: { email: "persona@example.com", password: "incorrecta" },
  });
  assert.equal(wrongLogin.statusCode, 401);

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: "http://127.0.0.1:4173" },
    payload: { email: "persona@example.com", password },
  });
  assert.equal(login.statusCode, 200);
  assert.equal(login.json().user.email, "persona@example.com");
});

test("la contraseña exige 8 caracteres y no define un máximo propio", async (context) => {
  const { database } = createAuthDatabase();
  const app = await buildApp({
    frontendOrigins: ["http://127.0.0.1:5173"],
    host: "127.0.0.1",
    port: 3001,
  }, database);
  context.after(() => app.close());

  const tooShort = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "short@example.com", password: "1234567" },
  });
  assert.equal(tooShort.statusCode, 400);

  const longPassword = "frase-segura-".repeat(40);
  const accepted = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "long@example.com", password: longPassword },
  });
  assert.equal(accepted.statusCode, 201);
});
