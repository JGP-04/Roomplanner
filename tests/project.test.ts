import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject, projectPayloadSchema } from "../src/domain/project.ts";
import { fitInstance } from "../src/editor/geometry.ts";

const catalogItem = {
  id: "ea570b62-330d-48b2-8646-64c1ef832b6f",
  name: "Mesa de prueba",
  kind: "box" as const,
  width: 1,
  depth: 0.6,
  height: 0.75,
  color: "#a8795f",
};

test("un proyecto vacío es válido", () => {
  const project = createEmptyProject("Sala", { width: 4, depth: 5, height: 2.7 });
  assert.equal(projectPayloadSchema.safeParse(project).success, true);
});

test("no acepta instancias sin pieza en el catálogo", () => {
  const project = createEmptyProject("Sala", { width: 4, depth: 5, height: 2.7 });
  project.instances.push({
    id: "d766cb6a-6954-441c-9fc6-6f8134e94bfd",
    catalogItemId: catalogItem.id,
    position: [0, 0, 0],
    rotationY: 0,
    scale: [1, 1, 1],
  });
  assert.equal(projectPayloadSchema.safeParse(project).success, false);
});

test("limita un objeto a las dimensiones del ambiente", () => {
  const instance = fitInstance({
    id: "d766cb6a-6954-441c-9fc6-6f8134e94bfd",
    catalogItemId: catalogItem.id,
    position: [20, 0, 20],
    rotationY: 0,
    scale: [1, 1, 1],
  }, catalogItem, { width: 4, depth: 5, height: 2.7 });
  assert.ok(instance.position[0] <= 1.5);
  assert.ok(instance.position[2] <= 2.2);
});
