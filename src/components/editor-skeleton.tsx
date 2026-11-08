function LoadingAnnouncement({ label }: { label: string }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {label}
    </span>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span className={`skeleton-block ${className}`} aria-hidden="true" />;
}

export function EditorSetupSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className={`editor-skeleton-page${showHeader ? "" : " editor-skeleton-page--body"}`} aria-busy="true">
      <LoadingAnnouncement label="Cargando el editor" />
      {showHeader && (
        <header className="editor-skeleton-header">
          <SkeletonBlock className="skeleton-wordmark" />
          <SkeletonBlock className="skeleton-header-title" />
        </header>
      )}
      <main className="editor-skeleton-setup">
        <div className="skeleton-intro" aria-hidden="true">
          <SkeletonBlock className="skeleton-heading skeleton-heading-short" />
          <SkeletonBlock className="skeleton-heading" />
          <SkeletonBlock className="skeleton-copy" />
          <SkeletonBlock className="skeleton-copy skeleton-copy-short" />
        </div>
        <div className="skeleton-form" aria-hidden="true">
          <SkeletonBlock className="skeleton-form-title" />
          <SkeletonBlock className="skeleton-field" />
          <div className="skeleton-field-row">
            <SkeletonBlock className="skeleton-field" />
            <SkeletonBlock className="skeleton-field" />
            <SkeletonBlock className="skeleton-field" />
          </div>
          <SkeletonBlock className="skeleton-action" />
        </div>
      </main>
    </div>
  );
}

export function ViewportSkeleton() {
  return (
    <div className="viewport-skeleton" aria-busy="true">
      <LoadingAnnouncement label="Cargando el visor 3D" />
      <div className="viewport-skeleton-room" aria-hidden="true">
        <SkeletonBlock className="viewport-skeleton-wall" />
        <SkeletonBlock className="viewport-skeleton-floor" />
        <SkeletonBlock className="viewport-skeleton-object" />
      </div>
    </div>
  );
}

export function ProjectGridSkeleton() {
  return (
    <div className="project-grid skeleton-project-grid" aria-busy="true">
      <LoadingAnnouncement label="Cargando tus proyectos" />
      {[0, 1, 2].map((item) => (
        <div className="skeleton-project-card" aria-hidden="true" key={item}>
          <SkeletonBlock className="skeleton-project-icon" />
          <SkeletonBlock className="skeleton-project-title" />
          <SkeletonBlock className="skeleton-project-date" />
        </div>
      ))}
    </div>
  );
}
