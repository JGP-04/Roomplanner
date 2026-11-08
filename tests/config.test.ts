import assert from "node:assert/strict";
import test from "node:test";
import { readServerConfig } from "../server/config.ts";

test("acepta y normaliza varios orígenes de frontend", () => {
  const config = readServerConfig({
    FRONTEND_ORIGINS: "http://127.0.0.1:5173, https://roomplannr.example/",
    PORT: "3001",
  });

  assert.deepEqual(config.frontendOrigins, ["http://127.0.0.1:5173", "https://roomplannr.example"]);
  assert.equal(config.port, 3001);
});

test("rechaza puertos y orígenes inválidos", () => {
  assert.throws(() => readServerConfig({ FRONTEND_ORIGIN: "no es una URL" }));
  assert.throws(() => readServerConfig({ FRONTEND_ORIGIN: "https://roomplannr.example", PORT: "70000" }));
});

test("exige un origen explícito en producción", () => {
  assert.throws(() => readServerConfig({ NODE_ENV: "production" }));
});

test("exige HTTPS para el frontend de producción", () => {
  assert.throws(() => readServerConfig({ NODE_ENV: "production", FRONTEND_ORIGIN: "http://roomplannr.example" }));
  assert.equal(
    readServerConfig({ NODE_ENV: "production", FRONTEND_ORIGIN: "https://roomplannr.example" }).frontendOrigins[0],
    "https://roomplannr.example",
  );
});
