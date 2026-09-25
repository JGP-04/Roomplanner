# ROOMPLANNR

Landing page oficial de ROOMPLANNR, una plataforma en evolución para imaginar,
planificar y comunicar espacios interiores.

## Desarrollo local

```bash
pnpm install
pnpm dev
```

## Comprobaciones

```bash
pnpm lint
pnpm build
```

El proyecto utiliza React, TypeScript, Vite, Tailwind CSS y componentes
compatibles con shadcn/ui. El editor 3D se incorporará en una fase posterior
como un módulo independiente y cargado bajo demanda.

## Arquitectura

- El contenido está modelado con tipos TypeScript y separado de los componentes.
- Las redes sociales aceptan una URL opcional; sin URL se muestran como canales
  no interactivos y no recopilan datos.
- El futuro editor 3D vivirá en una ruta y un bundle independientes para no
  afectar la carga de la landing.
- Las cabeceras de seguridad y el enrutado SPA están definidos en `vercel.json`.

## Despliegue

Vercel detecta Vite automáticamente. El comando de producción es `pnpm build`
y la carpeta de salida es `dist`.
