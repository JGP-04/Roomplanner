import { ArrowDownRight, ArrowRight, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SocialChannel } from "@/components/social-channel";
import { Button } from "@/components/ui/button";
import {
  audienceProfiles,
  processSteps,
  socialChannels,
} from "@/content/site";

export function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <SiteHeader />

      <main id="contenido">
        <section id="inicio" className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Diseño interior, a tu manera</p>
            <h1 id="hero-title">
              Tu espacio,
              <br />
              <em>antes de existir.</em>
            </h1>
            <p className="hero-intro">
              Imagina, planifica y comparte interiores. Define tu ambiente,
              crea objetos a medida y explora cómo se relacionan en el espacio.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <a href="/editor">
                  Iniciar el diseño <ArrowDownRight aria-hidden="true" size={18} />
                </a>
              </Button>
              <a className="text-link" href="#para-quien">
                Descubrir para quién es
              </a>
            </div>
          </div>

          <figure className="hero-visual">
            <img
              src="/roomplannr-hero.webp"
              alt="Living contemporáneo en tonos cálidos, con madera natural y textiles claros"
              fetchPriority="high"
            />
            <figcaption>
              <span>01</span>
              <p>Imagina</p>
            </figcaption>
          </figure>
        </section>

        <section
          id="como-funciona"
          className="section process-section"
          aria-labelledby="process-title"
        >
          <div className="section-heading">
            <p className="eyebrow">Así funciona</p>
            <h2 id="process-title">
              Del primer boceto a una idea que todos pueden ver.
            </h2>
          </div>
          <p className="section-lead">
            Comienza por un ambiente con medidas reales, crea tus piezas y
            colócalas en el espacio para tomar decisiones con más claridad.
          </p>

          <div className="process-grid">
            {processSteps.map((step) => {
              const Icon = step.icon;

              return (
                <article className="process-card" key={step.number}>
                  <div className="process-card-top">
                    <span>{step.number}</span>
                    <Icon aria-hidden="true" size={25} strokeWidth={1.4} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="manifesto" aria-label="Principio de ROOMPLANNR">
          <p>No se trata de decorar más.</p>
          <h2>Se trata de decidir mejor.</h2>
          <span>ROOMPLANNR / Principio 01</span>
        </section>

        <section
          id="para-quien"
          className="section audience-section"
          aria-labelledby="audience-title"
        >
          <div className="section-heading narrow-heading">
            <p className="eyebrow">Dos miradas, un mismo espacio</p>
            <h2 id="audience-title">Pensado para habitar. Creado para diseñar.</h2>
          </div>

          <div className="audience-grid">
            {audienceProfiles.map((profile) => {
              const Icon = profile.icon;

              return (
                <article className="audience-card" key={profile.kicker}>
                  <div className="audience-kicker">
                    <Icon aria-hidden="true" size={20} strokeWidth={1.6} />
                    <span>{profile.kicker}</span>
                  </div>
                  <h3>{profile.title}</h3>
                  <p>{profile.description}</p>
                  <ul>
                    {profile.points.map((point) => (
                      <li key={point}>
                        <ArrowRight aria-hidden="true" size={16} />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section id="vision" className="vision-section" aria-labelledby="vision-title">
          <div className="vision-copy">
            <p className="eyebrow">La visión</p>
            <h2 id="vision-title">Un primer espacio para tus ideas.</h2>
            <p>
              El editor permite crear ambientes rectangulares, guardar objetos
              en un catálogo y organizarlos en tres dimensiones. Seguiremos
              ampliando las herramientas de modelado y presentación.
            </p>
            <div className="future-note">
              <Sparkles aria-hidden="true" size={19} />
              <a href="/editor">Abrir el editor 3D</a>
            </div>
          </div>

          <ol className="vision-list">
            <li>
              <span>01</span>
              <div>
                <h3>Modelado espacial</h3>
                <p>Una base flexible para construir ambientes con precisión.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Decisiones visuales</h3>
                <p>Materiales, distribución e iluminación fáciles de comparar.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Colaboración clara</h3>
                <p>Un lenguaje compartido entre clientes y profesionales.</p>
              </div>
            </li>
          </ol>
        </section>

        <section
          id="contacto"
          className="contact-section"
          aria-labelledby="contact-title"
        >
          <div className="contact-copy">
            <p className="eyebrow">Sigamos en contacto</p>
            <h2 id="contact-title">El espacio está por transformarse.</h2>
            <p>
              Muy pronto podrás seguir el proceso, conocer novedades y ser parte
              de las primeras personas en descubrir ROOMPLANNR.
            </p>
          </div>
          <div className="social-list" aria-label="Próximos canales de contacto">
            {socialChannels.map((channel) => (
              <SocialChannel channel={channel} key={channel.name} />
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="wordmark footer-wordmark" href="#inicio">
          ROOM<span>PLANNR</span>
        </a>
        <p>Imagina. Planifica. Transforma.</p>
        <small>© {new Date().getFullYear()} ROOMPLANNR</small>
      </footer>
    </div>
  );
}
