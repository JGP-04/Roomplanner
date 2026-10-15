import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Box, Check, Cloud, FolderOpen, LogIn, LogOut, Move3D, Plus, Redo2, Rotate3D, Save, Scaling, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { catalogItemSchema, projectPayloadSchema, roomSchema, type CatalogItem, type ObjectInstance, type ProjectDocument, type ProjectPayload, type ProjectSummary, type Room } from "@/domain/project";
import { api, type AccountUser } from "./api";
import { centimetersToMeters, metersToCentimeters } from "./geometry";
import { clearGuestProject, hasGuestProject, useEditorStore } from "./store";
import "./editor.css";

const SceneViewport = lazy(() => import("./SceneViewport").then((module) => ({ default: module.SceneViewport })));

interface NewProjectFormProps {
  onCreate: (title: string, room: Room) => Promise<void>;
  busy: boolean;
}

function NewProjectForm({ onCreate, busy }: NewProjectFormProps) {
  const [title, setTitle] = useState("Mi espacio");
  const [width, setWidth] = useState(400);
  const [depth, setDepth] = useState(500);
  const [height, setHeight] = useState(270);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = roomSchema.safeParse({
      width: centimetersToMeters(width),
      depth: centimetersToMeters(depth),
      height: centimetersToMeters(height),
    });
    if (!title.trim() || !result.success) {
      setError("Introduce un nombre y medidas entre 5 cm y 100 m.");
      return;
    }
    setError("");
    await onCreate(title.trim(), result.data);
  }

  return (
    <form className="setup-form" onSubmit={submit}>
      <label>Nombre del proyecto<input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} required /></label>
      <div className="field-grid">
        <label>Ancho · cm<input type="number" min={5} max={10000} step={1} value={width} onChange={(event) => setWidth(Number(event.target.value))} required /></label>
        <label>Largo · cm<input type="number" min={5} max={10000} step={1} value={depth} onChange={(event) => setDepth(Number(event.target.value))} required /></label>
        <label>Alto · cm<input type="number" min={5} max={10000} step={1} value={height} onChange={(event) => setHeight(Number(event.target.value))} required /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>Crear ambiente <Plus size={17} aria-hidden="true" /></Button>
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = isRegistering
        ? await api.register(email, password)
        : await api.login(email, password);
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
      <form className="setup-form" onSubmit={submit}>
        <label>Correo electrónico<input type="email" autoComplete="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Contraseña<input type="password" autoComplete={isRegistering ? "new-password" : "current-password"} minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{isRegistering ? "Crear cuenta" : "Entrar"}</Button>
      </form>
      <button className="text-button" type="button" onClick={() => { setIsRegistering(!isRegistering); setError(""); }}>
        {isRegistering ? "Ya tengo cuenta" : "Quiero crear una cuenta"}
      </button>
    </div>
  );
}

function CatalogForm({ onAdd }: { onAdd: (item: CatalogItem) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CatalogItem["kind"]>("box");
  const [width, setWidth] = useState(100);
  const [depth, setDepth] = useState(60);
  const [height, setHeight] = useState(75);
  const [color, setColor] = useState("#a8795f");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = catalogItemSchema.safeParse({
      id: crypto.randomUUID(), name, kind,
      width: centimetersToMeters(width),
      depth: centimetersToMeters(depth),
      height: centimetersToMeters(height), color,
    });
    if (!result.success) {
      setError("Indica un nombre y medidas entre 5 cm y 100 m.");
      return;
    }
    onAdd(result.data);
    setName("");
    setError("");
  }

  return (
    <form className="catalog-form" onSubmit={submit}>
      <label>Nombre<input placeholder="Ej. Mesa de comedor" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required /></label>
      <label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value as CatalogItem["kind"])}>
        <option value="box">Volumen</option><option value="table">Mesa</option><option value="shelf">Estantería</option>
      </select></label>
      <div className="field-grid compact-grid">
        <label>Ancho · cm<input type="number" min={5} max={10000} value={width} onChange={(event) => setWidth(Number(event.target.value))} required /></label>
        <label>Fondo · cm<input type="number" min={5} max={10000} value={depth} onChange={(event) => setDepth(Number(event.target.value))} required /></label>
        <label>Alto · cm<input type="number" min={5} max={10000} value={height} onChange={(event) => setHeight(Number(event.target.value))} required /></label>
      </div>
      <label className="color-label">Color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" size="sm">Guardar objeto <Plus size={16} aria-hidden="true" /></Button>
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
    const number = Number(draft);
    if (Number.isFinite(number)) onCommit(number);
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
      <p className="panel-label">Propiedades</p>
      {selected && item ? (
        <div className="properties-content" key={selected.id}>
          <h2>{item.name}</h2>
          <p className="subtle-text">{metersToCentimeters(item.width)} × {metersToCentimeters(item.depth)} × {metersToCentimeters(item.height)} cm · {item.kind === "box" ? "Volumen" : item.kind === "table" ? "Mesa" : "Estantería"}</p>
          <h3>Posición</h3>
          <div className="field-grid compact-grid">
            {(["X", "Y", "Z"] as const).map((axis, index) => <NumberField key={axis} label={`${axis} · cm`} value={metersToCentimeters(selected.position[index])} step={1} onCommit={(value) => {
              const position: [number, number, number] = [...selected.position];
              position[index] = centimetersToMeters(value);
              updateInstance(selected.id, { position });
            }} />)}
          </div>
          <h3>Rotación y escala</h3>
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
          <h2>Ambiente</h2>
          <p className="subtle-text">Selecciona un objeto para editar su posición, giro y escala.</p>
          <h3>Medidas del espacio</h3>
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [serverAvailable, setServerAvailable] = useState(true);
  const [guestResume, setGuestResume] = useState(hasGuestProject);

  const loadProjects = useCallback(async () => {
    try {
      const result = await api.projects();
      setProjects(result.projects);
      setServerAvailable(true);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudieron cargar los proyectos");
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
        setGuestResume(true);
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
        clearGuestProject();
        setGuestResume(false);
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
      if (mode === "guest") { clearGuestProject(); setGuestResume(false); }
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
    setGuestResume(hasGuestProject());
    if (user) void loadProjects();
  }

  const selected = project?.instances.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="editor-page">
      <header className="editor-header">
        <a href="/" className="wordmark" aria-label="ROOMPLANNR, volver al inicio">ROOM<span>PLANNR</span></a>
        {project ? <p className="editor-project-title">{project.title} <span>· {mode === "guest" ? "Invitado" : "Mi cuenta"}</span></p> : <p className="editor-project-title">Estudio de diseño</p>}
        <div className="editor-header-actions">
          {project && <button type="button" className="quiet-button" onClick={backToProjects}><FolderOpen size={17} aria-hidden="true" /> Proyectos</button>}
          {project && <Button size="sm" onClick={saveProject} disabled={busy}><Save size={16} aria-hidden="true" /> {mode === "guest" ? "Guardar en mi cuenta" : dirty ? "Guardar cambios" : "Guardado"}</Button>}
          {!project && user && <button type="button" className="quiet-button" onClick={logout}><LogOut size={17} aria-hidden="true" /> Salir</button>}
        </div>
      </header>

      {message && <div className="editor-message" role="status">{message}<button type="button" onClick={() => setMessage("")} aria-label="Cerrar aviso">×</button></div>}

      {showAuth && <div className="auth-overlay"><AuthForm onSuccess={authenticated} onCancel={() => setShowAuth(false)} /></div>}

      {checkingSession && !project ? <div className="editor-loading">Preparando ROOMPLANNR…</div> : project ? (
        <div className={`editor-layout${busy ? " is-busy" : ""}`}>
          <aside className="editor-sidebar" aria-label="Herramientas y catálogo">
            <button className="back-link" type="button" onClick={backToProjects}><ArrowLeft size={17} aria-hidden="true" /> Todos los proyectos</button>
            <div className="editor-side-section">
              <p className="panel-label">Herramientas</p>
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
              <p className="panel-label">Catálogo del proyecto</p>
              <p className="subtle-text">Crea una pieza una vez y colócala tantas veces como necesites.</p>
              <div className="catalog-list">
                {project.catalog.length === 0 && <p className="empty-note">Aún no hay objetos. Crea el primero abajo.</p>}
                {project.catalog.map((item) => <div className="catalog-row" key={item.id}>
                  <span className="catalog-swatch" style={{ backgroundColor: item.color }} aria-hidden="true"><Box size={16} /></span>
                  <span><strong>{item.name}</strong><small>{metersToCentimeters(item.width)} × {metersToCentimeters(item.depth)} × {metersToCentimeters(item.height)} cm</small></span>
                  <button type="button" onClick={() => store().placeItem(item.id)} aria-label={`Colocar ${item.name}`} title={`Colocar ${item.name}`}><Plus size={18} /></button>
                </div>)}
              </div>
            </div>
            <div className="editor-side-section">
              <p className="panel-label">Crear objeto</p>
              <CatalogForm onAdd={(item) => store().addCatalogItem(item)} />
            </div>
          </aside>

          <main className="editor-main">
            <div className="canvas-toolbar">
              <span><Check size={16} aria-hidden="true" /> Ambiente {metersToCentimeters(project.room.width)} × {metersToCentimeters(project.room.depth)} × {metersToCentimeters(project.room.height)} cm</span>
              <span>{mode === "guest" ? "Temporal en esta pestaña" : dirty ? "Cambios sin guardar" : "Guardado en PostgreSQL"}</span>
            </div>
            <Suspense fallback={<div className="editor-loading">Preparando el visor 3D…</div>}>
              <SceneViewport project={project} />
            </Suspense>
          </main>

          <PropertiesPanel project={project} selected={selected} />
        </div>
      ) : (
        <main className="editor-setup">
          <div className="setup-intro">
            <p className="eyebrow">ROOMPLANNR / Estudio</p>
            <h1>Empieza por el espacio que imaginas.</h1>
            <p>Introduce las medidas del ambiente y crea objetos propios. Puedes probar sin cuenta; el diseño invitado vive solo en esta pestaña.</p>
            <div className="setup-features"><span><Box size={17} /> Ambiente a escala</span><span><Move3D size={17} /> Objetos editables</span><span><Cloud size={17} /> Guardado con cuenta</span></div>
          </div>
          <div className="setup-card">
            <div className="panel-heading"><div><p className="eyebrow">Nuevo proyecto</p><h2>Define tu ambiente</h2></div></div>
            <NewProjectForm onCreate={createProject} busy={busy} />
            {guestResume && !user && <button type="button" className="resume-button" onClick={() => store().resumeGuest()}><FolderOpen size={17} /> Continuar el diseño invitado de esta pestaña</button>}
            {!user && <button type="button" className="login-link" onClick={() => setShowAuth(true)}><LogIn size={17} /> Iniciar sesión para guardar proyectos</button>}
            {!serverAvailable && <p className="server-note">El modo invitado está disponible. Para guardar en una cuenta, inicia el servidor de ROOMPLANNR.</p>}
          </div>
          {user && <section className="project-library" aria-labelledby="library-title">
            <div className="library-heading"><h2 id="library-title">Mis proyectos</h2><span>{user.email}</span></div>
            {projects.length === 0 ? <p className="empty-note">Todavía no tienes proyectos guardados.</p> : <div className="project-grid">
              {projects.map((item) => <button type="button" className="project-card" key={item.id} onClick={() => openProject(item.id)} disabled={busy}><FolderOpen size={22} aria-hidden="true" /><strong>{item.title}</strong><small>Actualizado {new Date(item.updatedAt).toLocaleDateString("es-AR")}</small></button>)}
            </div>}
          </section>}
        </main>
      )}
    </div>
  );
}
