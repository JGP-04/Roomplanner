import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const EditorPage = lazy(() => import("./editor/EditorPage"));
const isEditor = window.location.pathname === "/editor" || window.location.pathname.startsWith("/editor/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isEditor ? (
      <Suspense fallback={<p className="editor-loading">Preparando el editor…</p>}>
        <EditorPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
