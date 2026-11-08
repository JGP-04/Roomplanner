import { projectPayloadSchema, type ProjectDocument } from "@/domain/project";

const storageKey = "roomplannr_guest_projects_v2";
const legacyStorageKey = "roomplannr_guest_project_v1";
const storageVersion = 2;

interface GuestProjectsEnvelope {
  version: typeof storageVersion;
  projects: ProjectDocument[];
}

function browserLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function browserSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function parseProject(value: unknown): ProjectDocument | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<ProjectDocument>;
  const payload = projectPayloadSchema.safeParse(candidate);
  if (
    !payload.success
    || typeof candidate.id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate.id)
    || typeof candidate.updatedAt !== "string"
    || !Number.isFinite(Date.parse(candidate.updatedAt))
  ) {
    return null;
  }
  return { ...payload.data, id: candidate.id, updatedAt: candidate.updatedAt };
}

function parseProjects(raw: string | null): ProjectDocument[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as Partial<GuestProjectsEnvelope>;
    if (value.version !== storageVersion || !Array.isArray(value.projects)) return [];
    return value.projects.flatMap((project) => {
      const parsed = parseProject(project);
      return parsed ? [parsed] : [];
    });
  } catch {
    return [];
  }
}

function writeProjects(storage: Storage, projects: ProjectDocument[]): void {
  const envelope: GuestProjectsEnvelope = { version: storageVersion, projects };
  storage.setItem(storageKey, JSON.stringify(envelope));
}

function migrateLegacyProject(storage: Storage, legacyStorage: Storage | null): ProjectDocument[] {
  const projects = parseProjects(storage.getItem(storageKey));
  const legacySources = [storage, legacyStorage].filter((source): source is Storage => source !== null);
  let changed = false;

  for (const source of legacySources) {
    const raw = source.getItem(legacyStorageKey);
    if (!raw) continue;
    try {
      const project = parseProject(JSON.parse(raw));
      if (project && !projects.some((current) => current.id === project.id)) {
        projects.push(project);
        changed = true;
      }
      source.removeItem(legacyStorageKey);
    } catch {
      source.removeItem(legacyStorageKey);
    }
  }

  if (changed) writeProjects(storage, projects);
  return projects;
}

export function listGuestProjects(
  storage: Storage | null = browserLocalStorage(),
  legacyStorage: Storage | null = browserSessionStorage(),
): ProjectDocument[] {
  if (!storage) return [];
  try {
    return migrateLegacyProject(storage, legacyStorage)
      .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
  } catch {
    return [];
  }
}

export function getGuestProject(
  id: string,
  storage: Storage | null = browserLocalStorage(),
): ProjectDocument | null {
  return listGuestProjects(storage, null).find((project) => project.id === id) ?? null;
}

export function saveGuestProject(
  project: ProjectDocument,
  storage: Storage | null = browserLocalStorage(),
): boolean {
  if (!storage) return false;
  const parsed = parseProject(project);
  if (!parsed) return false;
  try {
    const projects = listGuestProjects(storage, null).filter((current) => current.id !== parsed.id);
    writeProjects(storage, [parsed, ...projects]);
    return true;
  } catch {
    return false;
  }
}

export function removeGuestProject(
  id: string,
  storage: Storage | null = browserLocalStorage(),
): void {
  if (!storage) return;
  try {
    const projects = listGuestProjects(storage, null).filter((project) => project.id !== id);
    writeProjects(storage, projects);
  } catch {
    // El navegador puede bloquear localStorage; el proyecto seguirá abierto en memoria.
  }
}
