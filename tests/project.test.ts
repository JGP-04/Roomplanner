import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject, projectPayloadSchema } from "../src/domain/project.ts";
import { findAvailablePlacement, fitInstance, instancesOverlap } from "../src/editor/geometry.ts";
import { useEditorStore } from "../src/editor/store.ts";

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

test("acepta silla y sillón como tipos de objeto predeterminados", () => {
  for (const kind of ["chair", "armchair"] as const) {
    const project = createEmptyProject("Sala", { width: 4, depth: 5, height: 2.7 });
    project.catalog.push({ ...catalogItem, id: crypto.randomUUID(), kind });
    assert.equal(projectPayloadSchema.safeParse(project).success, true);
  }
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

test("coloca objetos en posiciones libres y dentro del ambiente", () => {
  const room = { width: 4, depth: 5, height: 2.7 };
  const first = findAvailablePlacement({
    id: "d766cb6a-6954-441c-9fc6-6f8134e94bfd",
    catalogItemId: catalogItem.id,
    position: [0, 0, 0],
    rotationY: 0,
    scale: [1, 1, 1],
  }, catalogItem, room, []);
  assert.ok(first);
  const second = findAvailablePlacement({
    id: "4c4dfbbb-9df7-4213-845d-142a2e1e4f0d",
    catalogItemId: catalogItem.id,
    position: [0, 0, 0],
    rotationY: 0,
    scale: [1, 1, 1],
  }, catalogItem, room, [{ instance: first, item: catalogItem }]);
  assert.ok(second);
  assert.equal(instancesOverlap(first, catalogItem, second, catalogItem), false);
  assert.ok(second.position[0] >= -room.width / 2 + catalogItem.width / 2);
  assert.ok(second.position[0] <= room.width / 2 - catalogItem.width / 2);
  assert.ok(second.position[2] >= -room.depth / 2 + catalogItem.depth / 2);
  assert.ok(second.position[2] <= room.depth / 2 - catalogItem.depth / 2);
});

test("una transformación se confirma una sola vez y admite deshacer y rehacer", () => {
  const instance = {
    id: "d766cb6a-6954-441c-9fc6-6f8134e94bfd",
    catalogItemId: catalogItem.id,
    position: [0, 0, 0] as [number, number, number],
    rotationY: 0,
    scale: [1, 1, 1] as [number, number, number],
  };
  useEditorStore.getState().openAccountProject({
    ...createEmptyProject("Sala", { width: 4, depth: 5, height: 2.7 }),
    id: "f121c9c5-f39a-4209-b602-a1a680beb456",
    updatedAt: new Date(0).toISOString(),
    catalog: [catalogItem],
    instances: [instance],
  });
  useEditorStore.getState().beginInstanceTransform();
  useEditorStore.getState().previewInstanceTransform(instance.id, { position: [1, 0, 0] });
  assert.equal(useEditorStore.getState().project?.instances[0].position[0], 1);
  assert.equal(useEditorStore.getState().undoStack.length, 0);
  useEditorStore.getState().commitInstanceTransform(instance.id, { position: [1, 0, 0] });
  assert.equal(useEditorStore.getState().undoStack.length, 1);
  useEditorStore.getState().undo();
  assert.equal(useEditorStore.getState().project?.instances[0].position[0], 0);
  useEditorStore.getState().redo();
  assert.equal(useEditorStore.getState().project?.instances[0].position[0], 1);
});
