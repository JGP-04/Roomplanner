import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigation } from "@/content/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="wordmark" href="#inicio" aria-label="ROOMPLANNR, inicio">
        ROOM<span>PLANNR</span>
      </a>

      <nav className="desktop-nav" aria-label="Navegación principal">
        {navigation.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <Button asChild size="sm" className="header-cta">
        <a href="/editor">Iniciar el diseño</a>
      </Button>

      <details className="mobile-menu">
        <summary>
          <Menu className="menu-open-icon" aria-hidden="true" size={22} />
          <X className="menu-close-icon" aria-hidden="true" size={22} />
          <span className="sr-only">Abrir navegación</span>
        </summary>
        <nav aria-label="Navegación móvil">
          <a href="/editor">Iniciar el diseño</a>
          {navigation.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </details>
    </header>
  );
}
