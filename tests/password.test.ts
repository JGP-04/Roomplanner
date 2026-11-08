import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../server/password.ts";

test("guarda contraseñas con scrypt, salt aleatoria y formato versionado", async () => {
  const password = "una contraseña segura";
  const first = await hashPassword(password);
  const second = await hashPassword(password);

  assert.match(first, /^scrypt\$32768\$8\$1\$/);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("contraseña incorrecta", first), false);
});

test("rechaza hashes malformados sin lanzar errores", async () => {
  assert.equal(await verifyPassword("cualquier contraseña", "texto sin formato"), false);
  assert.equal(await verifyPassword("cualquier contraseña", "scrypt$999999$8$1$salt$hash"), false);
});
