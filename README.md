# ROOMPLANNR

Landing y primer editor 3D de ambientes. El editor permite definir las medidas del espacio, crear piezas con dimensiones propias, reutilizarlas desde un catálogo del proyecto y moverlas, rotarlas o escalarlas dentro del ambiente.

## Arquitectura

- `src/`: React, TypeScript y Vite. La ruta `/editor` y Three.js se cargan bajo demanda; la landing no descarga el visor.
- `src/domain/`: contrato Zod compartido entre cliente y servidor.
- `server/`: API Fastify y PostgreSQL propios. Las sesiones usan cookies HttpOnly y tokens aleatorios cuyo hash se guarda en la base.
- `server/sql/`: migración inicial versionada.
- Sin cuenta, el diseño se guarda solo en `sessionStorage` de la pestaña. Al cerrar la pestaña se pierde; con una cuenta, los proyectos se guardan en PostgreSQL. Algunos navegadores pueden restaurar una pestaña cerrada con su sesión; no uses el modo invitado para datos que deban conservarse ni para información sensible.

## Desarrollo local

Requiere Node.js 22+, pnpm 11+ y PostgreSQL 16+ (o Docker para la base local).

1. `pnpm install`
2. Copiar `.env.example` a `.env` y ajustar `DATABASE_URL`.
3. Levantar PostgreSQL, por ejemplo con `docker compose up -d postgres`.
4. `pnpm db:migrate`
5. En dos terminales: `pnpm dev:api` y `pnpm dev`.
6. Abrir `http://127.0.0.1:5173/editor`.

El modo invitado funciona incluso sin la API, pero el registro, inicio de sesión y guardado persistente requieren el servidor y PostgreSQL.

## Validación

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Despliegue

La landing y el editor estático se pueden desplegar en Vercel con `pnpm build` y salida `dist`. La API Fastify es un proceso Node separado que necesita una instancia PostgreSQL administrada. Ejecutar `pnpm db:migrate` antes de iniciar la API con `pnpm start:api`. No publicar el puerto de PostgreSQL a Internet.

Configurar en la API `DATABASE_URL`, `NODE_ENV=production` y `FRONTEND_ORIGIN=https://<dominio-web>`. Configurar en Vercel `VITE_API_BASE_URL=https://<dominio-api>` y reconstruir. Se recomienda usar subdominios del mismo dominio registrable para que las cookies `SameSite=Lax` funcionen. Si los dominios son de sitios distintos, hará falta `COOKIE_SAME_SITE=none` y una estrategia compatible con el bloqueo de cookies de terceros del navegador. `VITE_API_BASE_URL` es público; jamás colocar secretos en variables `VITE_`.

El servidor debe terminar TLS mediante un proxy o plataforma de hosting; las cookies son `Secure` en producción. Configurar copias de seguridad, supervisión, límites de recursos y rotación de credenciales en la plataforma elegida. No hay despliegue funcional de cuentas sin una URL de API y PostgreSQL reales.
