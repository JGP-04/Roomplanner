import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject, type ProjectDocument } from "../src/domain/project.ts";
import {
  getGuestProject,
  listGuestProjects,
  removeGuestProject,
  saveGuestProject,
} from "../src/editor/guest-projects.ts";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function project(id: string, title: string, updatedAt: string): ProjectDocument {
  return {
    ...createEmptyProject(title, { width: 4, depth: 5, height: 2.7 }),
    id,
    updatedAt,
  };
}

test("localStorage conserva varios proyectos invitados y los ordena por actualización", () => {
  const storage = new MemoryStorage();
  const first = project("f121c9c5-f39a-4209-b602-a1a680beb456", "Sala", "2026-01-01T00:00:00.000Z");
  const second = project("22c1a986-20ec-4a44-9420-e446de4e2db6", "Dormitorio", "2026-02-01T00:00:00.000Z");

  assert.equal(saveGuestProject(first, storage), true);
  assert.equal(saveGuestProject(second, storage), true);
  assert.deepEqual(listGuestProjects(storage, null).map((item) => item.title), ["Dormitorio", "Sala"]);
  assert.deepEqual(getGuestProject(first.id, storage), first);
});

test("actualiza y elimina un proyecto invitado sin afectar a los demás", () => {
  const storage = new MemoryStorage();
  const first = project("f121c9c5-f39a-4209-b602-a1a680beb456", "Sala", "2026-01-01T00:00:00.000Z");
  const second = project("22c1a986-20ec-4a44-9420-e446de4e2db6", "Dormitorio", "2026-02-01T00:00:00.000Z");
  saveGuestProject(first, storage);
  saveGuestProject(second, storage);
  saveGuestProject({ ...first, title: "Sala nueva", updatedAt: "2026-03-01T00:00:00.000Z" }, storage);

  assert.equal(listGuestProjects(storage, null).length, 2);
  assert.equal(getGuestProject(first.id, storage)?.title, "Sala nueva");
  removeGuestProject(first.id, storage);
  assert.deepEqual(listGuestProjects(storage, null).map((item) => item.id), [second.id]);
});

test("migra el proyecto legado de sessionStorage al contenedor local versionado", () => {
  const storage = new MemoryStorage();
  const legacyStorage = new MemoryStorage();
  const legacy = project("f121c9c5-f39a-4209-b602-a1a680beb456", "Proyecto legado", "2026-01-01T00:00:00.000Z");
  legacyStorage.setItem("roomplannr_guest_project_v1", JSON.stringify(legacy));

  assert.deepEqual(listGuestProjects(storage, legacyStorage), [legacy]);
  assert.equal(legacyStorage.getItem("roomplannr_guest_project_v1"), null);
  assert.deepEqual(listGuestProjects(storage, null), [legacy]);
});

test("descarta entradas locales corruptas", () => {
  const storage = new MemoryStorage();
  storage.setItem("roomplannr_guest_projects_v2", JSON.stringify({
    version: 2,
    projects: [{ id: "no-es-uuid", title: "Inválido" }],
  }));

  assert.deepEqual(listGuestProjects(storage, null), []);
});
