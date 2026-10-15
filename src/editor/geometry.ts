import type { CatalogItem, ObjectInstance, Room } from "@/domain/project";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export function fitInstance(
  instance: ObjectInstance,
  item: CatalogItem,
  room: Room,
  snap = false,
): ObjectInstance {
  const rotationY = snap
    ? Math.round(instance.rotationY / (Math.PI / 12)) * (Math.PI / 12)
    : instance.rotationY;
  let [sx, sy, sz] = instance.scale.map((value) => clamp(value, 0.1, 10)) as [number, number, number];
  const cosine = Math.abs(Math.cos(rotationY));
  const sine = Math.abs(Math.sin(rotationY));
  const footprintWidth = item.width * sx * cosine + item.depth * sz * sine;
  const footprintDepth = item.width * sx * sine + item.depth * sz * cosine;
  const ratio = Math.min(1, room.width / footprintWidth, room.depth / footprintDepth, room.height / (item.height * sy));
  sx *= ratio;
  sy *= ratio;
  sz *= ratio;
  const halfWidth = (item.width * sx * cosine + item.depth * sz * sine) / 2;
  const halfDepth = (item.width * sx * sine + item.depth * sz * cosine) / 2;
  const step = (value: number) => snap ? Math.round(value / 0.05) * 0.05 : value;
  return {
    ...instance,
    position: [
      round(clamp(step(instance.position[0]), -room.width / 2 + halfWidth, room.width / 2 - halfWidth)),
      round(clamp(step(instance.position[1]), 0, room.height - item.height * sy)),
      round(clamp(step(instance.position[2]), -room.depth / 2 + halfDepth, room.depth / 2 - halfDepth)),
    ],
    rotationY: round(rotationY),
    scale: [round(sx), round(sy), round(sz)],
  };
}

export function metersToCentimeters(value: number): number {
  return Math.round(value * 100);
}

export function centimetersToMeters(value: number): number {
  return Math.round(value) / 100;
}
