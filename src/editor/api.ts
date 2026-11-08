import type { ProjectDocument, ProjectPayload, ProjectSummary } from "@/domain/project";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export interface AccountUser {
  id: string;
  email: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      credentials: "include",
      signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", ...init.headers },
      ...init,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new Error("El servidor tardó demasiado en responder.");
    }
    throw new Error("No se pudo conectar con el servidor de ROOMPLANNR.");
  }
  const body = await response.json().catch(() => ({})) as { error?: unknown };
  if (!response.ok) {
    throw new Error(typeof body.error === "string"
      ? body.error
      : response.status >= 500
        ? "El servidor de cuentas no está disponible."
        : "No se pudo completar la operación");
  }
  return body as T;
}

export const api = {
  me: () => request<{ user: AccountUser | null }>("/auth/me"),
  login: (email: string, password: string) =>
    request<{ user: AccountUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<{ user: AccountUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  projects: () => request<{ projects: ProjectSummary[] }>("/projects"),
  project: (id: string) => request<{ project: ProjectDocument }>(`/projects/${id}`),
  createProject: (payload: ProjectPayload) =>
    request<{ project: ProjectDocument }>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  saveProject: (id: string, payload: ProjectPayload) =>
    request<{ project: ProjectDocument }>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};
