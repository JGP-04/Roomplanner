import { create } from "zustand";
import {
  createEmptyProject,
  type CatalogItem,
  type ObjectInstance,
  type ProjectDocument,
  type ProjectPayload,
  type Room,
} from "@/domain/project";
import { findAvailablePlacement, fitInstance, hasInstanceCollision } from "./geometry";
import { getGuestProject, removeGuestProject, saveGuestProject } from "./guest-projects";

type EditorMode = "guest" | "account" | null;
type Tool = "translate" | "rotate" | "scale";

interface EditorState {
  mode: EditorMode;
  project: ProjectDocument | null;
  selectedId: string | null;
  tool: Tool;
  dirty: boolean;
  undoStack: ProjectPayload[];
  redoStack: ProjectPayload[];
  transformSnapshot: ProjectPayload | null;
  startGuest: (title: string, room: Room) => void;
  resumeGuest: (id: string) => boolean;
  openAccountProject: (project: ProjectDocument) => void;
  closeProject: () => void;
  setSelected: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  setRoom: (room: Room) => void;
  addCatalogItem: (item: CatalogItem) => void;
  removeCatalogItem: (id: string) => void;
  placeItem: (catalogItemId: string) => boolean;
  updateInstance: (id: string, patch: Partial<ObjectInstance>) => void;
  beginInstanceTransform: () => void;
  previewInstanceTransform: (id: string, patch: Partial<ObjectInstance>) => void;
  commitInstanceTransform: (id: string, patch: Partial<ObjectInstance>) => void;
  removeInstance: (id: string) => void;
  undo: () => void;
  redo: () => void;
}

function snapshot(project: ProjectDocument): ProjectPayload {
  return {
    title: project.title,
    room: project.room,
    catalog: project.catalog,
    instances: project.instances,
    revision: project.revision,
  };
}

function samePayload(first: ProjectPayload, second: ProjectPayload): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function transformInstance(
  project: ProjectDocument,
  id: string,
  patch: Partial<ObjectInstance>,
  snap = false,
): ProjectDocument {
  const current = project.instances.find((instance) => instance.id === id);
  if (!current) return project;
  const item = project.catalog.find((entry) => entry.id === current.catalogItemId);
  if (!item) return project;
  const candidate = fitInstance({ ...current, ...patch }, item, project.room, snap);
  const occupied = project.instances.flatMap((instance) => {
    if (instance.id === id) return [];
    const occupiedItem = project.catalog.find((entry) => entry.id === instance.catalogItemId);
    return occupiedItem ? [{ instance, item: occupiedItem }] : [];
  });
  const next = hasInstanceCollision(candidate, item, occupied) ? current : candidate;
  if (JSON.stringify(next) === JSON.stringify(current)) return project;
  return {
    ...project,
    instances: project.instances.map((instance) => instance.id === id ? next : instance),
  };
}

function persistGuest(mode: EditorMode, project: ProjectDocument | null): void {
  if (mode !== "guest" || !project) return;
  saveGuestProject(project);
}

function updatedProject(
  state: EditorState,
  change: (project: ProjectDocument) => ProjectDocument,
): Partial<EditorState> {
  if (!state.project) return {};
  const changedProject = change(state.project);
  if (changedProject === state.project || samePayload(snapshot(changedProject), snapshot(state.project))) return {};
  const project = state.mode === "guest"
    ? { ...changedProject, updatedAt: new Date().toISOString() }
    : changedProject;
  persistGuest(state.mode, project);
  return {
    project,
    dirty: state.mode === "account",
    undoStack: [...state.undoStack.slice(-49), snapshot(state.project)],
    redoStack: [],
    transformSnapshot: null,
  };
}

export function clearGuestProject(id: string): void {
  removeGuestProject(id);
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: null,
  project: null,
  selectedId: null,
  tool: "translate",
  dirty: false,
  undoStack: [],
  redoStack: [],
  transformSnapshot: null,
  startGuest: (title, room) => {
    const project: ProjectDocument = {
      ...createEmptyProject(title, room),
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    persistGuest("guest", project);
    set({ mode: "guest", project, selectedId: null, dirty: false, undoStack: [], redoStack: [], transformSnapshot: null });
  },
  resumeGuest: (id) => {
    const project = getGuestProject(id);
    if (!project) return false;
    set({ mode: "guest", project, selectedId: null, dirty: false, undoStack: [], redoStack: [], transformSnapshot: null });
    return true;
  },
  openAccountProject: (project) => set({
    mode: "account", project, selectedId: null, dirty: false, undoStack: [], redoStack: [], transformSnapshot: null,
  }),
  closeProject: () => set({ mode: null, project: null, selectedId: null, dirty: false, undoStack: [], redoStack: [], transformSnapshot: null }),
  setSelected: (selectedId) => set({ selectedId }),
  setTool: (tool) => set({ tool }),
  setRoom: (room) => set((state) => updatedProject(state, (project) => {
    const placed: ObjectInstance[] = [];
    for (const instance of project.instances) {
      const item = project.catalog.find((entry) => entry.id === instance.catalogItemId);
      if (!item) continue;
      const occupied = placed.flatMap((entry) => {
        const occupiedItem = project.catalog.find((catalogItem) => catalogItem.id === entry.catalogItemId);
        return occupiedItem ? [{ instance: entry, item: occupiedItem }] : [];
      });
      const placement = findAvailablePlacement(instance, item, room, occupied);
      if (!placement) return project;
      placed.push(placement);
    }
    return { ...project, room, instances: placed };
  })),
  addCatalogItem: (item) => set((state) => updatedProject(state, (project) => ({
    ...project, catalog: [...project.catalog, item],
  }))),
  removeCatalogItem: (id) => set((state) => ({
    ...updatedProject(state, (project) => ({
      ...project,
      catalog: project.catalog.filter((item) => item.id !== id),
      instances: project.instances.filter((item) => item.catalogItemId !== id),
    })),
    selectedId: state.project?.instances.some((item) => item.catalogItemId === id && item.id === state.selectedId)
      ? null : state.selectedId,
  })),
  placeItem: (catalogItemId) => {
    let placed = false;
    set((state) => {
    const catalogItem = state.project?.catalog.find((item) => item.id === catalogItemId);
    if (!state.project || !catalogItem) return {};
    const id = crypto.randomUUID();
    const occupied = state.project.instances.flatMap((instance) => {
      const item = state.project?.catalog.find((entry) => entry.id === instance.catalogItemId);
      return item ? [{ instance, item }] : [];
    });
    const instance = findAvailablePlacement({
      id, catalogItemId,
      position: [0, 0, 0], rotationY: 0, scale: [1, 1, 1],
    }, catalogItem, state.project.room, occupied);
    if (!instance) return {};
    placed = true;
    return {
      ...updatedProject(state, (project) => ({
        ...project,
        instances: [...project.instances, instance],
      })),
      selectedId: id,
    };
    });
    return placed;
  },
  updateInstance: (id, patch) => set((state) => updatedProject(state, (project) => transformInstance(project, id, patch))),
  beginInstanceTransform: () => set((state) => state.project
    ? { transformSnapshot: snapshot(state.project) }
    : {}),
  previewInstanceTransform: (id, patch) => set((state) => {
    if (!state.project) return {};
    const project = transformInstance(state.project, id, patch);
    return project === state.project ? {} : { project };
  }),
  commitInstanceTransform: (id, patch) => set((state) => {
    if (!state.project) return { transformSnapshot: null };
    const transformedProject = transformInstance(state.project, id, patch, true);
    const previous = state.transformSnapshot ?? snapshot(state.project);
    if (samePayload(previous, snapshot(transformedProject))) return { project: transformedProject, transformSnapshot: null };
    const project = state.mode === "guest"
      ? { ...transformedProject, updatedAt: new Date().toISOString() }
      : transformedProject;
    persistGuest(state.mode, project);
    return {
      project,
      dirty: state.mode === "account",
      undoStack: [...state.undoStack.slice(-49), previous],
      redoStack: [],
      transformSnapshot: null,
    };
  }),
  removeInstance: (id) => set((state) => ({
    ...updatedProject(state, (project) => ({
      ...project, instances: project.instances.filter((item) => item.id !== id),
    })),
    selectedId: state.selectedId === id ? null : state.selectedId,
  })),
  undo: () => set((state) => {
    if (!state.project || state.undoStack.length === 0) return {};
    const previous = state.undoStack.at(-1)!;
    const restoredProject = { ...state.project, ...previous };
    const project = state.mode === "guest"
      ? { ...restoredProject, updatedAt: new Date().toISOString() }
      : restoredProject;
    persistGuest(state.mode, project);
    return {
      project,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, snapshot(state.project)],
      dirty: state.mode === "account",
      selectedId: project.instances.some((item) => item.id === state.selectedId) ? state.selectedId : null,
      transformSnapshot: null,
    };
  }),
  redo: () => set((state) => {
    if (!state.project || state.redoStack.length === 0) return {};
    const next = state.redoStack.at(-1)!;
    const restoredProject = { ...state.project, ...next };
    const project = state.mode === "guest"
      ? { ...restoredProject, updatedAt: new Date().toISOString() }
      : restoredProject;
    persistGuest(state.mode, project);
    return {
      project,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, snapshot(state.project)],
      dirty: state.mode === "account",
      selectedId: project.instances.some((item) => item.id === state.selectedId) ? state.selectedId : null,
      transformSnapshot: null,
    };
  }),
}));
