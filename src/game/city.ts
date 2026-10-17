import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Quaternius Downtown City MegaKit (CC0), free Standard set.
 * Measured from the glTF accessors, Y-up, 1 unit = 1 meter:
 *   Building fronts sit on local +Z (the door/stoop is the max-Z face).
 *   Street_4Lane is 6 m along local X and 18 m across local Z (12 m asphalt, curbs at ±9).
 *   The 4-way curb box is 18 m. Decal triangles extend past that, so the module size
 *   is the curb, not the decal bounds.
 * Roads stay on the 50 m grid so driving and the doors keep their streets.
 * The lots do not. Each block is a court, a row, a tower, or a single front,
 * not a mirrored pair of the same two boxes.
 * The ground is not a plane. Roads follow a shelf. Each lot sits on its own pad.
 */

export const DISTRICT = { cell: 50, road: 16, grid: 5, shoulder: 2.4 } as const;
const TILE_LEN = 6;
const CROSS = 18;
const LIFT = 0.17;

export type BKind = "large" | "medium" | "small";
export type Face = "west" | "east" | "north" | "south";
export type Spec = { width: number; depth: number };
export type Placement = {
  kind: BKind | "street" | "cross";
  x: number;
  y: number;
  z: number;
  yaw: number;
  sx: number;
  sy: number;
  sz: number;
  face: Face | null;
};

const FACE_YAW: Record<Face, number> = {
  east: Math.PI / 2,
  west: -Math.PI / 2,
  north: 0,
  south: Math.PI,
};

export type BlockBox = { minX: number; maxX: number; minZ: number; maxZ: number; h: number };

/** Stable 0..1, so a lot reads the same every load and does not touch the gameplay seed. */
function unit(gx: number, gz: number, salt: number) {
  const n = Math.sin(gx * 12.9898 + gz * 78.233 + salt * 45.164) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Authored lots inside the sidewalk. Roads stay on the 50 m lines.
 * Each cell is a house row, a court, an L, a tower, or three detached houses.
 * Plaza kiosks stay low so the open center can still be walked.
 */
export function lotMasses(frame = DISTRICT): BlockBox[] {
  const out: BlockBox[] = [];
  const half = (frame.grid * frame.cell) / 2;
  const pad = frame.road / 2 + frame.shoulder;
  const mid = Math.floor(frame.grid / 2);
  for (let gx = 0; gx < frame.grid; gx++) {
    for (let gz = 0; gz < frame.grid; gz++) {
      if (gx === mid && gz === mid) continue;
      const x0 = -half + gx * frame.cell + pad;
      const z0 = -half + gz * frame.cell + pad;
      const x1 = -half + (gx + 1) * frame.cell - pad;
      const z1 = -half + (gz + 1) * frame.cell - pad;
      const w = x1 - x0;
      const d = z1 - z0;
      const arch = (gx * 3 + gz * 5) % 6;
      const push = (minX: number, maxX: number, minZ: number, maxZ: number, h: number) => {
        out.push({ minX, maxX, minZ, maxZ, h });
      };
      if (arch === 0) {
        const count = 4;
        const gap = 0.85;
        const houseW = (w - gap * (count - 1)) / count;
        for (let i = 0; i < count; i++) {
          const depth = d * (0.34 + unit(gx, gz, i) * 0.16);
          const hx = x0 + i * (houseW + gap);
          push(hx, hx + houseW, z0, z0 + depth, 5.5 + unit(gx, gz, 20 + i) * 9);
        }
      } else if (arch === 1) {
        const count = 3;
        const gap = 0.9;
        const houseD = (d - gap * (count - 1)) / count;
        for (let i = 0; i < count; i++) {
          const width = w * (0.3 + unit(gx, gz, i) * 0.16);
          const hz = z0 + i * (houseD + gap);
          push(x0, x0 + width, hz, hz + houseD, 7 + unit(gx, gz, 30 + i) * 12);
        }
      } else if (arch === 2) {
        const southD = d * 0.2;
        const northD = d * 0.24;
        const gap = 1.5;
        push(x0, x1, z0, z0 + southD, 8 + unit(gx, gz, 1) * 6);
        push(x0, x1, z1 - northD, z1, 20 + unit(gx, gz, 2) * 14);
        const zA = z0 + southD + gap;
        const zB = z1 - northD - gap;
        push(x0, x0 + w * 0.22, zA, zB, 11 + unit(gx, gz, 3) * 8);
        push(x1 - w * 0.26, x1, zA, zB, 24 + unit(gx, gz, 4) * 12);
      } else if (arch === 3) {
        const foot = 8.4 + unit(gx, gz, 1) * 2.8;
        if (unit(gx, gz, 9) < 0.45) {
          const ox = unit(gx, gz, 5) * (w - foot);
          const oz = unit(gx, gz, 6) * (d - foot);
          push(x0 + ox, x0 + ox + foot, z0 + oz, z0 + oz + foot, 32 + unit(gx, gz, 2) * 16);
        } else {
          const corner = (gx + gz) % 4;
          const southTower = corner < 2;
          const westTower = corner % 2 === 0;
          const tx0 = westTower ? x0 : x1 - foot;
          const tz0 = southTower ? z0 : z1 - foot;
          push(tx0, tx0 + foot, tz0, tz0 + foot, 28 + unit(gx, gz, 2) * 18);
          const shop = 5.2;
          const shopX0 = westTower ? x0 : x0 + w * 0.38;
          const shopX1 = westTower ? x0 + w * 0.62 : x1;
          if (southTower) push(shopX0, shopX1, z1 - shop, z1, 5 + unit(gx, gz, 3) * 3.5);
          else push(shopX0, shopX1, z0, z0 + shop, 5 + unit(gx, gz, 3) * 3.5);
          const wingW = w * 0.28;
          const wingD = d * 0.28;
          if (southTower) {
            const wz0 = z0 + foot + 1.6;
            if (westTower) push(x1 - wingW, x1, wz0, wz0 + wingD, 12 + unit(gx, gz, 4) * 8);
            else push(x0, x0 + wingW, wz0, wz0 + wingD, 12 + unit(gx, gz, 4) * 8);
          } else {
            const wz1 = z1 - foot - 1.6;
            if (westTower) push(x1 - wingW, x1, wz1 - wingD, wz1, 12 + unit(gx, gz, 4) * 8);
            else push(x0, x0 + wingW, wz1 - wingD, wz1, 12 + unit(gx, gz, 4) * 8);
          }
        }
      } else if (arch === 4) {
        const southD = d * 0.34;
        push(x0, x1, z0, z0 + southD, 9 + unit(gx, gz, 1) * 8);
        push(x0, x0 + w * 0.4, z0 + southD + 1.6, z1, 16 + unit(gx, gz, 2) * 12);
      } else {
        const place = (fx: number, fz: number, salt: number, h0: number, h1: number) => {
          const hw = 6.4 + unit(gx, gz, salt) * 2.8;
          const hd = 6.6 + unit(gx, gz, salt + 1) * 2.6;
          push(x0 + fx * (w - hw), x0 + fx * (w - hw) + hw, z0 + fz * (d - hd), z0 + fz * (d - hd) + hd, h0 + unit(gx, gz, salt + 2) * (h1 - h0));
        };
        place(0, 0, 1, 5.2, 8);
        place(1, 0.04, 4, 10, 16);
        place(0.06, 1, 7, 6.5, 11);
      }
    }
  }
  out.push({ minX: -3.3, maxX: 3.3, minZ: -3.3, maxZ: 3.3, h: 1.5 });
  out.push({ minX: -10, maxX: -7.4, minZ: -2, maxZ: 0.8, h: 1.15 });
  out.push({ minX: 6, maxX: 9.1, minZ: 3, maxZ: 5.6, h: 1.15 });
  out.push({ minX: -2, maxX: 1.4, minZ: -12.2, maxZ: -9.1, h: 1.05 });
  return out;
}

const CITY_EDGE = 168;

function smooth(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

function nearestLine(v: number) {
  const half = (DISTRICT.grid * DISTRICT.cell) / 2;
  const i = Math.round((v + half) / DISTRICT.cell);
  const c = Math.max(0, Math.min(DISTRICT.grid, i));
  return -half + c * DISTRICT.cell;
}

function roadGap(x: number, z: number) {
  const rx = nearestLine(x);
  const rz = nearestLine(z);
  const dx = Math.abs(x - rx);
  const dz = Math.abs(z - rz);
  if (dx <= dz) return { dist: dx, sx: rx, sz: z };
  return { dist: dz, sx: x, sz: rz };
}

/** District shelves. West bluff, north ridge, south basin. The plaza stays low. */
function shelfRaw(x: number, z: number) {
  const plaza = smooth(16, 46, Math.hypot(x, z));
  const west = smooth(8, -118, x);
  const north = smooth(-8, 118, z);
  const south = smooth(6, -118, z);
  const east = smooth(-20, 118, x);
  const ripple = Math.sin(x * 0.028 + 0.6) * Math.cos(z * 0.024 - 0.8);
  const bowl = Math.sin((x + z) * 0.02);
  const h = (west * 4.4 + north * 3.6 + east * 1.45 + ripple * 0.65 + bowl * 0.55 - south * 2.6) * plaza;
  const rim = smooth(158, 112, Math.max(Math.abs(x), Math.abs(z)));
  return h * rim;
}

function terrace(x: number, z: number) {
  const half = (DISTRICT.grid * DISTRICT.cell) / 2;
  const gx = Math.floor((x + half) / DISTRICT.cell);
  const gz = Math.floor((z + half) / DISTRICT.cell);
  if (gx < 0 || gz < 0 || gx >= DISTRICT.grid || gz >= DISTRICT.grid) return 0;
  if (gx === 2 && gz === 2) return 0.15;
  const n = unit(gx, gz, 11);
  const bluff = gx === 0 || gz === 4 ? 0.7 : gx === 4 || gz === 0 ? 0.28 : 0;
  return 0.5 + n * 1.25 + bluff;
}

let massGrid: BlockBox[][] | null = null;

function massesInCell(x: number, z: number): BlockBox[] {
  if (!massGrid) {
    const cells: BlockBox[][] = Array.from({ length: DISTRICT.grid * DISTRICT.grid }, () => []);
    const half = (DISTRICT.grid * DISTRICT.cell) / 2;
    for (const b of lotMasses()) {
      if (b.h <= 2) continue;
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const gx = Math.min(DISTRICT.grid - 1, Math.max(0, Math.floor((cx + half) / DISTRICT.cell)));
      const gz = Math.min(DISTRICT.grid - 1, Math.max(0, Math.floor((cz + half) / DISTRICT.cell)));
      cells[gz * DISTRICT.grid + gx]!.push(b);
    }
    massGrid = cells;
  }
  const half = (DISTRICT.grid * DISTRICT.cell) / 2;
  const gx = Math.floor((x + half) / DISTRICT.cell);
  const gz = Math.floor((z + half) / DISTRICT.cell);
  if (gx < 0 || gz < 0 || gx >= DISTRICT.grid || gz >= DISTRICT.grid) return [];
  return massGrid[gz * DISTRICT.grid + gx]!;
}

function massAt(x: number, z: number): BlockBox | null {
  for (const b of massesInCell(x, z)) {
    if (x >= b.minX - 0.35 && x <= b.maxX + 0.35 && z >= b.minZ - 0.35 && z <= b.maxZ + 0.35) return b;
  }
  return null;
}

/**
 * One height for the mesh, the cars, and the people.
 * Asphalt follows the shelf. A lot is a flat pad above that shelf.
 * The hall and the rooms sit outside the district and stay at 0.
 */
export function groundY(x: number, z: number): number {
  if (Math.abs(x) > CITY_EDGE || Math.abs(z) > CITY_EDGE) return 0;
  const gap = roadGap(x, z);
  const roadH = shelfRaw(gap.sx, gap.sz);
  // Street tiles are 18 m across, so the asphalt stays flat past the 16 m lane.
  const lane = 9.4;
  if (gap.dist <= lane) return roadH;
  const mass = massAt(x, z);
  if (mass) {
    const cx = (mass.minX + mass.maxX) / 2;
    const cz = (mass.minZ + mass.maxZ) / 2;
    return shelfRaw(cx, cz) + terrace(cx, cz);
  }
  const t = smooth(lane, lane + 1.15, gap.dist);
  return roadH + (shelfRaw(x, z) + terrace(x, z) - roadH) * t;
}

function frontFace(b: BlockBox, siblings: BlockBox[], frame: { cell: number; road: number; grid: number; shoulder: number }): Face {
  const half = (frame.grid * frame.cell) / 2;
  const gx = Math.min(frame.grid - 1, Math.max(0, Math.floor((b.minX + half) / frame.cell)));
  const gz = Math.min(frame.grid - 1, Math.max(0, Math.floor((b.minZ + half) / frame.cell)));
  const pad = frame.road / 2 + frame.shoulder;
  const x0 = -half + gx * frame.cell + pad;
  const z0 = -half + gz * frame.cell + pad;
  const x1 = -half + (gx + 1) * frame.cell - pad;
  const z1 = -half + (gz + 1) * frame.cell - pad;
  const gap: Record<Face, number> = {
    west: b.minX - x0,
    east: x1 - b.maxX,
    south: b.minZ - z0,
    north: z1 - b.maxZ,
  };
  const faces: Face[] = ["west", "east", "south", "north"];
  const best = Math.min(gap.west, gap.east, gap.south, gap.north);
  const near = faces.filter((f) => gap[f] <= best + 0.45);
  if (near.length === 1) return near[0]!;
  const beside = (axis: "x" | "z") =>
    siblings.some((o) => {
      if (o === b) return false;
      const xGap = Math.max(b.minX, o.minX) - Math.min(b.maxX, o.maxX);
      const zGap = Math.max(b.minZ, o.minZ) - Math.min(b.maxZ, o.maxZ);
      const xOverlap = Math.min(b.maxX, o.maxX) - Math.max(b.minX, o.minX);
      const zOverlap = Math.min(b.maxZ, o.maxZ) - Math.max(b.minZ, o.minZ);
      return axis === "x" ? zOverlap > 1 && xGap > -0.05 && xGap < 1.2 : xOverlap > 1 && zGap > -0.05 && zGap < 1.2;
    });
  if (beside("x")) {
    if (near.includes("south")) return "south";
    if (near.includes("north")) return "north";
  }
  if (beside("z")) {
    if (near.includes("west")) return "west";
    if (near.includes("east")) return "east";
  }
  const wideX = b.maxX - b.minX >= b.maxZ - b.minZ;
  const prefer: Face[] = wideX ? ["south", "north", "west", "east"] : ["west", "east", "south", "north"];
  for (const f of prefer) if (near.includes(f)) return f;
  return near[0]!;
}

function placeFronts(out: Placement[], specs: Record<BKind, Spec>, frame: typeof DISTRICT) {
  const half = (frame.grid * frame.cell) / 2;
  const masses = lotMasses(frame).filter((b) => b.h > 2);
  const groups = new Map<string, BlockBox[]>();
  for (const b of masses) {
    const gx = Math.floor((b.minX + half) / frame.cell);
    const gz = Math.floor((b.minZ + half) / frame.cell);
    const key = `${gx},${gz}`;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    for (const b of list) {
      const face = frontFace(b, list, frame);
      const span = b.maxX - b.minX;
      const depth = b.maxZ - b.minZ;
      const along = face === "west" || face === "east" ? depth : span;
      const into = face === "west" || face === "east" ? span : depth;
      const thin = Math.min(span, depth);
      const kind: BKind = b.h > 22 || thin > 14 ? (thin > 12 ? "large" : "medium") : b.h < 12 && thin < 11 ? "small" : "medium";
      const spec = specs[kind];
      const salt = Math.round(b.minX * 3 + b.minZ);
      const setback = Math.min(0.45 + unit(salt, Math.round(b.maxX + b.maxZ), 15) * 1.65, into * 0.26);
      const fitDepth = spec.depth > 0.01 ? Math.min(1, (into - setback - 0.12) / spec.depth) : 1;
      if (fitDepth < 0.18) continue;
      const gap = 0.9;
      const widthAt = spec.width * fitDepth;
      let count = 1;
      if (widthAt * 2 + gap <= along - 0.2) count = 2;
      if (widthAt * 3 + gap * 2 <= along - 0.2) count = 3;
      const fitW = spec.width > 0.01 ? (along - gap * (count - 1) - 0.15) / (spec.width * count) : 1;
      const fit = Math.min(fitDepth, fitW, 1);
      if (fit < 0.18) continue;
      const piece = spec.width * fit;
      const total = piece * count + gap * (count - 1);
      const midAlong = face === "west" || face === "east" ? (b.minZ + b.maxZ) / 2 : (b.minX + b.maxX) / 2;
      const start = midAlong - total / 2 + piece / 2;
      const across = face === "west" ? b.minX + setback : face === "east" ? b.maxX - setback : face === "south" ? b.minZ + setback : b.maxZ - setback;
      const along0 = face === "west" || face === "east" ? b.minZ : b.minX;
      const along1 = face === "west" || face === "east" ? b.maxZ : b.maxX;
      for (let i = 0; i < count; i++) {
        const slide = (unit(salt, i + 3, 21) - 0.5) * 0.5;
        const at = Math.min(along1 - piece / 2 - 0.08, Math.max(along0 + piece / 2 + 0.08, start + i * (piece + gap) + slide));
        const x = face === "west" || face === "east" ? across : at;
        const z = face === "west" || face === "east" ? at : across;
        const bulk = 0.94 + unit(Math.round(x * 5), Math.round(z * 5), 17 + i) * 0.2;
        out.push({ kind, x, y: LIFT + groundY(x, z), z, yaw: FACE_YAW[face], sx: fit, sy: fit * bulk, sz: fit, face });
      }
    }
  }
}

export function layoutDistrict(specs: Record<BKind, Spec>, frame = DISTRICT): Placement[] {
  const out: Placement[] = [];
  const half = (frame.grid * frame.cell) / 2;
  const lines: number[] = [];
  for (let i = 0; i <= frame.grid; i++) lines.push(-half + i * frame.cell);
  const gap = frame.cell - CROSS;
  const tiles = 5;
  const tileLen = gap / tiles;
  const stretch = tileLen / TILE_LEN;

  for (const x of lines) {
    for (const z of lines) out.push(flat("cross", x, z, 0, 1));
  }
  for (const x of lines) {
    for (let j = 0; j < lines.length - 1; j++) {
      const z0 = lines[j]! + CROSS / 2;
      for (let k = 0; k < tiles; k++) {
        out.push(flat("street", x, z0 + tileLen * (k + 0.5), Math.PI / 2, stretch));
      }
    }
  }
  for (const z of lines) {
    for (let i = 0; i < lines.length - 1; i++) {
      const x0 = lines[i]! + CROSS / 2;
      for (let k = 0; k < tiles; k++) {
        out.push(flat("street", x0 + tileLen * (k + 0.5), z, 0, stretch));
      }
    }
  }

  placeFronts(out, specs, frame);
  return out;
}

function flat(kind: "street" | "cross", x: number, z: number, yaw: number, stretch: number): Placement {
  return { kind, x, y: LIFT + groundY(x, z), z, yaw, sx: stretch, sy: 1, sz: 1, face: null };
}

/** Two tones per side, so a row is not one wash. Height stays near the kit, not a squash. */
export function districtLook(x: number, z: number, kind: BKind): { tint: number; height: number } {
  const n = Math.abs(Math.sin(x * 0.17 + z * 0.13));
  const alt = Math.sin(x * 0.09 + z * 0.15 + 2.2) > 0.15;
  let tint = alt ? 0xe6d7c4 : 0xcfc3b0;
  if (x < -40) tint = alt ? 0xf0d2b4 : 0xd9b294;
  else if (x > 40) tint = alt ? 0xc9d7ea : 0xaebfc4;
  else if (z < -40) tint = alt ? 0xe7d3bf : 0xc9a88e;
  else if (z > 40) tint = alt ? 0xd5d8e4 : 0xb7c3b2;
  const base = kind === "large" ? 1.04 : kind === "medium" ? 0.96 : 0.9;
  const spread = kind === "large" ? 0.34 : kind === "medium" ? 0.14 : 0.08;
  return { tint, height: base + n * spread };
}

type Bake = { geo: THREE.BufferGeometry; mat: THREE.Material; cast: boolean };

export type CityHandle = { dispose: () => void };

export async function mountCity(
  scene: THREE.Scene,
  qualityHigh: boolean,
  frame = DISTRICT,
): Promise<CityHandle> {
  const loader = new GLTFLoader();
  const base = "/vendor/quaternius/downtown-city-megakit";
  const files: Record<BKind | "street" | "cross", string> = {
    large: `${base}/Building_Large_2.gltf`,
    medium: `${base}/Building_Medium_2_001.gltf`,
    small: `${base}/Building_Small_1.gltf`,
    street: `${base}/Street_4Lane.gltf`,
    cross: `${base}/Street_4WayIntersection.gltf`,
  };
  const loaded = await Promise.all(
    (Object.keys(files) as Array<keyof typeof files>).map(async (key) => {
      const gltf = await loader.loadAsync(files[key]);
      return [key, gltf.scene] as const;
    }),
  );
  const baked = new Map<keyof typeof files, { parts: Bake[]; spec: Spec }>();
  for (const [key, root] of loaded) {
    baked.set(key, key === "street" || key === "cross" ? bakeRoad(root) : bakeBuilding(root));
  }
  const specs = {
    large: baked.get("large")!.spec,
    medium: baked.get("medium")!.spec,
    small: baked.get("small")!.spec,
  };
  const placements = layoutDistrict(specs, frame);
  const meshes: THREE.InstancedMesh[] = [];
  const geos = new Set<THREE.BufferGeometry>();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const place = (inst: THREE.InstancedMesh, item: Placement, height: number, i: number) => {
    q.setFromAxisAngle(up, item.yaw);
    p.set(item.x, item.y, item.z);
    s.set(item.sx, item.sy * height, item.sz);
    inst.setMatrixAt(i, m.compose(p, q, s));
  };
  for (const key of Object.keys(files) as Array<keyof typeof files>) {
    const group = placements.filter((item) => item.kind === key);
    if (group.length === 0) continue;
    const parts = baked.get(key)!.parts;
    if (key === "street" || key === "cross") {
      for (const part of parts) {
        const inst = new THREE.InstancedMesh(part.geo, part.mat, group.length);
        geos.add(part.geo);
        inst.frustumCulled = false;
        inst.castShadow = false;
        inst.receiveShadow = qualityHigh;
        group.forEach((item, i) => place(inst, item, 1, i));
        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);
        meshes.push(inst);
      }
      continue;
    }
    const buckets = new Map<number, Placement[]>();
    for (const item of group) {
      const look = districtLook(item.x, item.z, key);
      const list = buckets.get(look.tint) ?? [];
      list.push(item);
      buckets.set(look.tint, list);
    }
    for (const [tint, items] of buckets) {
      const color = new THREE.Color(tint);
      for (const part of parts) {
        const mat = (part.mat as THREE.MeshStandardMaterial).clone();
        if (mat.color) mat.color.multiply(color);
        const inst = new THREE.InstancedMesh(part.geo, mat, items.length);
        geos.add(part.geo);
        inst.frustumCulled = false;
        inst.castShadow = qualityHigh && part.cast;
        inst.receiveShadow = qualityHigh;
        items.forEach((item, i) => place(inst, item, districtLook(item.x, item.z, key).height, i));
        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);
        meshes.push(inst);
      }
    }
    for (const part of parts) part.mat.dispose();
  }
  return {
    dispose() {
      for (const mesh of meshes) {
        mesh.removeFromParent();
        const mat = mesh.material as THREE.Material;
        mat.dispose();
      }
      for (const geo of geos) geo.dispose();
      meshes.length = 0;
    },
  };
}

function bakeBuilding(root: THREE.Object3D): { parts: Bake[]; spec: Spec } {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const spec = { width: box.max.x - box.min.x, depth: box.max.z - box.min.z };
  const shift = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -box.max.z);
  return { parts: bakeMeshes(root, shift, false), spec };
}

function bakeRoad(root: THREE.Object3D): { parts: Bake[]; spec: Spec } {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  return { parts: bakeMeshes(root, new THREE.Matrix4(), true), spec: { width: box.max.x - box.min.x, depth: box.max.z - box.min.z } };
}

function bakeMeshes(root: THREE.Object3D, shift: THREE.Matrix4, road: boolean): Bake[] {
  const parts: Bake[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    geo.applyMatrix4(shift);
    const src = mesh.material as THREE.MeshStandardMaterial;
    const mat = src.clone();
    mat.envMapIntensity = 1.15;
    const name = src.name || "";
    if (/decal/i.test(name)) geo.translate(0, 0.02, 0);
    if (/glass/i.test(name)) {
      mat.transparent = true;
      mat.depthWrite = false;
    }
    mat.shadowSide = THREE.FrontSide;
    const skipCast = /glass|fake|interior|decal/i.test(name) || road;
    parts.push({ geo, mat, cast: !skipCast });
  });
  return parts;
}

/**
 * KayKit City Builder Bits (CC0), sidewalk scale in the open plaza.
 * The pieces are about 2 m, so they stay kiosks. They do not replace the
 * downtown blocks and they do not add colliders or lights.
 */
export async function mountDressing(scene: THREE.Scene): Promise<CityHandle> {
  const loader = new GLTFLoader();
  const root = new THREE.Group();
  scene.add(root);
  const base = "/vendor/kaykit/city-builder-bits";
  const props: Array<{ file: string; x: number; z: number; yaw: number; s: number }> = [
    { file: "building_A.gltf", x: -15, z: -15, yaw: 0.4, s: 2.45 },
    { file: "building_C.gltf", x: -15, z: 14, yaw: 1.1, s: 2.35 },
    { file: "building_E.gltf", x: -5, z: 15, yaw: 0.15, s: 2.4 },
    { file: "building_G.gltf", x: 6, z: 15, yaw: -0.2, s: 2.3 },
    { file: "building_B.gltf", x: 15, z: 8, yaw: Math.PI, s: 2.4 },
    { file: "building_D.gltf", x: 15, z: -4, yaw: -1.4, s: 2.25 },
    { file: "building_F.gltf", x: -15, z: 2, yaw: Math.PI / 2, s: 2.35 },
    { file: "building_H.gltf", x: 2, z: -15, yaw: 0.8, s: 2.2 },
    { file: "bench.gltf", x: -8, z: -15.5, yaw: 0.2, s: 6 },
    { file: "bench.gltf", x: 8, z: 15.5, yaw: Math.PI, s: 6 },
    { file: "dumpster.gltf", x: -15.2, z: 6, yaw: 0.4, s: 5 },
    { file: "streetlight.gltf", x: -16.2, z: -6, yaw: 0, s: 3.6 },
    { file: "streetlight.gltf", x: 16.2, z: 2, yaw: Math.PI, s: 3.6 },
    { file: "firehydrant.gltf", x: 12, z: 15.2, yaw: 0, s: 3.5 },
    { file: "bush.gltf", x: -12, z: 10, yaw: 0, s: 4 },
    { file: "bush.gltf", x: 10, z: -15, yaw: 1, s: 4 },
    { file: "watertower.gltf", x: -6, z: -6, yaw: 0.4, s: 4.8 },
    { file: "box_A.gltf", x: -10, z: -8, yaw: 0.6, s: 4.2 },
    { file: "box_B.gltf", x: 4, z: -12, yaw: 1.2, s: 4 },
    { file: "trash_A.gltf", x: 14, z: 12, yaw: 0.3, s: 4.5 },
    { file: "trash_B.gltf", x: -8, z: 8, yaw: -0.4, s: 4.5 },
    { file: "trafficlight_A.gltf", x: -14, z: -14, yaw: 0.8, s: 4.2 },
    { file: "trafficlight_B.gltf", x: 14, z: 14, yaw: Math.PI, s: 4.2 },
    { file: "trafficlight_C.gltf", x: -14, z: 14, yaw: Math.PI / 2, s: 4.2 },
  ];
  await Promise.all(
    props.map(async (prop) => {
      const gltf = await loader.loadAsync(`${base}/${prop.file}`);
      const model = gltf.scene;
      model.position.set(prop.x, groundY(prop.x, prop.z), prop.z);
      model.rotation.y = prop.yaw;
      model.scale.setScalar(prop.s);
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          if ("envMapIntensity" in std) std.envMapIntensity = 1.15;
        }
      });
      root.add(model);
    }),
  );
  return {
    dispose() {
      root.removeFromParent();
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) mat.dispose();
      });
    },
  };
}
