import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Box, Check, FolderOpen, LogIn, LogOut, Move3D, Plus, Redo2, Rotate3D, Save, Scaling, Trash2, Undo2 } from "lucide-react";
import { EditorSetupSkeleton, ProjectGridSkeleton, ViewportSkeleton } from "@/components/editor-skeleton";
import { Button } from "@/components/ui/button";
import { catalogItemSchema, projectPayloadSchema, roomSchema, type CatalogItem, type ObjectInstance, type ProjectDocument, type ProjectPayload, type ProjectSummary, type Room } from "@/domain/project";
import { api, type AccountUser } from "./api";
import { centimetersToMeters, metersToCentimeters } from "./geometry";
import { listGuestProjects } from "./guest-projects";
import { clearGuestProject, useEditorStore } from "./store";
import "./editor.css";

const SceneViewport = lazy(() => import("./SceneViewport").then((module) => ({ default: module.SceneViewport })));

function parseNumberDraft(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface NewProjectFormProps {
  onCreate: (title: string, room: Room) => Promise<void>;
  busy: boolean;
}

function NewProjectForm({ onCreate, busy }: NewProjectFormProps) {
  const [title, setTitle] = useState("Mi espacio");
  const [width, setWidth] = useState("400");
  const [depth, setDepth] = useState("500");
  const [height, setHeight] = useState("270");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const measurements = [width, depth, height].map(parseNumberDraft);
    const result = measurements.every((value): value is number => value !== null)
      ? roomSchema.safeParse({
        width: centimetersToMeters(measurements[0]),
        depth: centimetersToMeters(measurements[1]),
        height: centimetersToMeters(measurements[2]),
      })
      : null;
    if (!title.trim() || !result?.success) {
      setError("Introduce un nombre y medidas entre 5 cm y 100 m.");
      return;
    }
    setError("");
    await onCreate(title.trim(), result.data);
  }

  return (
    <form className="setup-form" onSubmit={submit} noValidate>
      <label>Nombre del proyecto<input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} required /></label>
      <div className="field-grid">
        <label>Ancho · cm<input type="number" min={5} max={10000} step={1} value={width} onChange={(event) => setWidth(event.target.value)} /></label>
        <label>Largo · cm<input type="number" min={5} max={10000} step={1} value={depth} onChange={(event) => setDepth(event.target.value)} /></label>
        <label>Alto · cm<input type="number" min={5} max={10000} step={1} value={height} onChange={(event) => setHeight(event.target.value)} /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" disabled={busy} aria-busy={busy}>
        Crear y abrir editor <Plus size={17} aria-hidden="true" />
      </Button>
    </form>
  );
}

interface AuthFormProps {
  onSuccess: (user: AccountUser) => Promise<void>;
  onCancel: () => void;
}

function AuthForm({ onSuccess, onCancel }: AuthFormProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Introduce un correo electrónico válido.");
      setBusy(false);
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      setBusy(false);
      return;
    }
    if (isRegistering && password !== passwordConfirmation) {
      setError("Las contraseñas no coinciden.");
      setBusy(false);
      return;
    }
    try {
      const result = isRegistering
        ? await api.register(normalizedEmail, password)
        : await api.login(normalizedEmail, password);
      await onSuccess(result.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="panel-heading">
        <div><p className="eyebrow">Proyectos persistentes</p><h2>{isRegistering ? "Crear cuenta" : "Iniciar sesión"}</h2></div>
        <button type="button" className="quiet-button" onClick={onCancel}>Cerrar</button>
      </div>
      <p>Guarda tus proyectos en tu cuenta para volver a abrirlos desde otra sesión.</p>
      <form className="setup-form" onSubmit={submit} noValidate>
        <label>Correo electrónico<input type="email" autoComplete="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Contraseña<input type="password" autoComplete={isRegistering ? "new-password" : "current-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {isRegistering && <>
          <small className="password-hint">Usa al menos 8 caracteres.</small>
          <label>Repetir contraseña<input type="password" autoComplete="new-password" minLength={8} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required /></label>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{isRegistering ? "Crear cuenta" : "Entrar"}</Button>
      </form>
      <button className="text-button" type="button" onClick={() => { setIsRegistering(!isRegistering); setPasswordConfirmation(""); setError(""); }}>
        {isRegistering ? "Ya tengo cuenta" : "Quiero crear una cuenta"}
      </button>
    </div>
  );
}

function CatalogForm({ onAdd }: { onAdd: (item: CatalogItem) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CatalogItem["kind"]>("box");
  const [width, setWidth] = useState("100");
  const [depth, setDepth] = useState("60");
  const [height, setHeight] = useState("75");
  const [color, setColor] = useState("#a8795f");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const measurements = [width, depth, height].map(parseNumberDraft);
    const result = measurements.every((value): value is number => value !== null)
      ? catalogItemSchema.safeParse({
        id: crypto.randomUUID(), name, kind,
        width: centimetersToMeters(measurements[0]),
        depth: centimetersToMeters(measurements[1]),
        height: centimetersToMeters(measurements[2]), color,
      })
      : null;
    if (!result?.success) {
      setError("Indica un nombre y medidas entre 5 cm y 100 m.");
      return;
    }
    onAdd(result.data);
    setName("");
    setError("");
  }

  return (
    <form className="catalog-form" onSubmit={submit} noValidate>
      <label>Nombre<input placeholder="Ej. Mesa de comedor" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required /></label>
      <label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value as CatalogItem["kind"])}>
        <option value="box">Volumen</option><option value="table">Mesa</option><option value="shelf">Estantería</option>
      </select></label>
      <div className="field-grid compact-grid">
        <label>Ancho · cm<input type="number" min={5} max={10000} value={width} onChange={(event) => setWidth(event.target.value)} /></label>
        <label>Fondo · cm<input type="number" min={5} max={10000} value={depth} onChange={(event) => setDepth(event.target.value)} /></label>
        <label>Alto · cm<input type="number" min={5} max={10000} value={height} onChange={(event) => setHeight(event.target.value)} /></label>
      </div>
      <label className="color-label">Color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" size="sm">Añadir objeto <Plus size={16} aria-hidden="true" /></Button>
    </form>
  );
}

function NumberField({ label, value, min, max, step = 1, onCommit }: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const number = parseNumberDraft(draft);
    if (number !== null && (min === undefined || number >= min) && (max === undefined || number <= max)) onCommit(number);
    else setDraft(String(value));
  }
  return <label>{label}<input type="number" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>;
}

function PropertiesPanel({ project, selected }: { project: ProjectDocument; selected: ObjectInstance | null }) {
  const setRoom = useEditorStore((state) => state.setRoom);
  const updateInstance = useEditorStore((state) => state.updateInstance);
  const removeInstance = useEditorStore((state) => state.removeInstance);
  const item = project.catalog.find((entry) => entry.id === selected?.catalogItemId);

  return (
    <aside className="editor-properties" aria-label="Propiedades">
      <h2 className="panel-title">Propiedades</h2>
      {selected && item ? (
        <div className="properties-content" key={selected.id}>
          <h3>{item.name}</h3>
          <p className="subtle-text">{metersToCentimeters(item.width * selected.scale[0])} × {metersToCentimeters(item.depth * selected.scale[2])} × {metersToCentimeters(item.height * selected.scale[1])} cm · {item.kind === "box" ? "Volumen" : item.kind === "table" ? "Mesa" : "Estantería"}</p>
          <h4>Dimensiones</h4>
          <div className="field-grid compact-grid">
            {([
              ["Ancho", 0, item.width],
              ["Fondo", 2, item.depth],
              ["Alto", 1, item.height],
            ] as const).map(([label, index, base]) => <NumberField key={label} label={`${label} · cm`} value={metersToCentimeters(base * selected.scale[index])} min={5} max={10000} step={1} onCommit={(value) => {
              const scale: [number, number, number] = [...selected.scale];
              scale[index] = centimetersToMeters(value) / base;
              updateInstance(selected.id, { scale });
            }} />)}
          </div>
          <h4>Posición</h4>
          <div className="field-grid compact-grid">
            {(["X", "Y", "Z"] as const).map((axis, index) => <NumberField key={axis} label={`${axis} · cm`} value={metersToCentimeters(selected.position[index])} step={1} onCommit={(value) => {
              const position: [number, number, number] = [...selected.position];
              position[index] = centimetersToMeters(value);
              updateInstance(selected.id, { position });
            }} />)}
          </div>
          <h4>Rotación y escala</h4>
          <NumberField label="Giro · grados" value={Math.round(selected.rotationY * 180 / Math.PI)} step={1} onCommit={(value) => updateInstance(selected.id, { rotationY: value * Math.PI / 180 })} />
          <div className="field-grid compact-grid">
            {(["X", "Y", "Z"] as const).map((axis, index) => <NumberField key={axis} label={`Escala ${axis}`} value={selected.scale[index]} min={0.1} max={10} step={0.1} onCommit={(value) => {
              const scale: [number, number, number] = [...selected.scale];
              scale[index] = value;
              updateInstance(selected.id, { scale });
            }} />)}
          </div>
          <button type="button" className="danger-button" onClick={() => removeInstance(selected.id)}>Quitar del ambiente</button>
        </div>
      ) : (
        <div className="properties-content">
          <h3>Ambiente</h3>
          <p className="subtle-text">Selecciona un objeto para editarlo.</p>
          <h4>Medidas del espacio</h4>
          <div className="field-grid compact-grid">
            {(["width", "depth", "height"] as const).map((key) => <NumberField key={key} label={`${key === "width" ? "Ancho" : key === "depth" ? "Largo" : "Alto"} · cm`} value={metersToCentimeters(project.room[key])} min={5} max={10000} onCommit={(value) => {
              const room = roomSchema.safeParse({ ...project.room, [key]: centimetersToMeters(value) });
              if (room.success) setRoom(room.data);
            }} />)}
          </div>
        </div>
      )}
    </aside>
  );
}

export default function EditorPage() {
  const project = useEditorStore((state) => state.project);
  const mode = useEditorStore((state) => state.mode);
  const dirty = useEditorStore((state) => state.dirty);
  const selectedId = useEditorStore((state) => state.selectedId);
  const tool = useEditorStore((state) => state.tool);
  const undoCount = useEditorStore((state) => state.undoStack.length);
  const redoCount = useEditorStore((state) => state.redoStack.length);
  const store = useEditorStore.getState;
  const [user, setUser] = useState<AccountUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [serverAvailable, setServerAvailable] = useState(true);
  const [guestProjects, setGuestProjects] = useState(listGuestProjects);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const result = await api.projects();
      setProjects(result.projects);
      setServerAvailable(true);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudieron cargar los proyectos");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    api.me().then(({ user: currentUser }) => {
      setUser(currentUser);
      setServerAvailable(true);
      if (currentUser) void loadProjects();
    }).catch(() => {
      setServerAvailable(false);
    }).finally(() => setCheckingSession(false));
  }, [loadProjects]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!project) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store().redo(); else store().undo();
      } else if (event.key === "Delete" && store().selectedId) {
        store().removeInstance(store().selectedId!);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [project, store]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [project?.id]);

  async function createProject(title: string, room: Room) {
    setBusy(true);
    setMessage("");
    try {
      if (user) {
        const payload: ProjectPayload = { title, room, catalog: [], instances: [], revision: 0 };
        const result = await api.createProject(payload);
        store().openAccountProject(result.project);
        await loadProjects();
      } else {
        store().startGuest(title, room);
        setGuestProjects(listGuestProjects());
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo crear el proyecto");
    } finally {
      setBusy(false);
    }
  }

  async function authenticated(account: AccountUser) {
    setUser(account);
    setServerAvailable(true);
    setShowAuth(false);
    const guest = store().mode === "guest" ? store().project : null;
    if (guest) {
      try {
        const payload = projectPayloadSchema.parse(guest);
        const result = await api.createProject({ ...payload, revision: 0 });
        store().openAccountProject(result.project);
        clearGuestProject(guest.id);
        setGuestProjects(listGuestProjects());
        setMessage("Tu diseño invitado quedó guardado en tu cuenta.");
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "No se pudo guardar el diseño invitado");
      }
    }
    await loadProjects();
  }

  async function openProject(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api.project(id);
      store().openAccountProject(result.project);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo abrir el proyecto");
    } finally {
      setBusy(false);
    }
  }

  async function saveProject() {
    const current = store().project;
    if (!current) return;
    if (!user) { setShowAuth(true); return; }
    setBusy(true);
    setMessage("");
    try {
      const payload = projectPayloadSchema.parse(current);
      const result = mode === "guest"
        ? await api.createProject({ ...payload, revision: 0 })
        : await api.saveProject(current.id, payload);
      store().openAccountProject(result.project);
      if (mode === "guest") {
        clearGuestProject(current.id);
        setGuestProjects(listGuestProjects());
      }
      setMessage("Proyecto guardado en tu cuenta.");
      await loadProjects();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo guardar el proyecto");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Salir de la cuenta de todos modos?")) return;
    try {
      await api.logout();
      setUser(null);
      setProjects([]);
      store().closeProject();
      setMessage("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo cerrar sesión");
    }
  }

  function backToProjects() {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Volver de todos modos?")) return;
    store().closeProject();
    setGuestProjects(listGuestProjects());
    if (user) void loadProjects();
  }

  function openGuestProject(id: string) {
    if (!store().resumeGuest(id)) {
      setGuestProjects(listGuestProjects());
      setMessage("El proyecto local ya no está disponible.");
    }
  }

  function deleteGuestProject(id: string) {
    if (!window.confirm("¿Eliminar este proyecto guardado en el navegador?")) return;
    clearGuestProject(id);
    setGuestProjects(listGuestProjects());
  }

  const selected = project?.instances.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="editor-page">
      <header className="editor-header">
        <a href="/" className="wordmark" aria-label="ROOMPLANNR, volver al inicio">ROOM<span>PLANNR</span></a>
        {project ? <p className="editor-project-title">{project.title} <span>· {mode === "guest" ? "Invitado" : "Mi cuenta"}</span></p> : <p className="editor-project-title">Estudio de diseño</p>}
        <div className="editor-header-actions">
          {project && <button type="button" className="quiet-button" onClick={backToProjects}><FolderOpen size={17} aria-hidden="true" /> <span>Proyectos</span></button>}
          {project && <Button className="editor-save-button" size="sm" onClick={saveProject} disabled={busy || (mode === "account" && !dirty)} aria-busy={busy} aria-label={mode === "guest" ? "Guardar en mi cuenta" : dirty ? "Guardar cambios" : "Proyecto guardado"}><Save size={16} aria-hidden="true" /> <span className="save-label-long">{mode === "guest" ? "Guardar en mi cuenta" : dirty ? "Guardar cambios" : "Guardado"}</span><span className="save-label-short">Guardar</span></Button>}
          {!project && user && <button type="button" className="quiet-button" onClick={logout}><LogOut size={17} aria-hidden="true" /> Salir</button>}
        </div>
      </header>

      {message && <div className="editor-message" role="status">{message}<button type="button" onClick={() => setMessage("")} aria-label="Cerrar aviso">×</button></div>}

      {showAuth && <div className="auth-overlay"><AuthForm onSuccess={authenticated} onCancel={() => setShowAuth(false)} /></div>}

      {checkingSession && !project ? <EditorSetupSkeleton showHeader={false} /> : project ? (
        <div className="editor-layout">
          <aside className="editor-sidebar" aria-label="Herramientas y catálogo">
            <button className="back-link" type="button" onClick={backToProjects}><ArrowLeft size={17} aria-hidden="true" /> Todos los proyectos</button>
            <div className="editor-side-section">
              <h2 className="panel-title">Herramientas</h2>
              <div className="tool-row" role="group" aria-label="Transformar objeto">
                {([
                  ["translate", Move3D, "Mover"],
                  ["rotate", Rotate3D, "Rotar"],
                  ["scale", Scaling, "Escalar"],
                ] as const).map(([value, Icon, label]) => <button key={value} type="button" className={tool === value ? "tool-button active" : "tool-button"} onClick={() => store().setTool(value)} aria-pressed={tool === value}><Icon size={18} aria-hidden="true" />{label}</button>)}
              </div>
              <div className="history-row">
                <button type="button" disabled={!undoCount} onClick={() => store().undo()}><Undo2 size={16} aria-hidden="true" /> Deshacer</button>
                <button type="button" disabled={!redoCount} onClick={() => store().redo()}><Redo2 size={16} aria-hidden="true" /> Rehacer</button>
              </div>
            </div>
            <div className="editor-side-section">
              <h2 className="panel-title">Catálogo</h2>
              <div className="catalog-list">
                {project.catalog.length === 0 && <p className="empty-note">Crea un objeto para colocarlo en el ambiente.</p>}
                {project.catalog.map((item) => <div className="catalog-row" key={item.id}>
                  <span className="catalog-swatch" style={{ backgroundColor: item.color }} aria-hidden="true"><Box size={16} /></span>
                  <span><strong>{item.name}</strong><small>{metersToCentimeters(item.width)} × {metersToCentimeters(item.depth)} × {metersToCentimeters(item.height)} cm</small></span>
                  <button type="button" onClick={() => {
                    if (!store().placeItem(item.id)) setMessage("No hay espacio libre para colocar este objeto sin superponerlo.");
                    else setMessage("");
                  }} aria-label={`Colocar ${item.name}`} title={`Colocar ${item.name}`}><Plus size={18} /></button>
                </div>)}
              </div>
            </div>
            <div className="editor-side-section">
              <h2 className="panel-title">Nuevo objeto</h2>
              <CatalogForm onAdd={(item) => store().addCatalogItem(item)} />
            </div>
          </aside>

          <main className="editor-main">
            <div className="canvas-toolbar">
              <span><Check size={16} aria-hidden="true" /> Ambiente {metersToCentimeters(project.room.width)} × {metersToCentimeters(project.room.depth)} × {metersToCentimeters(project.room.height)} cm</span>
              <span>{mode === "guest" ? "Guardado en este navegador" : dirty ? "Cambios sin guardar" : "Todos los cambios guardados"}</span>
            </div>
            <Suspense fallback={<ViewportSkeleton />}>
              <SceneViewport project={project} />
            </Suspense>
          </main>

          <PropertiesPanel project={project} selected={selected} />
        </div>
      ) : (
        <main className="editor-setup">
          <div className="setup-intro">
            <h1>Diseña tu ambiente a escala.</h1>
            <p>Define sus medidas y abre el editor 3D. No necesitas una cuenta para empezar; tus proyectos quedarán guardados en este navegador.</p>
          </div>
          <div className="setup-card">
            <div className="panel-heading"><h2>Nuevo ambiente</h2></div>
            <NewProjectForm onCreate={createProject} busy={busy} />
            {!user && <button type="button" className="login-link" onClick={() => setShowAuth(true)}><LogIn size={17} /> Iniciar sesión para guardar proyectos</button>}
            {!serverAvailable && <p className="server-note">El guardado en cuenta no está disponible ahora. Puedes seguir en modo invitado.</p>}
          </div>
          {!user && guestProjects.length > 0 && <section className="project-library" aria-labelledby="guest-library-title">
            <div className="library-heading"><h2 id="guest-library-title">Proyectos en este navegador</h2><span>Persisten aunque cierres la pestaña</span></div>
            <div className="project-grid">
              {guestProjects.map((item) => <div className="guest-project-card" key={item.id}>
                <button type="button" className="project-card" onClick={() => openGuestProject(item.id)}><FolderOpen size={22} aria-hidden="true" /><strong>{item.title}</strong><small>Actualizado {new Date(item.updatedAt).toLocaleDateString("es-AR")}</small></button>
                <button type="button" className="guest-project-delete" onClick={() => deleteGuestProject(item.id)} aria-label={`Eliminar ${item.title}`} title={`Eliminar ${item.title}`}><Trash2 size={16} aria-hidden="true" /></button>
              </div>)}
            </div>
          </section>}
          {user && <section className="project-library" aria-labelledby="library-title">
            <div className="library-heading"><h2 id="library-title">Mis proyectos</h2><span>{user.email}</span></div>
            {projectsLoading ? <ProjectGridSkeleton /> : projects.length === 0 ? <p className="empty-note">Todavía no tienes proyectos guardados.</p> : <div className="project-grid">
              {projects.map((item) => <button type="button" className="project-card" key={item.id} onClick={() => openProject(item.id)} disabled={busy}><FolderOpen size={22} aria-hidden="true" /><strong>{item.title}</strong><small>Actualizado {new Date(item.updatedAt).toLocaleDateString("es-AR")}</small></button>)}
            </div>}
          </section>}
        </main>
      )}
    </div>
  );
}
