import type { CatalogItem, ObjectInstance, Room } from "@/domain/project";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 1000) / 1000;
const collisionGap = 0.02;

interface InstanceBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface OccupiedInstance {
  instance: ObjectInstance;
  item: CatalogItem;
}

function instanceBounds(instance: ObjectInstance, item: CatalogItem): InstanceBounds {
  const cosine = Math.abs(Math.cos(instance.rotationY));
  const sine = Math.abs(Math.sin(instance.rotationY));
  const halfWidth = (item.width * instance.scale[0] * cosine + item.depth * instance.scale[2] * sine) / 2;
  const halfDepth = (item.width * instance.scale[0] * sine + item.depth * instance.scale[2] * cosine) / 2;
  return {
    minX: instance.position[0] - halfWidth,
    maxX: instance.position[0] + halfWidth,
    minY: instance.position[1],
    maxY: instance.position[1] + item.height * instance.scale[1],
    minZ: instance.position[2] - halfDepth,
    maxZ: instance.position[2] + halfDepth,
  };
}

export function instancesOverlap(
  first: ObjectInstance,
  firstItem: CatalogItem,
  second: ObjectInstance,
  secondItem: CatalogItem,
  gap = collisionGap,
): boolean {
  const a = instanceBounds(first, firstItem);
  const b = instanceBounds(second, secondItem);
  return a.minX < b.maxX + gap && a.maxX > b.minX - gap
    && a.minY < b.maxY + gap && a.maxY > b.minY - gap
    && a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap;
}

export function hasInstanceCollision(
  instance: ObjectInstance,
  item: CatalogItem,
  occupied: OccupiedInstance[],
): boolean {
  return occupied.some((entry) => entry.instance.id !== instance.id
    && instancesOverlap(instance, item, entry.instance, entry.item));
}

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

function findAvailablePlacementAtCurrentScale(
  instance: ObjectInstance,
  item: CatalogItem,
  room: Room,
  occupied: OccupiedInstance[],
): ObjectInstance | null {
  const origin = fitInstance(instance, item, room);
  if (!hasInstanceCollision(origin, item, occupied)) return origin;

  const bounds = instanceBounds(origin, item);
  const halfWidth = (bounds.maxX - bounds.minX) / 2;
  const halfDepth = (bounds.maxZ - bounds.minZ) / 2;
  const minX = -room.width / 2 + halfWidth;
  const maxX = room.width / 2 - halfWidth;
  const minZ = -room.depth / 2 + halfDepth;
  const maxZ = room.depth / 2 - halfDepth;
  const candidates: Array<[number, number]> = [
    [0, 0], [minX, minZ], [minX, maxZ], [maxX, minZ], [maxX, maxZ],
  ];

  for (const entry of occupied) {
    const other = instanceBounds(entry.instance, entry.item);
    const left = other.minX - halfWidth - collisionGap;
    const right = other.maxX + halfWidth + collisionGap;
    const back = other.minZ - halfDepth - collisionGap;
    const front = other.maxZ + halfDepth + collisionGap;
    const otherX = (other.minX + other.maxX) / 2;
    const otherZ = (other.minZ + other.maxZ) / 2;
    candidates.push(
      [left, otherZ], [right, otherZ], [otherX, back], [otherX, front],
      [left, back], [left, front], [right, back], [right, front],
    );
  }

  const searchStep = Math.max(0.1, Math.min(halfWidth, halfDepth));
  for (let ring = 1; ring <= 32; ring += 1) {
    for (let offset = -ring; offset <= ring; offset += 1) {
      candidates.push(
        [origin.position[0] + offset * searchStep, origin.position[2] - ring * searchStep],
        [origin.position[0] + offset * searchStep, origin.position[2] + ring * searchStep],
        [origin.position[0] - ring * searchStep, origin.position[2] + offset * searchStep],
        [origin.position[0] + ring * searchStep, origin.position[2] + offset * searchStep],
      );
    }
  }

  candidates.sort((a, b) => {
    const distanceA = (a[0] - origin.position[0]) ** 2 + (a[1] - origin.position[2]) ** 2;
    const distanceB = (b[0] - origin.position[0]) ** 2 + (b[1] - origin.position[2]) ** 2;
    return distanceA - distanceB;
  });

  for (const [x, z] of candidates) {
    if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
    const candidate = fitInstance({ ...origin, position: [x, origin.position[1], z] }, item, room);
    if (!hasInstanceCollision(candidate, item, occupied)) return candidate;
  }
  return null;
}

export function findAvailablePlacement(
  instance: ObjectInstance,
  item: CatalogItem,
  room: Room,
  occupied: OccupiedInstance[],
): ObjectInstance | null {
  const fitted = fitInstance(instance, item, room);
  for (let attempt = 0; attempt <= 9; attempt += 1) {
    const factor = 1 - attempt * 0.1;
    const candidate = attempt === 0 ? fitted : fitInstance({
      ...fitted,
      scale: fitted.scale.map((value) => Math.max(0.1, value * factor)) as [number, number, number],
    }, item, room);
    const placement = findAvailablePlacementAtCurrentScale(candidate, item, room, occupied);
    if (placement) return placement;
  }
  return null;
}

export function metersToCentimeters(value: number): number {
  return Math.round(value * 100);
}

export function centimetersToMeters(value: number): number {
  return Math.round(value) / 100;
}
