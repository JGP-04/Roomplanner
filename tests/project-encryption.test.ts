import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject } from "../src/domain/project.ts";
import { ProjectEncryption } from "../server/project-encryption.ts";

const keyOne = Buffer.alloc(32, 1).toString("base64");
const keyTwo = Buffer.alloc(32, 2).toString("base64");

test("cifra proyectos con AES-GCM y detecta cambios o un propietario distinto", () => {
  const encryption = ProjectEncryption.fromEnvironment({ DATA_ENCRYPTION_KEY: keyOne }, true);
  assert.ok(encryption);
  const project = createEmptyProject("Casa privada", { width: 4, depth: 5, height: 2.7 });
  const encrypted = encryption.encrypt("project-1", "owner-1", project);

  assert.equal(encrypted.ciphertext.includes(Buffer.from("Casa privada")), false);
  assert.deepEqual(
    encryption.decrypt("project-1", "owner-1", encrypted.ciphertext, encrypted.keyVersion),
    project,
  );
  assert.throws(() => encryption.decrypt("project-1", "owner-2", encrypted.ciphertext, encrypted.keyVersion));

  const changed = Buffer.from(encrypted.ciphertext);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => encryption.decrypt("project-1", "owner-1", changed, encrypted.keyVersion));
});

test("mantiene claves anteriores durante una rotación", () => {
  const oldEncryption = ProjectEncryption.fromEnvironment({ DATA_ENCRYPTION_KEY: keyOne }, true)!;
  const project = createEmptyProject("Rotación", { width: 4, depth: 5, height: 2.7 });
  const oldPayload = oldEncryption.encrypt("project-1", "owner-1", project);
  const rotatingEncryption = ProjectEncryption.fromEnvironment({
    DATA_ENCRYPTION_KEYS: `1:${keyOne},2:${keyTwo}`,
    DATA_ENCRYPTION_KEY_VERSION: "2",
  }, true)!;

  assert.deepEqual(
    rotatingEncryption.decrypt("project-1", "owner-1", oldPayload.ciphertext, oldPayload.keyVersion),
    project,
  );
  assert.equal(rotatingEncryption.encrypt("project-1", "owner-1", project).keyVersion, 2);
});

test("rechaza claves ausentes o con un tamaño inseguro", () => {
  assert.throws(() => ProjectEncryption.fromEnvironment({}, true));
  assert.throws(() => ProjectEncryption.fromEnvironment({ DATA_ENCRYPTION_KEY: "corta" }, true));
});
