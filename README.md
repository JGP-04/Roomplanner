# ROOMPLANNR

Landing y primer editor 3D de ambientes. El editor permite definir las medidas del espacio, crear piezas con dimensiones propias, reutilizarlas desde un catálogo del proyecto y moverlas, rotarlas o escalarlas dentro del ambiente.

## Arquitectura

- `src/`: React, TypeScript y Vite. La ruta `/editor` y Three.js se cargan bajo demanda; la landing no descarga el visor.
- `src/domain/`: contrato Zod compartido entre cliente y servidor.
- `server/`: API Fastify separada en configuración, rutas, servicios de sesión y repositorio de proyectos PostgreSQL. Las sesiones usan cookies HttpOnly y tokens aleatorios cuyo hash se guarda en la base.
- `server/sql/`: migraciones versionadas, RLS y funciones de autenticación con privilegios mínimos.
- Sin cuenta, cada proyecto y sus objetos se guardan en un contenedor versionado de `localStorage`, por lo que continúan disponibles después de cerrar la pestaña o el navegador. Con una cuenta, los proyectos se guardan en PostgreSQL. `localStorage` pertenece a ese navegador y origen: no sincroniza dispositivos, puede borrarse al limpiar los datos del sitio y no debe usarse para información sensible.

## Desarrollo local

Requiere Node.js 22+, pnpm 11+ y PostgreSQL 16+ (o Docker para la base local).

1. `pnpm install`
2. Copiar `.env.example` a `.env` y ajustar las URLs y la clave de cifrado.
3. Levantar PostgreSQL, por ejemplo con `docker compose up -d postgres`.
4. `pnpm db:migrate`
5. En dos terminales: `pnpm dev:api` y `pnpm dev`.
6. Abrir `http://127.0.0.1:5173/editor`.

La vista previa de producción (`pnpm preview`, puerto `4173`) también reenvía `/api` al backend local. En desarrollo se aceptan ambos puertos; en producción, definir `FRONTEND_ORIGIN` o una lista separada por comas en `FRONTEND_ORIGINS`.

Si el volumen local de PostgreSQL se creó con una versión anterior de `compose.yaml`, hay que crear manualmente el rol `roomplannr_app` o recrear voluntariamente el volumen de desarrollo antes de migrar. No se debe borrar un volumen que contenga datos necesarios.

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

Configurar en la API `DATABASE_URL` (solo migraciones), `APP_DATABASE_URL` (rol restringido), `DATABASE_APP_ROLE`, `DATA_ENCRYPTION_KEY`, `NODE_ENV=production` y `FRONTEND_ORIGIN=https://<dominio-web>` (o `FRONTEND_ORIGINS` si hay más de uno). `APP_DATABASE_URL` debe verificar el servidor PostgreSQL con `sslmode=verify-full`. Configurar en Vercel `VITE_API_BASE_URL=https://<dominio-api>` y reconstruir. Se recomienda usar subdominios del mismo dominio registrable para que las cookies `SameSite=Lax` funcionen. Si los dominios son de sitios distintos, hará falta `COOKIE_SAME_SITE=none` y una estrategia compatible con el bloqueo de cookies de terceros del navegador. `VITE_API_BASE_URL` es público; jamás colocar secretos en variables `VITE_`.

El servidor debe terminar TLS mediante un proxy o plataforma de hosting; las cookies son `Secure` en producción. Configurar copias de seguridad, supervisión, límites de recursos y rotación de credenciales en la plataforma elegida. No hay despliegue funcional de cuentas sin una URL de API y PostgreSQL reales.

Estos controles apoyan SOC 2, ISO/IEC 27001 e ISO/IEC 27701, pero no sustituyen una auditoría o certificación.
