import { z } from "zod";

const dimension = z.number().finite().min(0.05).max(100);
const coordinate = z.number().finite().min(-1000).max(1000);
const scaleFactor = z.number().finite().min(0.0001).max(10);

export const catalogItemKinds = ["box", "table", "chair", "armchair", "shelf"] as const;
export type CatalogItemKind = typeof catalogItemKinds[number];

export const catalogItemKindLabels: Record<CatalogItemKind, string> = {
  box: "Volumen",
  table: "Mesa",
  chair: "Silla",
  armchair: "Sillón",
  shelf: "Estantería",
};

export const roomSchema = z.object({
  width: dimension,
  depth: dimension,
  height: dimension,
});

export const catalogItemSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(catalogItemKinds),
  width: dimension,
  depth: dimension,
  height: dimension,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const instanceSchema = z.object({
  id: z.uuid(),
  catalogItemId: z.uuid(),
  position: z.tuple([coordinate, coordinate, coordinate]),
  rotationY: z.number().finite().min(-Math.PI * 100).max(Math.PI * 100),
  scale: z.tuple([scaleFactor, scaleFactor, scaleFactor]),
});

export const projectPayloadSchema = z.object({
  title: z.string().trim().min(1).max(100),
  room: roomSchema,
  catalog: z.array(catalogItemSchema).max(200),
  instances: z.array(instanceSchema).max(1000),
  revision: z.number().int().nonnegative(),
}).superRefine((value, context) => {
  const catalogIds = new Set(value.catalog.map((item) => item.id));
  if (catalogIds.size !== value.catalog.length) {
    context.addIssue({ code: "custom", message: "Hay objetos duplicados en el catálogo" });
  }
  const instanceIds = new Set(value.instances.map((item) => item.id));
  if (instanceIds.size !== value.instances.length) {
    context.addIssue({ code: "custom", message: "Hay instancias duplicadas" });
  }
  for (const instance of value.instances) {
    if (!catalogIds.has(instance.catalogItemId)) {
      context.addIssue({ code: "custom", message: "Una instancia no existe en el catálogo" });
    }
  }
});

export type Room = z.infer<typeof roomSchema>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type ObjectInstance = z.infer<typeof instanceSchema>;
export type ProjectPayload = z.infer<typeof projectPayloadSchema>;

export interface ProjectDocument extends ProjectPayload {
  id: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export function createEmptyProject(title: string, room: Room): ProjectPayload {
  return { title, room, catalog: [], instances: [], revision: 0 };
}
