import { create } from "zustand";
import {
  createEmptyProject,
  projectPayloadSchema,
  type CatalogItem,
  type ObjectInstance,
  type ProjectDocument,
  type ProjectPayload,
  type Room,
} from "@/domain/project";
import { fitInstance } from "./geometry";

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
  startGuest: (title: string, room: Room) => void;
  resumeGuest: () => boolean;
  openAccountProject: (project: ProjectDocument) => void;
  closeProject: () => void;
  setSelected: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  setRoom: (room: Room) => void;
  addCatalogItem: (item: CatalogItem) => void;
  removeCatalogItem: (id: string) => void;
  placeItem: (catalogItemId: string) => void;
  updateInstance: (id: string, patch: Partial<ObjectInstance>) => void;
  removeInstance: (id: string) => void;
  undo: () => void;
  redo: () => void;
}

const guestKey = "roomplannr_guest_project_v1";

function snapshot(project: ProjectDocument): ProjectPayload {
  return {
    title: project.title,
    room: project.room,
    catalog: project.catalog,
    instances: project.instances,
    revision: project.revision,
  };
}

function persistGuest(mode: EditorMode, project: ProjectDocument | null): void {
  if (mode !== "guest" || !project) return;
  try {
    sessionStorage.setItem(guestKey, JSON.stringify(project));
  } catch {
    // El editor sigue funcionando en memoria si el navegador bloquea el almacenamiento.
  }
}

function updatedProject(
  state: EditorState,
  change: (project: ProjectDocument) => ProjectDocument,
): Partial<EditorState> {
  if (!state.project) return {};
  const project = change(state.project);
  if (project === state.project) return {};
  persistGuest(state.mode, project);
  return {
    project,
    dirty: state.mode === "account",
    undoStack: [...state.undoStack.slice(-49), snapshot(state.project)],
    redoStack: [],
  };
}

export function hasGuestProject(): boolean {
  try {
    return Boolean(sessionStorage.getItem(guestKey));
  } catch {
    return false;
  }
}

export function clearGuestProject(): void {
  try {
    sessionStorage.removeItem(guestKey);
  } catch {
    // No hay almacenamiento disponible en esta pestaña.
  }
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: null,
  project: null,
  selectedId: null,
  tool: "translate",
  dirty: false,
  undoStack: [],
  redoStack: [],
  startGuest: (title, room) => {
    const project: ProjectDocument = {
      ...createEmptyProject(title, room),
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    persistGuest("guest", project);
    set({ mode: "guest", project, selectedId: null, dirty: false, undoStack: [], redoStack: [] });
  },
  resumeGuest: () => {
    try {
      const raw = sessionStorage.getItem(guestKey);
      if (!raw) return false;
      const value = JSON.parse(raw) as ProjectDocument;
      const payload = projectPayloadSchema.safeParse(value);
      if (!payload.success || typeof value.id !== "string") return false;
      set({ mode: "guest", project: { ...payload.data, id: value.id, updatedAt: value.updatedAt }, selectedId: null, dirty: false, undoStack: [], redoStack: [] });
      return true;
    } catch {
      return false;
    }
  },
  openAccountProject: (project) => set({
    mode: "account", project, selectedId: null, dirty: false, undoStack: [], redoStack: [],
  }),
  closeProject: () => set({ mode: null, project: null, selectedId: null, dirty: false, undoStack: [], redoStack: [] }),
  setSelected: (selectedId) => set({ selectedId }),
  setTool: (tool) => set({ tool }),
  setRoom: (room) => set((state) => updatedProject(state, (project) => ({
    ...project,
    room,
    instances: project.instances.map((instance) => {
      const item = project.catalog.find((entry) => entry.id === instance.catalogItemId);
      return item ? fitInstance(instance, item, room) : instance;
    }),
  }))),
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
  placeItem: (catalogItemId) => set((state) => {
    if (!state.project?.catalog.some((item) => item.id === catalogItemId)) return {};
    const id = crypto.randomUUID();
    return {
      ...updatedProject(state, (project) => ({
        ...project,
        instances: [...project.instances, fitInstance({
          id, catalogItemId,
          position: [0, 0, 0], rotationY: 0, scale: [1, 1, 1],
        }, project.catalog.find((entry) => entry.id === catalogItemId)!, project.room)],
      })),
      selectedId: id,
    };
  }),
  updateInstance: (id, patch) => set((state) => updatedProject(state, (project) => ({
    ...project,
    instances: project.instances.map((instance) => {
      if (instance.id !== id) return instance;
      const item = project.catalog.find((entry) => entry.id === instance.catalogItemId);
      return item ? fitInstance({ ...instance, ...patch }, item, project.room) : instance;
    }),
  }))),
  removeInstance: (id) => set((state) => ({
    ...updatedProject(state, (project) => ({
      ...project, instances: project.instances.filter((item) => item.id !== id),
    })),
    selectedId: state.selectedId === id ? null : state.selectedId,
  })),
  undo: () => set((state) => {
    if (!state.project || state.undoStack.length === 0) return {};
    const previous = state.undoStack.at(-1)!;
    const project = { ...state.project, ...previous };
    persistGuest(state.mode, project);
    return {
      project,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, snapshot(state.project)],
      dirty: state.mode === "account",
      selectedId: project.instances.some((item) => item.id === state.selectedId) ? state.selectedId : null,
    };
  }),
  redo: () => set((state) => {
    if (!state.project || state.redoStack.length === 0) return {};
    const next = state.redoStack.at(-1)!;
    const project = { ...state.project, ...next };
    persistGuest(state.mode, project);
    return {
      project,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, snapshot(state.project)],
      dirty: state.mode === "account",
      selectedId: project.instances.some((item) => item.id === state.selectedId) ? state.selectedId : null,
    };
  }),
}));
