import { CASINO_FLOOR, type CasinoGame } from "./casino.ts";

/**
 * Walk-in rooms sit outside the 250 m city. The street spot stays put.
 * The door is a move, same as the Dice Hall. Shells are original geometry.
 */

export type RoomId =
  | "home1"
  | "home2"
  | "home3"
  | "store1"
  | "store2"
  | "pawn"
  | "teller"
  | "vault"
  | "fixer"
  | "roller";

export type RoomAccess = "house" | "shop" | "invite" | "public";

export type Box = { minX: number; maxX: number; minZ: number; maxZ: number; h: number };

export type RoomProp = Box & { id: string; kind: "safe" | "bed" | "bay" | "counter" | "shelf" | "vault" | "desk" | "bar" | "table" };

export type RoomSpec = {
  id: RoomId;
  title: string;
  access: RoomAccess;
  origin: { x: number; z: number };
  width: number;
  depth: number;
  bays: number;
  floor: number;
  wall: number;
  accent: number;
  counter: string;
};

/** South door half-width. The player stands in the gap and walks out through it. */
export const DOOR_HALF = 1.7;
/** Spawn is inside, north of the south wall, on the open aisle. */
export const ROOM_SPAWN_Z = 1.6;

const ROOMS_LIST: readonly RoomSpec[] = [
  { id: "home1", title: "Row House", access: "house", origin: { x: 480, z: 360 }, width: 10, depth: 8, bays: 1, floor: 0x6a5340, wall: 0x2a221c, accent: 0xc4a15a, counter: "STASH" },
  { id: "home2", title: "Walk-up", access: "house", origin: { x: 480, z: 460 }, width: 12, depth: 10, bays: 2, floor: 0x5c4636, wall: 0x241c18, accent: 0xc4a15a, counter: "STASH" },
  { id: "home3", title: "Duplex", access: "house", origin: { x: 480, z: 560 }, width: 14, depth: 12, bays: 3, floor: 0x4e3c30, wall: 0x1e1814, accent: 0xd4b06a, counter: "STASH" },
  { id: "store1", title: "Corner Mart", access: "shop", origin: { x: 600, z: 360 }, width: 12, depth: 10, bays: 0, floor: 0x2a3038, wall: 0x1a1214, accent: 0xe23b3b, counter: "COUNTER" },
  { id: "store2", title: "Late Shop", access: "shop", origin: { x: 600, z: 460 }, width: 12, depth: 10, bays: 0, floor: 0x241c18, wall: 0x161210, accent: 0xe07a2f, counter: "COUNTER" },
  { id: "pawn", title: "Pawn", access: "shop", origin: { x: 600, z: 560 }, width: 12, depth: 10, bays: 0, floor: 0x1a1614, wall: 0x14110e, accent: 0xc4a15a, counter: "CAGE" },
  { id: "teller", title: "Civic Bank", access: "public", origin: { x: 720, z: 360 }, width: 16, depth: 11, bays: 0, floor: 0x1c2430, wall: 0x141820, accent: 0x8eb4d4, counter: "TELLER" },
  { id: "vault", title: "Vault", access: "public", origin: { x: 720, z: 470 }, width: 10, depth: 9, bays: 0, floor: 0x14181c, wall: 0x101418, accent: 0xe6c15a, counter: "VAULT" },
  { id: "fixer", title: "Fixer", access: "public", origin: { x: 720, z: 580 }, width: 10, depth: 8, bays: 0, floor: 0x241c14, wall: 0x1a140e, accent: 0xffb020, counter: "DESK" },
  { id: "roller", title: "The Suite", access: "invite", origin: { x: 840, z: 360 }, width: 14, depth: 12, bays: 0, floor: 0x241428, wall: 0x160e1c, accent: 0xb06adf, counter: "BAR" },
];

export function roomList(): readonly RoomSpec[] {
  return ROOMS_LIST;
}

export function roomById(id: string): RoomSpec | undefined {
  return ROOMS_LIST.find((room) => room.id === id);
}

export function isRoomId(id: string): id is RoomId {
  return ROOMS_LIST.some((room) => room.id === id);
}

export function roomShell(spec: RoomSpec): Box[] {
  return shell(spec.width, spec.depth);
}

function shell(width: number, depth: number): Box[] {
  const half = width / 2;
  return [
    { minX: -half - 0.45, maxX: -half + 0.15, minZ: -0.4, maxZ: depth + 0.35, h: 5 },
    { minX: half - 0.15, maxX: half + 0.45, minZ: -0.4, maxZ: depth + 0.35, h: 5 },
    { minX: -half - 0.45, maxX: half + 0.45, minZ: depth - 0.15, maxZ: depth + 0.4, h: 5 },
    { minX: -half - 0.45, maxX: -DOOR_HALF, minZ: -0.5, maxZ: 0.55, h: 5 },
    { minX: DOOR_HALF, maxX: half + 0.45, minZ: -0.5, maxZ: 0.55, h: 5 },
  ];
}

function prop(id: string, kind: RoomProp["kind"], minX: number, maxX: number, minZ: number, maxZ: number, h: number): RoomProp {
  return { id, kind, minX, maxX, minZ, maxZ, h };
}

export function roomProps(spec: RoomSpec): RoomProp[] {
  const half = spec.width / 2;
  const depth = spec.depth;
  if (spec.access === "house") {
    const props: RoomProp[] = [
      prop("safe", "safe", -half + 0.45, -half + 1.45, depth * 0.42, depth * 0.42 + 0.75, 1.05),
      prop("bed", "bed", -half + 0.4, -half + 2.35, depth - 2.15, depth - 0.5, 0.62),
    ];
    for (let i = 0; i < spec.bays; i++) {
      const z0 = 2.5 + i * 1.75;
      props.push(prop(`bay${i}`, "bay", half - 2.25, half - 0.4, z0, z0 + 1.35, 0.2));
    }
    return props;
  }
  if (spec.id === "vault") {
    return [
      prop("door", "vault", -1.3, 1.3, depth - 1.7, depth - 0.45, 2.4),
      prop("shelf", "shelf", -half + 0.4, -half + 1.15, 2.2, depth - 2.1, 1.6),
    ];
  }
  if (spec.id === "fixer") {
    return [prop("desk", "desk", -1.3, 1.3, depth - 2.4, depth - 0.7, 0.95)];
  }
  if (spec.id === "roller") {
    return [
      prop("bar", "bar", -half + 0.4, -half + 1.5, 2.3, depth - 0.6, 1.15),
      prop("table", "table", 1.6, 3.5, 4.2, 6.3, 0.85),
    ];
  }
  return [
    prop("counter", "counter", -half + 0.7, half - 0.7, depth - 1.55, depth - 0.45, 1.12),
    prop("shelf", "shelf", -half + 0.4, -half + 1.2, 2.15, depth - 2.05, 1.7),
  ];
}

export function roomLocalBoxes(spec: RoomSpec): Box[] {
  return [...shell(spec.width, spec.depth), ...roomProps(spec)];
}

export function roomWorldWalls(spec: RoomSpec): Box[] {
  const { x, z } = spec.origin;
  return roomLocalBoxes(spec).map((box) => ({
    minX: box.minX + x,
    maxX: box.maxX + x,
    minZ: box.minZ + z,
    maxZ: box.maxZ + z,
    h: box.h,
  }));
}

export function circleHits(x: number, z: number, r: number, box: Box) {
  const cx = Math.max(box.minX, Math.min(box.maxX, x));
  const cz = Math.max(box.minZ, Math.min(box.maxZ, z));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

/** True when a player circle at the local point is inside the room and off the furniture. */
export function standClear(spec: RoomSpec, x: number, z: number, r: number) {
  const half = spec.width / 2;
  if (x - r < -half + 0.15 || x + r > half - 0.15) return false;
  if (z - r < 0.55 || z + r > spec.depth - 0.15) return false;
  return !roomProps(spec).some((box) => circleHits(x, z, r, box));
}

/** European wheel. Pocket 0 starts on local -Z. Positive yaw brings that index to the player. */
export const WHEEL_POCKETS = 37;

export function wheelYaw(index: number) {
  return index * ((Math.PI * 2) / WHEEL_POCKETS);
}

export function pocketOffset(index: number) {
  const yaw = wheelYaw(index);
  return { x: Math.sin(yaw), z: -Math.cos(yaw) };
}

/**
 * PlaneGeometry faces +Z. This euler lays it flat, normal +Y, texture-up toward +Z.
 * A player at the south door (looking +Z) reads the face upright.
 */
export const CARD_EULER = { x: -Math.PI / 2, y: 0, z: Math.PI } as const;
/** PlaneGeometry rotateY so its face points at the player standing south. */
export const FACE_PLAYER_Y = Math.PI;

export function casinoStationLocal(game: CasinoGame, x: number, z: number): Box {
  if (game === "cage") return { minX: x - 1.7, maxX: x + 1.7, minZ: z - 0.35, maxZ: z + 0.55, h: 5 };
  if (game === "slots") return { minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.25, maxZ: z + 0.35, h: 5 };
  return { minX: x - 1.05, maxX: x + 1.05, minZ: z - 0.85, maxZ: z + 0.85, h: 5 };
}

export function casinoStations(): Array<Box & { id: string; game: CasinoGame }> {
  return CASINO_FLOOR.entries.map((entry) => ({ ...casinoStationLocal(entry.game, entry.x, entry.z), id: entry.id, game: entry.game }));
}
