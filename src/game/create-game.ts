import * as THREE from "three/webgpu";
import { CHARACTER_SAVE_KEY, PLAYABLES, playableById } from "./roster.ts";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import {
  abs,
  float,
  floor,
  fract,
  instanceColor,
  length,
  max,
  mix,
  normalLocal,
  pass,
  positionWorld,
  screenUV,
  sin,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
} from "three/tsl";
import { blurb, hustleById, hustlesAt, resolveHustle, scoreHustle, scoreSpend, spendBlurb, spendById, SPENDS, type HustlePlace, type SpendDef } from "@/game/economy";
import {
  choosePadIndex,
  forgetPadLayout,
  layoutFor,
  LOOK_PITCH_DRIVE,
  LOOK_PITCH_FOOT,
  LOOK_YAW_DRIVE,
  LOOK_YAW_FOOT,
  padWindowLive,
  radialDeadzone,
  readGamepads,
  responseCurve,
  sampleAxes,
  triggerFeel,
} from "@/game/gamepad";
import {
  actorKey,
  BEATS,
  createActor,
  disposeCast,
  gunFor,
  loadCast,
  parkActor,
  clipPace,
  locomotionPose,
  hopVelocity,
  placeActor,
  setHeldGun,
  shootHold,
  sirenThreat,
  stepHop,
  travelYaw,
  updateActor,
  type Actor,
  type Beat,
  type CastLibrary,
  type Melee,
  type ReactKind,
} from "@/game/cast";
import { groundY, districtColliders, mountCity, mountDressing, type CityHandle } from "@/game/city";
import { characterProfile } from "./wardrobe.ts";
import { bodyFor, loadFleet, type Fleet, type FleetBody } from "@/game/fleet";
import { PED_GAP, PLAYER_BUBBLE, separateCrowd } from "@/game/crowd";
import { HALL_ORIGIN, hallWalls, mountHall, type HallHandle } from "@/game/hall";
import { isRoomId, ROOM_SPAWN_Z, roomById, roomList, roomWorldWalls, type RoomId } from "@/game/room-layout";
import { mountRooms, type RoomsHandle } from "@/game/rooms";
import {
  affordable,
  buyCar as buyCarDeed,
  buyHouse,
  buyShop,
  catalogCars,
  catalogHouses,
  catalogShops,
  deathLoss,
  depositStash,
  emptyProperty,
  healRates,
  parkCar,
  PROPERTY_VERSION,
  sellHouse,
  sellShop,
  shopTick,
  shopVisit,
  starClear,
  takeCar,
  withdrawStash,
  type CarBody,
  type HouseId,
  type PropertyState,
  type ShopId,
  type ShopKind,
} from "@/game/property";
import {
  CASINO_FLOOR,
  double as doubleBj,
  hit as hitBj,
  playBaccarat,
  rollCraps,
  spinRoulette,
  spinSlots,
  split as splitBj,
  stand as standBj,
  startBlackjack,
  type BaccaratResult,
  type BaccaratSide,
  type BlackjackState,
  type CrapsResult,
  type RouletteKind,
  type RouletteResult,
  type SlotsResult,
} from "@/game/casino";
import { blockAt, type BaySlot, type Desk, type FixerItem, type JobCard, type UiCmd } from "@/game/desk";

export type Phase = "menu" | "play" | "pause" | "dead";

export type HudSnapshot = {
  phase: Phase;
  health: number;
  armor: number;
  wanted: number;
  cash: number;
  bank: number;
  loot: number;
  best: number;
  speedMph: number;
  driving: boolean;
  toast: string;
  cooling: boolean;
  looking: boolean;
  pad: boolean;
  /** Live controller line. Empty only before the first poll. */
  padStatus: string;
  lostCash: number;
  error: string;
  gun: string;
  ammo: string;
  job: string;
  radio: string;
  shop: string;
  nearShop: boolean;
  drifting: boolean;
  cover: boolean;
  hustle: string;
  hustlePct: number;
  nearWork: boolean;
  nearTeller: boolean;
  assets: string;
  portfolio: string;
  character: string;
  characterReady: boolean;
  pauseSel: number;
  desk: Desk | null;
  navSeq: number;
  navKey: string;
  guns: { id: GunId; name: string; mag: number; reserve: number; owned: boolean; active: boolean }[];
  stations: { name: string; active: boolean }[];
};

export type TouchInput = {
  x: number;
  y: number;
  lookX: number;
  lookY: number;
  fire: boolean;
  sprint: boolean;
  meleeQueued: boolean;
  jumpQueued: boolean;
  useQueued: boolean;
  reloadQueued: boolean;
  cycleGunQueued: boolean;
  radioQueued: boolean;
  hustleQueued: boolean;
  bankQueued: boolean;
  buy: "" | BuyKind;
};

export type GameHandle = {
  selectCharacter: (id: string) => void;
  previewCharacter: (action: "turn" | "pose") => void;
  start: () => void;
  respawn: () => void;
  resume: () => void;
  quit: () => void;
  focusPause: (index: number) => void;
  dispose: () => void;
  command: (cmd: UiCmd) => void;
  touch: TouchInput;
};

type Faction = "civ" | "amber" | "teal" | "cop";
type PedState = "walk" | "flee" | "fight" | "down";
type CarMode = "locked" | "player" | "traffic" | "chase" | "idle" | "coast" | "search" | "block" | "tail";
type Ride = "sport" | "sedan" | "van" | "cruiser";
type GunId = "pistol" | "shotgun" | "smg";
type JobKind = "deliver" | "shake" | "hit";
type BuyKind = "bail" | "vest" | "shotgun" | "sport";

type AABB = { minX: number; maxX: number; minZ: number; maxZ: number; h: number };
type Vec = { x: number; z: number };

type Car = {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  hp: number;
  maxHp: number;
  mode: CarMode;
  color: number;
  wps: Vec[];
  wp: number;
  alarm: boolean;
  hadDriver: boolean;
  maxSpeed: number;
  stuckT: number;
  spin: number;
  shootCd: number;
  police: boolean;
  ride: Ride;
  body: FleetBody;
  lat: number;
  block: boolean;
  forSale: boolean;
  deedId: string;
};

type Ped = {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  faction: Faction;
  state: PedState;
  active: boolean;
  cd: number;
  goal: number;
  goals: Vec[];
  color: number;
  bob: number;
  respawn: number;
  dive: number;
  mark: number;
  ally: boolean;
  maxHp: number;
  fall: number;
  downFor: number;
  er: boolean;
  settled: boolean;
  byPlayer: boolean;
  beat: Beat;
  look: number;
  linger: number;
  lingerFor: number;
  walkPace: number;
  shootPose: number;
  shotGen: number;
  flinch: number;
  flinchGen: number;
  react: ReactKind;
  melee: number;
  meleeKind: 0 | 1 | 2;
  meleeGen: number;
  brawl: number;
  speed: number;
  prevX: number;
  prevZ: number;
  fleeFor: number;
};

type Pickup = { x: number; z: number; kind: "med" | "armor"; wait: number };
type Shot = { x: number; y: number; z: number; x2: number; y2: number; z2: number; life: number };

const CELL = 50;
const ROAD = 16;
const GRID = 5;
const WORLD = GRID * CELL;
const HALF = WORLD / 2;
const LANE = 2.75;
const MAX_SHOTS = 48;

const PAINTS = [0xc44536, 0xe6d3a3, 0x1f6f6a, 0xf4f1ea, 0x2a2e38, 0xd4a017, 0x6b3a5d, 0x87a0b5, 0xb5521a, 0x243246];

const RIDES: Record<Ride, { maxHp: number; vmax: number; cruise: number; accel: number; turn: number; mass: number; scale: [number, number, number] }> = {
  sport: { maxHp: 150, vmax: 42, cruise: 18, accel: 36, turn: 2.55, mass: 0.75, scale: [0.9, 0.7, 0.88] },
  sedan: { maxHp: 210, vmax: 32, cruise: 14, accel: 24, turn: 2.15, mass: 1, scale: [1, 0.96, 1.05] },
  van: { maxHp: 360, vmax: 24, cruise: 12, accel: 15, turn: 1.45, mass: 1.8, scale: [1.28, 1.5, 1.4] },
  cruiser: { maxHp: 280, vmax: 36, cruise: 16, accel: 26, turn: 2.05, mass: 1.3, scale: [1.08, 1.02, 1.18] },
};

const GUNS: Record<GunId, { cd: number; reload: number; spread: number; dmg: number; pellets: number; range: number; mag: number }> = {
  pistol: { cd: 0.22, reload: 1.05, spread: 0.016, dmg: 34, pellets: 1, range: 70, mag: 12 },
  shotgun: { cd: 0.64, reload: 1.55, spread: 0.15, dmg: 15, pellets: 5, range: 16, mag: 6 },
  smg: { cd: 0.08, reload: 1.2, spread: 0.055, dmg: 13, pellets: 1, range: 44, mag: 30 },
};

const RADIO = ["NIGHTLINE", "LOW KING", "TEAL WAVE", "SIREN FM"];

function carRadius(ride: Ride) {
  const s = RIDES[ride].scale;
  return 1.22 * ((s[0] + s[2]) * 0.5);
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

function wrap(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function yawTo(x: number, z: number, tx: number, tz: number) {
  return Math.atan2(-(tx - x), -(tz - z));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roadLines() {
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i <= GRID; i++) {
    xs.push(-HALF + i * CELL);
    zs.push(-HALF + i * CELL);
  }
  return { xs, zs };
}

function circleHitsAABB(x: number, z: number, r: number, b: AABB) {
  const cx = clamp(x, b.minX, b.maxX);
  const cz = clamp(z, b.minZ, b.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

function pushCircle(x: number, z: number, r: number, b: AABB) {
  const cx = clamp(x, b.minX, b.maxX);
  const cz = clamp(z, b.minZ, b.maxZ);
  let dx = x - cx;
  let dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return { x, z, hit: false };
  if (d2 < 1e-8) {
    const left = x - b.minX;
    const right = b.maxX - x;
    const down = z - b.minZ;
    const up = b.maxZ - z;
    const m = Math.min(left, right, down, up);
    if (m === left) return { x: b.minX - r - 0.01, z, hit: true };
    if (m === right) return { x: b.maxX + r + 0.01, z, hit: true };
    if (m === down) return { x, z: b.minZ - r - 0.01, hit: true };
    return { x, z: b.maxZ + r + 0.01, hit: true };
  }
  const d = Math.sqrt(d2);
  const k = (r - d) / d;
  return { x: x + dx * k, z: z + dz * k, hit: true };
}

function rayAABB(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  b: AABB,
  maxT: number,
) {
  let tmin = 0;
  let tmax = maxT;
  const pad = groundY((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2);
  const min = [b.minX, pad, b.minZ];
  const max = [b.maxX, b.h + pad, b.maxZ];
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]!) < 1e-8) {
      if (o[i]! < min[i]! || o[i]! > max[i]!) return null;
    } else {
      let t1 = (min[i]! - o[i]!) / d[i]!;
      let t2 = (max[i]! - o[i]!) / d[i]!;
      if (t1 > t2) {
        const s = t1;
        t1 = t2;
        t2 = s;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
}

function rayCylinder(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cz: number,
  r: number,
  y0: number,
  y1: number,
  maxT: number,
) {
  const lx = ox - cx;
  const lz = oz - cz;
  const a = dx * dx + dz * dz;
  const b = 2 * (lx * dx + lz * dz);
  const c = lx * lx + lz * lz - r * r;
  if (a < 1e-8) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  let t = (-b - s) / (2 * a);
  if (t < 0 || t > maxT) t = (-b + s) / (2 * a);
  if (t < 0 || t > maxT) return null;
  const y = oy + dy * t;
  if (y < y0 || y > y1) return null;
  return t;
}

function blockLoop(xs: number[], zs: number[], i: number, j: number): Vec[] {
  const x0 = xs[i]!;
  const x1 = xs[i + 1]!;
  const z0 = zs[j]!;
  const z1 = zs[j + 1]!;
  const L = LANE;
  const pts: Vec[] = [];
  const steps = 3;
  const zA = z0 + 12;
  const zB = z1 - 12;
  const xA = x0 + 12;
  const xB = x1 - 12;
  for (let s = 0; s <= steps; s++) pts.push({ x: x0 + L, z: zA + ((zB - zA) * s) / steps });
  for (let s = 1; s <= steps; s++) pts.push({ x: xA + ((xB - xA) * s) / steps, z: z1 + L });
  for (let s = 1; s <= steps; s++) pts.push({ x: x1 - L, z: zB + ((zA - zB) * s) / steps });
  for (let s = 1; s <= steps; s++) pts.push({ x: xB + ((xA - xB) * s) / steps, z: z0 - L });
  return pts;
}

function makeWindowTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 768;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1a1c22";
  g.fillRect(0, 0, 512, 768);
  for (let i = 0; i < 5000; i++) {
    const v = 22 + ((i * 13) % 28);
    g.fillStyle = `rgba(${v},${v - 2},${v + 2},${0.35 + (i % 5) * 0.08})`;
    g.fillRect((i * 47) % 512, (i * 91) % 768, i % 4 === 0 ? 4 : 1, i % 6 === 0 ? 3 : 1);
  }
  g.strokeStyle = "rgba(8,9,12,0.55)";
  g.lineWidth = 2;
  for (let y = 0; y < 768; y += 6) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y + ((y * 3) % 5) - 2);
    g.stroke();
  }
  const warms = ["#ffb14a", "#e39a3a", "#f4e7cf", "#c9842a", "#8a6238", "#ffd7a1"];
  const cools = ["#b7d4e4", "#3ecfc0", "#7f9cb4", "#d5e2ea", "#6aa8c4"];
  const paint = (x: number, y: number, lit: string, on: boolean, kind: number) => {
    g.fillStyle = "#2a2c32";
    g.fillRect(x - 4, y - 4, 108, 112);
    g.fillStyle = "#0c0e14";
    g.fillRect(x, y, 100, 104);
    g.fillStyle = "#3a342c";
    g.fillRect(x, y + 100, 100, 6);
    if (!on) {
      g.fillStyle = "#12151c";
      g.fillRect(x + 6, y + 6, 88, 90);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(x + 6, y + 6, 18, 90);
      return;
    }
    const grd = g.createLinearGradient(x, y, x + 88, y + 90);
    grd.addColorStop(0, lit);
    grd.addColorStop(0.55, lit);
    grd.addColorStop(1, "#1a120c");
    g.fillStyle = grd;
    g.fillRect(x + 6, y + 6, 88, 90);
    g.fillStyle = "rgba(8,9,12,0.55)";
    g.fillRect(x + 48, y + 6, 3, 90);
    g.fillRect(x + 6, y + 48, 88, 3);
    if (kind % 3 === 0) {
      g.fillStyle = "rgba(90, 28, 36, 0.55)";
      g.fillRect(x + 10, y + 8, 16, 86);
    } else if (kind % 3 === 1) {
      g.fillStyle = "rgba(20, 16, 12, 0.4)";
      g.fillRect(x + 58, y + 20, 28, 70);
    }
    g.fillStyle = "rgba(255,244,220,0.28)";
    g.fillRect(x + 10, y + 10, 8, 40);
  };
  let n = 0;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      const roll = (row * 13 + col * 7) % 10;
      const on = roll > 2 && roll !== 4;
      const lit = roll > 7 ? cools[n % cools.length]! : warms[n % warms.length]!;
      paint(18 + col * 128, 24 + row * 128, lit, on, n);
      n++;
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function makeGroundTexture(xs: number[], zs: number[]) {
  const TEX = 1024;
  const c = document.createElement("canvas");
  c.width = TEX;
  c.height = TEX;
  const g = c.getContext("2d")!;
  const px = (v: number) => ((v + HALF) / WORLD) * TEX;
  g.fillStyle = "#161820";
  g.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = i % 3 ? "#16181e" : "#0c0d11";
    g.fillRect(Math.random() * TEX, Math.random() * TEX, 2, 2);
  }
  const band = (draw: (at: number) => void, lines: number[]) => {
    for (const line of lines) draw(line);
  };
  g.fillStyle = "#6e685c";
  band((x) => {
    const a = px(x - ROAD / 2 - 4.2);
    const b = px(x + ROAD / 2 + 4.2);
    g.fillRect(a, 0, b - a, TEX);
  }, xs);
  band((z) => {
    const a = px(z - ROAD / 2 - 4.2);
    const b = px(z + ROAD / 2 + 4.2);
    g.fillRect(0, a, TEX, b - a);
  }, zs);
  g.fillStyle = "#6a6458";
  band((x) => {
    const a = px(x - ROAD / 2 - 0.35);
    const b = px(x + ROAD / 2 + 0.35);
    g.fillRect(a, 0, Math.max(1, px(x - ROAD / 2) - a), TEX);
    g.fillRect(px(x + ROAD / 2), 0, Math.max(1, b - px(x + ROAD / 2)), TEX);
  }, xs);
  band((z) => {
    const a = px(z - ROAD / 2 - 0.35);
    const b = px(z + ROAD / 2 + 0.35);
    g.fillRect(0, a, TEX, Math.max(1, px(z - ROAD / 2) - a));
    g.fillRect(0, px(z + ROAD / 2), TEX, Math.max(1, b - px(z + ROAD / 2)));
  }, zs);
  g.fillStyle = "#141820";
  band((x) => {
    const a = px(x - ROAD / 2);
    const b = px(x + ROAD / 2);
    g.fillRect(a, 0, b - a, TEX);
  }, xs);
  band((z) => {
    const a = px(z - ROAD / 2);
    const b = px(z + ROAD / 2);
    g.fillRect(0, a, TEX, b - a);
  }, zs);
  g.fillStyle = "rgba(255, 236, 210, 0.045)";
  band((x) => {
    const a = px(x - 0.35);
    g.fillRect(a, 0, Math.max(1, px(x + 0.35) - a), TEX);
  }, xs);
  band((z) => {
    const a = px(z - 0.35);
    g.fillRect(0, a, TEX, Math.max(1, px(z + 0.35) - a));
  }, zs);
  g.strokeStyle = "rgba(20, 18, 16, 0.45)";
  g.lineWidth = 1;
  for (const x of xs) {
    const left = px(x - ROAD / 2 - 4.1);
    const right = px(x + ROAD / 2 + 0.4);
    for (let y = 0; y < TEX; y += 18) {
      g.strokeRect(left, y, px(3.6) - px(0), 14);
      g.strokeRect(right, y, px(3.6) - px(0), 14);
    }
  }
  g.fillStyle = "#cbb98a";
  for (const x of xs) {
    for (let z = -HALF + 6; z < HALF; z += 8) {
      let near = false;
      for (const hz of zs) if (Math.abs(z - hz) < ROAD / 2 + 1) near = true;
      if (near) continue;
      g.fillRect(px(x - 0.2), px(z), Math.max(2, px(x + 0.2) - px(x - 0.2)), px(z + 4.4) - px(z));
    }
  }
  for (const z of zs) {
    for (let x = -HALF + 6; x < HALF; x += 8) {
      let near = false;
      for (const vx of xs) if (Math.abs(x - vx) < ROAD / 2 + 1) near = true;
      if (near) continue;
      g.fillRect(px(x), px(z - 0.2), px(x + 4.4) - px(x), Math.max(2, px(z + 0.2) - px(z - 0.2)));
    }
  }
  g.fillStyle = "#f6f1e6";
  for (const x of xs) {
    for (const z of zs) {
      g.fillRect(px(x - ROAD / 2), px(z - 0.35), px(ROAD) - px(0), px(0.7) - px(0));
      g.fillRect(px(x - 0.35), px(z - ROAD / 2), px(0.7) - px(0), px(ROAD) - px(0));
      const stripe = (ox: number, oz: number, w: number, h: number) => g.fillRect(px(ox), px(oz), px(w) - px(0), px(h) - px(0));
      for (let i = -2; i <= 2; i++) {
        stripe(x + i * 1.15 - 0.32, z + ROAD / 2 - 3.6, 0.64, 2.5);
        stripe(x + i * 1.15 - 0.32, z - ROAD / 2 + 1.1, 0.64, 2.5);
        stripe(x + ROAD / 2 - 3.6, z + i * 1.15 - 0.32, 2.5, 0.64);
        stripe(x - ROAD / 2 + 1.1, z + i * 1.15 - 0.32, 2.5, 0.64);
      }
    }
  }
  g.fillStyle = "#2a3330";
  g.beginPath();
  g.arc(px(0), px(0), px(16) - px(0), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255, 176, 32, 0.08)";
  g.fillRect(0, 0, px(-28), TEX);
  g.fillStyle = "rgba(62, 224, 197, 0.07)";
  g.fillRect(px(28), 0, TEX - px(28), TEX);
  g.fillStyle = "rgba(6, 7, 10, 0.08)";
  g.fillRect(0, 0, px(-82), TEX);
  g.fillRect(px(82), 0, TEX - px(82), TEX);
  g.fillRect(0, 0, TEX, px(-82));
  g.fillRect(0, px(82), TEX, TEX - px(82));
  g.fillStyle = "rgba(150, 148, 140, 0.16)";
  g.fillRect(px(-30), px(36), px(30) - px(-30), TEX - px(36));
  for (let i = 0; i < 700; i++) {
    g.fillStyle = i % 2 ? "rgba(180,190,200,0.05)" : "rgba(0,0,0,0.28)";
    g.fillRect(Math.random() * TEX, Math.random() * TEX, 22, 1);
  }
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 1;
  for (const x of xs) {
    for (let k = 0; k < 6; k++) {
      const y0 = Math.random() * TEX;
      g.beginPath();
      g.moveTo(px(x - ROAD / 4 + k * 1.4), y0);
      g.lineTo(px(x - ROAD / 4 + k * 1.4) + 6, y0 + 40 + k * 8);
      g.stroke();
    }
  }
  g.fillStyle = "rgba(8,8,10,0.55)";
  for (let i = 0; i < 18; i++) {
    const x = px(-HALF + Math.random() * WORLD);
    const y = px(-HALF + Math.random() * WORLD);
    g.beginPath();
    g.ellipse(x, y, 10 + Math.random() * 22, 4 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "rgba(190, 206, 216, 0.1)";
  for (const x of xs) {
    const a = px(x - ROAD / 2 + 1.15);
    g.fillRect(a, 0, px(x + ROAD / 2 - 1.15) - a, TEX);
  }
  for (const z of zs) {
    const a = px(z - ROAD / 2 + 1.15);
    g.fillRect(0, a, TEX, px(z + ROAD / 2 - 1.15) - a);
  }
  const rc = document.createElement("canvas");
  rc.width = TEX;
  rc.height = TEX;
  const rg = rc.getContext("2d")!;
  rg.fillStyle = "#b4b4b4";
  rg.fillRect(0, 0, TEX, TEX);
  rg.fillStyle = "#3a3a3a";
  band((x) => {
    const a = px(x - ROAD / 2);
    const b = px(x + ROAD / 2);
    rg.fillRect(a, 0, b - a, TEX);
  }, xs);
  band((z) => {
    const a = px(z - ROAD / 2);
    const b = px(z + ROAD / 2);
    rg.fillRect(0, a, TEX, b - a);
  }, zs);
  rg.fillStyle = "#2a2a2a";
  for (const x of xs) {
    for (const z of zs) {
      rg.fillRect(px(x - ROAD / 2), px(z - 0.35), px(ROAD) - px(0), px(0.7) - px(0));
      rg.fillRect(px(x - 0.35), px(z - ROAD / 2), px(0.7) - px(0), px(ROAD) - px(0));
    }
  }
  for (let i = 0; i < 1800; i++) {
    const v = 40 + ((i * 17) % 50);
    rg.fillStyle = `rgb(${v},${v},${v})`;
    rg.fillRect((i * 53) % TEX, (i * 97) % TEX, 2, 2);
  }
  rg.fillStyle = "#101010";
  for (let i = 0; i < 28; i++) {
    rg.beginPath();
    rg.ellipse((i * 173) % TEX, (i * 97) % TEX, 30 + (i % 5) * 12, 7 + (i % 3) * 4, (i % 7) * 0.45, 0, Math.PI * 2);
    rg.fill();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 16;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  const rough = new THREE.CanvasTexture(rc);
  rough.colorSpace = THREE.NoColorSpace;
  rough.anisotropy = 16;
  return { map, rough };
}

function makeFacadeMaterial(winTex: THREE.Texture) {
  const n = abs(normalLocal);
  const p = positionWorld;
  const roof = step(float(0.65), n.y);
  const useZ = step(n.z, n.x);
  const span = mix(p.x, p.z, useZ);
  const tile = vec2(span, p.y).mul(vec2(0.28, 0.16));
  const sampled = texture(winTex, tile).rgb;
  const cell = floor(tile.x.mul(3.1)).add(floor(tile.y.mul(2.2)).mul(19));
  const flick = fract(
    sin(cell.mul(12.9898).add(floor(p.x.mul(0.17))).add(floor(p.z.mul(0.13)).mul(4.2))).mul(43758.5453),
  );
  const keep = smoothstep(float(0.18), float(0.36), flick);
  const base = mix(vec3(0.045, 0.048, 0.055), sampled, keep);
  const civic = step(float(30), abs(p.x)).oneMinus().mul(step(float(30), abs(p.z)).oneMinus());
  const outer = max(step(float(82), abs(p.x)), step(float(82), abs(p.z)));
  const north = step(float(36), p.z).mul(step(float(28), abs(p.x)).oneMinus());
  const brutalM = max(outer, north).mul(civic.oneMinus());
  const brickM = step(p.x, float(-28)).mul(brutalM.oneMinus()).mul(civic.oneMinus());
  const glassM = step(float(28), p.x).mul(brutalM.oneMinus()).mul(civic.oneMinus());
  const pour = smoothstep(float(0.9), float(0.99), fract(p.y.mul(2.2)));
  const joint = smoothstep(float(0.94), float(0.995), fract(span.mul(0.31)));
  const colU = fract(span.mul(0.2));
  const rowU = fract(p.y.mul(0.16));
  const hole = step(float(0.16), colU).mul(step(colU, float(0.4))).mul(step(float(0.24), rowU)).mul(step(rowU, float(0.58)));
  const pier = step(float(0.06), fract(span.mul(0.14))).mul(step(fract(span.mul(0.14)), float(0.2)));
  const brutalCol = mix(
    mix(vec3(0.42, 0.4, 0.36), vec3(0.16, 0.15, 0.13), max(pour, joint)),
    mix(vec3(0.02, 0.02, 0.018), vec3(0.55, 0.4, 0.2), step(float(0.88), flick)),
    hole,
  );
  const brutalLit = mix(brutalCol, mix(vec3(0.025, 0.025, 0.022), vec3(0.46, 0.45, 0.41), pier), step(p.y, float(4.4)));
  const course = smoothstep(float(0.86), float(0.98), fract(p.y.mul(1.7)));
  const brickU = fract(span.mul(1.35));
  const brickV = fract(p.y.mul(2.15).add(step(float(0.5), fract(span.mul(0.675))).mul(0.5)));
  const mortar = max(smoothstep(float(0.9), float(0.99), brickU), smoothstep(float(0.88), float(0.98), brickV));
  const brickN = fract(sin(floor(span.mul(1.35)).mul(12.3).add(floor(p.y.mul(2.15)).mul(47.1))).mul(43758.5));
  const brickCol = mix(
    mix(
      mix(mix(vec3(0.42, 0.16, 0.1), vec3(0.56, 0.24, 0.14), brickN), vec3(0.26, 0.11, 0.07), flick),
      vec3(0.14, 0.11, 0.09),
      max(mortar, course.mul(0.65)),
    ),
    vec3(1, 0.62, 0.26),
    step(float(0.74), flick).mul(step(float(3.4), p.y)).mul(mortar.oneMinus()).mul(0.7),
  );
  const mull = smoothstep(float(0), float(0.12), fract(tile.x.mul(1.6))).mul(
    smoothstep(float(0), float(0.12), fract(tile.x.mul(1.6)).oneMinus()),
  );
  const sheen = smoothstep(float(6), float(36), p.y);
  const glassCol = mix(
    mix(vec3(0.02, 0.04, 0.05), vec3(0.45, 0.62, 0.68), sheen.mul(0.35)),
    mix(vec3(0.05, 0.14, 0.16), vec3(0.25, 0.82, 0.74), keep),
    mull,
  );
  const gold = smoothstep(float(0.93), float(0.995), fract(p.y.mul(0.105)));
  const decoCol = mix(base, vec3(0.78, 0.62, 0.3), gold);
  const stoneJoint = smoothstep(float(0.9), float(0.99), fract(p.y.mul(0.2)));
  const civicCol = mix(
    mix(vec3(0.58, 0.54, 0.46), vec3(0.34, 0.32, 0.28), stoneJoint),
    vec3(0.95, 0.78, 0.48),
    step(float(0.82), flick).mul(0.4),
  );
  const styled = mix(mix(mix(decoCol, glassCol, glassM), brickCol, brickM), brutalLit, brutalM);
  const district = mix(styled, civicCol, civic);
  const floorBand = smoothstep(float(0.92), float(0.99), fract(p.y.mul(0.21))).mul(brutalM.oneMinus());
  const banded = mix(district, vec3(0.05, 0.052, 0.06), floorBand);
  const wx = fract(span.mul(0.22));
  const wy = p.y.div(3.15).clamp(0, 1);
  const pane = step(float(0.06), wx).mul(step(wx, float(0.94))).mul(step(float(0.18), wy)).mul(step(wy, float(0.92)));
  const seed = fract(sin(floor(span.mul(0.22)).mul(91.7).add(floor(p.x.add(p.z)).mul(12.3))).mul(43758.5));
  const glow = mix(vec3(1, 0.58, 0.2), vec3(0.22, 0.72, 0.66), step(float(18), abs(p.x)));
  const shop = mix(vec3(0.035, 0.037, 0.045), mix(vec3(0.07, 0.08, 0.09), glow.mul(0.72), step(float(0.62), seed)), pane);
  const shopM = step(p.y, float(3.15)).mul(brutalM.oneMinus()).mul(brickM.oneMinus());
  const face = mix(banded, shop, shopM);
  const colorNode = mix(vec3(0.045, 0.048, 0.058), face, roof.oneMinus()).mul(instanceColor);
  const luma = face.x.mul(0.3).add(face.y.mul(0.59)).add(face.z.mul(0.11));
  const emissiveNode = face.mul(smoothstep(float(0.22), float(0.5), luma)).mul(roof.oneMinus()).mul(3.8);
  const wallRough = mix(mix(mix(float(0.62), float(0.14), glassM), float(0.94), brickM), float(0.88), brutalM);
  const districtRough = mix(wallRough, float(0.74), civic);
  const shopRough = mix(districtRough, float(0.18), shopM.mul(pane));
  const roughNode = mix(float(0.96), shopRough, roof.oneMinus());
  const wallMetal = mix(mix(mix(float(0.05), float(0.78), glassM), float(0.02), brickM), float(0.04), brutalM);
  const metalNode = mix(mix(wallMetal, float(0.08), civic), float(0.62), shopM.mul(pane)).mul(roof.oneMinus());
  const mat = new THREE.MeshStandardNodeMaterial();
  mat.colorNode = colorNode;
  mat.emissiveNode = emissiveNode;
  mat.roughnessNode = roughNode;
  mat.metalnessNode = metalNode;
  mat.envMapIntensity = 1.4;
  return mat;
}

type Brand = { title: string; sub: string; fg: string; bg: string; map: string; code: string };

const BRAND: Record<string, Brand> = {
  teller: { title: "CIVIC", sub: "BANK", fg: "#f3efe4", bg: "#1c4a32", map: "#d7e6c8", code: "BK" },
  vault: { title: "VAULT", sub: "LOCK", fg: "#f0d070", bg: "#2a220c", map: "#e6c15a", code: "VT" },
  home1: { title: "ROW", sub: "HOUSE", fg: "#f3efe4", bg: "#3d2c24", map: "#e7cbb8", code: "RH" },
  home2: { title: "WALK-UP", sub: "FLATS", fg: "#f3efe4", bg: "#243044", map: "#9eb4d0", code: "WU" },
  home3: { title: "DUPLEX", sub: "HOME", fg: "#f3efe4", bg: "#3a2430", map: "#d4a0b4", code: "DX" },
  store1: { title: "MART", sub: "CORNER", fg: "#fff4ea", bg: "#8a1e1e", map: "#e23b3b", code: "M1" },
  store2: { title: "LATE", sub: "SHOP", fg: "#e8fff8", bg: "#0d3a36", map: "#3ee0c5", code: "M2" },
  roller: { title: "SUITE", sub: "NIGHT", fg: "#f6e8ff", bg: "#3a1860", map: "#b06adf", code: "SU" },
  corner1: { title: "WEST", sub: "CORNER", fg: "#fff6e8", bg: "#6a3010", map: "#e07a2f", code: "W" },
  corner2: { title: "EAST", sub: "CORNER", fg: "#e8f4ff", bg: "#14304a", map: "#4aa0e0", code: "E" },
  pawn: { title: "PAWN", sub: "CASH", fg: "#1a1208", bg: "#ffb020", map: "#ffb020", code: "PN" },
  casino: { title: "DICE", sub: "HALL", fg: "#ffe8f4", bg: "#6a1848", map: "#e04090", code: "DC" },
  fixer: { title: "FIXER", sub: "AMMO", fg: "#f3efe4", bg: "#101014", map: "#f3efe4", code: "FX" },
};

function makeSign(text: string, fg: string, bg: string, sub?: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = sub ? 256 : 160;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg;
  g.lineWidth = 10;
  g.strokeRect(10, 10, c.width - 20, c.height - 20);
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (sub) {
    g.font = "700 78px Impact, Arial Narrow, sans-serif";
    g.fillText(text, c.width / 2, 96);
    g.font = "600 44px Impact, Arial Narrow, sans-serif";
    g.fillText(sub, c.width / 2, 176);
  } else {
    g.font = "700 84px Impact, Arial Narrow, sans-serif";
    g.fillText(text, c.width / 2, c.height / 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBlocks(rand: () => number) {
  // The old waffle burned a data-dependent run of rand(). Drain the same calls
  // so cars and people keep their seed, then use the authored lot footprints.
  for (let gx = 0; gx < GRID; gx++) {
    for (let gz = 0; gz < GRID; gz++) {
      if (gx === 2 && gz === 2) continue;
      const tall = () => {
        const r = rand();
        if (r < 0.18) rand();
        else if (r < 0.72) rand();
        else rand();
      };
      if (rand() < 0.22) {
        tall();
        continue;
      }
      rand();
      rand();
      rand();
      tall();
      rand();
      rand();
      tall();
    }
  }
  return districtColliders();
}

type ArchStyle = "brutal" | "brick" | "glass" | "deco" | "civic";

function blockStyle(cx: number, cz: number, h: number, w: number, d: number): ArchStyle {
  const short = Math.min(w, d);
  const long = Math.max(w, d);
  if (h > 26 || (h > 20 && short < 11)) return "glass";
  if (short < 11 && long < 16 && h < 18) {
    const n = Math.abs(Math.sin(cx * 0.17 + cz * 0.11));
    if (n < 0.28) return "brick";
    if (n < 0.52) return "deco";
    if (n < 0.74) return "civic";
    return "glass";
  }
  if (Math.abs(cx) < 30 && Math.abs(cz) < 30 && h < 22) return "civic";
  if (h > 22 && w > 18 && d > 18 && (Math.abs(cx) > 82 || Math.abs(cz) > 82 || cz > 36)) return "brutal";
  if (cx < -28) return "brick";
  if (cx > 28) return "glass";
  if (cz > 36 && h > 16 && short > 14) return "brutal";
  return "deco";
}

function massing(b: AABB) {
  const fullW = b.maxX - b.minX;
  const fullD = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const style = blockStyle(cx, cz, b.h, fullW, fullD);
  const roomy = b.h > 11 && fullW > 6 && fullD > 6;
  let podiumH = 0;
  let midH = 0;
  let inset = 0;
  let midInset = 0;
  if (style === "glass" && roomy) {
    podiumH = 3.3;
    inset = Math.min(2.6, Math.min(fullW, fullD) * 0.18);
  } else if (style === "deco" && roomy) {
    podiumH = Math.min(5, b.h * 0.15);
    midH = (b.h - podiumH) * 0.46;
    midInset = Math.min(1.35, Math.min(fullW, fullD) * 0.08);
    inset = Math.min(3.4, Math.min(fullW, fullD) * 0.22);
  } else if (style === "civic" && b.h > 8) {
    podiumH = Math.min(4.4, b.h * 0.24);
    inset = Math.min(1.15, Math.min(fullW, fullD) * 0.07);
  }
  return { fullW, fullD, cx, cz, style, podiumH, midH, inset, midInset };
}

type Hit = { t: number; kind: "ped" | "car" | "player" | "world"; index: number };

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getBodyYaw?: () => number;
      getHeight?: () => number;
      getSpeed: () => number;
      getPhase?: () => string;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    __brookriverReview?: {
      pose: (x: number, z: number, yaw?: number) => void;
      camera: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => void;
      crowd: (start?: number) => void;
      melee: () => void;
    };
    __brookriver?: {
      snap: () => {
        driving: boolean;
        speed: number;
        yaw: number;
        wanted: number;
        health: number;
        cash: number;
        bank: number;
        loot: number;
        x: number;
        z: number;
        down: number;
        alive: number;
        phase: Phase;
        job: string;
        idle: number;
      };
      exit: () => void;
      enter: () => void;
      fire: () => void;
      dummy: () => void;
      books: () => { cash: number; bank: number; loot: number };
      goto: (id: string) => boolean;
      pump: () => boolean;
      buy: (id: string) => boolean;
      hold: () => { tunes: number; house: boolean; lux: number; biz: boolean; packs: number; invite: boolean; crew: number; tape: number };
      pad: (n: number) => number;
    };
  }
}

export function createGame(
  canvas: HTMLCanvasElement,
  minimap: HTMLCanvasElement,
  touch: TouchInput,
  onHud: (hud: HudSnapshot) => void,
): GameHandle {
  // The city kit references the same atlases from many glTF files. Sharing
  // decoded images avoids duplicate fetch/decode work during a cold boot.
  const cacheWasEnabled = THREE.Cache.enabled;
  THREE.Cache.enabled = true;
  const rand = mulberry32(0x51c0);
  const { xs: roadXs, zs: roadZs } = roadLines();
  const blocks = buildBlocks(rand);
  const staticBlocks = blocks.filter((b) => b.h > 2);
  const LOT = { x: 12, z: -8 };
  blocks.push({ minX: LOT.x - 0.8, maxX: LOT.x + 0.8, minZ: LOT.z - 0.5, maxZ: LOT.z + 0.5, h: 1.5 });

  type Spot = {
    id: string;
    place: HustlePlace;
    x: number;
    z: number;
    name: string;
    cool: number;
    pick: number;
  };
  const spots: Spot[] = [
    { id: "teller", place: "teller", x: -69, z: -75, name: "CIVIC BANK", cool: 0, pick: 0 },
    { id: "vault", place: "vault", x: -75, z: -69, name: "VAULT", cool: 0, pick: 0 },
    { id: "home1", place: "home", x: 31, z: -75, name: "ROW HOUSE", cool: 0, pick: 0 },
    { id: "home2", place: "home", x: 69, z: 25, name: "WALK-UP", cool: 0, pick: 0 },
    { id: "home3", place: "home", x: -25, z: 69, name: "DUPLEX", cool: 0, pick: 0 },
    { id: "store1", place: "store", x: -19, z: 25, name: "CORNER MART", cool: 0, pick: 0 },
    { id: "store2", place: "store", x: 75, z: -31, name: "LATE SHOP", cool: 0, pick: 0 },
    { id: "roller", place: "roller", x: 69, z: 75, name: "THE SUITE", cool: 0, pick: 0 },
    { id: "corner1", place: "corner", x: -75, z: 31, name: "WEST CORNER", cool: 0, pick: 0 },
    { id: "corner2", place: "corner", x: 25, z: 69, name: "EAST CORNER", cool: 0, pick: 0 },
    { id: "pawn", place: "pawn", x: -31, z: -25, name: "PAWN", cool: 0, pick: 0 },
    { id: "casino", place: "casino", x: 31, z: -25, name: "DICE HALL", cool: 0, pick: 0 },
    { id: "fixer", place: "fixer", x: -6, z: 4, name: "FIXER", cool: 0, pick: 0 },
  ];
  const hallBoxes = hallWalls();
  const roomBoxes = new Map<RoomId, ReturnType<typeof roomWorldWalls>>();
  for (const spec of roomList()) roomBoxes.set(spec.id, roomWorldWalls(spec));
  for (const s of spots) {
    for (const b of blocks) {
      if (s.x > b.minX - 1.4 && s.x < b.maxX + 1.4 && s.z > b.minZ - 1.4 && s.z < b.maxZ + 1.4) {
        const road = nearestRoad(s.x, s.z);
        s.x = road.x;
        s.z = road.z;
        break;
      }
    }
  }

  const keys = new Set<string>();
  const injected = new Set<string>();
  let steerOverride: number | null = null;
  let mouseFire = false;
  let rightLook = false;
  let gunKick = 0;
  let padOn = false;
  let padIndex = -1;
  let padStatus = "Listening for a controller";
  let padLive = padWindowLive({ hidden: document.hidden });
  let gx = 0;
  let gy = 0;
  let gGas = 0;
  let gBrake = 0;
  let gSprint = false;
  let gFire = false;
  let gAim = false;
  let aiming = false;
  let aimBlend = 0;
  let gLook = false;
  let padUse = false;
  let padReload = false;
  let padGun = false;
  let padRadio = false;
  let padHustle = false;
  let padBank = false;
  let padMelee = false;
  let padJump = false;
  const padEdge = new Array<boolean>(16).fill(false);
  let started = false;
  let alive = true;
  let phase: Phase = "menu";
  let driving = true;
  let playerCar = 0;
  let px = -22.25;
  let pz = 12;
  let py = 0;
  let vy = 0;
  let vx = 0;
  let vz = 0;
  let camYaw = 0;
  let bodyYaw = 0;
  let footMoving = false;
  let air: "none" | "up" | "hang" | "land" = "none";
  let airT = 0;
  let jumpHeld = false;
  let camPitch = -0.08;
  let lookOffset = 0;
  let lookPitch = -0.08;
  let health = 100;
  let armor = 30;
  let wanted = 0;
  let cash = 40;
  let bankBal = 0;
  let loot = 0;
  let best = 0;
  const bookGet = (key: string) => {
    try {
      return localStorage.getItem(`brookriver-${key}`) ?? localStorage.getItem(`viceroy-${key}`);
    } catch {
      return null;
    }
  };
  try {
    best = Number(bookGet("best") ?? "0") || 0;
    bankBal = Math.max(0, Math.floor(Number(bookGet("bank") ?? "0") || 0));
    loot = Math.max(0, Math.floor(Number(bookGet("loot") ?? "0") || 0));
  } catch {
    best = 0;
  }
  const hold = {
    tunes: 0,
    house: false,
    lux: 0,
    biz: false,
    packs: 0,
    invite: false,
    crewT: 0,
    hitT: 0,
    bizTick: 0,
    marketCost: 0,
    marketBasis: 1,
    index: 1,
    pick: 0,
  };
  try {
    const raw = bookGet("hold");
    if (raw) {
      const saved = JSON.parse(raw) as Partial<typeof hold>;
      hold.tunes = Math.max(0, Math.min(3, Math.floor(saved.tunes ?? 0)));
      hold.house = !!saved.house;
      hold.lux = Math.max(0, Math.min(5, Math.floor(saved.lux ?? 0)));
      hold.biz = !!saved.biz;
      hold.packs = Math.max(0, Math.floor(saved.packs ?? 0));
      hold.invite = !!saved.invite;
      hold.marketCost = Math.max(0, Math.floor(saved.marketCost ?? 0));
      hold.marketBasis = saved.marketBasis && saved.marketBasis > 0 ? saved.marketBasis : 1;
      hold.index = saved.index && saved.index > 0 ? saved.index : 1;
    }
  } catch {
    /* ignore bad save */
  }
  const isHouseId = (value: string): value is HouseId => value === "home1" || value === "home2" || value === "home3";
  const isShopId = (value: string): value is ShopId => value === "store1" || value === "store2" || value === "pawn";
  const isShopKind = (value: string): value is ShopKind => value === "mart" || value === "late" || value === "counter";
  const isCarBody = (value: string): value is CarBody => catalogCars().some((car) => car.body === value);
  function readProperty(raw: string | null): PropertyState {
    const blank = emptyProperty();
    if (!raw) return blank;
    try {
      const saved = JSON.parse(raw) as Partial<PropertyState>;
      if (!saved || saved.version !== PROPERTY_VERSION) return blank;
      const ownedHouses = Array.isArray(saved.ownedHouses)
        ? saved.ownedHouses.filter((id): id is HouseId => typeof id === "string" && isHouseId(id))
        : [];
      const ownedShops = Array.isArray(saved.ownedShops)
        ? saved.ownedShops.filter(
            (shop): shop is { id: ShopId; kind: ShopKind } =>
              !!shop && typeof shop.id === "string" && typeof shop.kind === "string" && isShopId(shop.id) && isShopKind(shop.kind),
          )
        : [];
      const ownedCars = Array.isArray(saved.ownedCars)
        ? saved.ownedCars.filter(
            (car): car is PropertyState["ownedCars"][number] =>
              !!car && typeof car.id === "string" && typeof car.body === "string" && isCarBody(car.body) && (car.ride === "sedan" || car.ride === "sport" || car.ride === "van"),
          )
        : [];
      const ids = new Set(ownedCars.map((car) => car.id));
      const houseSet = new Set(ownedHouses);
      const garage = Array.isArray(saved.garage)
        ? saved.garage.filter(
            (slot): slot is PropertyState["garage"][number] =>
              !!slot &&
              typeof slot.carId === "string" &&
              ids.has(slot.carId) &&
              typeof slot.bayHouse === "string" &&
              isHouseId(slot.bayHouse) &&
              houseSet.has(slot.bayHouse) &&
              typeof slot.body === "string" &&
              isCarBody(slot.body),
          )
        : [];
      const parked = new Set(garage.map((slot) => slot.carId));
      const shopTill: PropertyState["shopTill"] = {};
      const shopClock: PropertyState["shopClock"] = {};
      for (const shop of ownedShops) {
        const till = saved.shopTill?.[shop.id];
        const clock = saved.shopClock?.[shop.id];
        if (typeof till === "number" && Number.isFinite(till) && till > 0) shopTill[shop.id] = Math.floor(till);
        if (typeof clock === "number" && Number.isFinite(clock) && clock > 0) shopClock[shop.id] = clock;
      }
      return {
        version: PROPERTY_VERSION,
        ownedHouses: [...new Set(ownedHouses)],
        ownedShops,
        stash: typeof saved.stash === "number" && saved.stash > 0 ? Math.floor(saved.stash) : 0,
        garage,
        ownedCars: ownedCars.map((car) => ({ ...car, parked: parked.has(car.id) })),
        shopTill,
        shopClock,
      };
    } catch {
      return blank;
    }
  }
  let deeds = readProperty(bookGet("property"));
  if (deeds.ownedHouses.length === 0 && hold.house) deeds.ownedHouses.push("home1");
  if (deeds.ownedShops.length === 0 && hold.biz) deeds.ownedShops.push({ id: "store2", kind: "late" });
  hold.house = deeds.ownedHouses.length > 0;
  hold.biz = deeds.ownedShops.length > 0;
  let inHall = false;
  let catalog: { kind: "house" | "shop" | "car"; index: number } | null = null;
  let liveDesk: Desk | null = null;
  let navSeq = 0;
  let navKey = "";
  const uiCmds: UiCmd[] = [];
  let lastRoulette: RouletteResult | null = null;
  let lastSlots: SlotsResult | null = null;
  let lastCraps: CrapsResult | null = null;
  let lastBaccarat: BaccaratResult | null = null;
  let deedPick = 0;
  let deedSpot = "";
  let starAcc = 0;
  let starHouse = "";
  let martCd = 0;
  let betPick = 0;
  let bj: BlackjackState | null = null;
  let rouletteIx = 0;
  let rouletteN = 17;
  let dozenN = 1;
  let baccaratIx = 0;
  const BET_STEPS = [10, 25, 50, 100, 250, 500];
  const ROULETTE_CYCLE: RouletteKind[] = ["red", "black", "odd", "even", "dozen", "straight"];
  const BACCARAT_CYCLE: BaccaratSide[] = ["player", "banker", "tie"];
  let toast = "";
  let toastT = 0;
  let lostCash = 0;
  let invuln = 0;
  let shootCd = 0;
  let starLock = 0;
  let sinceCrime = 99;
  let sinceShot = 99;
  let clearT = 0;
  let lastHurt = 99;
  let regenT = 0;
  let deathLeft = 0;
  let shake = 0;
  let prevF = false;
  let pauseSel = 0;
  let pauseHold = 0;
  let pauseLatch = 0;
  let sirenFlip = 0;
  let engagePlayer = new Set<Ped>();
  let error = "";
  let raf = 0;
  let disposed = false;
  let cityHandle: CityHandle | null = null;
  let dressingHandle: CityHandle | null = null;
  let hallHandle: HallHandle | null = null;
  let roomsHandle: RoomsHandle | null = null;
  let roomId: RoomId | null = null;
  let fleet: Fleet | null = null;
  let hudAcc = 0;
  let crunchCd = 0;
  let drifting = false;
  let flashT = 0;
  let flashX = 0;
  let flashY = 1.4;
  let flashZ = 0;
  let gun: GunId = "pistol";
  const owned: Record<GunId, boolean> = { pistol: true, shotgun: false, smg: false };
  const ammo: Record<GunId, { mag: number; reserve: number }> = {
    pistol: { mag: 12, reserve: 72 },
    shotgun: { mag: 6, reserve: 24 },
    smg: { mag: 30, reserve: 90 },
  };
  let reloadT = 0;
  let shootPose = 0;
  let playerFlinch = 0;
  let playerFlinchGen = 0;
  let playerReact: ReactKind = "chest";
  let playerMelee = 0;
  let playerMeleeKind: Melee = "none";
  let playerMeleeGen = 0;
  let playerContact = 0;
  let meleeCd = 0;
  let playerShotGen = 0;
  let castReady = false;
  let castLib: CastLibrary | null = null;
  let pedActors: Actor[] = [];
  const actorAnimTime: number[] = [];
  let animationFrame = 0;
  let playerActor: Actor | null = null;
  let chosenCharacter = playableById(null).id;
  try { chosenCharacter = playableById(localStorage.getItem(CHARACTER_SAVE_KEY)).id; } catch { /* private browsing */ }
  const playableActors = new Map<string, Actor>();
  let previewYaw = -.18;
  let previewWalk = false;
  function selectCharacter(id: string) {
    if (phase !== "menu") return;
    const hero = playableById(id);
    playerActor && (playerActor.root.visible = false);
    chosenCharacter = hero.id;
    previewYaw = -.18; previewWalk = false;
    if (castLib) {
      if (!playableActors.has(hero.id)) {
        const actor = createActor(castLib, `player-${hero.id}`, "all");
        scene.add(actor.root); playableActors.set(hero.id, actor);
      }
      playerActor = playableActors.get(hero.id)!;
    }
    try { localStorage.setItem(CHARACTER_SAVE_KEY, hero.id); } catch { /* choice remains available this session */ }
    pushHud();
  }
  const studio = new THREE.Group();
  studio.position.set(0, 40, 0);
  const studioFloor = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, .08, 64), new THREE.MeshStandardMaterial({ color: 0x202831, roughness: .85 }));
  studioFloor.position.y = -.04;
  studio.add(studioFloor);
  const studioBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshStandardMaterial({ color: 0x12171f, roughness: 1 }));
  studioBackdrop.position.set(0, 3, 3); studioBackdrop.rotation.y = Math.PI;
  studio.add(studioBackdrop);
  const studioGround = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x11161c, roughness: 1 }));
  studioGround.rotation.x = -Math.PI / 2; studioGround.position.y = -.09; studio.add(studioGround);
  for (const [x, y, z, color, intensity] of [[-2, 3, -2, 0xffe5c5, 14], [2, 2, -1, 0xd7e9ff, 9], [0, 3, 2, 0xffb020, 10]]) {
    const light = new THREE.PointLight(color, intensity, 8); light.position.set(x!, y!, z!); studio.add(light);
  }

  let radioTrack = 0;
  const radioOn = true;
  let lit = false;
  let seenX = 0;
  let seenZ = 0;
  let heliX = 0;
  let heliZ = 40;
  let coverNow = false;
  let coverSaid = false;
  let blockLive = false;
  const job = {
    active: false,
    kind: "deliver" as JobKind,
    t: 0,
    cool: 3,
    next: 0,
    x: 0,
    z: 0,
    car: -1,
    tail: -1,
    faction: "teal" as "amber" | "teal",
    flag: false,
    hold: 0,
    bx: 0,
    bz: 0,
    show: false,
    prevColor: 0xffffff,
    prevRide: "sedan" as Ride,
    prevSpeed: 14,
  };
  type Channel = {
    hustleId: string;
    spotId: string;
    ped: number;
    left: number;
    need: number;
    stake: number;
    x: number;
    z: number;
  };
  let channel: Channel | null = null;
  const edge = { r: false, n: false, b: false, v: false, g: false, h: false, d1: false, d2: false, d3: false, j: false, k: false, c: false, u: false, i: false };

  const held = (code: string) => keys.has(code) || injected.has(code);

  const cars: Car[] = [];
  const peds: Ped[] = [];
  const living: Ped[] = [];
  const meleeContacts = new Map<Ped, { left: number; victim: Ped | null; player: boolean }>();
  const pickups: Pickup[] = [];
  const shots: Shot[] = [];

  const playerStart = { x: roadXs[2]! + LANE, z: 58 };

  function nearestRoad(x: number, z: number) {
    let bestD = 1e9;
    let bx = x;
    let bz = z;
    let by = 0;
    for (const rx of roadXs) {
      const laneX = rx + LANE;
      const cz = clamp(z, -HALF + 8, HALF - 8);
      const d = (x - laneX) ** 2 + (z - cz) ** 2;
      if (d < bestD) {
        bestD = d;
        bx = laneX;
        bz = cz;
        by = 0;
      }
    }
    for (const rz of roadZs) {
      const laneZ = rz + LANE;
      const cx = clamp(x, -HALF + 8, HALF - 8);
      const d = (x - cx) ** 2 + (z - laneZ) ** 2;
      if (d < bestD) {
        bestD = d;
        bx = cx;
        bz = laneZ;
        by = -Math.PI / 2;
      }
    }
    return { x: bx, z: bz, yaw: by };
  }

  function separated(x: number, z: number, min: number) {
    for (const c of cars) {
      const dx = c.x - x;
      const dz = c.z - z;
      if (dx * dx + dz * dz < min * min) return false;
    }
    return true;
  }

  function makeCar(
    x: number,
    z: number,
    yaw: number,
    mode: CarMode,
    color: number,
    wps: Vec[],
    opts?: { alarm?: boolean; driver?: boolean; police?: boolean; hp?: number; maxSpeed?: number; ride?: Ride; forSale?: boolean },
  ): Car {
    const ride = opts?.ride ?? (opts?.police ? "cruiser" : "sedan");
    const stats = RIDES[ride];
    const maxHp = opts?.hp ?? stats.maxHp;
    return {
      x,
      z,
      yaw,
      speed: mode === "traffic" ? stats.cruise : 0,
      hp: maxHp,
      maxHp,
      mode,
      color,
      wps,
      wp: 0,
      alarm: !!opts?.alarm,
      hadDriver: !!opts?.driver,
      maxSpeed: opts?.maxSpeed ?? (mode === "traffic" ? stats.cruise : stats.vmax),
      stuckT: 0,
      spin: 0,
      shootCd: 1,
      police: !!opts?.police,
      ride,
      body: bodyFor(ride, Math.round(x * 10 + z * 3)),
      lat: 0,
      block: false,
      forSale: !!opts?.forSale,
      deedId: "",
    };
  }

  cars.push(
    makeCar(playerStart.x, playerStart.z, 0, "locked", 0xd7a15a, [], {
      ride: "sport",
      driver: false,
      alarm: false,
    }),
  );

  const loops: Vec[][] = [];
  for (let i = 1; i <= 3; i++) {
    for (let j = 1; j <= 3; j++) loops.push(blockLoop(roadXs, roadZs, i, j));
  }
  let spawnedTraffic = 0;
  for (let n = 0; n < 14 && spawnedTraffic < 14; n++) {
    const wps = loops[n % loops.length]!;
    let guard = 0;
    let idx = (n * 5) % wps.length;
    let spot = wps[idx]!;
    while (guard < wps.length && (Math.hypot(spot.x - playerStart.x, spot.z - playerStart.z) < 26 || !separated(spot.x, spot.z, 8))) {
      idx = (idx + 1) % wps.length;
      spot = wps[idx]!;
      guard++;
    }
    if (Math.hypot(spot.x - playerStart.x, spot.z - playerStart.z) < 20 || !separated(spot.x, spot.z, 7)) continue;
    const next = wps[(idx + 1) % wps.length]!;
    const ride: Ride = n % 6 === 0 ? "van" : n % 6 === 1 ? "sport" : "sedan";
    const car = makeCar(spot.x, spot.z, yawTo(spot.x, spot.z, next.x, next.z), "traffic", PAINTS[n % PAINTS.length]!, wps, {
      driver: true,
      ride,
      hp: RIDES[ride].maxHp,
    });
    car.wp = (idx + 1) % wps.length;
    cars.push(car);
    spawnedTraffic++;
  }

  let parked = 0;
  for (let i = 0; i < GRID && parked < 10; i++) {
    for (let j = 0; j < GRID && parked < 10; j++) {
      if ((i + j) % 2 !== 0) continue;
      const rx = roadXs[i + 1]!;
      const z = -HALF + j * CELL + CELL * 0.5;
      const x = rx - ROAD / 2 + 1.7;
      if (Math.hypot(x - playerStart.x, z - playerStart.z) < 18) continue;
      let cross = false;
      for (const rz of roadZs) if (Math.abs(z - rz) < 12) cross = true;
      if (cross) continue;
      if (!separated(x, z, 7)) continue;
      if (staticBlocks.some((b) => circleHitsAABB(x, z, 1.5, b))) continue;
      cars.push(
        makeCar(x, z, Math.PI, "idle", PAINTS[(i * 3 + j) % PAINTS.length]!, [], {
          alarm: parked % 2 === 0,
          driver: false,
          ride: parked % 4 === 0 ? "van" : parked % 4 === 1 ? "sport" : "sedan",
        }),
      );
      parked++;
    }
  }

  for (let n = 0; n < 4; n++) {
    const wps = loops[(n + 2) % loops.length]!;
    const spot = wps[(n * 3) % wps.length]!;
    const next = wps[(n * 3 + 1) % wps.length]!;
    const shifted = nearestRoad(spot.x + (n - 1.5) * 6, spot.z + 20);
    const car = makeCar(shifted.x, shifted.z, yawTo(spot.x, spot.z, next.x, next.z), "traffic", 0xd5d8df, wps, {
      police: true,
      driver: true,
      ride: "cruiser",
    });
    car.speed = 12;
    cars.push(car);
  }

  cars.push(
    makeCar(16, -8, Math.PI, "locked", 0xf4f1ea, [], {
      ride: "sport",
      forSale: true,
      driver: false,
    }),
  );
  for (let i = 0; i < 8; i++) {
    const spare = makeCar(200, 160 + i * 8, 0, "idle", 0xf4f1ea, [], { ride: "sedan" });
    spare.hp = -1;
    cars.push(spare);
  }
  {
    let slot = 0;
    const spares = cars.filter((car) => car.hp < 0 && car.deedId === "");
    for (const owned of deeds.ownedCars) {
      const spare = spares[slot++];
      if (!spare) break;
      spare.deedId = owned.id;
      spare.body = owned.body;
      spare.ride = owned.ride;
      spare.maxHp = RIDES[owned.ride].maxHp;
      if (owned.parked) {
        spare.hp = -1;
      } else {
        const road = nearestRoad(18 + (slot % 3) * 3.2, -8);
        spare.x = road.x;
        spare.z = road.z;
        spare.yaw = road.yaw;
        spare.hp = spare.maxHp;
        spare.mode = "locked";
      }
    }
  }

  const civColors = [0x6e8cae, 0xc46b4a, 0xd9c7a1, 0x4d6b52, 0x8a6070, 0xb9a15a];
  function addPed(x: number, z: number, faction: Faction, color: number, goals: Vec[]) {
    const look = peds.length;
    const personality = characterProfile(actorKey(faction, look), look);
    peds.push({
      x,
      z,
      yaw: rand() * Math.PI * 2,
      hp: faction === "cop" ? 120 : faction === "civ" ? 70 : 100,
      faction,
      state: "walk",
      active: faction !== "cop",
      cd: rand() * 0.8,
      goal: 0,
      goals,
      color,
      bob: rand() * 10,
      respawn: 0,
      dive: 0,
      mark: 0,
      ally: false,
      maxHp: faction === "cop" ? 120 : faction === "civ" ? 70 : 100,
      fall: 0,
      downFor: 0,
      er: false,
      settled: false,
      byPlayer: false,
      beat: faction === "civ" ? personality.idle : BEATS[look % BEATS.length]!,
      look,
      linger: 0,
      lingerFor: (4 + rand() * 6) / personality.gait,
      walkPace: 1.7 * personality.gait,
      shootPose: 0,
      shotGen: 0,
      flinch: 0,
      flinchGen: 0,
      react: "chest",
      melee: 0,
      meleeKind: 0,
      meleeGen: 0,
      brawl: 0,
      speed: 0,
      prevX: x,
      prevZ: z,
      fleeFor: 0,
    });
  }

  for (let gx = 0; gx < GRID; gx++) {
    for (let gz = 0; gz < GRID; gz++) {
      const ox = -HALF + gx * CELL;
      const oz = -HALF + gz * CELL;
      const lanes: Array<[number, number, number, number]> = [
        [ox + 9.2, oz + 18, ox + 9.2, oz + CELL - 14],
        [ox + CELL - 9.2, oz + 16, ox + CELL - 9.2, oz + CELL - 16],
        [ox + 18, oz + 9.2, ox + CELL - 14, oz + 9.2],
        [ox + 16, oz + CELL - 9.2, ox + CELL - 16, oz + CELL - 9.2],
      ];
      const pair = (gx + gz) % 2;
      const use = [lanes[pair]!, lanes[pair + 2]!];
      use.forEach((lane, edge) => {
        const shift = ((gx * 5 + gz * 3 + edge * 7) % 18) / 18;
        const x = lane[0] + (lane[2] - lane[0]) * shift;
        const z = lane[1] + (lane[3] - lane[1]) * shift;
        if (Math.hypot(x - playerStart.x, z - playerStart.z) < 22) return;
        addPed(x, z, "civ", civColors[(gx + gz + edge) % civColors.length]!, [
          { x: lane[0], z: lane[1] },
          { x: lane[2], z: lane[3] },
        ]);
      });
    }
  }
  addPed(-66, -8, "amber", 0xe0a040, [
    { x: -66, z: -16 },
    { x: -66, z: 18 },
  ]);
  addPed(-66, 14, "amber", 0xc9842a, [
    { x: -66, z: 6 },
    { x: -66, z: 28 },
  ]);
  addPed(-66, 42, "amber", 0xf0c14a, [
    { x: -66, z: 34 },
    { x: -66, z: 52 },
  ]);
  addPed(66, -8, "teal", 0x3ecfb8, [
    { x: 66, z: -16 },
    { x: 66, z: 18 },
  ]);
  addPed(66, 14, "teal", 0x1f8f86, [
    { x: 66, z: 6 },
    { x: 66, z: 28 },
  ]);
  addPed(66, 42, "teal", 0x7ee0d0, [
    { x: 66, z: 34 },
    { x: 66, z: 52 },
  ]);
  for (let i = 0; i < 4; i++) {
    addPed(80, 80, "cop", 0x243246, [
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    ]);
  }

  const kitSpots: Array<[number, number, "med" | "armor"]> = [
    [-14, -14, "med"],
    [14, 14, "med"],
    [-14, 14, "armor"],
    [14, -14, "armor"],
    [0, 16, "med"],
    [-40, 20, "med"],
    [40, -30, "armor"],
  ];
  for (const [x, z, kind] of kitSpots) pickups.push({ x, z, kind, wait: 0 });

  const finePointer = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  const qualityHigh = finePointer || (typeof window !== "undefined" ? window.innerWidth : 1280) >= 960;
  const dprCap = finePointer ? 1.75 : qualityHigh ? 1.5 : 1.15;
  let renderer: THREE.WebGPURenderer;
  let gpuReady = false;
  try {
    renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (err) {
    error = err instanceof Error ? err.message : "WebGL failed";
    const deadHandle: GameHandle = {
      previewCharacter() {},
      selectCharacter() {},
      start() {},
      respawn() {},
      resume() {},
      quit() {},
      focusPause() {},
      dispose() {},
      command() {},
      touch,
    };
    onHud(snapshot());
    return deadHandle;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;
  renderer.setClearColor(0x100818, 1);
  if (qualityHigh) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  void renderer.init().then(() => {
    gpuReady = true;
  }).catch((err: unknown) => {
    error = err instanceof Error ? err.message : "Renderer failed";
  });

  const scene = new THREE.Scene();
  scene.add(studio);
  scene.background = new THREE.Color(0x100818);
  scene.fog = new THREE.FogExp2(0x241830, 0.0022);

  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 480);

  const hemi = new THREE.HemisphereLight(0xb8c9e0, 0x625448, 1.6);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xe4e6ff, 2.1);
  moon.position.set(-80, 140, -30);
  if (qualityHigh) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 30;
    moon.shadow.camera.far = 320;
    moon.shadow.camera.left = -58;
    moon.shadow.camera.right = 58;
    moon.shadow.camera.top = 58;
    moon.shadow.camera.bottom = -58;
    moon.shadow.bias = -0.00035;
    moon.shadow.normalBias = 0.045;
  }
  scene.add(moon);
  scene.add(moon.target);
  const plazaLight = new THREE.PointLight(0xffb020, 14, 52, 1.5);
  plazaLight.position.set(0, 5.2, 0);
  scene.add(plazaLight);
  const amberLight = new THREE.PointLight(0xffb020, 12, 78, 1.55);
  amberLight.position.set(-62, 8, 10);
  scene.add(amberLight);
  const tealLight = new THREE.PointLight(0x3ee0c5, 12, 78, 1.55);
  tealLight.position.set(62, 8, 10);
  scene.add(tealLight);
  const fillWest = new THREE.PointLight(0xff6a3a, 8, 52, 1.8);
  fillWest.position.set(-28, 6, -40);
  scene.add(fillWest);
  const fillEast = new THREE.PointLight(0x9ec8ff, 7.2, 48, 1.8);
  fillEast.position.set(28, 9, 42);
  scene.add(fillEast);

  const head = new THREE.SpotLight(0xffe2b0, 0, 48, 0.55, 0.42, 1.15);
  head.position.set(0, 2, 0);
  scene.add(head);
  scene.add(head.target);

  const skyW = 1024;
  const skyH = 2048;
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = skyW;
  skyCanvas.height = skyH;
  const sg = skyCanvas.getContext("2d")!;
  const fractN = (n: number) => n - Math.floor(n);
  const grad = sg.createLinearGradient(0, 0, 0, skyH);
  grad.addColorStop(0, "#07010f");
  grad.addColorStop(0.16, "#16082c");
  grad.addColorStop(0.34, "#1a1244");
  grad.addColorStop(0.5, "#0c1c3c");
  grad.addColorStop(0.66, "#241848");
  grad.addColorStop(0.8, "#3a2460");
  grad.addColorStop(0.9, "#120c18");
  grad.addColorStop(1, "#07060c");
  sg.fillStyle = grad;
  sg.fillRect(0, 0, skyW, skyH);
  const nebula = (x: number, y: number, rx: number, ry: number, rot: number, color: string, alpha: number) => {
    sg.save();
    sg.translate(x, y);
    sg.rotate(rot);
    const rad = sg.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    rad.addColorStop(0, color);
    rad.addColorStop(1, "rgba(0,0,0,0)");
    sg.globalAlpha = alpha;
    sg.fillStyle = rad;
    sg.beginPath();
    sg.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    sg.fill();
    sg.restore();
  };
  nebula(skyW * 0.22, skyH * 0.2, skyW * 0.46, skyH * 0.14, -0.45, "#ff4ad4", 0.5);
  nebula(skyW * 0.74, skyH * 0.28, skyW * 0.4, skyH * 0.12, 0.55, "#2ce0c8", 0.46);
  nebula(skyW * 0.5, skyH * 0.4, skyW * 0.62, skyH * 0.09, -0.2, "#7a4bff", 0.4);
  nebula(skyW * 0.16, skyH * 0.48, skyW * 0.3, skyH * 0.07, 0.7, "#ffb020", 0.26);
  nebula(skyW * 0.82, skyH * 0.52, skyW * 0.34, skyH * 0.1, -0.55, "#ff5a6a", 0.3);
  nebula(skyW * 0.48, skyH * 0.32, skyW * 0.78, skyH * 0.035, -0.32, "#f4e6ff", 0.38);
  nebula(skyW * 0.5, skyH * 0.76, skyW * 0.9, skyH * 0.07, 0, "#6a3a88", 0.36);
  nebula(skyW * 0.28, skyH * 0.78, skyW * 0.32, skyH * 0.04, 0.1, "#2ce0c8", 0.22);
  const starPaint = ["#fff6e8", "#7dfff0", "#ff6ab8", "#b794ff", "#ffc14a", "#d6e4ff"];
  for (let i = 0; i < 1100; i++) {
    const x = fractN(Math.sin(i * 12.9898) * 43758.5453) * skyW;
    const y = fractN(Math.sin(i * 78.233 + 1.7) * 43758.5453) * skyH * 0.82;
    const big = i % 37 === 0;
    sg.globalAlpha = big ? 0.95 : 0.35 + (i % 5) * 0.12;
    sg.fillStyle = starPaint[i % starPaint.length]!;
    const s = big ? 3 : i % 11 === 0 ? 2 : 1;
    sg.fillRect(x, y, s, s);
  }
  sg.globalAlpha = 1;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(380, 48, 32),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }),
  );
  scene.add(sky);
  void renderer.init().then(() => {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      envScene.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(8, 32, 20),
          new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide }),
        ),
      );
      const env = pmrem.fromScene(envScene, 0.04);
      scene.environment = env.texture;
      scene.environmentIntensity = 1.6;
      pmrem.dispose();
    } catch {
      /* city still renders if the reflection probe fails */
    }
  });
  const moonDisc = new THREE.Mesh(
    new THREE.SphereGeometry(3.1, 24, 18),
    new THREE.MeshBasicMaterial({ color: 0xf2efe6, fog: false, toneMapped: false }),
  );
  moonDisc.position.set(-130, 168, -190);
  scene.add(moonDisc);
  const moonHalo = new THREE.Mesh(
    new THREE.SphereGeometry(11, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xffd0ea, transparent: true, opacity: 0.08, fog: false, depthWrite: false, toneMapped: false }),
  );
  moonHalo.position.copy(moonDisc.position);
  scene.add(moonHalo);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(16, 36, 28),
    new THREE.MeshBasicMaterial({ color: 0x49f0d4, fog: false, toneMapped: false }),
  );
  planet.position.set(168, 132, -180);
  scene.add(planet);
  const cosmosRing = new THREE.Mesh(
    new THREE.RingGeometry(23, 33, 64),
    new THREE.MeshBasicMaterial({ color: 0xffb14a, side: THREE.DoubleSide, fog: false, toneMapped: false, transparent: true, opacity: 0.9 }),
  );
  cosmosRing.position.copy(planet.position);
  cosmosRing.rotation.x = 1.05;
  cosmosRing.rotation.y = 0.4;
  scene.add(cosmosRing);
  for (let i = 0; i < 180; i++) {
    rand();
    rand();
    rand();
  }
  const starCount = 520;
  const starArr = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  const starPalette = [
    [1, 0.96, 0.9],
    [0.45, 0.95, 0.88],
    [1, 0.42, 0.72],
    [0.72, 0.5, 1],
    [1, 0.76, 0.32],
    [0.82, 0.9, 1],
  ];
  for (let i = 0; i < starCount; i++) {
    const ang = fractN(Math.sin(i * 127.1) * 43758.5453) * Math.PI * 2;
    const elev = 0.22 + fractN(Math.sin(i * 311.7) * 43758.5453) * (Math.PI / 2 - 0.22);
    const rad = 240 + fractN(Math.sin(i * 74.7) * 43758.5453) * 110;
    const ce = Math.cos(elev);
    starArr[i * 3] = Math.cos(ang) * ce * rad;
    starArr[i * 3 + 1] = Math.sin(elev) * rad;
    starArr[i * 3 + 2] = Math.sin(ang) * ce * rad;
    const rgb = starPalette[i % starPalette.length]!;
    starCol[i * 3] = rgb[0]!;
    starCol[i * 3 + 1] = rgb[1]!;
    starCol[i * 3 + 2] = rgb[2]!;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starArr, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.7,
      sizeAttenuation: true,
      vertexColors: true,
      fog: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  scene.add(stars);

  const groundTex = makeGroundTexture(roadXs, roadZs);
  const groundGeo = new THREE.PlaneGeometry(WORLD + 80, WORLD + 80, 180, 180);
  groundGeo.rotateX(-Math.PI / 2);
  const groundPos = groundGeo.attributes.position;
  const groundCol = new Float32Array(groundPos.count * 3);
  for (let i = 0; i < groundPos.count; i++) {
    const x = groundPos.getX(i);
    const z = groundPos.getZ(i);
    const y = groundY(x, z);
    groundPos.setY(i, y - 0.08);
    const t = Math.max(-1, Math.min(1, y / 6));
    groundCol[i * 3] = 0.94 + t * 0.06;
    groundCol[i * 3 + 1] = 0.95 + t * 0.03;
    groundCol[i * 3 + 2] = 0.98 - t * 0.06;
  }
  groundGeo.setAttribute("color", new THREE.BufferAttribute(groundCol, 3));
  groundPos.needsUpdate = true;
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({
      map: groundTex.map,
      roughnessMap: groundTex.rough,
      roughness: 1,
      metalness: 0.22,
      envMapIntensity: 1.45,
      color: 0xffffff,
      vertexColors: true,
    }),
  );
  ground.receiveShadow = qualityHigh;
  scene.add(ground);

  const pavingGeo = new THREE.PlaneGeometry(34, 34, 34, 34);
  pavingGeo.rotateX(-Math.PI / 2);
  const pavingPos = pavingGeo.getAttribute("position");
  for (let i = 0; i < pavingPos.count; i++) pavingPos.setY(i, groundY(pavingPos.getX(i), pavingPos.getZ(i)) + 0.025);
  pavingGeo.computeVertexNormals();
  const pavingMat = new THREE.MeshStandardMaterial({ color: 0x6e706b, roughness: 0.92, metalness: 0.02 });
  const paving = new THREE.Mesh(pavingGeo, pavingMat);
  paving.receiveShadow = qualityHigh;
  scene.add(paving);

  const winTex = makeWindowTexture();
  const bMat = makeFacadeMaterial(winTex);
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildingMesh = new THREE.InstancedMesh(bGeo, bMat, staticBlocks.length);
  buildingMesh.frustumCulled = false;
  const shopCanvas = document.createElement("canvas");
  shopCanvas.width = 256;
  shopCanvas.height = 128;
  const shopG = shopCanvas.getContext("2d")!;
  shopG.fillStyle = "#16130f";
  shopG.fillRect(0, 0, 256, 128);
  shopG.fillStyle = "#2a2218";
  shopG.fillRect(0, 0, 256, 16);
  for (let i = 0; i < 16; i++) {
    shopG.fillStyle = i % 2 ? "#6a2430" : "#1a140e";
    shopG.fillRect(i * 16, 0, 16, 10);
  }
  const shopLits = ["#ffb020", "#1a140c", "#f3efe4", "#1a140c", "#3a6a66", "#1a140c", "#e7c27a", "#120e0c"];
  for (let i = 0; i < 6; i++) {
    shopG.fillStyle = "#07080c";
    shopG.fillRect(10 + i * 42, 24, 34, 88);
    shopG.fillStyle = shopLits[i % shopLits.length]!;
    shopG.fillRect(14 + i * 42, 28, 26, 78);
    shopG.fillStyle = "rgba(0,0,0,0.28)";
    shopG.fillRect(14 + i * 42, 28, 6, 78);
  }
  shopG.fillStyle = "#cbb98a";
  shopG.fillRect(0, 112, 256, 8);
  const shopTex = new THREE.CanvasTexture(shopCanvas);
  shopTex.colorSpace = THREE.SRGBColorSpace;
  shopTex.wrapS = THREE.RepeatWrapping;
  shopTex.wrapT = THREE.ClampToEdgeWrapping;
  const podiumMat = new THREE.MeshStandardMaterial({
    map: shopTex,
    emissive: new THREE.Color(0xffb020),
    emissiveMap: shopTex,
    emissiveIntensity: 2.05,
    roughness: 0.38,
    metalness: 0.42,
    color: 0xffffff,
  });
  const podiumMesh = new THREE.InstancedMesh(bGeo, podiumMat, staticBlocks.length);
  podiumMesh.frustumCulled = false;
  const grit = (() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#9a9a9a";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2400; i++) {
      const v = 70 + ((i * 29) % 140);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect((i * 37) % 256, (i * 73) % 256, i % 5 === 0 ? 3 : 1, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 16;
    return tex;
  })();
  const midMat = new THREE.MeshStandardMaterial({ color: 0xc4b49a, roughness: 0.84, metalness: 0.06, roughnessMap: grit });
  const midMesh = new THREE.InstancedMesh(bGeo, midMat, staticBlocks.length);
  midMesh.frustumCulled = false;
  const finMat = new THREE.MeshPhysicalMaterial({
    color: 0xc5e4de,
    emissive: 0x0c3330,
    emissiveIntensity: 0.7,
    roughness: 0.05,
    metalness: 0.12,
    envMapIntensity: 1.9,
  });
  const finMesh = new THREE.InstancedMesh(bGeo, finMat, staticBlocks.length);
  finMesh.frustumCulled = false;
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.92, metalness: 0.08, roughnessMap: grit });
  const beltMesh = new THREE.InstancedMesh(bGeo, beltMat, staticBlocks.length);
  beltMesh.frustumCulled = false;
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x6a6c64, roughness: 0.96, metalness: 0.03, roughnessMap: grit });
  const coreMesh = new THREE.InstancedMesh(bGeo, coreMat, staticBlocks.length);
  coreMesh.frustumCulled = false;
  const tint = new THREE.Color();
  const m = new THREE.Matrix4();
  const qid = new THREE.Quaternion();
  const hide = () => m.compose(new THREE.Vector3(0, -40, 0), qid, new THREE.Vector3(0.001, 0.001, 0.001));
  staticBlocks.forEach((b, i) => {
    const g = massing(b);
    const crownH = Math.max(0.4, b.h - g.podiumH - g.midH);
    const towerW = Math.max(1.4, g.fullW - g.inset * 2);
    const towerD = Math.max(1.4, g.fullD - g.inset * 2);
    m.compose(
      new THREE.Vector3(g.cx, g.podiumH + g.midH + crownH / 2, g.cz),
      qid,
      new THREE.Vector3(towerW, crownH, towerD),
    );
    buildingMesh.setMatrixAt(i, m);
    if (g.podiumH > 0.2) {
      m.compose(new THREE.Vector3(g.cx, g.podiumH / 2, g.cz), qid, new THREE.Vector3(g.fullW, g.podiumH, g.fullD));
    } else hide();
    podiumMesh.setMatrixAt(i, m);
    if (g.midH > 0.4) {
      const mw = Math.max(1.6, g.fullW - g.midInset * 2);
      const md = Math.max(1.6, g.fullD - g.midInset * 2);
      m.compose(new THREE.Vector3(g.cx, g.podiumH + g.midH / 2, g.cz), qid, new THREE.Vector3(mw, g.midH, md));
      midMesh.setMatrixAt(i, m);
      midMesh.setColorAt(i, tint.setHex(0xd8c4a4));
    } else hide();
    if (g.midH <= 0.4) midMesh.setMatrixAt(i, m);
    if (g.style === "glass" && b.h > 10) {
      m.compose(
        new THREE.Vector3(g.cx, g.podiumH + crownH * 0.55, g.cz + towerD / 2 + 0.12),
        qid,
        new THREE.Vector3(Math.max(0.8, towerW * 0.72), crownH * 0.72, 0.22),
      );
    } else hide();
    finMesh.setMatrixAt(i, m);
    if (g.style === "brick" && b.h > 7) {
      m.compose(
        new THREE.Vector3(g.cx, b.h + 0.7, g.cz),
        qid,
        new THREE.Vector3(Math.min(4.2, g.fullW * 0.35), 1.3, Math.min(3.2, g.fullD * 0.28)),
      );
    } else hide();
    beltMesh.setMatrixAt(i, m);
    if (g.style === "brutal" && b.h > 8) {
      const stemH = Math.min(9, Math.max(4.8, b.h * 0.36));
      m.compose(new THREE.Vector3(g.cx, stemH / 2, g.cz), qid, new THREE.Vector3(g.fullW, stemH, g.fullD));
      buildingMesh.setMatrixAt(i, m);
      const slabH = Math.max(1, b.h - stemH);
      m.compose(
        new THREE.Vector3(g.cx, stemH + slabH / 2, g.cz),
        qid,
        new THREE.Vector3(g.fullW + 3.6, slabH, g.fullD + 3.6),
      );
      midMesh.setMatrixAt(i, m);
      midMesh.setColorAt(i, tint.setHex(0x8a8c84));
      m.compose(new THREE.Vector3(g.cx, stemH, g.cz), qid, new THREE.Vector3(g.fullW + 4.1, 0.42, g.fullD + 4.1));
      beltMesh.setMatrixAt(i, m);
      const cw = Math.min(4.2, g.fullW * 0.28);
      const cd = Math.min(6.2, g.fullD * 0.36);
      m.compose(
        new THREE.Vector3(g.cx - g.fullW / 2 + cw * 0.5 + 0.2, (b.h + 4.4) / 2, g.cz - g.fullD / 2 + cd * 0.5 + 0.2),
        qid,
        new THREE.Vector3(cw, b.h + 4.4, cd),
      );
    } else hide();
    coreMesh.setMatrixAt(i, m);
    const styleHex =
      g.style === "brick" ? 0xffffff : g.style === "glass" ? 0xd8fff8 : g.style === "civic" ? 0xf4efe4 : g.style === "deco" ? 0xfff6e4 : 0xffffff;
    buildingMesh.setColorAt(i, tint.setHex(styleHex));
  });
  buildingMesh.instanceMatrix.needsUpdate = true;
  podiumMesh.instanceMatrix.needsUpdate = true;
  midMesh.instanceMatrix.needsUpdate = true;
  finMesh.instanceMatrix.needsUpdate = true;
  beltMesh.instanceMatrix.needsUpdate = true;
  coreMesh.instanceMatrix.needsUpdate = true;
  if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;
  if (midMesh.instanceColor) midMesh.instanceColor.needsUpdate = true;
  scene.add(podiumMesh);
  scene.add(midMesh);
  scene.add(buildingMesh);
  scene.add(finMesh);
  scene.add(beltMesh);
  scene.add(coreMesh);
  const roofMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x101218, roughness: 0.9, metalness: 0.05 }),
    staticBlocks.length,
  );
  roofMesh.frustumCulled = false;
  staticBlocks.forEach((b, i) => {
    if (b.h < 4) {
      hide();
    } else {
      const g = massing(b);
      const over = g.style === "brutal" && b.h > 8 ? 3.8 : 0;
      const w = Math.max(1.5, g.fullW - g.inset * 2) + (g.style === "brick" ? 0.9 : 0.35) + over;
      const d = Math.max(1.5, g.fullD - g.inset * 2) + (g.style === "brick" ? 0.9 : 0.35) + over;
      const lip = g.style === "brutal" ? 0.85 : g.style === "deco" ? 0.7 : g.style === "civic" ? 0.55 : 0.38;
      m.compose(new THREE.Vector3(g.cx, b.h + 0.2, g.cz), qid, new THREE.Vector3(w, lip, d));
    }
    roofMesh.setMatrixAt(i, m);
  });
  roofMesh.instanceMatrix.needsUpdate = true;
  scene.add(roofMesh);

  const corniceMat = new THREE.MeshStandardMaterial({ color: 0x3a3e48, roughness: 0.32, metalness: 0.72, roughnessMap: grit });
  const corniceMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), corniceMat, staticBlocks.length);
  corniceMesh.frustumCulled = false;
  staticBlocks.forEach((b, i) => {
    if (b.h < 6) {
      hide();
      corniceMesh.setMatrixAt(i, m);
      corniceMesh.setColorAt(i, tint.setHex(0x23262e));
      return;
    }
    const g = massing(b);
    const over = g.style === "brutal" && b.h > 8 ? 3.9 : 0;
    const w = Math.max(1.6, g.fullW - g.inset * 2) + (g.style === "brick" || g.style === "deco" ? 1.15 : 0.55) + over;
    const d = Math.max(1.6, g.fullD - g.inset * 2) + (g.style === "brick" || g.style === "deco" ? 1.15 : 0.55) + over;
    const thick = g.style === "brutal" ? 1.15 : g.style === "deco" ? 0.7 : g.style === "civic" ? 0.62 : g.style === "brick" ? 0.5 : 0.32;
    m.compose(new THREE.Vector3(g.cx, b.h - 0.12, g.cz), qid, new THREE.Vector3(w, thick, d));
    corniceMesh.setMatrixAt(i, m);
    const hex = g.style === "deco" ? 0xcbb98a : g.style === "brick" ? 0x6a4034 : g.style === "glass" ? 0x9fd9d2 : g.style === "civic" ? 0xe4dcc8 : 0x3a3c38;
    corniceMesh.setColorAt(i, tint.setHex(hex));
  });
  corniceMesh.instanceMatrix.needsUpdate = true;
  if (corniceMesh.instanceColor) corniceMesh.instanceColor.needsUpdate = true;
  scene.add(corniceMesh);

  const tallBlocks = staticBlocks.filter((b) => b.h > 16 && blockStyle((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, b.h, b.maxX - b.minX, b.maxZ - b.minZ) !== "brick");
  const mechMat = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.62, metalness: 0.28 });
  const mechMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mechMat, Math.max(1, tallBlocks.length));
  mechMesh.frustumCulled = false;
  tallBlocks.forEach((b, i) => {
    const w = Math.min(4.2, (b.maxX - b.minX) * 0.28);
    const d = Math.min(3.2, (b.maxZ - b.minZ) * 0.24);
    m.compose(new THREE.Vector3(b.minX + w * 0.7 + 0.6, b.h + 1.15, b.minZ + d * 0.7 + 0.6), qid, new THREE.Vector3(w, 1.7, d));
    mechMesh.setMatrixAt(i, m);
  });
  if (tallBlocks.length === 0) mechMesh.setMatrixAt(0, m.compose(new THREE.Vector3(0, -30, 0), qid, new THREE.Vector3(0.001, 0.001, 0.001)));
  mechMesh.instanceMatrix.needsUpdate = true;
  scene.add(mechMesh);

  const spires = staticBlocks.filter((b) => b.h > 24 && blockStyle((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, b.h, b.maxX - b.minX, b.maxZ - b.minZ) === "deco");
  const spireMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1, 5),
    new THREE.MeshStandardMaterial({ color: 0xcbb98a, emissive: 0xffb020, emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.62 }),
    Math.max(1, spires.length),
  );
  spireMesh.frustumCulled = false;
  spires.forEach((b, i) => {
    m.compose(new THREE.Vector3((b.minX + b.maxX) / 2, b.h + 3.4, (b.minZ + b.maxZ) / 2), qid, new THREE.Vector3(1, 6.2, 1));
    spireMesh.setMatrixAt(i, m);
  });
  if (spires.length === 0) spireMesh.setMatrixAt(0, m.compose(new THREE.Vector3(0, -30, 0), qid, new THREE.Vector3(0.001, 0.001, 0.001)));
  spireMesh.instanceMatrix.needsUpdate = true;
  scene.add(spireMesh);

  const treeSpots: Array<{ x: number; z: number; s: number; y: number }> = [];
  for (let gx = 0; gx < GRID; gx++) {
    for (let gz = 0; gz < GRID; gz++) {
      if (gx === 2 && gz === 2) continue;
      const ox = -HALF + gx * CELL;
      const oz = -HALF + gz * CELL;
      const candidates: Array<[number, number]> = [
        [ox + ROAD / 2 + 2.6, oz + 11],
        [ox + CELL - ROAD / 2 - 2.6, oz + CELL * 0.62],
        [ox + CELL * 0.42, oz + ROAD / 2 + 2.6],
        [ox + CELL * 0.7, oz + CELL - ROAD / 2 - 2.8],
      ];
      for (const [x, z] of candidates) {
        if (staticBlocks.some((b) => x > b.minX - 1.1 && x < b.maxX + 1.1 && z > b.minZ - 1.1 && z < b.maxZ + 1.1)) continue;
        if (roadXs.some((rx) => Math.abs(x - rx) < ROAD / 2 + 0.6)) continue;
        if (roadZs.some((rz) => Math.abs(z - rz) < ROAD / 2 + 0.6)) continue;
        treeSpots.push({ x, z, s: 0.75 + rand() * 0.55, y: groundY(x, z) });
      }
    }
  }
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.16, 1, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.9 }),
    Math.max(1, treeSpots.length),
  );
  const canopyGeo = new THREE.ConeGeometry(1.15, 2.1, 7);
  const canopyMesh = new THREE.InstancedMesh(
    canopyGeo,
    new THREE.MeshStandardMaterial({ color: 0x2f5a3e, roughness: 0.78 }),
    Math.max(1, treeSpots.length),
  );
  const canopy2 = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.72, 1.35, 6),
    new THREE.MeshStandardMaterial({ color: 0x3d6a48, roughness: 0.74 }),
    Math.max(1, treeSpots.length),
  );
  trunkMesh.frustumCulled = false;
  canopyMesh.frustumCulled = false;
  canopy2.frustumCulled = false;
  treeSpots.forEach((t, i) => {
    m.compose(new THREE.Vector3(t.x, 1.05 + t.y, t.z), qid, new THREE.Vector3(1, 2.1, 1));
    trunkMesh.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(t.x, 2.55 + t.y, t.z), qid, new THREE.Vector3(t.s, t.s, t.s));
    canopyMesh.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(t.x + 0.15, 3.35 + t.y, t.z - 0.1), qid, new THREE.Vector3(t.s * 0.85, t.s * 0.9, t.s * 0.85));
    canopy2.setMatrixAt(i, m);
    canopyMesh.setColorAt(i, tint.setHex(i % 3 === 0 ? 0x3a6a48 : i % 3 === 1 ? 0x245038 : 0x4a7a52));
  });
  if (treeSpots.length === 0) {
    m.compose(new THREE.Vector3(0, -30, 0), qid, new THREE.Vector3(0.001, 0.001, 0.001));
    trunkMesh.setMatrixAt(0, m);
    canopyMesh.setMatrixAt(0, m);
    canopy2.setMatrixAt(0, m);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  canopyMesh.instanceMatrix.needsUpdate = true;
  canopy2.instanceMatrix.needsUpdate = true;
  if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;
  scene.add(trunkMesh);
  scene.add(canopyMesh);
  scene.add(canopy2);

  const curbList: Array<[number, number, number, number]> = [];
  for (let i = 0; i < roadXs.length; i++) {
    const x = roadXs[i]!;
    for (let j = 0; j < roadZs.length - 1; j++) {
      const z0 = roadZs[j]! + ROAD / 2 + 0.55;
      const z1 = roadZs[j + 1]! - ROAD / 2 - 0.55;
      const len = z1 - z0;
      if (len < 3) continue;
      const mid = (z0 + z1) / 2;
      curbList.push([x - ROAD / 2, mid, 0.32, len]);
      curbList.push([x + ROAD / 2, mid, 0.32, len]);
    }
  }
  for (let j = 0; j < roadZs.length; j++) {
    const z = roadZs[j]!;
    for (let i = 0; i < roadXs.length - 1; i++) {
      const x0 = roadXs[i]! + ROAD / 2 + 0.55;
      const x1 = roadXs[i + 1]! - ROAD / 2 - 0.55;
      const len = x1 - x0;
      if (len < 3) continue;
      const mid = (x0 + x1) / 2;
      curbList.push([mid, z - ROAD / 2, len, 0.32]);
      curbList.push([mid, z + ROAD / 2, len, 0.32]);
    }
  }
  const curbMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x8d877c, roughness: 0.72, metalness: 0.06 }),
    Math.max(1, curbList.length),
  );
  curbMesh.frustumCulled = false;
  curbList.forEach(([x, z, sx, sz], i) => {
    m.compose(new THREE.Vector3(x, 0.11 + groundY(x, z), z), qid, new THREE.Vector3(sx, 0.22, sz));
    curbMesh.setMatrixAt(i, m);
  });
  if (curbList.length === 0) curbMesh.setMatrixAt(0, m.compose(new THREE.Vector3(0, -20, 0), qid, new THREE.Vector3(0.001, 0.001, 0.001)));
  curbMesh.instanceMatrix.needsUpdate = true;
  scene.add(curbMesh);

  const liftBlockMesh = (mesh: THREE.InstancedMesh, blocks: AABB[]) => {
    const mat = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const n = Math.min(mesh.count, blocks.length);
    for (let i = 0; i < n; i++) {
      mesh.getMatrixAt(i, mat);
      mat.decompose(p, quat, sc);
      if (p.y < -15 || sc.x < 0.02) continue;
      const b = blocks[i]!;
      p.y += groundY((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2);
      mesh.setMatrixAt(i, mat.compose(p, quat, sc));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  for (const mesh of [buildingMesh, podiumMesh, midMesh, finMesh, beltMesh, coreMesh, roofMesh, corniceMesh]) liftBlockMesh(mesh, staticBlocks);
  liftBlockMesh(mechMesh, tallBlocks);
  liftBlockMesh(spireMesh, spires);

  const boxBlocks = [buildingMesh, podiumMesh, midMesh, finMesh, beltMesh, coreMesh, roofMesh, corniceMesh, mechMesh, spireMesh, curbMesh];
  void mountCity(scene, qualityHigh, { cell: CELL, road: ROAD, grid: GRID, shoulder: 2.4 }).then((handle) => {
    if (disposed) {
      handle.dispose();
      return;
    }
    cityHandle = handle;
    for (const mesh of boxBlocks) mesh.visible = false;
  }).catch((err) => {
    console.error("Brookriver city failed", err);
  });
  void mountDressing(scene).then((handle) => {
    if (disposed) {
      handle.dispose();
      return;
    }
    dressingHandle = handle;
  }).catch((err) => {
    console.error("Brookriver dressing failed", err);
  });
  hallHandle = mountHall(scene);
  roomsHandle = mountRooms(scene);

  const lampCount = roadXs.length * roadZs.length;
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 7.4, 6);
  const poleMesh = new THREE.InstancedMesh(
    poleGeo,
    new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.45, metalness: 0.55 }),
    lampCount,
  );
  const lampArmGeo = new THREE.BoxGeometry(1.15, 0.08, 0.08);
  const armMesh = new THREE.InstancedMesh(
    lampArmGeo,
    new THREE.MeshStandardMaterial({ color: 0x2a2c32, roughness: 0.4, metalness: 0.6 }),
    lampCount,
  );
  const bulbGeo = new THREE.SphereGeometry(0.28, 10, 8);
  const bulbMesh = new THREE.InstancedMesh(
    bulbGeo,
    new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xffc14a, emissiveIntensity: 5.2, roughness: 0.18 }),
    lampCount,
  );
  poleMesh.frustumCulled = false;
  armMesh.frustumCulled = false;
  bulbMesh.frustumCulled = false;
  let li = 0;
  for (const x of roadXs) {
    for (const z of roadZs) {
      const lx = x + ROAD / 2 + 0.55;
      const lz = z + ROAD / 2 + 0.55;
      const ly = groundY(lx, lz);
      m.compose(new THREE.Vector3(lx, 3.7 + ly, lz), qid, new THREE.Vector3(1, 1, 1));
      poleMesh.setMatrixAt(li, m);
      m.compose(new THREE.Vector3(lx - 0.45, 7.2 + ly, lz), qid, new THREE.Vector3(1, 1, 1));
      armMesh.setMatrixAt(li, m);
      m.compose(new THREE.Vector3(lx - 0.95, 7.05 + ly, lz), qid, new THREE.Vector3(1, 1, 1));
      bulbMesh.setMatrixAt(li, m);
      li++;
    }
  }
  poleMesh.instanceMatrix.needsUpdate = true;
  armMesh.instanceMatrix.needsUpdate = true;
  bulbMesh.instanceMatrix.needsUpdate = true;
  scene.add(poleMesh);
  scene.add(armMesh);
  scene.add(bulbMesh);
  const poolGeo = new THREE.CircleGeometry(3.4, 14);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMesh = new THREE.InstancedMesh(
    poolGeo,
    new THREE.MeshBasicMaterial({ color: 0xff9a2a, transparent: true, opacity: 0.3, depthWrite: false }),
    lampCount,
  );
  poolMesh.frustumCulled = false;
  for (let i = 0; i < lampCount; i++) {
    const xi = Math.floor(i / roadZs.length);
    const zi = i % roadZs.length;
    const x = roadXs[xi]!;
    const z = roadZs[zi]!;
    const pxL = x + ROAD / 2 - 0.4;
    const pzL = z + ROAD / 2 + 0.55;
    m.compose(new THREE.Vector3(pxL, 0.05 + groundY(pxL, pzL), pzL), qid, new THREE.Vector3(1.35, 1, 1.35));
    poolMesh.setMatrixAt(i, m);
  }
  poolMesh.instanceMatrix.needsUpdate = true;
  scene.add(poolMesh);

  const stone = new THREE.MeshStandardMaterial({ color: 0xb2aa9c, roughness: 0.86, metalness: 0.04, roughnessMap: grit });
  const plazaY = groundY(0, 0);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 0.85, 24), stone);
  fountain.position.set(0, 0.42 + plazaY, 0);
  scene.add(fountain);
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(2.35, 0.16, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xcbb98a, roughness: 0.35, metalness: 0.45 }),
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.set(0, 0.86 + plazaY, 0);
  scene.add(lip);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(2.15, 28),
    new THREE.MeshPhysicalMaterial({
      color: 0x0e3a42,
      emissive: 0x083038,
      emissiveIntensity: 0.55,
      roughness: 0.04,
      metalness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.6,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.9 + plazaY, 0);
  scene.add(water);
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.16, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xd7eef2, emissive: 0x9fd4e0, emissiveIntensity: 0.4, transparent: true, opacity: 0.55, roughness: 0.1 }),
  );
  jet.position.set(0, 1.7 + plazaY, 0);
  scene.add(jet);

  const sigs: Array<{ x: number; z: number; ns: boolean }> = [];
  for (let i = 1; i < roadXs.length - 1; i++) {
    for (let j = 1; j < roadZs.length - 1; j++) {
      const x = roadXs[i]!;
      const z = roadZs[j]!;
      sigs.push({ x: x + ROAD / 2 + 0.85, z: z + 2.4, ns: true });
      sigs.push({ x: x + 2.4, z: z + ROAD / 2 + 0.85, ns: false });
    }
  }
  const sigPole = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.07, 0.09, 4.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.4, metalness: 0.62 }),
    Math.max(1, sigs.length),
  );
  const sigHead = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.32, 0.78, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x121318, roughness: 0.5, metalness: 0.4 }),
    Math.max(1, sigs.length),
  );
  const sigBulbMat = new THREE.MeshStandardNodeMaterial();
  sigBulbMat.colorNode = instanceColor;
  sigBulbMat.emissiveNode = instanceColor.mul(4.4);
  sigBulbMat.roughness = 0.22;
  const sigBulb = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.13, 8, 6),
    sigBulbMat,
    Math.max(1, sigs.length),
  );
  sigPole.frustumCulled = false;
  sigHead.frustumCulled = false;
  sigBulb.frustumCulled = false;
  sigs.forEach((s, i) => {
    const sy = groundY(s.x, s.z);
    m.compose(new THREE.Vector3(s.x, 2.4 + sy, s.z), qid, new THREE.Vector3(1, 1, 1));
    sigPole.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(s.x, 4.55 + sy, s.z), qid, new THREE.Vector3(1, 1, 1));
    sigHead.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(s.x, 4.62 + sy, s.z), qid, new THREE.Vector3(1.45, 1.45, 1.45));
    sigBulb.setMatrixAt(i, m);
  });
  sigPole.instanceMatrix.needsUpdate = true;
  sigHead.instanceMatrix.needsUpdate = true;
  sigBulb.instanceMatrix.needsUpdate = true;
  scene.add(sigPole);
  scene.add(sigHead);
  scene.add(sigBulb);

  const hydrants: Array<[number, number]> = [];
  const dumps: Array<[number, number]> = [];
  const benches: Array<[number, number]> = [];
  for (let i = 0; i < roadXs.length - 1; i++) {
    for (let j = 0; j < roadZs.length - 1; j++) {
      const xL = roadXs[i]! + ROAD / 2 + 1.5;
      const xR = roadXs[i + 1]! - ROAD / 2 - 1.5;
      const zA = roadZs[j]! + ROAD / 2 + 7;
      const zB = roadZs[j + 1]! - ROAD / 2 - 7;
      const midZ = (roadZs[j]! + roadZs[j + 1]!) / 2;
      if (Math.abs(xL) < 22 && Math.abs(midZ) < 22) continue;
      if ((i + j) % 2 === 0) hydrants.push([xL, midZ]);
      else hydrants.push([xR, midZ - 3]);
      if ((i + j) % 3 === 0) dumps.push([xR, zB]);
      if ((i * 2 + j) % 3 === 1) benches.push([xL, zA]);
    }
  }
  const hydrantMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.72, 7),
    new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.55, metalness: 0.25 }),
    Math.max(1, hydrants.length),
  );
  const capMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.2, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xb3382c, roughness: 0.4, metalness: 0.35 }),
    Math.max(1, hydrants.length),
  );
  hydrantMesh.frustumCulled = false;
  capMesh.frustumCulled = false;
  hydrants.forEach(([x, z], i) => {
    const hy = groundY(x, z);
    m.compose(new THREE.Vector3(x, 0.36 + hy, z), qid, new THREE.Vector3(1, 1, 1));
    hydrantMesh.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 0.78 + hy, z), qid, new THREE.Vector3(1, 1, 1));
    capMesh.setMatrixAt(i, m);
  });
  hydrantMesh.instanceMatrix.needsUpdate = true;
  capMesh.instanceMatrix.needsUpdate = true;
  scene.add(hydrantMesh);
  scene.add(capMesh);

  const dumpMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.7, 1.15, 0.95),
    new THREE.MeshStandardMaterial({ color: 0x1a332c, roughness: 0.62, metalness: 0.28 }),
    Math.max(1, dumps.length),
  );
  dumpMesh.frustumCulled = false;
  dumps.forEach(([x, z], i) => {
    m.compose(new THREE.Vector3(x, 0.58 + groundY(x, z), z), qid, new THREE.Vector3(1, 1, 1));
    dumpMesh.setMatrixAt(i, m);
  });
  dumpMesh.instanceMatrix.needsUpdate = true;
  scene.add(dumpMesh);

  const benchMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.55, 0.42, 0.48),
    new THREE.MeshStandardMaterial({ color: 0x8d6240, roughness: 0.68, metalness: 0.08 }),
    Math.max(1, benches.length),
  );
  benchMesh.frustumCulled = false;
  benches.forEach(([x, z], i) => {
    m.compose(new THREE.Vector3(x, 0.38 + groundY(x, z), z), qid, new THREE.Vector3(1, 1, 1));
    benchMesh.setMatrixAt(i, m);
  });
  benchMesh.instanceMatrix.needsUpdate = true;
  scene.add(benchMesh);

  const acs: Array<[number, number, number]> = [];
  for (const b of staticBlocks) {
    if (acs.length >= 32) break;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    if (blockStyle(cx, cz, b.h, b.maxX - b.minX, b.maxZ - b.minZ) !== "brick" || b.h < 9) continue;
    acs.push([b.minX - 0.25, 5.2 + (acs.length % 3) * 2.4 + groundY(cx, cz), cz]);
  }
  const acMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.42, 0.48, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xc8c2b4, roughness: 0.62, metalness: 0.18 }),
    Math.max(1, acs.length),
  );
  acMesh.frustumCulled = false;
  acs.forEach(([x, y, z], i) => {
    m.compose(new THREE.Vector3(x, y, z), qid, new THREE.Vector3(1, 1, 1));
    acMesh.setMatrixAt(i, m);
  });
  acMesh.instanceMatrix.needsUpdate = true;
  scene.add(acMesh);

  const vents = hydrants.slice(0, 8).map(([x, z]) => ({ x: x + 0.8, z }));
  const steamMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.45, 7, 6),
    new THREE.MeshBasicMaterial({ color: 0xe7eef2, transparent: true, opacity: 0.42, depthWrite: false }),
    Math.max(1, vents.length),
  );
  steamMesh.frustumCulled = false;
  scene.add(steamMesh);

  const birds = Array.from({ length: 7 }, (_, i) => ({
    ang: i * 0.9,
    r: 26 + (i % 3) * 16,
    y: 16 + (i % 4) * 3.5,
    spook: 0,
  }));
  const birdMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.35, 0.08, 0.42),
    new THREE.MeshBasicMaterial({ color: 0x12141a }),
    birds.length,
  );
  birdMesh.frustumCulled = false;
  scene.add(birdMesh);

  const scraps = [1, 2, 3, 4].flatMap((lane, j) => [
    { x: -70 + j * 18, z: roadZs[lane]! + 2.4, s: 0.28 + (j % 2) * 0.12 },
    { x: 20 - j * 14, z: roadZs[lane]! - 2.6, s: 0.2 },
  ]);
  const scrapMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.55, 0.08, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x8a8274, roughness: 0.9 }),
    scraps.length,
  );
  scrapMesh.frustumCulled = false;
  scene.add(scrapMesh);

  const cloudMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xd5dce8, transparent: true, opacity: 0.28, depthWrite: false, fog: false }),
    4,
  );
  cloudMesh.frustumCulled = false;
  const clouds = [
    { x: -80, z: -30, s: 22 },
    { x: -10, z: 50, s: 16 },
    { x: 60, z: -10, s: 26 },
    { x: 100, z: 40, s: 18 },
  ];
  scene.add(cloudMesh);

  const craft = new THREE.Group();
  const fuseMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.45, metalness: 0.35 });
  const fuse = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 3.6), fuseMat);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 0.7), fuseMat);
  wing.position.z = 0.2;
  const nav = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
  nav.position.set(2.05, 0.05, 0.15);
  craft.add(fuse, wing, nav);
  scene.add(craft);

  const racks: Array<[number, number]> = [
    [-18, -18],
    [18, -18],
    [-18, 18],
    [18, 18],
  ];
  const rackMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.7, 0.95, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 0.7, emissive: 0xffb020, emissiveIntensity: 0.25 }),
    racks.length,
  );
  racks.forEach(([x, z], i) => {
    m.compose(new THREE.Vector3(x, 0.48 + groundY(x, z), z), qid, new THREE.Vector3(1, 1, 1));
    rackMesh.setMatrixAt(i, m);
  });
  rackMesh.instanceMatrix.needsUpdate = true;
  scene.add(rackMesh);

  const crateGeo = new THREE.BoxGeometry(1, 1, 1);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6a5644, roughness: 0.85 });
  const crateMesh = new THREE.InstancedMesh(crateGeo, crateMat, 3);
  const crates = blocks.slice(-3);
  crates.forEach((b, i) => {
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    m.compose(
      new THREE.Vector3(cx, b.h / 2 + groundY(cx, cz), cz),
      qid,
      new THREE.Vector3(b.maxX - b.minX, b.h, b.maxZ - b.minZ),
    );
    crateMesh.setMatrixAt(i, m);
  });
  scene.add(crateMesh);

  const signs = ["LIQUOR", "MOTEL", "GUNS", "DINER", "BAIL", "CASH", "VICE", "24 HR"];
  const signColors = [
    ["#ffb020", "#1a1208"],
    ["#f3efe4", "#5a1a1a"],
    ["#ffb020", "#14171f"],
    ["#e23b3b", "#140c0c"],
    ["#f3efe4", "#14221f"],
    ["#ffb020", "#20160c"],
    ["#3ee0c5", "#071412"],
    ["#f3efe4", "#1a1208"],
  ];
  const signMeshes: THREE.Mesh[] = [];
  const signHosts = staticBlocks.filter((b) => b.h > 10).slice(0, signs.length);
  signHosts.forEach((b, i) => {
    const tex = makeSign(signs[i]!, signColors[i]![0]!, signColors[i]![1]!);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 2.3, 0.32),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    const sx = b.maxX + 0.08;
    const sz = (b.minZ + b.maxZ) / 2;
    mesh.position.set(sx, Math.min(b.h * 0.45, 14) + groundY(sx, sz), sz);
    mesh.rotation.y = Math.PI / 2;
    scene.add(mesh);
    signMeshes.push(mesh);
  });
  const amberSign = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 2.4, 0.32),
    new THREE.MeshBasicMaterial({ map: makeSign("AMBER", "#ffb020", "#1a1208") }),
  );
  amberSign.position.set(-60, 7.2 + groundY(-60, 12), 12);
  amberSign.rotation.y = -Math.PI / 2;
  scene.add(amberSign);
  const tealSign = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 2.4, 0.32),
    new THREE.MeshBasicMaterial({ map: makeSign("TEAL", "#3ee0c5", "#071412") }),
  );
  tealSign.position.set(60, 7.2 + groundY(60, 12), 12);
  tealSign.rotation.y = Math.PI / 2;
  scene.add(tealSign);
  const lotSign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.3),
    new THREE.MeshBasicMaterial({ map: makeSign("LOT", "#ffb020", "#14120c") }),
  );
  lotSign.position.set(LOT.x, 3.1 + groundY(LOT.x, LOT.z + 0.7), LOT.z + 0.7);
  scene.add(lotSign);
  const deedBoards: { id: string; mesh: THREE.Mesh }[] = [];
  const safeMeshes = new Map<string, THREE.Mesh>();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.15, emissive: 0x2a1808, emissiveIntensity: 0.45 });
  const postMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.28, 2.6, 6), postMat, spots.length);
  spots.forEach((s, i) => {
    const brand = BRAND[s.id] ?? { title: s.name, sub: "", fg: "#ffb020", bg: "#14120c", map: "#ffb020", code: "•" };
    const spotY = groundY(s.x, s.z);
    m.compose(new THREE.Vector3(s.x, 1.3 + spotY, s.z), qid, new THREE.Vector3(1, 1, 1));
    postMesh.setMatrixAt(i, m);
    postMesh.setColorAt(i, tint.set(brand.map));
    const lane = nearestRoad(s.x, s.z);
    const face = Math.abs(lane.yaw) < 0.01 ? 0 : Math.PI / 2;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 1.6, 0.18),
      new THREE.MeshBasicMaterial({
        map: makeSign(brand.title, brand.fg, brand.bg, brand.sub || undefined),
        side: THREE.DoubleSide,
      }),
    );
    board.position.set(s.x, 3.05 + spotY, s.z);
    board.rotation.y = face;
    scene.add(board);
    deedBoards.push({ id: s.id, mesh: board });
    const accent = new THREE.Color(brand.map);
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(4.9, 0.16, 1.55),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55, metalness: 0.08, emissive: accent, emissiveIntensity: 0.4 }),
    );
    awning.position.set(s.x, 3.95 + spotY, s.z);
    awning.rotation.y = face;
    scene.add(awning);
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 18),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.82, emissive: accent, emissiveIntensity: 0.28 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(s.x, 0.22 + spotY, s.z);
    scene.add(pad);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  if (postMesh.instanceColor) postMesh.instanceColor.needsUpdate = true;
  scene.add(postMesh);
  const safeMat = new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 0.42, metalness: 0.62, emissive: 0xc4a15a, emissiveIntensity: 0.35 });
  for (const id of ["home1", "home2", "home3"]) {
    const home = spots.find((s) => s.id === id);
    if (!home) continue;
    const safe = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.62, 0.5), safeMat);
    safe.position.set(home.x + 1.35, 0.36 + groundY(home.x + 1.35, home.z + 0.4), home.z + 0.4);
    safe.visible = false;
    scene.add(safe);
    safeMeshes.set(id, safe);
  }
  const suite = spots.find((s) => s.id === "roller");
  const inviteTable = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.1, 1.15),
    new THREE.MeshStandardMaterial({ color: 0xb06adf, roughness: 0.45, emissive: 0xb06adf, emissiveIntensity: 0.45 }),
  );
  inviteTable.position.set(suite ? suite.x : 69, 0.82 + groundY(suite ? suite.x : 69, suite ? suite.z + 1.7 : 76.7), suite ? suite.z + 1.7 : 76.7);
  inviteTable.visible = false;
  scene.add(inviteTable);
  refreshDeedSigns();
  refreshProps();
  const kiosk = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.5, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 0.72 }),
  );
  kiosk.position.set(LOT.x, 0.75 + groundY(LOT.x, LOT.z), LOT.z);
  scene.add(kiosk);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 9, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.8 }),
  );
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.3, 4.15, 28),
    new THREE.MeshBasicMaterial({ color: 0xffb020, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 2.2, 18, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0.05, depthWrite: false }),
  );
  beam.visible = false;
  scene.add(beam);
  const heliSpot = new THREE.SpotLight(0xfff4d2, 0, 92, 0.42, 0.55, 1.15);
  heliSpot.position.set(0, 34, 0);
  scene.add(heliSpot);
  scene.add(heliSpot.target);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
  flash.visible = false;
  scene.add(flash);
  const smokeGeo = new THREE.SphereGeometry(0.35, 6, 6);
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x2a2e38, transparent: true, opacity: 0.45, depthWrite: false });
  const smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, 24);
  smokeMesh.frustumCulled = false;
  scene.add(smokeMesh);

  const carCap = cars.length;
  const bodyGeo = new THREE.BoxGeometry(1.72, 0.42, 4.05);
  const cabinGeo = new THREE.BoxGeometry(1.42, 0.38, 1.7);
  const hoodGeo = new THREE.BoxGeometry(1.62, 0.22, 1.35);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.28, 8);
  rimGeo.rotateZ(Math.PI / 2);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.62,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.85,
  });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x071016, roughness: 0.06, metalness: 0.22, emissive: 0x0c1822, emissiveIntensity: 0.35, envMapIntensity: 1.5 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9ec8d4,
    roughness: 0.02,
    metalness: 0.08,
    envMapIntensity: 2.2,
    emissive: 0x102028,
    emissiveIntensity: 0.2,
  });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xe7d7b0, roughness: 0.28, metalness: 0.82 });
  const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, carCap);
  const cabinMesh = new THREE.InstancedMesh(cabinGeo, cabinMat, carCap);
  const glassMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.18, 0.3, 1.48), glassMat, carCap);
  const hoodMesh = new THREE.InstancedMesh(hoodGeo, bodyMat, carCap);
  const wheelMesh = new THREE.InstancedMesh(wheelGeo, wheelMat, carCap * 4);
  const rimMesh = new THREE.InstancedMesh(rimGeo, rimMat, carCap * 4);
  const lampLGeo = new THREE.BoxGeometry(0.36, 0.16, 0.12);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8e8, emissive: 0xfff1c4, emissiveIntensity: 5.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff4a3a, emissive: 0xff2218, emissiveIntensity: 4.2 });
  const headMesh = new THREE.InstancedMesh(lampLGeo, headMat, carCap * 2);
  const tailMesh = new THREE.InstancedMesh(lampLGeo, tailMat, carCap * 2);
  const barGeo = new THREE.BoxGeometry(0.22, 0.12, 0.22);
  const barMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2a2a, emissiveIntensity: 4.4 });
  const barMesh = new THREE.InstancedMesh(barGeo, barMat, carCap * 2);
  const shadowGeo = new THREE.CircleGeometry(1.7, 14);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.InstancedMesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: qualityHigh ? 0.18 : 0.4, depthWrite: false }),
    carCap,
  );
  for (const mesh of [bodyMesh, cabinMesh, glassMesh, hoodMesh, wheelMesh, rimMesh, headMesh, tailMesh, barMesh, shadowMesh]) {
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  if (qualityHigh) {
    bodyMesh.castShadow = true;
    cabinMesh.castShadow = true;
    hoodMesh.castShadow = true;
    trunkMesh.castShadow = true;
    canopyMesh.castShadow = true;
    canopy2.castShadow = true;
    buildingMesh.castShadow = true;
    curbMesh.castShadow = true;
    curbMesh.receiveShadow = true;
  }
  cars.forEach((car, i) => {
    tint.setHex(car.color);
    bodyMesh.setColorAt(i, tint);
    hoodMesh.setColorAt(i, tint);
  });
  if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
  if (hoodMesh.instanceColor) hoodMesh.instanceColor.needsUpdate = true;
  const boxCars = [bodyMesh, cabinMesh, glassMesh, hoodMesh, wheelMesh, rimMesh, headMesh, tailMesh];
  void loadFleet(scene, carCap, qualityHigh).then((handle) => {
    if (disposed) {
      handle.dispose();
      return;
    }
    fleet = handle;
    for (const mesh of boxCars) mesh.visible = false;
  }).catch((err) => {
    console.error("Brookriver cars failed", err);
  });

  const pedCap = peds.length;
  const pedBodyGeo = new THREE.BoxGeometry(0.42, 0.62, 0.26);
  const pedHeadGeo = new THREE.SphereGeometry(0.15, 10, 8);
  const pedLegGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
  const pedArmGeo = new THREE.BoxGeometry(0.1, 0.38, 0.1);
  const pedBodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 });
  const pedHeadMat = new THREE.MeshStandardMaterial({ color: 0xd7b59a, roughness: 0.58 });
  const pedLimbMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.8 });
  const pedHairMat = new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: 0.75 });
  const pedBody = new THREE.InstancedMesh(pedBodyGeo, pedBodyMat, pedCap);
  const pedHead = new THREE.InstancedMesh(pedHeadGeo, pedHeadMat, pedCap);
  const pedHair = new THREE.InstancedMesh(new THREE.SphereGeometry(0.155, 8, 6), pedHairMat, pedCap);
  const pedLeg = new THREE.InstancedMesh(pedLegGeo, pedLimbMat, pedCap * 2);
  const pedArm = new THREE.InstancedMesh(pedArmGeo, pedLimbMat, pedCap * 2);
  pedBody.frustumCulled = false;
  pedHead.frustumCulled = false;
  pedHair.frustumCulled = false;
  pedLeg.frustumCulled = false;
  pedArm.frustumCulled = false;
  scene.add(pedBody, pedHead, pedHair, pedLeg, pedArm);

  peds.forEach((p, i) => {
    tint.setHex(p.color);
    pedBody.setColorAt(i, tint);
  });
  if (pedBody.instanceColor) pedBody.instanceColor.needsUpdate = true;

  const playerGroup = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.64, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.55, metalness: 0.08 }),
  );
  jacket.position.y = 1.16;
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.07, 0.32),
    new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xffb020, emissiveIntensity: 0.55 }),
  );
  stripe.position.y = 1.32;
  const headP = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), pedHeadMat);
  headP.position.y = 1.64;
  const hairP = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: 0.7 }),
  );
  hairP.position.set(0, 1.74, -0.02);
  hairP.scale.set(1, 0.62, 1);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.58, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.8 }),
  );
  legs.position.y = 0.46;
  const armGeo = new THREE.BoxGeometry(0.12, 0.46, 0.12);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.7 });
  const leftPivot = new THREE.Group();
  leftPivot.position.set(-0.34, 1.32, 0);
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.y = -0.2;
  leftPivot.add(leftArm);
  const rightPivot = new THREE.Group();
  rightPivot.position.set(0.34, 1.32, 0);
  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.y = -0.2;
  rightPivot.add(rightArm);
  playerGroup.add(legs, jacket, stripe, headP, hairP, leftPivot, rightPivot);
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.32, metalness: 0.78 });
  const gunDark = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.48, metalness: 0.45 });
  const gunWood = new THREE.MeshStandardMaterial({ color: 0x6d4a30, roughness: 0.66, metalness: 0.04 });
  const gunPart = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    return mesh;
  };
  const gunRoot = new THREE.Group();
  const pistolMesh = new THREE.Group();
  pistolMesh.add(
    gunPart(0.07, 0.09, 0.28, gunMetal, 0, 0.04, -0.08),
    gunPart(0.055, 0.15, 0.07, gunDark, 0, -0.08, 0.05),
    gunPart(0.035, 0.04, 0.07, gunDark, 0, 0.05, -0.22),
  );
  const shotgunMesh = new THREE.Group();
  shotgunMesh.add(
    gunPart(0.05, 0.055, 0.78, gunDark, 0, 0.05, -0.24),
    gunPart(0.06, 0.07, 0.32, gunWood, 0, 0.01, 0.18),
    gunPart(0.05, 0.14, 0.07, gunWood, 0, -0.09, 0.1),
  );
  const smgMesh = new THREE.Group();
  smgMesh.add(
    gunPart(0.07, 0.09, 0.44, gunMetal, 0, 0.04, -0.14),
    gunPart(0.055, 0.18, 0.07, gunDark, 0, -0.11, 0.02),
    gunPart(0.09, 0.05, 0.12, gunMetal, 0, 0.07, 0.02),
  );
  gunRoot.add(pistolMesh, shotgunMesh, smgMesh);
  gunRoot.position.set(0, -0.5, 0);
  gunRoot.rotation.set(-Math.PI / 2, 0, 0);
  rightPivot.add(gunRoot);
  scene.add(playerGroup);

  void loadCast()
    .then((lib) => {
      if (disposed) {
        disposeCast(lib);
        return;
      }
      castLib = lib;
      pedActors = peds.map((ped) => {
        const actor = createActor(lib, actorKey(ped.faction, ped.look), gunFor(ped.faction, ped.look), ped.look);
        scene.add(actor.root);
        parkActor(actor);
        return actor;
      });
      selectCharacter(chosenCharacter);
      // Loading can finish after Start was pressed.
      if (!playerActor) { const actor = createActor(lib, `player-${chosenCharacter}`, "all"); scene.add(actor.root); playableActors.set(chosenCharacter, actor); playerActor = actor; }
      pedBody.visible = false;
      pedHead.visible = false;
      pedHair.visible = false;
      pedLeg.visible = false;
      pedArm.visible = false;
      jacket.visible = false;
      stripe.visible = false;
      headP.visible = false;
      hairP.visible = false;
      legs.visible = false;
      leftPivot.visible = false;
      rightPivot.visible = false;
      castReady = true;
    })
    .catch((err) => {
      console.error("Brookriver cast failed", err);
    });

  const pickupMesh = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.38, 0),
    new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xffb020, emissiveIntensity: 0.8, roughness: 0.35 }),
    pickups.length,
  );
  pickupMesh.frustumCulled = false;
  scene.add(pickupMesh);
  pickups.forEach((p, i) => {
    tint.setHex(p.kind === "med" ? 0xffb020 : 0xf3efe4);
    pickupMesh.setColorAt(i, tint);
  });
  if (pickupMesh.instanceColor) pickupMesh.instanceColor.needsUpdate = true;

  const shotMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffe7a8 }),
    MAX_SHOTS,
  );
  shotMesh.frustumCulled = false;
  shotMesh.count = MAX_SHOTS;
  scene.add(shotMesh);
  const shotHide = new THREE.Matrix4().makeScale(0, 0, 0);

  const timer = new THREE.Timer();
  timer.connect(document);

  const v = new THREE.Vector3();
  const camHold = new THREE.Vector3(0, 38, 72);
  const v2 = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const axle = new THREE.Vector3(1, 0, 0);
  const axleZ = new THREE.Vector3(0, 0, 1);
  const shotScale = new THREE.Vector3();
  const scale1 = new THREE.Vector3(1, 1, 1);
  const scale0 = new THREE.Vector3(0.0001, 0.0001, 0.0001);
  const scaleBody = new THREE.Vector3(1, 1, 1);
  const scaleWheel = new THREE.Vector3(1, 1, 1);
  const qw = new THREE.Quaternion();

  const audio = {
    ctx: null as AudioContext | null,
    engine: null as OscillatorNode | null,
    engineGain: null as GainNode | null,
    sirenA: null as OscillatorNode | null,
    sirenB: null as OscillatorNode | null,
    sirenGain: null as GainNode | null,
    tire: null as AudioBufferSourceNode | null,
    tireGain: null as GainNode | null,
    radioA: null as OscillatorNode | null,
    radioB: null as OscillatorNode | null,
    radioGain: null as GainNode | null,
    noise: null as AudioBuffer | null,
    ensure() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctx();
        this.engine = this.ctx.createOscillator();
        this.engine.type = "sawtooth";
        this.engine.frequency.value = 48;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engine.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engine.start();
        this.sirenA = this.ctx.createOscillator();
        this.sirenB = this.ctx.createOscillator();
        this.sirenA.type = "triangle";
        this.sirenB.type = "sine";
        this.sirenA.frequency.value = 680;
        this.sirenB.frequency.value = 520;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenA.connect(this.sirenGain);
        this.sirenB.connect(this.sirenGain);
        this.sirenGain.connect(this.ctx.destination);
        this.sirenA.start();
        this.sirenB.start();
        const len = this.ctx.sampleRate;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noise = buf;
        this.tire = this.ctx.createBufferSource();
        this.tire.buffer = buf;
        this.tire.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 780;
        bp.Q.value = 0.65;
        this.tireGain = this.ctx.createGain();
        this.tireGain.gain.value = 0;
        this.tire.connect(bp);
        bp.connect(this.tireGain);
        this.tireGain.connect(this.ctx.destination);
        this.tire.start();
        this.radioA = this.ctx.createOscillator();
        this.radioB = this.ctx.createOscillator();
        this.radioA.type = "triangle";
        this.radioB.type = "sine";
        this.radioGain = this.ctx.createGain();
        this.radioGain.gain.value = 0;
        this.radioA.connect(this.radioGain);
        this.radioB.connect(this.radioGain);
        this.radioGain.connect(this.ctx.destination);
        this.radioA.start();
        this.radioB.start();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    },
    blip(freq: number, dur: number, type: OscillatorType, gain: number) {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + dur + 0.02);
    },
    shot(kind: GunId = "pistol") {
      if (!this.ctx || !this.noise) {
        this.blip(180, 0.07, "square", 0.04);
        this.blip(90, 0.09, "sawtooth", 0.03);
        return;
      }
      const t = this.ctx.currentTime;
      const spec = kind === "shotgun" ? { hp: 280, peak: 0.11, dur: 0.16 } : kind === "smg" ? { hp: 1400, peak: 0.045, dur: 0.05 } : { hp: 900, peak: 0.075, dur: 0.08 };
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = spec.hp;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(spec.peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.ctx.destination);
      src.start(t);
      src.stop(t + spec.dur + 0.02);
      const slap = this.ctx.createBufferSource();
      slap.buffer = this.noise;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 620;
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.setValueAtTime(spec.peak * 0.32, t + 0.08);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      slap.connect(lp);
      lp.connect(sg);
      sg.connect(this.ctx.destination);
      slap.start(t);
      slap.stop(t + 0.22);
    },
    crunch() {
      if (!this.ctx || !this.noise) return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 220;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      src.connect(lp);
      lp.connect(g);
      g.connect(this.ctx.destination);
      src.start(t);
      src.stop(t + 0.18);
    },
  };

  function jobCard(def: NonNullable<ReturnType<typeof hustleById>>): JobCard {
    const scored = scoreHustle(def);
    if (def.kind === "fence") {
      return {
        id: def.id,
        name: def.name,
        pay: `${Math.round(scored.fenceCut * 100)}% of the goods`,
        detail: "Turns what you're carrying into wallet cash.",
        stake: 0,
        seconds: scored.seconds,
        stars: scored.stars,
        hurt: scored.hurt,
        fail: scored.fail,
      };
    }
    if (def.kind === "wager") {
      return {
        id: def.id,
        name: def.name,
        pay: `$${scored.stakeCash.toLocaleString("en-US")} up to $${scored.winPay.toLocaleString("en-US")}`,
        detail: "The stake is gone if it misses.",
        stake: scored.stakeCash,
        seconds: scored.seconds,
        stars: scored.stars,
        hurt: scored.hurt,
        fail: scored.fail,
      };
    }
    const detail = def.yield === "goods" ? "Pays in goods." : def.yield === "mixed" ? "Cash and goods." : "Pays cash.";
    return {
      id: def.id,
      name: def.name,
      pay: `$${scored.low.toLocaleString("en-US")}–$${scored.high.toLocaleString("en-US")}`,
      detail,
      stake: scored.stakeCash,
      seconds: scored.seconds,
      stars: scored.stars,
      hurt: scored.hurt,
      fail: scored.fail,
    };
  }

  function carCards() {
    return catalogCars().map((car) => {
      const ride = RIDES[car.ride];
      return {
        body: car.body,
        name: car.name,
        ride: car.ride,
        tier: car.tier,
        cost: car.cost,
        stars: car.stars,
        top: Math.round(ride.vmax * 2.237),
        accel: ride.accel,
        turn: ride.turn,
        hp: ride.maxHp,
        affordable: cash >= car.cost,
        owned: deeds.ownedCars.filter((ownedCar) => ownedCar.body === car.body).length,
      };
    });
  }

  function houseCards() {
    return catalogHouses().map((house) => ({
      id: house.id,
      name: house.name,
      address: blockAt(house.address.x, house.address.z),
      cost: house.cost,
      stars: house.stars,
      stashCap: house.stashCap,
      bays: house.bays,
      starInterval: house.starInterval,
      deathMultiplier: house.deathMultiplier,
      healHp: house.healHp,
      healArmor: house.healArmor,
      owned: deeds.ownedHouses.includes(house.id),
      affordable: cash >= house.cost,
    }));
  }

  function shopCards() {
    return catalogShops().map((shop) => {
      const visit = shopVisit(shop.id);
      const counter =
        visit.effect === "heal"
          ? `The counter heals ${visit.heal}.`
          : visit.effect === "ammo"
            ? `The counter puts ${visit.ammoPacks} magazines on your belt.`
            : "The cage sells the tape or orders a hit.";
      return {
        id: shop.id,
        kind: shop.kind,
        name: shop.name,
        address: blockAt(shop.address.x, shop.address.z),
        cost: shop.cost,
        stars: shop.stars,
        till: shop.income - shop.upkeepCash,
        owned: deeds.ownedShops.some((ownedShop) => ownedShop.id === shop.id),
        affordable: cash >= shop.cost,
        counter,
      };
    });
  }

  function fixerItem(def: SpendDef): FixerItem {
    const ownedCount = def.kind === "tune" ? hold.tunes : 0;
    const scored = scoreSpend(def, ownedCount);
    const cost = def.kind === "bribe" ? bribeCost(def) : scored.cost;
    let enabled = cash >= cost;
    let note = "";
    let price = `$${cost.toLocaleString("en-US")}`;
    let name = def.name;
    if (def.kind === "ammo") note = "Magazines for the gun in your hand.";
    else if (def.kind === "armor") note = "Puts a vest on.";
    else if (def.kind === "tune") {
      note = hold.tunes >= 3 ? "Nothing left to tune." : `Patches the car you're in. ${hold.tunes}/3.`;
      if (hold.tunes >= 3) enabled = false;
    } else if (def.kind === "bribe") {
      note = wanted <= 0 ? "Nobody's looking." : "Cuts the heat. The price climbs with the stars.";
      if (wanted <= 0) enabled = false;
    } else if (def.kind === "crew") note = `A gun rides with you for ${scored.seconds}s.`;
    else if (def.kind === "drug") note = hold.packs > 0 ? `${hold.packs} packs in the coat.` : "A pack for the corner.";
    else if (def.id === "shotgun") {
      note = owned.shotgun ? "You already have it." : "The shotgun.";
      if (owned.shotgun) enabled = false;
    } else if (def.id === "smg") {
      note = owned.smg ? "You already have it." : "The SMG.";
      if (owned.smg) enabled = false;
    } else if (def.kind === "market") {
      if (hold.marketCost > 0) {
        name = "Sell the tape";
        price = `$${tapeValue().toLocaleString("en-US")}`;
        note = "The fixer buys it back.";
        enabled = true;
      } else note = "A tape you can sell back later.";
    } else if (def.kind === "hit") note = "A contract on the block.";
    else if (def.kind === "invite") {
      note = hold.invite ? "You're already on the list." : "Opens the suite.";
      if (hold.invite) enabled = false;
    } else if (def.kind === "luxury") {
      note = hold.lux > 0 ? "You already wear it." : "The watch. The safe is at the house.";
      if (hold.lux > 0) enabled = false;
    }
    if (cash < cost && !(def.kind === "market" && hold.marketCost > 0)) enabled = false;
    return { id: def.id, name, price, note, enabled, action: "spend" };
  }

  function fixerItems(where: "fixer" | "lot"): FixerItem[] {
    const items: FixerItem[] = [];
    const cars = catalogCars();
    const cheapCar = cars.reduce((best, car) => (car.cost < best ? car.cost : best), cars[0]?.cost ?? 0);
    if (where === "fixer") {
      const houses = catalogHouses();
      const shops = catalogShops();
      const cheapHouse = houses.reduce((best, house) => (house.cost < best ? house.cost : best), houses[0]?.cost ?? 0);
      const cheapShop = shops.reduce((best, shop) => (shop.cost < best ? shop.cost : best), shops[0]?.cost ?? 0);
      items.push({
        id: "houses",
        name: "Houses",
        price: `from $${cheapHouse.toLocaleString("en-US")}`,
        note: "Stash, a garage, and stars cool while you're inside.",
        enabled: true,
        action: "catalog-house",
      });
      items.push({
        id: "shops",
        name: "Shops",
        price: `from $${cheapShop.toLocaleString("en-US")}`,
        note: "Mart, late shop, or the back room. Each counter is different.",
        enabled: true,
        action: "catalog-shop",
      });
    }
    items.push({
      id: "cars",
      name: "Cars",
      price: `from $${cheapCar.toLocaleString("en-US")}`,
      note: "Every body on the sheet, with the speed and the price.",
      enabled: true,
      action: "catalog-car",
    });
    const lotIds = new Set(["bribe", "vest", "shotgun"]);
    for (const def of SPENDS) {
      if (def.kind === "ride" || def.kind === "house" || def.kind === "business") continue;
      if (where === "lot" && !lotIds.has(def.id)) continue;
      items.push(fixerItem(def));
    }
    return items;
  }

  function homeDesk(id: HouseId): Desk | null {
    const house = catalogHouses().find((item) => item.id === id);
    const spot = spots.find((item) => item.id === id);
    if (!house || !spot) return null;
    const cap = catalogHouses()
      .filter((item) => deeds.ownedHouses.includes(item.id))
      .reduce((best, item) => Math.max(best, item.stashCap), 0);
    const parked = deeds.garage.filter((slot) => slot.bayHouse === id);
    const names = catalogCars();
    const bays: BaySlot[] = parked.map((slot) => ({
      carId: slot.carId,
      name: names.find((car) => car.body === slot.body)?.name ?? slot.body,
    }));
    let sellBlock = "";
    if (deeds.stash > 0) sellBlock = "Pull the stash first";
    else if (parked.length > 0) sellBlock = "Take the car out first";
    return {
      kind: "home",
      spotId: id,
      name: house.name,
      stash: Math.floor(deeds.stash),
      cap,
      goods: Math.floor(loot),
      room: Math.max(0, cap - Math.floor(deeds.stash)),
      bays,
      bayCount: house.bays,
      refund: Math.round(house.cost * 0.6),
      sellBlock,
    };
  }

  function counterDesk(id: ShopId): Desk | null {
    const shop = deeds.ownedShops.find((item) => item.id === id);
    const listing = catalogShops().find((item) => item.id === id);
    const spot = spots.find((item) => item.id === id);
    if (!shop || !listing || !spot) return null;
    const acts = doorActs(spot);
    const visit = shopVisit(shop.id);
    const useDetail =
      visit.effect === "heal"
        ? `Heals ${visit.heal}.`
        : visit.effect === "ammo"
          ? `${visit.ammoPacks} magazines onto the gun you're holding.`
          : hold.marketCost > 0
            ? `The tape is worth $${tapeValue().toLocaleString("en-US")}.`
            : "Orders a hit on the block.";
    const till = Math.floor(deeds.shopTill[shop.id] ?? 0);
    return {
      kind: "counter",
      spotId: id,
      name: listing.name,
      till,
      use: acts[1] ?? "Use",
      useDetail,
      payout: Math.round(listing.cost * 0.6) + till,
      busy: shop.id === "pawn" ? 0 : martCd,
    };
  }

  function bankDesk(): Desk {
    return {
      kind: "bank",
      wallet: Math.floor(cash),
      bank: Math.floor(bankBal),
      draw: Math.min(Math.floor(bankBal), 500),
      hot: wanted >= 4,
    };
  }

  function jobsDesk(spot: (typeof spots)[number]): Desk {
    const list = offersAt(spot.place);
    return {
      kind: "jobs",
      title: spot.name,
      cool: spot.cool,
      selected: list.length ? spot.pick % list.length : 0,
      jobs: list.map(jobCard),
    };
  }

  function hallDesk(): Desk | null {
    const table = nearestTable();
    if (!table) return null;
    const wallet = Math.floor(cash);
    const bet = chipStep();
    const bets = BET_STEPS.slice();
    if (table.game === "cage") return { kind: "cage", wallet };
    if (table.game === "blackjack") return { kind: "blackjack", wallet, bet, bets, state: bj };
    if (table.game === "roulette") {
      const pickKind = ROULETTE_CYCLE[rouletteIx] ?? "red";
      const pick = pickKind === "straight" ? rouletteN : pickKind === "dozen" ? dozenN : 0;
      return { kind: "roulette", wallet, bet, bets, pickKind, pick, last: lastRoulette };
    }
    if (table.game === "slots") {
      const machine = table.id === "slot-l" ? "LEFT MACHINE" : table.id === "slot-r" ? "RIGHT MACHINE" : "CENTER MACHINE";
      return { kind: "slots", wallet, bet, bets, machine, last: lastSlots };
    }
    if (table.game === "craps") return { kind: "craps", wallet, bet, bets, last: lastCraps };
    return { kind: "baccarat", wallet, bet, bets, side: BACCARAT_CYCLE[baccaratIx] ?? "player", last: lastBaccarat };
  }

  function buildDesk(): Desk | null {
    if (!started || phase !== "play" || !alive || channel) return null;
    if (catalog && nearCatalog()) {
      const wallet = Math.floor(cash);
      if (catalog.kind === "car") return { kind: "cars", wallet, cars: carCards() };
      if (catalog.kind === "house") return { kind: "houses", wallet, houses: houseCards() };
      return { kind: "shops", wallet, shops: shopCards() };
    }
    if (inHall) return hallDesk();
    if (roomId === "teller") return bankDesk();
    if (roomId === "fixer") return { kind: "fixer", wallet: Math.floor(cash), where: "fixer", items: fixerItems("fixer") };
    if (roomId && isHouseId(roomId)) return homeDesk(roomId);
    if (roomId && isShopId(roomId)) return counterDesk(roomId);
    if (roomId) {
      const inside = spots.find((spot) => spot.id === roomId);
      return inside ? jobsDesk(inside) : null;
    }
    const spot = nearestSpot();
    if (spot?.place === "fixer") return { kind: "fixer", wallet: Math.floor(cash), where: "fixer", items: fixerItems("fixer") };
    if (spot?.place === "teller") return bankDesk();
    if (!driving) {
      const door = ownedDoorSpot();
      if (door && isHouseId(door.id)) return homeDesk(door.id);
      if (door && isShopId(door.id)) return counterDesk(door.id);
    }
    if (nearLot() && !spot) return { kind: "fixer", wallet: Math.floor(cash), where: "lot", items: fixerItems("lot") };
    if (!driving && spot) return jobsDesk(spot);
    if (!driving && nearestMug() >= 0) {
      const mug = hustleById("mug");
      const person = pedActors[nearestMug()]?.profile;
      return mug ? { kind: "mug", job: jobCard(mug), resident: person ? { name: person.name, role: person.role, manner: person.manner } : undefined } : null;
    }
    if (nearLot()) return { kind: "fixer", wallet: Math.floor(cash), where: "lot", items: fixerItems("lot") };
    return null;
  }

  function poke(key: "confirm" | "next" | "back") {
    navSeq += 1;
    navKey = key;
    pushHud();
  }

  function blackjackHand() {
    return inHall && !!bj && bj.phase === "player" && nearestTable()?.game === "blackjack";
  }

  function setRoulette(kind: RouletteKind, pick: number) {
    const index = ROULETTE_CYCLE.indexOf(kind);
    if (index >= 0) rouletteIx = index;
    if (kind === "straight" && pick >= 0 && pick <= 36) rouletteN = pick;
    if (kind === "dozen" && (pick === 1 || pick === 2 || pick === 3)) dozenN = pick;
  }

  function beginHustleId(id: string) {
    if (!started || !alive || phase !== "play" || channel) return;
    if (driving) {
      say("On foot for this");
      return;
    }
    if (id === "mug") {
      const ped = nearestMug();
      if (ped < 0) {
        say("Nothing in reach");
        return;
      }
      const target = peds[ped]!;
      openChannel("mug", "civ", ped, target.x, target.z);
      return;
    }
    const spot = roomId ? spots.find((item) => item.id === roomId) : nearestSpot();
    if (!spot) return;
    if (spot.cool > 0) {
      say(`Hot for ${Math.ceil(spot.cool)}s`);
      return;
    }
    openChannel(id, spot.id, -1, roomId ? px : spot.x, roomId ? pz : spot.z);
  }

  function applyCmd(cmd: UiCmd) {
    if (!started || phase !== "play") return;
    switch (cmd.op) {
      case "close":
        catalog = null;
        return;
      case "catalog":
        openCatalog(cmd.kind);
        return;
      case "buy-house":
        commitHouse(cmd.id);
        return;
      case "buy-shop":
        commitShop(cmd.id);
        return;
      case "buy-car": {
        const listing = catalogCars().find((car) => car.body === cmd.body);
        if (listing) commitCar(listing.body, listing.ride, listing.stars, listing.name);
        return;
      }
      case "spend":
        buySpend(cmd.id);
        return;
      case "door": {
        const spot = spots.find((item) => item.id === cmd.spotId);
        if (spot) doDoor(spot, cmd.act, cmd.carId);
        return;
      }
      case "deposit":
        depositAll();
        return;
      case "withdraw":
        withdrawChunk();
        return;
      case "hustle":
        beginHustleId(cmd.id);
        return;
      case "bet": {
        const index = BET_STEPS.indexOf(cmd.amount);
        if (index >= 0) betPick = index;
        return;
      }
      case "play":
        hallPlay();
        return;
      case "stand":
        hallCycle();
        return;
      case "double":
        hallAlt("u");
        return;
      case "split":
        hallAlt("i");
        return;
      case "pick-roulette":
        setRoulette(cmd.kind, cmd.pick);
        return;
      case "pick-side": {
        const index = BACCARAT_CYCLE.indexOf(cmd.side);
        if (index >= 0) baccaratIx = index;
        return;
      }
      case "gun":
        selectGun(cmd.id);
        return;
      case "radio":
        selectRadio(cmd.index);
        return;
      default:
        return;
    }
  }

  function drainCmds() {
    for (let i = 0; i < 8 && uiCmds.length > 0; i++) {
      const cmd = uiCmds.shift();
      if (cmd) applyCmd(cmd);
    }
  }

  function snapshot(): HudSnapshot {
    liveDesk = buildDesk();
    const car = cars[playerCar];
    const speed = driving && car ? Math.abs(car.speed) : Math.hypot(vx, vz);
    return {
      phase,
      health: Math.max(0, health),
      armor: Math.max(0, armor),
      wanted,
      cash: Math.floor(cash),
      bank: Math.floor(bankBal),
      loot: Math.floor(loot),
      best,
      speedMph: Math.round(speed * 2.237),
      driving,
      toast: toastT > 0 ? toast : "",
      cooling: clearT > 0.4 && wanted > 0,
      looking: document.pointerLockElement === canvas || rightLook || gLook,
      pad: padOn,
      padStatus,
      lostCash,
      error,
      gun: gun === "smg" ? "SMG" : gun === "shotgun" ? "SHOTGUN" : "PISTOL",
      ammo: reloadT > 0 ? "REL" : `${ammo[gun].mag}/${ammo[gun].reserve}`,
      job: jobLine(),
      radio: RADIO[radioTrack] ?? "NIGHTLINE",
      shop: nearLot() && started && phase === "play" ? lotLine() : "",
      nearShop: nearLot() && started && phase === "play",
      drifting,
      cover: coverNow && wanted >= 5,
      ...hustleHud(),
      assets: assetLine(),
      portfolio: portfolioText(),
      character: chosenCharacter,
      characterReady: castReady,
      pauseSel,
      desk: liveDesk,
      navSeq,
      navKey,
      guns: (["pistol", "shotgun", "smg"] as const).map((id) => ({
        id,
        name: id === "smg" ? "SMG" : id === "shotgun" ? "SHOTGUN" : "PISTOL",
        mag: ammo[id].mag,
        reserve: ammo[id].reserve,
        owned: owned[id],
        active: gun === id,
      })),
      stations: RADIO.map((name, index) => ({ name, active: index === radioTrack })),
    };
  }

  function pushHud() {
    onHud(snapshot());
  }

  function say(text: string, time = 2.2) {
    toast = text;
    toastT = time;
  }

  const REACH = 6.4;

  function nearestSpot() {
    const me = playerPos();
    let best: (typeof spots)[number] | null = null;
    let bestD = REACH;
    for (const s of spots) {
      const d = Math.hypot(s.x - me.x, s.z - me.z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  function nearestMug() {
    if (driving) return -1;
    const me = playerPos();
    let idx = -1;
    let bestD = 2.5;
    for (let i = 0; i < peds.length; i++) {
      const p = peds[i]!;
      if (!p.active || p.state === "down" || p.mark > 0 || p.faction !== "civ") continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < bestD) {
        bestD = d;
        idx = i;
      }
    }
    return idx;
  }

  function hustleHud() {
    if (!started || phase !== "play") return { hustle: "", hustlePct: 0, nearWork: false, nearTeller: false };
    if (channel) {
      const def = hustleById(channel.hustleId);
      const pct = clamp(1 - channel.left / Math.max(0.1, channel.need), 0, 1);
      return { hustle: `${def?.name ?? "Working"} ${Math.round(pct * 100)}%`, hustlePct: pct, nearWork: true, nearTeller: false };
    }
    const spot = nearestSpot();
    if (inHall) return { hustle: hallLine(), hustlePct: 0, nearWork: true, nearTeller: false };
    if (roomId) return { hustle: roomLine(), hustlePct: 0, nearWork: true, nearTeller: roomId === "teller" };
    if (catalog && nearCatalog()) return { hustle: catalogLine(), hustlePct: 0, nearWork: true, nearTeller: false };
    const door = ownedDoorSpot();
    if (door) return { hustle: doorLine(door), hustlePct: 0, nearWork: true, nearTeller: false };
    if (spot?.place === "fixer") {
      const def = SPENDS[hold.pick % SPENDS.length]!;
      if (def.kind === "house" || def.kind === "business" || def.kind === "ride") {
        const noun = def.kind === "house" ? "a house" : def.kind === "business" ? "a shop" : "a car";
        return { hustle: `FIXER · F inside · J pick ${noun} · K swap`, hustlePct: 0, nearWork: true, nearTeller: false };
      }
      const owned = def.kind === "tune" ? hold.tunes : 0;
      const price = def.kind === "bribe" ? bribeCost(def) : scoreSpend(def, owned).cost;
      const tag = spendState(def);
      return {
        hustle: `FIXER · F inside · J ${def.name} $${price.toLocaleString("en-US")}${tag} · K swap`,
        hustlePct: 0,
        nearWork: true,
        nearTeller: false,
      };
    }
    if (spot?.place === "teller") {
      return {
        hustle: `J deposit $${Math.floor(cash)} · K withdraw · bank $${Math.floor(bankBal)} · F inside`,
        hustlePct: 0,
        nearWork: true,
        nearTeller: true,
      };
    }
    if (spot) {
      const list = offersAt(spot.place);
      const def = list[spot.pick % Math.max(1, list.length)];
      const cool = spot.cool > 0 ? ` · ${Math.ceil(spot.cool)}s` : "";
      const swap = list.length > 1 ? " · K swap" : "";
      return {
        hustle: def ? `${spot.name} · J ${blurb(def)}${swap}${cool}${walkInHint(spot)}` : `${spot.name}${walkInHint(spot)}`,
        hustlePct: 0,
        nearWork: true,
        nearTeller: false,
      };
    }
    const ped = nearestMug();
    if (ped >= 0) {
      const def = hustleById("mug");
      return { hustle: def ? `J ${blurb(def)}` : "J mug", hustlePct: 0, nearWork: true, nearTeller: false };
    }
    return { hustle: "", hustlePct: 0, nearWork: false, nearTeller: false };
  }

  function cancelChannel(msg: string, refund: boolean) {
    if (!channel) return;
    if (refund) cash += channel.stake;
    channel = null;
    say(msg);
  }

  function depositAll() {
    if (cash <= 0) {
      say(bankBal > 0 ? "Wallet's empty. K draws from the bank." : "Nothing to deposit");
      return;
    }
    const moved = Math.floor(cash);
    bankBal += moved;
    cash = 0;
    saveBooks();
    noteWorth();
    say(`Deposited $${moved.toLocaleString("en-US")}`);
  }

  function withdrawChunk() {
    if (wanted >= 4) {
      say("Too hot to draw");
      return;
    }
    if (bankBal <= 0) {
      say("Bank's empty");
      return;
    }
    const n = Math.min(Math.floor(bankBal), 500);
    bankBal -= n;
    cash += n;
    saveBooks();
    say(`Withdrew $${n}`);
  }

  function openChannel(hustleId: string, spotId: string, ped: number, x: number, z: number) {
    const def = hustleById(hustleId);
    if (!def) return;
    const s = scoreHustle(def);
    let stakePay = s.stakeCash;
    if (def.id === "deal" && hold.packs > 0) {
      hold.packs -= 1;
      stakePay = 0;
      saveBooks();
    }
    if (stakePay > cash) {
      if (def.id === "deal") hold.packs += 1;
      say(`Need $${s.stakeCash} in the wallet`);
      return;
    }
    if (def.kind === "fence" && loot <= 0) {
      say("Nothing to pawn");
      return;
    }
    cash -= stakePay;
    channel = { hustleId, spotId, ped, left: s.seconds, need: s.seconds, stake: stakePay, x, z };
    say(stakePay === 0 && def.id === "deal" ? "Using a pack" : def.name);
  }

  function offersAt(place: HustlePlace) {
    const open = hold.invite || hold.house || hold.lux > 0;
    return hustlesAt(place).filter((h) => h.id !== "private" || open);
  }

  function bribeCost(def: SpendDef) {
    return Math.round(scoreSpend(def).cost * (1 + wanted * 0.45));
  }

  function tapeValue() {
    if (hold.marketCost <= 0 || hold.marketBasis <= 0) return 0;
    return Math.max(0, Math.round((hold.marketCost * hold.index) / hold.marketBasis));
  }

  function spendState(def: SpendDef) {
    if (def.kind === "tune") return hold.tunes > 0 ? ` · ${hold.tunes}/3` : "";
    if (def.kind === "house" && deeds.ownedHouses.length > 0) return ` · ${deeds.ownedHouses.length}`;
    if (def.kind === "luxury" && hold.lux > 0) return " · owned";
    if (def.kind === "business" && deeds.ownedShops.length > 0) return ` · ${deeds.ownedShops.length}`;
    if (def.kind === "invite" && hold.invite) return " · in";
    if (def.kind === "market" && hold.marketCost > 0) return ` · worth $${tapeValue().toLocaleString("en-US")}`;
    if (def.kind === "drug" && hold.packs > 0) return ` · ${hold.packs} packs`;
    if (def.id === "shotgun" && owned.shotgun) return " · owned";
    if (def.id === "smg" && owned.smg) return " · owned";
    if (def.kind === "crew" && hold.crewT > 0) return ` · ${Math.ceil(hold.crewT)}s`;
    return "";
  }

  function assetLine() {
    const bits: string[] = [];
    if (hold.tunes > 0) bits.push(`Tune ${hold.tunes}`);
    for (const id of deeds.ownedHouses) {
      const house = catalogHouses().find((item) => item.id === id);
      if (house) bits.push(house.name);
    }
    if (hold.lux > 0) bits.push("Watch");
    for (const shop of deeds.ownedShops) {
      const listing = catalogShops().find((item) => item.id === shop.id);
      if (listing) bits.push(listing.name);
    }
    if (hold.invite) bits.push("List");
    if (hold.packs > 0) bits.push(`Packs ${hold.packs}`);
    if (hold.crewT > 0) bits.push(`Crew ${Math.ceil(hold.crewT)}s`);
    if (hold.marketCost > 0) bits.push(`Tape $${tapeValue().toLocaleString("en-US")}`);
    return bits.join(" · ");
  }

  function lotLine() {
    const bribe = spendById("bribe")!;
    const vest = spendById("vest")!;
    const shot = spendById("shotgun")!;
    const list = catalogCars();
    const shown = catalog?.kind === "car" ? list[catalog.index % list.length] : list[0];
    const carBit = shown ? `H ${shown.name} $${shown.cost.toLocaleString("en-US")}` : "H a car";
    return `B bribe $${bribeCost(bribe).toLocaleString("en-US")} · V vest $${scoreSpend(vest).cost} · G shot $${scoreSpend(shot).cost} · ${carBit}`;
  }

  function hireCrew(seconds: number, power: number) {
    hold.crewT = Math.max(hold.crewT, seconds);
    let p = peds.find((ped) => ped.ally && ped.state !== "down");
    if (!p) p = peds.find((ped) => ped.faction === "civ" && ped.active && ped.state !== "down");
    if (!p) return;
    const door = roomId ? spots.find((spot) => spot.id === roomId) : undefined;
    const me = door ?? playerPos();
    p.ally = true;
    p.active = true;
    p.hp = 90 + power * 12;
    p.state = "fight";
    p.color = 0xf3efe4;
    p.x = me.x + 1.6;
    p.z = me.z + 1.2;
  }

  function landHit() {
    const door = roomId ? spots.find((spot) => spot.id === roomId) : undefined;
    const me = door ?? playerPos();
    let best: Ped | null = null;
    let bd = 90;
    for (const p of peds) {
      if (!p.active || p.state === "down" || p.ally) continue;
      if (p.faction !== "amber" && p.faction !== "teal") continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (!best) {
      say("Hit missed. Block was empty.");
      return;
    }
    dropPed(best, false);
    say("Contract closed");
  }

  function buySpend(id: string) {
    if (!started || !alive || phase !== "play") return false;
    const def = spendById(id);
    if (!def) return false;
    if (def.kind === "market" && hold.marketCost > 0) {
      const value = tapeValue();
      hold.marketCost = 0;
      hold.marketBasis = hold.index;
      cash += value;
      noteWorth();
      saveBooks();
      say(value > 0 ? `Sold the tape $${value.toLocaleString("en-US")}` : "Tape was worthless");
      return true;
    }
    if (def.kind === "house" || def.kind === "business" || def.kind === "ride") {
      say("Pick one. J opens the list.");
      return false;
    }
    if (def.kind === "luxury" && hold.lux > 0) {
      say("You already wear it");
      return false;
    }
    if (def.kind === "invite" && hold.invite) {
      say("You're already on the list");
      return false;
    }
    if (def.kind === "tune" && hold.tunes >= 3) {
      say("Nothing left to tune");
      return false;
    }
    if (def.id === "shotgun" && owned.shotgun) {
      say("You have the shotgun");
      return false;
    }
    if (def.id === "smg" && owned.smg) {
      say("You have the SMG");
      return false;
    }
    if (def.kind === "bribe" && wanted <= 0) {
      say("Nobody's looking");
      return false;
    }
    const ownedCount = def.kind === "tune" ? hold.tunes : 0;
    const scored = scoreSpend(def, ownedCount);
    const cost = def.kind === "bribe" ? bribeCost(def) : scored.cost;
    if (cash < cost) {
      say(`Need $${cost.toLocaleString("en-US")} in the wallet`);
      return false;
    }
    if (def.kind === "bribe" && def.heat > 0 && rand() < 0.08 * def.heat) {
      cash -= cost;
      addStars(1);
      saveBooks();
      say("They kept it and called it in");
      return true;
    }
    cash -= cost;
    if (def.kind === "tune") {
      hold.tunes += 1;
      if (driving) {
        const car = cars[playerCar]!;
        car.hp = Math.min(car.maxHp, car.hp + 35);
      }
      say(`Tuned ${hold.tunes}/3`);
    } else if (def.kind === "bribe") {
      const cut = 1 + Math.floor(scored.power / 2);
      wanted = Math.max(0, wanted - cut);
      clearT = 0;
      if (wanted < 4) {
        blockLive = false;
        for (const c of cars) c.block = false;
      }
      say(wanted <= 0 ? "Paid off" : `Bought off ${cut}`);
    } else if (def.kind === "crew") {
      hireCrew(scored.seconds, scored.power);
      say(`Gun's with you ${Math.ceil(hold.crewT)}s`);
    } else if (def.kind === "gun") {
      if (def.id === "smg") {
        owned.smg = true;
        gun = "smg";
        say("SMG's yours");
      } else {
        owned.shotgun = true;
        gun = "shotgun";
        say("Shotgun's yours");
      }
    } else if (def.kind === "ammo") {
      const spec = GUNS[gun];
      ammo[gun].reserve += spec.mag * (1 + Math.round(scored.power / 2));
      say("Ammo on the belt");
    } else if (def.kind === "armor") {
      armor = Math.min(100, armor + 28 + scored.power * 12);
      say("Vest on");
    } else if (def.kind === "market") {
      hold.marketCost = cost;
      hold.marketBasis = hold.index || 1;
      say("You're in the tape");
    } else if (def.kind === "drug") {
      hold.packs += Math.max(1, Math.round(scored.power));
      say(`${hold.packs} packs in the coat`);
    } else if (def.kind === "luxury") {
      hold.lux = scored.power;
      armor = Math.min(100, armor + 15);
      refreshProps();
      say("They know the watch. The safe is at the house.");
    } else if (def.kind === "hit") {
      hold.hitT = Math.max(5, scored.seconds / 5);
      say("Contract's out");
    } else if (def.kind === "invite") {
      hold.invite = true;
      refreshProps();
      say("You're on the list. The suite table is lit.");
    }
    if (scored.stars && def.kind !== "bribe") addStars(scored.stars);
    saveBooks();
    return true;
  }

  function updateHoldings(dt: number) {
    hold.crewT = Math.max(0, hold.crewT - dt);
    if (hold.crewT <= 0) {
      for (const p of peds) {
        if (p.ally && p.state !== "down") p.state = "walk";
        if (p.ally) p.ally = false;
      }
    }
    martCd = Math.max(0, martCd - dt);
    if (catalog && !nearCatalog()) catalog = null;
    for (const shop of deeds.ownedShops) {
      const before = deeds.shopTill[shop.id] ?? 0;
      deeds = shopTick(deeds, shop.id, dt, wanted);
      if ((deeds.shopTill[shop.id] ?? 0) !== before) saveBooks();
    }
    const tape = spendById("market");
    if (tape) {
      const s = scoreSpend(tape);
      const bias = (s.power - 3) * 0.004;
      hold.index += hold.index * ((rand() - 0.5) * 0.55 + bias) * dt;
      hold.index = clamp(hold.index, 0.4, 2.5);
    }
    if (hold.hitT > 0) {
      hold.hitT -= dt;
      if (hold.hitT <= 0) {
        hold.hitT = 0;
        landHit();
      }
    }
    if (!driving && !inHall && deeds.ownedHouses.length > 0) {
      const me = playerPos();
      let home: (typeof spots)[number] | null = null;
      let homeD = 8;
      for (const id of deeds.ownedHouses) {
        const spot = spots.find((s) => s.id === id);
        if (!spot) continue;
        const d = Math.hypot(me.x - spot.x, me.z - spot.z);
        if (d < homeD) {
          homeD = d;
          home = spot;
        }
      }
      if (home) {
        const rates = healRates(deeds.ownedHouses);
        health = Math.min(100, health + rates.hp * dt);
        armor = Math.min(100, armor + rates.armor * dt);
        if (starHouse !== home.id) starHouse = home.id;
        const scale = hold.lux > 0 ? 1.45 : 1;
        const cleared = starClear(wanted, starAcc + dt * scale, home.id as HouseId);
        if (cleared.stars < wanted) {
          wanted = cleared.stars;
          clearT = 0;
          if (wanted < 4) {
            blockLive = false;
            for (const c of cars) c.block = false;
          }
          say(wanted <= 0 ? "Stars are gone" : "Heat cooling");
        } else wanted = cleared.stars;
        starAcc = cleared.secondsLeft;
      }
    }
    if (!driving && roomId && isHouseId(roomId) && deeds.ownedHouses.includes(roomId)) {
      const rates = healRates(deeds.ownedHouses);
      health = Math.min(100, health + rates.hp * dt);
      armor = Math.min(100, armor + rates.armor * dt);
      if (starHouse !== roomId) starHouse = roomId;
      const scale = hold.lux > 0 ? 1.45 : 1;
      const cleared = starClear(wanted, starAcc + dt * scale, roomId);
      if (cleared.stars < wanted) {
        wanted = cleared.stars;
        clearT = 0;
        if (wanted < 4) {
          blockLive = false;
          for (const c of cars) c.block = false;
        }
        say(wanted <= 0 ? "Stars are gone" : "Heat cooling");
      } else wanted = cleared.stars;
      starAcc = cleared.secondsLeft;
    }
  }

  function refreshDeedSigns() {
    for (const entry of deedBoards) {
      const brand = BRAND[entry.id] ?? { title: entry.id, sub: "", fg: "#ffb020", bg: "#14120c", map: "#ffb020", code: "•" };
      let title = brand.title;
      let sub = brand.sub;
      if (deeds.ownedHouses.includes(entry.id as HouseId)) {
        const house = catalogHouses().find((item) => item.id === entry.id);
        title = "YOURS";
        sub = (house?.name ?? brand.title).toUpperCase();
      }
      const shop = deeds.ownedShops.find((item) => item.id === entry.id);
      if (shop) {
        title = "YOURS";
        sub = shop.kind === "mart" ? "MART" : shop.kind === "late" ? "LATE" : "BACK";
      }
      const mat = entry.mesh.material as THREE.MeshBasicMaterial;
      const prev = mat.map;
      mat.map = makeSign(title, brand.fg, brand.bg, sub || undefined);
      mat.needsUpdate = true;
      if (prev && prev !== mat.map) prev.dispose();
    }
  }

  function refreshProps() {
    for (const [id, mesh] of safeMeshes) mesh.visible = hold.lux > 0 && deeds.ownedHouses.includes(id as HouseId);
    inviteTable.visible = hold.invite;
  }

  function syncFlags() {
    hold.house = deeds.ownedHouses.length > 0;
    hold.biz = deeds.ownedShops.length > 0;
  }

  function deedSay(error: string) {
    if (error === "short cash") return "Short cash";
    if (error === "already owned") return "You already own that";
    if (error === "stash still inside") return "Pull the stash first";
    if (error === "car in the garage") return "Take the car out first";
    if (error === "garage is full") return "Garage is full";
    if (error === "not carrying that much") return "Nothing to stash";
    if (error === "stash is full") return "Stash is full";
    if (error === "stash is short") return "Stash is empty";
    if (error === "unknown car") return "That ride isn't yours";
    if (error === "already parked") return "It's already in the garage";
    if (error === "not parked") return "It's already out";
    if (error === "not owned") return "That's not yours";
    return error;
  }

  function catalogOf(kind: "house" | "shop" | "car") {
    if (kind === "house") return affordable(cash, catalogHouses());
    if (kind === "shop") return affordable(cash, catalogShops());
    return affordable(cash, catalogCars());
  }

  function catalogLine() {
    if (!catalog) return "";
    const list = catalogOf(catalog.kind);
    const item = list[catalog.index % Math.max(1, list.length)];
    if (!item) {
      const full = catalog.kind === "house" ? catalogHouses() : catalog.kind === "shop" ? catalogShops() : catalogCars();
      const cheap = full[0];
      return cheap ? `Short. ${cheap.name} is $${cheap.cost.toLocaleString("en-US")}` : "Nothing for sale";
    }
    if ("stashCap" in item) return `${item.name} $${item.cost.toLocaleString("en-US")} · stash ${item.stashCap} · ${item.bays} bay · J buys · K next`;
    if ("kind" in item) {
      const use = item.kind === "mart" ? "refill" : item.kind === "late" ? "ammo" : "tape and hits";
      return `${item.name} $${item.cost.toLocaleString("en-US")} · ${use} · J buys · K next`;
    }
    return `${item.name} $${item.cost.toLocaleString("en-US")} · J buys · K next`;
  }

  function nearCatalog() {
    const me = playerPos();
    const fixer = spots.find((s) => s.id === "fixer");
    if (roomId === "fixer") return true;
    if (fixer && Math.hypot(me.x - fixer.x, me.z - fixer.z) <= 8) return true;
    return nearLot();
  }

  function openCatalog(kind: "house" | "shop" | "car") {
    catalog = { kind, index: 0 };
  }

  function confirmCatalog() {
    if (!catalog) return;
    const list = catalogOf(catalog.kind);
    const item = list[catalog.index % Math.max(1, list.length)];
    if (!item) {
      say(catalogLine());
      return;
    }
    if (catalog.kind === "house" && isHouseId(item.id)) commitHouse(item.id);
    else if (catalog.kind === "shop" && isShopId(item.id)) commitShop(item.id);
    else if ("body" in item) commitCar(item.body, item.ride, item.stars, item.name);
    catalog = null;
  }

  function advanceCatalog() {
    if (!catalog) return;
    const list = catalogOf(catalog.kind);
    if (list.length === 0) {
      say(catalogLine());
      return;
    }
    catalog.index = (catalog.index + 1) % list.length;
    say(catalogLine());
  }

  function commitHouse(id: HouseId) {
    const result = buyHouse(deeds, id, cash);
    if ("error" in result) {
      say(deedSay(result.error));
      return;
    }
    const listing = catalogHouses().find((house) => house.id === id);
    deeds = result.state;
    cash = result.cash;
    if (listing && listing.stars > 0) addStars(listing.stars);
    syncFlags();
    refreshDeedSigns();
    refreshProps();
    noteWorth();
    saveBooks();
    say(`${listing?.name ?? "House"} is yours. Go see it.`);
  }

  function commitShop(id: ShopId) {
    const result = buyShop(deeds, id, cash);
    if ("error" in result) {
      say(deedSay(result.error));
      return;
    }
    const listing = catalogShops().find((shop) => shop.id === id);
    deeds = result.state;
    cash = result.cash;
    if (listing && listing.stars > 0) addStars(listing.stars);
    syncFlags();
    refreshDeedSigns();
    refreshProps();
    noteWorth();
    saveBooks();
    say(`${listing?.name ?? "Shop"} is open. The till is at the counter.`);
  }

  function commitCar(body: CarBody, ride: Ride, stars: number, name: string) {
    const spare = cars.find((car) => car.deedId === "" && car.hp < 0);
    if (!spare) {
      say("The lot is full");
      return;
    }
    const before = new Set(deeds.ownedCars.map((car) => car.id));
    const result = buyCarDeed(deeds, body, cash);
    if ("error" in result) {
      say(deedSay(result.error));
      return;
    }
    const created = result.state.ownedCars.find((car) => !before.has(car.id));
    deeds = result.state;
    cash = result.cash;
    spare.deedId = created?.id ?? "";
    spare.body = body;
    spare.ride = ride;
    spare.maxHp = RIDES[ride].maxHp;
    spare.forSale = false;
    const parkedCount = cars.filter((car) => car.deedId).length;
    const road = nearestRoad(18 + parkedCount * 2.6, -8);
    spare.x = road.x;
    spare.z = road.z;
    spare.yaw = road.yaw;
    spare.hp = spare.maxHp;
    spare.mode = "locked";
    spare.speed = 0;
    if (stars > 0) addStars(stars);
    syncFlags();
    noteWorth();
    saveBooks();
    say(`${name} is on the lot.`);
  }

  function canWalkIn(spot: (typeof spots)[number]) {
    if (spot.id === "casino" || spot.id === "teller" || spot.id === "vault" || spot.id === "fixer") return true;
    if (spot.id === "roller") return hold.invite;
    if (isHouseId(spot.id)) return deeds.ownedHouses.includes(spot.id);
    if (isShopId(spot.id)) return deeds.ownedShops.some((shop) => shop.id === spot.id);
    return false;
  }

  function walkInHint(spot: (typeof spots)[number]) {
    return canWalkIn(spot) ? " · F inside" : "";
  }

  function enterBlock(spot: (typeof spots)[number]) {
    if (canWalkIn(spot)) return null;
    if (spot.id === "roller") return "You're not on the list.";
    if (isHouseId(spot.id) || isShopId(spot.id)) return "Not yours. The fixer sells it.";
    return null;
  }

  function nearestEnterSpot() {
    let best: (typeof spots)[number] | null = null;
    let bestD = REACH;
    for (const spot of spots) {
      if (spot.id !== "casino" && !isRoomId(spot.id)) continue;
      const d = Math.hypot(spot.x - px, spot.z - pz);
      if (d < bestD) {
        bestD = d;
        best = spot;
      }
    }
    return best;
  }

  function ownedDoorSpot() {
    if (driving || inHall || roomId) return null;
    const me = playerPos();
    let best: (typeof spots)[number] | null = null;
    let bestD = 8;
    for (const s of spots) {
      const owned = deeds.ownedHouses.includes(s.id as HouseId) || deeds.ownedShops.some((shop) => shop.id === s.id);
      if (!owned) continue;
      const d = Math.hypot(s.x - me.x, s.z - me.z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (!best) return null;
    const other = nearestSpot();
    if (other && other.id !== best.id && Math.hypot(other.x - me.x, other.z - me.z) < bestD) return null;
    return best;
  }

  function doorActs(spot: (typeof spots)[number]) {
    if (deeds.ownedHouses.includes(spot.id as HouseId)) return ["Stash goods", "Pull stash", "Park car", "Take car", "Sell house"];
    if (!deeds.ownedShops.some((shop) => shop.id === spot.id)) return [];
    const use = spot.id === "pawn" ? (hold.marketCost > 0 ? "Sell tape" : "Order hit") : spot.id === "store1" ? "Refill" : "Buy ammo";
    return ["Collect till", use, "Sell shop"];
  }

  function doorLine(spot: (typeof spots)[number]) {
    const acts = doorActs(spot);
    if (deedSpot !== spot.id) {
      deedSpot = spot.id;
      deedPick = 0;
    }
    const label = acts[deedPick % Math.max(1, acts.length)] ?? spot.name;
    return `${spot.name} · F inside · J ${label} · K next`;
  }

  function cycleDoor(spot: (typeof spots)[number]) {
    const acts = doorActs(spot);
    if (acts.length < 2) return;
    if (deedSpot !== spot.id) deedSpot = spot.id;
    deedPick = (deedPick + 1) % acts.length;
    say(acts[deedPick] ?? "");
  }

  function doDoor(spot: (typeof spots)[number], forced?: string, carId?: string) {
    const acts = doorActs(spot);
    const act = forced ?? acts[deedPick % Math.max(1, acts.length)] ?? "";
    if (deeds.ownedHouses.includes(spot.id as HouseId)) {
      const id = spot.id as HouseId;
      if (act === "Stash goods") {
        const cap = catalogHouses()
          .filter((house) => deeds.ownedHouses.includes(house.id))
          .reduce((best, house) => Math.max(best, house.stashCap), 0);
        const amount = Math.min(Math.floor(loot), Math.max(0, cap - deeds.stash));
        if (amount <= 0) {
          say(loot <= 0 ? "Nothing to stash" : "Stash is full");
          return;
        }
        const result = depositStash(deeds, amount, Math.floor(loot));
        if ("error" in result) {
          say(deedSay(result.error));
          return;
        }
        deeds = result.state;
        loot = result.carried;
        saveBooks();
        say(`Stashed $${amount.toLocaleString("en-US")}`);
        return;
      }
      if (act === "Pull stash") {
        if (deeds.stash <= 0) {
          say("Stash is empty");
          return;
        }
        const result = withdrawStash(deeds, deeds.stash);
        if ("error" in result) {
          say(deedSay(result.error));
          return;
        }
        deeds = result.state;
        loot += result.amount;
        saveBooks();
        say(`Pulled $${result.amount.toLocaleString("en-US")}`);
        return;
      }
      if (act === "Park car") {
        let car: Car | null = driving ? cars[playerCar]! : null;
        if (!car || car.hp < 0 || !car.deedId) {
          car = null;
          let best = 10;
          const me = roomId === id ? { x: spot.x, z: spot.z } : playerPos();
          for (const candidate of cars) {
            if (!candidate.deedId || candidate.hp < 0) continue;
            const d = Math.hypot(candidate.x - me.x, candidate.z - me.z);
            if (d < best) {
              best = d;
              car = candidate;
            }
          }
        }
        if (!car || !car.deedId) {
          say("That ride isn't yours");
          return;
        }
        const result = parkCar(deeds, car.deedId, id);
        if ("error" in result) {
          say(deedSay(result.error));
          return;
        }
        deeds = result.state;
        if (cars[playerCar] === car) {
          driving = false;
          px = spot.x;
          pz = spot.z + 1.6;
          vx = 0;
          vz = 0;
        }
        car.mode = "idle";
        car.speed = 0;
        car.hp = -1;
        saveBooks();
        say("Parked. It'll be here.");
        roomsHandle?.setParked(id, deeds.garage.filter((slot) => slot.bayHouse === id).map((slot) => slot.body));
        return;
      }
      if (act === "Take car") {
        const slot = carId
          ? deeds.garage.find((bay) => bay.bayHouse === id && bay.carId === carId)
          : deeds.garage.find((bay) => bay.bayHouse === id);
        if (!slot) {
          say("Garage is empty");
          return;
        }
        const car = cars.find((candidate) => candidate.deedId === slot.carId);
        if (!car) {
          say("That car isn't on the block");
          return;
        }
        const result = takeCar(deeds, slot.carId);
        if ("error" in result) {
          say(deedSay(result.error));
          return;
        }
        deeds = result.state;
        const road = nearestRoad(spot.x, spot.z);
        car.x = road.x;
        car.z = road.z;
        car.yaw = road.yaw;
        car.body = slot.body;
        car.ride = slot.ride;
        car.maxHp = RIDES[slot.ride].maxHp;
        car.hp = car.maxHp;
        car.speed = 0;
        car.mode = "locked";
        car.forSale = false;
        saveBooks();
        say("It's out front.");
        roomsHandle?.setParked(id, deeds.garage.filter((slot) => slot.bayHouse === id).map((slot) => slot.body));
        return;
      }
      const result = sellHouse(deeds, id, cash);
      if ("error" in result) {
        say(deedSay(result.error));
        return;
      }
      deeds = result.state;
      cash = result.cash;
      syncFlags();
      refreshDeedSigns();
      refreshProps();
      noteWorth();
      saveBooks();
      const line = `Sold. $${result.cost.toLocaleString("en-US")} back.`;
      if (roomId === id) exitRoom(line);
      else say(line);
      return;
    }
    const shop = deeds.ownedShops.find((item) => item.id === spot.id);
    if (!shop) return;
    if (act === "Collect till") {
      const till = Math.floor(deeds.shopTill[shop.id] ?? 0);
      if (till <= 0) {
        say("Till is empty");
        return;
      }
      cash += till;
      deeds = { ...deeds, shopTill: { ...deeds.shopTill, [shop.id]: 0 } };
      noteWorth();
      saveBooks();
      say(`Till paid $${till.toLocaleString("en-US")}`);
      return;
    }
    if (act === "Sell shop") {
      const result = sellShop(deeds, shop.id, cash);
      if ("error" in result) {
        say(deedSay(result.error));
        return;
      }
      deeds = result.state;
      cash = result.cash;
      syncFlags();
      refreshDeedSigns();
      noteWorth();
      saveBooks();
      const line = `Closed. $${result.cost.toLocaleString("en-US")} back.`;
      if (roomId === shop.id) exitRoom(line);
      else say(line);
      return;
    }
    if (martCd > 0 && shop.id !== "pawn") {
      say(`Counter's busy ${Math.ceil(martCd)}s`);
      return;
    }
    const visit = shopVisit(shop.id);
    if (visit.effect === "heal") {
      health = Math.min(100, health + visit.heal);
      martCd = 8;
      say("Patched up");
      return;
    }
    if (visit.effect === "ammo") {
      ammo[gun].reserve += GUNS[gun].mag * visit.ammoPacks;
      martCd = 8;
      say("Ammo on the belt");
      return;
    }
    if (hold.marketCost > 0) buySpend("market");
    else buySpend("hit");
  }

  function localHall() {
    return { x: px - HALL_ORIGIN.x, z: pz - HALL_ORIGIN.z };
  }

  function nearestTable() {
    if (!inHall) return null;
    const here = localHall();
    let best: (typeof CASINO_FLOOR.entries)[number] | null = null;
    let bestD = 2.5;
    for (const entry of CASINO_FLOOR.entries) {
      const d = Math.hypot(entry.x - here.x, entry.z - here.z);
      if (d < bestD) {
        bestD = d;
        best = entry;
      }
    }
    return best;
  }

  function chipStep() {
    return BET_STEPS[betPick] ?? 10;
  }

  function settleBj() {
    if (!bj || bj.phase !== "player") return;
    let guard = 0;
    while (bj.phase === "player" && guard++ < 6) {
      const next = standBj(bj, rand);
      if (typeof next === "string") break;
      bj = next;
      cash = next.cash;
    }
    noteWorth();
    saveBooks();
  }

  function enterHall() {
    inHall = true;
    driving = false;
    px = HALL_ORIGIN.x;
    pz = HALL_ORIGIN.z + 1.6;
    vx = 0;
    vz = 0;
    py = 0;
    vy = 0;
    air = "none";
    camYaw = Math.PI;
    bodyYaw = Math.PI;
    camPitch = -0.08;
    hallHandle?.setOpen(true);
    say("Dice Hall. Walk up to a table.");
  }

  function enterRoom(id: RoomId) {
    const spec = roomById(id);
    if (!spec) return;
    roomId = id;
    driving = false;
    px = spec.origin.x;
    pz = spec.origin.z + ROOM_SPAWN_Z;
    vx = 0;
    vz = 0;
    py = 0;
    vy = 0;
    air = "none";
    camYaw = Math.PI;
    bodyYaw = Math.PI;
    camPitch = -0.08;
    roomsHandle?.setActive(id);
    if (isHouseId(id)) {
      roomsHandle?.setParked(
        id,
        deeds.garage.filter((slot) => slot.bayHouse === id).map((slot) => slot.body),
      );
    }
    const spot = spots.find((item) => item.id === id);
    say(`${spot?.name ?? spec.title}. Door is south.`);
  }

  function exitRoom(line = "Back on the street") {
    const spot = roomId ? spots.find((item) => item.id === roomId) : undefined;
    roomId = null;
    roomsHandle?.setActive(null);
    px = spot ? spot.x : 0;
    pz = spot ? spot.z + 2 : 0;
    vx = 0;
    vz = 0;
    py = 0;
    vy = 0;
    air = "none";
    const safe = resolveCircle(px, pz, 0.45);
    px = safe.x;
    pz = safe.z;
    camYaw = 0;
    bodyYaw = 0;
    say(line);
  }

  function localRoom() {
    const spec = roomById(roomId ?? "");
    if (!spec) return { x: 0, z: 0 };
    return { x: px - spec.origin.x, z: pz - spec.origin.z };
  }

  function roomLine() {
    if (!roomId) return "Door is south";
    const spot = spots.find((item) => item.id === roomId);
    if (!spot) return "Door is south";
    if (isHouseId(roomId) || isShopId(roomId)) {
      const acts = doorActs(spot);
      if (deedSpot !== spot.id) {
        deedSpot = spot.id;
        deedPick = 0;
      }
      const label = acts[deedPick % Math.max(1, acts.length)] ?? spot.name;
      return `${spot.name} · J ${label} · K next · door is south`;
    }
    if (roomId === "teller") return `J deposit $${Math.floor(cash)} · K withdraw · door is south`;
    if (roomId === "fixer") {
      const def = SPENDS[hold.pick % SPENDS.length]!;
      return `FIXER · J ${def.name} · K swap · door is south`;
    }
    const list = offersAt(spot.place);
    const offer = list[spot.pick % Math.max(1, list.length)];
    return offer ? `${spot.name} · J ${blurb(offer)} · door is south` : `${spot.name} · door is south`;
  }

  function actInside() {
    if (!roomId) return;
    if (catalog && roomId === "fixer") {
      confirmCatalog();
      return;
    }
    const spot = spots.find((item) => item.id === roomId);
    if (!spot) return;
    if (isHouseId(roomId) || isShopId(roomId)) {
      doDoor(spot);
      return;
    }
    if (roomId === "teller") {
      depositAll();
      return;
    }
    if (roomId === "fixer") {
      const def = SPENDS[hold.pick % SPENDS.length]!;
      if (def.kind === "house") openCatalog("house");
      else if (def.kind === "business") openCatalog("shop");
      else if (def.kind === "ride") openCatalog("car");
      else buySpend(def.id);
      return;
    }
    const list = offersAt(spot.place);
    const offer = list[spot.pick % Math.max(1, list.length)];
    if (!offer) return;
    openChannel(offer.id, spot.id, -1, px, pz);
  }

  function cycleInside() {
    if (!roomId) return;
    const spot = spots.find((item) => item.id === roomId);
    if (!spot) return;
    if (isHouseId(roomId) || isShopId(roomId)) {
      cycleDoor(spot);
      return;
    }
    if (roomId === "teller") {
      withdrawChunk();
      return;
    }
    if (roomId === "fixer") {
      hold.pick = (hold.pick + 1) % SPENDS.length;
      const def = SPENDS[hold.pick]!;
      say(spendBlurb(def, def.kind === "tune" ? hold.tunes : 0));
      return;
    }
    const list = offersAt(spot.place);
    if (list.length < 2) return;
    spot.pick = (spot.pick + 1) % list.length;
    const offer = list[spot.pick];
    if (offer) say(blurb(offer));
  }

  function exitHall() {
    settleBj();
    hallHandle?.setOpen(false);
    inHall = false;
    bj = null;
    const spot = spots.find((s) => s.id === "casino");
    px = spot ? spot.x : 31;
    pz = spot ? spot.z + 2 : -23;
    vx = 0;
    vz = 0;
    py = 0;
    vy = 0;
    air = "none";
    const safe = resolveCircle(px, pz, 0.45);
    px = safe.x;
    pz = safe.z;
    camYaw = 0;
    bodyYaw = 0;
    say("Back on the street");
  }

  function takePurse(next: number, line: string) {
    cash = Math.max(0, Math.floor(next));
    noteWorth();
    saveBooks();
    say(line);
  }

  function hallPlay() {
    const table = nearestTable();
    if (!table) {
      say("Walk up to a table");
      return;
    }
    if (table.game === "cage") {
      say(`Wallet $${Math.floor(cash).toLocaleString("en-US")}. Bet at a table.`);
      return;
    }
    if (table.game !== "blackjack") settleBj();
    if (table.game === "blackjack") {
      if (!bj || bj.phase === "done") {
        const deal = startBlackjack(Math.floor(cash), chipStep(), rand);
        if (typeof deal === "string") {
          say(deal);
          return;
        }
        bj = deal;
        cash = deal.cash;
        saveBooks();
        say(deal.log);
        hallHandle?.showBlackjack(bj);
        return;
      }
      const next = hitBj(bj, rand);
      if (typeof next === "string") {
        say(next);
        return;
      }
      bj = next;
      cash = next.cash;
      if (next.phase === "done") {
        noteWorth();
        saveBooks();
      }
      say(next.log);
      hallHandle?.showBlackjack(bj);
      return;
    }
    const bet = chipStep();
    if (table.game === "roulette") {
      const kind = ROULETTE_CYCLE[rouletteIx] ?? "red";
      const pick = kind === "straight" ? rouletteN : kind === "dozen" ? dozenN : 0;
      const result = spinRoulette(Math.floor(cash), bet, kind, pick, rand);
      if (typeof result === "string") say(result);
      else {
        lastRoulette = result;
        takePurse(result.cash, result.log);
        hallHandle?.showRoulette(result);
      }
      return;
    }
    if (table.game === "slots") {
      const result = spinSlots(Math.floor(cash), bet, rand);
      if (typeof result === "string") say(result);
      else {
        lastSlots = result;
        takePurse(result.cash, result.log);
        hallHandle?.showSlots(table.id, result);
      }
      return;
    }
    if (table.game === "craps") {
      const result = rollCraps(Math.floor(cash), bet, rand);
      if (typeof result === "string") say(result);
      else {
        lastCraps = result;
        takePurse(result.cash, result.log);
        hallHandle?.showCraps(result);
      }
      return;
    }
    const side = BACCARAT_CYCLE[baccaratIx] ?? "player";
    const result = playBaccarat(Math.floor(cash), bet, side, rand);
    if (typeof result === "string") say(result);
    else {
      lastBaccarat = result;
      takePurse(result.cash, result.log);
      hallHandle?.showBaccarat(result);
    }
  }

  function hallCycle() {
    const table = nearestTable();
    if (table?.game === "blackjack" && bj && bj.phase === "player") {
      const next = standBj(bj, rand);
      if (typeof next === "string") {
        say(next);
        return;
      }
      bj = next;
      cash = next.cash;
      if (next.phase === "done") {
        noteWorth();
        saveBooks();
      }
      say(next.log);
      hallHandle?.showBlackjack(bj);
      return;
    }
    betPick = (betPick + 1) % BET_STEPS.length;
    const step = chipStep();
    say(step > cash ? `Bet $${step}. Short.` : `Bet $${step}`);
  }

  function hallAlt(key: "u" | "i") {
    const table = nearestTable();
    if (table?.game === "blackjack" && bj && bj.phase === "player") {
      const next = key === "u" ? doubleBj(bj, rand) : splitBj(bj, rand);
      if (typeof next === "string") {
        say(next);
        return;
      }
      bj = next;
      cash = next.cash;
      if (next.phase === "done") {
        noteWorth();
        saveBooks();
      }
      say(next.log);
      hallHandle?.showBlackjack(bj);
      return;
    }
    if (table?.game === "roulette") {
      if (key === "u") {
        rouletteIx = (rouletteIx + 1) % ROULETTE_CYCLE.length;
        say(ROULETTE_CYCLE[rouletteIx] ?? "red");
      } else if ((ROULETTE_CYCLE[rouletteIx] ?? "red") === "dozen") {
        dozenN = (dozenN % 3) + 1;
        say(`Dozen ${dozenN}`);
      } else {
        rouletteN = (rouletteN + 1) % 37;
        say(`Straight ${rouletteN}`);
      }
      return;
    }
    if (table?.game === "baccarat" && key === "u") {
      baccaratIx = (baccaratIx + 1) % BACCARAT_CYCLE.length;
      say(BACCARAT_CYCLE[baccaratIx] ?? "player");
    }
  }

  function hallLine() {
    const bet = chipStep();
    const table = nearestTable();
    if (!table) return `DICE HALL · bet $${bet} · walk to a table · door is south`;
    if (table.game === "cage") return `CAGE · wallet $${Math.floor(cash).toLocaleString("en-US")}`;
    if (table.game === "blackjack") {
      if (bj && bj.phase === "player") return `${bj.log} · J hit · K stand · U double · I split`;
      return `Blackjack $${bet} · J deal · K bet`;
    }
    if (table.game === "roulette") {
      const kind = ROULETTE_CYCLE[rouletteIx] ?? "red";
      const extra = kind === "straight" ? ` ${rouletteN}` : kind === "dozen" ? ` ${dozenN}` : "";
      return `Roulette ${kind}${extra} $${bet} · J spin · K bet · U kind · I number`;
    }
    if (table.game === "baccarat") return `Baccarat ${BACCARAT_CYCLE[baccaratIx]} $${bet} · J deal · K bet · U side`;
    if (table.game === "craps") return `Craps pass $${bet} · J roll · K bet`;
    return `Slots $${bet} · J spin · K bet`;
  }

  function portfolioText() {
    const lines: string[] = [];
    const houses = catalogHouses();
    const shops = catalogShops();
    if (deeds.ownedHouses.length === 0 && deeds.ownedShops.length === 0 && deeds.ownedCars.length === 0) {
      return "No deeds yet. The fixer sells a house, a shop, or a car.";
    }
    for (const id of deeds.ownedHouses) {
      const house = houses.find((item) => item.id === id);
      const bay = deeds.garage.filter((slot) => slot.bayHouse === id).map((slot) => slot.body);
      lines.push(`${house?.name ?? id} · ${bay.length}/${house?.bays ?? 0} parked${bay.length ? ` (${bay.join(", ")})` : ""}`);
    }
    if (deeds.ownedHouses.length > 0) lines.push(`Stash $${Math.floor(deeds.stash).toLocaleString("en-US")}`);
    for (const shop of deeds.ownedShops) {
      const listing = shops.find((item) => item.id === shop.id);
      lines.push(`${listing?.name ?? shop.id} · till $${Math.floor(deeds.shopTill[shop.id] ?? 0).toLocaleString("en-US")}`);
    }
    const out = deeds.ownedCars.filter((car) => !car.parked).map((car) => car.body);
    if (out.length > 0) lines.push(`On the street: ${out.join(", ")}`);
    if (hold.lux > 0) lines.push("Watch is in the safe");
    if (hold.invite) lines.push("Suite table is lit");
    return lines.join("\n");
  }

  function bestHouse() {
    const owned = catalogHouses().filter((house) => deeds.ownedHouses.includes(house.id));
    if (owned.length === 0) return null;
    return owned.reduce((pick, house) => (house.deathMultiplier < pick.deathMultiplier ? house : pick));
  }

  function beginHustle() {
    if (!started || !alive || phase !== "play" || channel) return;
    if (inHall) {
      hallPlay();
      return;
    }
    if (roomId) {
      actInside();
      return;
    }
    if (catalog && nearCatalog()) {
      confirmCatalog();
      return;
    }
    const spot = nearestSpot();
    if (spot?.place === "teller") {
      depositAll();
      return;
    }
    if (spot?.place === "fixer") {
      const def = SPENDS[hold.pick % SPENDS.length]!;
      if (def.kind === "house") openCatalog("house");
      else if (def.kind === "business") openCatalog("shop");
      else if (def.kind === "ride") openCatalog("car");
      else buySpend(def.id);
      return;
    }
    if (driving) {
      say("On foot for this");
      return;
    }
    const door = ownedDoorSpot();
    if (door) {
      doDoor(door);
      return;
    }
    if (spot) {
      if (spot.cool > 0) {
        say(`Hot for ${Math.ceil(spot.cool)}s`);
        return;
      }
      const list = offersAt(spot.place);
      const def = list[spot.pick % Math.max(1, list.length)];
      if (!def) return;
      openChannel(def.id, spot.id, -1, spot.x, spot.z);
      return;
    }
    const ped = nearestMug();
    if (ped < 0) {
      say("Nothing in reach");
      return;
    }
    const p = peds[ped]!;
    openChannel("mug", "civ", ped, p.x, p.z);
  }

  function cycleSpot() {
    if (!started || !alive || phase !== "play" || channel) return;
    if (inHall) {
      hallCycle();
      return;
    }
    if (roomId) {
      if (catalog && roomId === "fixer") advanceCatalog();
      else cycleInside();
      return;
    }
    if (catalog && nearCatalog()) {
      advanceCatalog();
      return;
    }
    const door = ownedDoorSpot();
    if (door) {
      cycleDoor(door);
      return;
    }
    const spot = nearestSpot();
    if (!spot) return;
    if (spot.place === "teller") {
      withdrawChunk();
      return;
    }
    if (spot.place === "fixer") {
      hold.pick = (hold.pick + 1) % SPENDS.length;
      const def = SPENDS[hold.pick]!;
      say(spendBlurb(def, def.kind === "tune" ? hold.tunes : 0));
      return;
    }
    const list = offersAt(spot.place);
    if (list.length < 2) return;
    spot.pick = (spot.pick + 1) % list.length;
    const def = list[spot.pick];
    if (def) say(blurb(def));
  }

  function finishChannel() {
    if (!channel) return;
    const current = channel;
    const def = hustleById(current.hustleId);
    channel = null;
    if (!def) return;
    const ped = current.ped >= 0 ? peds[current.ped] : undefined;
    const hostile = !!ped && ped.faction !== "civ";
    const result = resolveHustle(def, rand, loot, hostile);
    const spot = spots.find((s) => s.id === current.spotId);
    if (spot) spot.cool = scoreHustle(def).cooldown;
    if (ped) {
      ped.mark = 28;
      ped.state = "flee";
    }
    if (result.clearLoot) loot = 0;
    else loot += result.loot;
    if (result.wallet) bankCash(result.wallet);
    saveBooks();
    if (result.stars) addStars(result.stars);
    if (result.hurt) hurtPlayer(result.hurt);
    say(result.line, 2.8);
  }

  function updateChannel(dt: number) {
    if (!channel) return;
    sinceCrime = 0;
    if (!alive || driving) {
      cancelChannel(driving ? "On foot for this" : "Dropped it", true);
      return;
    }
    const me = playerPos();
    let ax = channel.x;
    let az = channel.z;
    if (channel.ped >= 0) {
      const p = peds[channel.ped];
      if (!p || !p.active || p.state === "down") {
        cancelChannel("They got away", true);
        return;
      }
      ax = p.x;
      az = p.z;
      channel.x = ax;
      channel.z = az;
    }
    const limit = channel.ped >= 0 ? 3.3 : 8;
    if (Math.hypot(me.x - ax, me.z - az) > limit) {
      cancelChannel("Too far", true);
      return;
    }
    channel.left -= dt;
    if (channel.left <= 0) finishChannel();
  }

  function noteWorth() {
    const worth = Math.floor(cash + bankBal + tapeValue());
    if (worth > best) {
      best = worth;
      try {
        localStorage.setItem("brookriver-best", String(best));
      } catch {
        /* ignore quota */
      }
    }
  }

  function saveBooks() {
    try {
      localStorage.setItem("brookriver-bank", String(Math.floor(bankBal)));
      localStorage.setItem("brookriver-loot", String(Math.floor(loot)));
      localStorage.setItem(
        "brookriver-hold",
        JSON.stringify({
          tunes: hold.tunes,
          house: hold.house,
          lux: hold.lux,
          biz: hold.biz,
          packs: hold.packs,
          invite: hold.invite,
          marketCost: hold.marketCost,
          marketBasis: hold.marketBasis,
          index: hold.index,
        }),
      );
      localStorage.setItem("brookriver-property", JSON.stringify(deeds));
    } catch {
      /* ignore quota */
    }
  }

  function bankCash(n: number) {
    cash += n;
    if (cash < 0) cash = 0;
    noteWorth();
  }

  function addStars(n: number) {
    sinceCrime = 0;
    clearT = 0;
    if (starLock > 0) {
      wanted = Math.max(wanted, 1);
      return;
    }
    const prev = wanted;
    wanted = clamp(wanted + n, 0, 5);
    starLock = 1.35;
    if (wanted !== prev) say(wanted >= 5 ? "Five stars. Get off the street." : `Wanted — ${wanted}`);
  }

  function eye() {
    if (driving) {
      const car = cars[playerCar]!;
      const yaw = car.yaw + lookOffset;
      const pitch = lookPitch;
      const fx = -Math.sin(yaw) * Math.cos(pitch);
      const fy = Math.sin(pitch);
      const fz = -Math.cos(yaw) * Math.cos(pitch);
      return { x: car.x + fx * 0.6, y: 1.35 + groundY(car.x, car.z), z: car.z + fz * 0.6, dx: fx, dy: fy, dz: fz, yaw };
    }
    const pitch = camPitch;
    const fx = -Math.sin(camYaw) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const fz = -Math.cos(camYaw) * Math.cos(pitch);
    return { x: px, y: 1.55 + groundY(px, pz), z: pz, dx: fx, dy: fy, dz: fz, yaw: camYaw };
  }

  function playerPos() {
    if (driving) {
      const c = cars[playerCar]!;
      return { x: c.x, z: c.z, yaw: c.yaw, speed: c.speed };
    }
    return { x: px, z: pz, yaw: camYaw, speed: Math.hypot(vx, vz) };
  }

  function trace(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number, ignoreCar: number, ignorePed: number, hitPlayer: boolean): Hit | null {
    let best: Hit | null = null;
    const take = (t: number | null, kind: Hit["kind"], index: number) => {
      if (t === null || t < 0 || t > maxT) return;
      if (!best || t < best.t) best = { t, kind, index };
    };
    const solids = inHall ? hallBoxes : roomId ? (roomBoxes.get(roomId) ?? blocks) : blocks;
    for (let i = 0; i < solids.length; i++) take(rayAABB(ox, oy, oz, dx, dy, dz, solids[i]!, maxT), "world", i);
    for (let i = 0; i < peds.length; i++) {
      const p = peds[i]!;
      if (!p.active || i === ignorePed || (p.state === "down" && p.hp <= 0)) continue;
      const prone = p.state === "down" && p.fall > 0.55;
      const foot = groundY(p.x, p.z);
      take(rayCylinder(ox, oy, oz, dx, dy, dz, p.x, p.z, prone ? 0.75 : 0.42, (prone ? 0.05 : 0.2) + foot, (prone ? 0.45 : 1.75) + foot, maxT), "ped", i);
    }
    for (let i = 0; i < cars.length; i++) {
      if (i === ignoreCar || cars[i]!.hp <= 0) continue;
      const foot = groundY(cars[i]!.x, cars[i]!.z);
      take(rayCylinder(ox, oy, oz, dx, dy, dz, cars[i]!.x, cars[i]!.z, 1.15, 0.25 + foot, 1.55 + foot, maxT), "car", i);
    }
    if (hitPlayer && alive && !driving) {
      const foot = groundY(px, pz);
      take(rayCylinder(ox, oy, oz, dx, dy, dz, px, pz, 0.42, 0.2 + foot, 1.8 + foot, maxT), "player", 0);
    }
    return best;
  }

  function los(x: number, z: number, tx: number, tz: number) {
    const dx = tx - x;
    const dy = groundY(tx, tz) - groundY(x, z);
    const dz = tz - z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const hit = trace(x, 1.2 + groundY(x, z), z, dx / len, dy / len, dz / len, len, -1, -1, false);
    return !hit || hit.kind !== "world" || hit.t > len - 0.4;
  }

  function hurtPlayer(amount: number) {
    if (!started || !alive || invuln > 0 || phase !== "play") return;
    lastHurt = 0;
    regenT = 0;
    let dmg = amount;
    if (armor > 0) {
      const absorb = Math.min(armor, dmg * 0.7);
      armor -= absorb;
      dmg -= absorb;
    }
    health -= dmg;
    shake = Math.max(shake, 0.18);
    rumble(110, 0.75);
    if (health <= 0) {
      health = 0;
      die();
    } else {
      playerReact = reactKind(playerFlinchGen);
      playerFlinch = 0.34;
      playerFlinchGen++;
    }
  }

  function reactKind(n: number): ReactKind {
    const i = Math.abs(n) % 3;
    return i === 0 ? "chest" : i === 1 ? "head" : "knock";
  }

  function markFlinch(p: Ped) {
    p.react = reactKind(p.flinchGen);
    p.flinch = 0.34;
    p.flinchGen++;
  }

  function overlapsFoot(x: number, z: number) {
    if (driving || !started || !alive) return false;
    const dx = x - px;
    const dz = z - pz;
    return dx * dx + dz * dz < PLAYER_BUBBLE * PLAYER_BUBBLE;
  }

  function crowdBlocked(x: number, z: number) {
    return Math.abs(x) > HALF - 6 || Math.abs(z) > HALF - 6 || blocks.some((b) => circleHitsAABB(x, z, 0.34, b));
  }

  function separateLiving() {
    living.length = 0;
    for (const p of peds) {
      if (!p.active || p.state === "down" || p.hp <= 0) continue;
      living.push(p);
    }
    // Driving skips the player bubble so a pack stays on the bumper.
    separateCrowd(living, started && alive && !driving ? { x: px, z: pz, vx, vz } : null, PED_GAP, PLAYER_BUBBLE, crowdBlocked);
  }

  function shovePed(p: Ped, fx: number, fz: number, dist: number) {
    if (p.state === "down" || p.hp <= 0) return;
    const nx = clamp(p.x + fx * dist, -HALF + 6, HALF - 6);
    const nz = clamp(p.z + fz * dist, -HALF + 6, HALF - 6);
    if (blocks.some((b) => circleHitsAABB(nx, nz, 0.34, b))) return;
    p.x = nx;
    p.z = nz;
  }

  function hurtBare(p: Ped, dmg: number, fx: number, fz: number, knock: number, byPlayer: boolean) {
    p.hp -= dmg;
    p.brawl = Math.max(p.brawl, 6.5);
    if (p.hp <= 0) {
      if (byPlayer) p.byPlayer = true;
      dropPed(p, byPlayer);
      return;
    }
    if (p.hp <= p.maxHp * 0.35) {
      collapsePed(p, byPlayer);
      return;
    }
    if (p.faction === "civ" && p.state !== "down") p.state = "fight";
    markFlinch(p);
    shovePed(p, fx, fz, knock);
  }

  function playerSwing() {
    if (!started || !alive || phase !== "play" || driving) return;
    if (meleeCd > 0 || playerMelee > 0) return;
    const turn = playerMeleeGen % 3;
    const kind: Melee = turn === 2 ? "shove" : turn === 1 ? "cross" : "jab";
    playerMeleeKind = kind;
    playerMelee = kind === "shove" ? 0.52 : 0.4;
    playerMeleeGen++;
    meleeCd = 0.48;
    playerContact = 0.16;
  }

  function playerMeleeContact() {
    if (!alive || driving || phase !== "play" || playerFlinch > 0) return;
    const kind = playerMeleeKind;
    const reach = kind === "shove" ? 1.95 : 1.65;
    const dmg = kind === "shove" ? 8 : kind === "cross" ? 22 : 16;
    const knock = kind === "shove" ? 1.45 : kind === "cross" ? 0.7 : 0.4;
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    let best = -1;
    let bestD = reach;
    for (let i = 0; i < peds.length; i++) {
      const p = peds[i]!;
      if (!p.active || p.hp <= 0) continue;
      const dx = p.x - px;
      const dz = p.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > bestD || dist < 0.05) continue;
      if ((dx / dist) * fx + (dz / dist) * fz < 0.2) continue;
      best = i;
      bestD = dist;
    }
    if (best >= 0) hurtBare(peds[best]!, dmg, fx, fz, knock, true);
  }

  function die() {
    if (!alive) return;
    alive = false;
    phase = "dead";
    document.exitPointerLock?.();
    settleBj();
    inHall = false;
    lostCash = Math.min(cash, Math.floor(cash * 0.3) + (cash > 40 ? 50 : 0));
    lostCash = deathLoss(lostCash, deeds.ownedHouses);
    cash -= lostCash;
    wanted = 0;
    clearT = 0;
    if (channel) channel = null;
    saveBooks();
    deathLeft = 3.1;
    if (driving) {
      const car = cars[playerCar]!;
      car.mode = "coast";
      driving = false;
    }
    py = 0;
    vy = 0;
    air = "none";
    vx = 0;
    vz = 0;
    say("Wasted", 3);
    pushHud();
  }

  function resolveCircle(x: number, z: number, r: number) {
    if (inHall || roomId) {
      const boxes = inHall ? hallBoxes : (roomBoxes.get(roomId!) ?? hallBoxes);
      let hit = false;
      for (let n = 0; n < 2; n++) {
        for (const b of boxes) {
          const p = pushCircle(x, z, r, b);
          x = p.x;
          z = p.z;
          hit = hit || p.hit;
        }
      }
      return { x, z, hit };
    }
    let hit = false;
    for (let n = 0; n < 2; n++) {
      for (const b of blocks) {
        const p = pushCircle(x, z, r, b);
        x = p.x;
        z = p.z;
        hit = hit || p.hit;
      }
    }
    const edgeLimit = HALF + 9 - r;
    if (x < -edgeLimit) {
      x = -edgeLimit;
      hit = true;
    }
    if (x > edgeLimit) {
      x = edgeLimit;
      hit = true;
    }
    if (z < -edgeLimit) {
      z = -edgeLimit;
      hit = true;
    }
    if (z > edgeLimit) {
      z = edgeLimit;
      hit = true;
    }
    return { x, z, hit };
  }

  function wakePed(p: Ped) {
    const home = p.goals[0] ?? { x: p.x, z: p.z };
    p.x = home.x;
    p.z = home.z;
    p.hp = p.maxHp;
    p.state = "walk";
    p.active = p.faction !== "cop";
    p.fall = 0;
    p.downFor = 0;
    p.er = false;
    p.settled = false;
    p.byPlayer = false;
    p.dive = 0;
    p.respawn = 0;
    p.linger = 0;
    p.lingerFor = 4 + rand() * 6;
    p.shootPose = 0;
    p.shotGen = 0;
    p.flinch = 0;
    p.flinchGen = 0;
    p.react = "chest";
    p.melee = 0;
    p.meleeKind = 0;
    p.meleeGen = 0;
    p.brawl = 0;
    p.speed = 0;
    p.prevX = p.x;
    p.prevZ = p.z;
    p.fleeFor = 0;
  }

  function collapsePed(p: Ped, byPlayer: boolean) {
    if (p.state === "down" || p.hp <= 0) return;
    p.state = "down";
    p.downFor = 0;
    p.fall = 0;
    p.dive = 0;
    p.byPlayer = byPlayer;
    p.er = rand() < 0.22;
  }

  function dropPed(p: Ped, killerPlayer: boolean) {
    if (p.settled) return;
    const fresh = p.state !== "down";
    p.hp = 0;
    p.state = "down";
    p.er = false;
    p.dive = 0;
    if (fresh) p.downFor = 0;
    p.settled = true;
    if (!killerPlayer || !started) return;
    if (job.active && job.kind === "hit" && p.faction === job.faction) {
      const inTurf = job.faction === "teal" ? p.x > 30 : p.x < -30;
      if (inTurf) {
        job.flag = true;
        say(job.faction === "teal" ? "Teal down. Leave their block." : "King down. Leave their block.");
      }
    }
    if (p.faction === "cop") {
      bankCash(80);
      addStars(2);
      if (!owned.smg) {
        owned.smg = true;
        gun = "smg";
        say("Cop down. Took his SMG");
      } else say("Cop down");
    } else if (p.faction === "civ") {
      bankCash(40);
      addStars(1);
      say("Civilian down");
    } else {
      bankCash(120);
      addStars(1);
      say(p.faction === "amber" ? "Amber King down +$120" : "Teal crew down +$120");
    }
  }

  function damageCar(index: number, amount: number, fromPlayer: boolean) {
    const car = cars[index]!;
    if (car.hp <= 0 || car.mode === "locked") return;
    if (!started && !fromPlayer) return;
    car.hp -= amount;
    if (fromPlayer && car.police) addStars(1);
    if (car.hp <= 0) {
      car.hp = 0;
      car.speed = 0;
      car.mode = car.mode === "player" ? "player" : "idle";
      if (car.mode === "player") {
        say("Ride's dead");
        driving = false;
        car.mode = "idle";
        px = car.x + Math.cos(car.yaw) * 2.6;
        pz = car.z - Math.sin(car.yaw) * 2.6;
        const safe = resolveCircle(px, pz, 0.45);
        px = safe.x;
        pz = safe.z;
      }
    }
  }

  function spawnShot(x: number, y: number, z: number, dx: number, dy: number, dz: number, dist: number) {
    shots.push({ x, y, z, x2: x + dx * dist, y2: y + dy * dist, z2: z + dz * dist, life: 0.18 });
    if (shots.length > MAX_SHOTS) shots.shift();
  }

  function playerShoot(force: boolean) {
    if (!started || !alive || phase !== "play") return;
    if (!force && (shootCd > 0 || reloadT > 0)) return;
    const spec = GUNS[gun];
    const a = ammo[gun];
    if (!force && a.mag <= 0) {
      if (a.reserve <= 0) say("Empty");
      else startReload();
      return;
    }
    if (!force) a.mag -= 1;
    shootCd = spec.cd;
    gunKick = gun === "shotgun" ? 0.22 : gun === "smg" ? 0.05 : 0.1;
    if (!driving) {
      shootPose = shootHold(gun);
      playerShotGen++;
    }
    rumble(gun === "shotgun" ? 70 : gun === "smg" ? 28 : 40, gun === "shotgun" ? 0.65 : gun === "smg" ? 0.18 : 0.32);
    const e = eye();
    if (!driving) {
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      const reach = aiming ? 0.78 : 0.55;
      e.x = px + e.dx * reach + rx * 0.24;
      e.y = (aiming ? 1.35 : 1.42) + groundY(px, pz);
      e.z = pz + e.dz * reach + rz * 0.24;
    }
    const pellets = force ? 1 : spec.pellets;
    let said = false;
    for (let n = 0; n < pellets; n++) {
      const spread = force ? 0 : (rand() - 0.5) * spec.spread * (aiming && !driving ? 0.45 : 1.05);
      const yaw = Math.atan2(-e.dx, -e.dz) + spread;
      const pitch = Math.asin(clamp(e.dy, -1, 1)) + (force ? 0 : (rand() - 0.5) * spec.spread * 0.35);
      const dx = -Math.sin(yaw) * Math.cos(pitch);
      const dy = Math.sin(pitch);
      const dz = -Math.cos(yaw) * Math.cos(pitch);
      const maxT = spec.range;
      const ignoreCar = driving ? playerCar : -1;
      const hit = trace(e.x, e.y, e.z, dx, dy, dz, maxT, ignoreCar, -1, false);
      const dist = hit ? hit.t : Math.min(18, maxT);
      spawnShot(e.x, e.y, e.z, dx, dy, dz, dist);
      if (n === 0) {
        flashT = 0.08;
        flashX = e.x + dx * 0.9;
        flashY = e.y + dy * 0.9;
        flashZ = e.z + dz * 0.9;
      }
      if (!hit) continue;
      if (hit.kind === "ped") {
        const p = peds[hit.index]!;
        p.hp -= spec.dmg;
        if (p.hp <= 0) {
          p.byPlayer = true;
          dropPed(p, true);
        } else if (p.hp <= p.maxHp * 0.35) {
          collapsePed(p, true);
          if (!said) {
            said = true;
            say(p.er ? "They're down. Sirens close." : "They're down");
          }
        } else {
          p.state = p.state === "down" ? "down" : "fight";
          markFlinch(p);
          if (!said) {
            said = true;
            say("Hit");
          }
        }
      } else if (hit.kind === "car") {
        damageCar(hit.index, spec.dmg * 0.65, true);
      }
    }
    audio.shot(gun);
    if (wanted === 0) addStars(1);
    else sinceCrime = 0;
    sinceShot = 0;
    if (!force && a.mag <= 0 && a.reserve > 0) startReload();
  }

  function npcShoot(x: number, z: number, tx: number, ty: number, tz: number, spread: number, dmg: number, ignoreCar: number) {
    const y0 = 1.2 + groundY(x, z);
    const dx0 = tx - x;
    const dy0 = ty + groundY(tx, tz) - y0;
    const dz0 = tz - z;
    const len = Math.hypot(dx0, dy0, dz0) || 1;
    let dx = dx0 / len;
    let dy = dy0 / len;
    let dz = dz0 / len;
    const j = (rand() - 0.5) * spread;
    const yaw = Math.atan2(-dx, -dz) + j;
    const pitch = Math.asin(clamp(dy, -1, 1));
    dx = -Math.sin(yaw) * Math.cos(pitch);
    dy = Math.sin(pitch);
    dz = -Math.cos(yaw) * Math.cos(pitch);
    const hit = trace(x, y0, z, dx, dy, dz, 40, ignoreCar, -1, true);
    const dist = hit ? Math.min(hit.t, 24) : 12;
    spawnShot(x, y0, z, dx, dy, dz, dist);
    if (Math.hypot(x - px, z - pz) < 34 || (driving && Math.hypot(x - cars[playerCar]!.x, z - cars[playerCar]!.z) < 34)) audio.shot("pistol");
    if (hit?.kind === "player") hurtPlayer(dmg);
    else if (hit?.kind === "ped") {
      const p = peds[hit.index]!;
      p.hp -= dmg * 2.2;
      if (p.hp <= 0) dropPed(p, false);
      else if (p.hp <= p.maxHp * 0.35) collapsePed(p, false);
      else markFlinch(p);
    } else if (hit?.kind === "car" && hit.index === playerCar && driving) {
      damageCar(hit.index, dmg, false);
      hurtPlayer(dmg * 0.35);
    }
  }

  function tryUse() {
    if (!started || !alive || phase !== "play") return;
    if (inHall) {
      const here = localHall();
      if (here.z < 2.2 && Math.abs(here.x) < 2.2) exitHall();
      else say("Door's south");
      return;
    }
    if (roomId) {
      const here = localRoom();
      if (here.z < 2.2 && Math.abs(here.x) < 2.2) exitRoom();
      else say("Door's south");
      return;
    }
    if (driving) {
      const car = cars[playerCar]!;
      const rx = Math.cos(car.yaw);
      const rz = -Math.sin(car.yaw);
      let sx = car.x + rx * 2.4;
      let sz = car.z + rz * 2.4;
      if (blocks.some((b) => circleHitsAABB(sx, sz, 0.45, b))) {
        sx = car.x - rx * 2.4;
        sz = car.z - rz * 2.4;
      }
      const safe = resolveCircle(sx, sz, 0.45);
      px = safe.x;
      pz = safe.z;
      vx = rx * 1.5;
      vz = rz * 1.5;
      camYaw = car.yaw;
      bodyYaw = car.yaw;
      py = 0;
      vy = 0;
      air = "none";
      car.mode = "coast";
      driving = false;
      say("On foot");
      return;
    }
    let bestI = -1;
    let bestD = 4.6;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i]!;
      if (c.hp <= 0) continue;
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    if (bestI < 0) {
      const door = nearestEnterSpot();
      if (door) {
        const block = enterBlock(door);
        if (block) {
          say(block);
          return;
        }
        if (door.id === "casino") enterHall();
        else if (isRoomId(door.id)) enterRoom(door.id);
        return;
      }
      say("No car in reach", 1.2);
      return;
    }
    const car = cars[bestI]!;
    if (car.forSale) {
      say("That's the sample. H buys a body off the list.");
      return;
    }
    if (driving) cars[playerCar]!.mode = "coast";
    playerCar = bestI;
    driving = true;
    py = 0;
    vy = 0;
    air = "none";
    footMoving = false;
    car.mode = "player";
    lookOffset = 0;
    if (car.police) {
      addStars(2);
      say("Stolen cruiser");
    } else if (car.hadDriver) {
      car.hadDriver = false;
      addStars(1);
      say("He called it in");
      let nearest: Ped | null = null;
      let nd = 18;
      for (const p of peds) {
        if (p.faction !== "civ" || !p.active || p.state === "down") continue;
        const d = Math.hypot(p.x - car.x, p.z - car.z);
        if (d < nd) {
          nd = d;
          nearest = p;
        }
      }
      if (nearest) {
        nearest.state = "flee";
        nearest.fleeFor = 2.4;
      }
    } else if (car.alarm) {
      car.alarm = false;
      addStars(1);
      say("Alarm tripped");
    } else say("In the seat");
    audio.blip(140, 0.08, "square", 0.03);
  }

  function updatePlayer(dt: number) {
    drifting = false;
    const throttleKeys = (held("KeyW") || held("ArrowUp") ? 1 : 0) - (held("KeyS") || held("ArrowDown") ? 1 : 0);
    let throttle = clamp(throttleKeys + touch.y + gy, -1, 1);
    if (driving && (gGas > 0.05 || gBrake > 0.05)) throttle = clamp(gGas - gBrake, -1, 1);
    if (driving) {
      py = 0;
      vy = 0;
      air = "none";
      footMoving = false;
      jumpHeld = held("Space");
      touch.jumpQueued = false;
      padJump = false;
      const car = cars[playerCar]!;
      if (car.hp <= 0) {
        driving = false;
        return;
      }
      let steer = 0;
      if (held("KeyA") || held("ArrowLeft")) steer += 1;
      if (held("KeyD") || held("ArrowRight")) steer -= 1;
      steer = clamp(steer - touch.x - gx, -1, 1);
      if (steerOverride !== null) steer = clamp(steerOverride, -1, 1);
      const ride = RIDES[car.ride];
      const hk = clamp(car.hp / car.maxHp, 0.28, 1);
      const hb = held("ShiftLeft") || held("ShiftRight") || touch.sprint || gSprint;
      drifting = hb && Math.abs(car.speed) > 5;
      // Same steer sign as before. High speed turns less so the car stops snapping.
      const speedFactor = clamp(1.05 - Math.abs(car.speed) / 34, 0.58, 1.05);
      const reverse = car.speed >= 0 ? 1 : -1;
      const turn = ride.turn * (drifting ? 1.65 : 1) * speedFactor * reverse;
      car.yaw += steer * turn * dt;
      const accel = ride.accel * (0.45 + 0.55 * hk) * (1 + hold.tunes * 0.12);
      const brake = 46;
      const vmax = ride.vmax * (0.55 + 0.45 * hk) * (1 + hold.tunes * 0.1);
      if (throttle > 0.05) car.speed += accel * throttle * dt;
      else if (throttle < -0.05) {
        if (car.speed > 0.6) car.speed -= brake * dt;
        else car.speed -= 16 * dt;
      } else {
        const drag = 2.1 + Math.abs(car.speed) * 0.08;
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), drag * dt);
      }
      if (drifting) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6.5 * dt);
      car.speed = clamp(car.speed, -11, vmax);
      const grip = drifting ? 1.35 : 8;
      car.lat *= Math.exp(-grip * dt);
      if (drifting) car.lat += -steer * Math.abs(car.speed) * 2.5 * dt;
      car.lat = clamp(car.lat, -16, 16);
      const fx = -Math.sin(car.yaw);
      const fz = -Math.cos(car.yaw);
      const rx = Math.cos(car.yaw);
      const rz = -Math.sin(car.yaw);
      const ox = car.x;
      const oz = car.z;
      car.x += (fx * car.speed + rx * car.lat) * dt;
      car.z += (fz * car.speed + rz * car.lat) * dt;
      const resolved = resolveCircle(car.x, car.z, carRadius(car.ride));
      const corrected = Math.hypot(resolved.x - car.x, resolved.z - car.z);
      car.x = resolved.x;
      car.z = resolved.z;
      if (corrected > 0.08 && Math.abs(car.speed) > 16) {
        const hard = Math.abs(car.speed);
        car.speed *= 0.8;
        car.lat *= 0.6;
        if (lastHurt > 0.45 && hard > 22) hurtPlayer(6 + corrected * 4);
        shake = Math.max(shake, 0.08);
      }
      if (Math.hypot(car.x - ox, car.z - oz) < 0.02 && Math.abs(car.speed) > 2 && corrected > 0) car.speed *= 0.94;
      car.spin += car.speed * dt;
      if (drifting && Math.abs(car.lat) > 4) shake = Math.max(shake, 0.05);
      if (held("KeyQ")) lookOffset += 1.5 * dt;
      if (held("KeyE")) lookOffset -= 1.5 * dt;
      lookOffset = clamp(lookOffset, -1.15, 1.15);
      return;
    }
    drifting = false;

    if (channel) {
      vx = 0;
      vz = 0;
      py = 0;
      vy = 0;
      air = "none";
      jumpHeld = held("Space");
      touch.jumpQueued = false;
      padJump = false;
      if (held("KeyQ")) camYaw += 1.7 * dt;
      if (held("KeyE")) camYaw -= 1.7 * dt;
      return;
    }

    let strafe = 0;
    if (held("KeyA") || held("ArrowLeft")) strafe -= 1;
    if (held("KeyD") || held("ArrowRight")) strafe += 1;
    strafe = clamp(strafe + touch.x + gx, -1, 1);
    const sprint = held("ShiftLeft") || held("ShiftRight") || touch.sprint || gSprint;
    const speed = sprint ? 8.6 : 5.3;
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    let wishX = fx * throttle + rx * strafe;
    let wishZ = fz * throttle + rz * strafe;
    const wish = Math.hypot(wishX, wishZ);
    if (wish > 1) {
      wishX /= wish;
      wishZ /= wish;
    }
    wishX *= speed;
    wishZ *= speed;
    const accel = wish > 0.08 ? (sprint ? 20 : 14) : 12;
    vx += (wishX - vx) * Math.min(1, accel * dt);
    vz += (wishZ - vz) * Math.min(1, accel * dt);
    px += vx * dt;
    pz += vz * dt;
    const resolved = resolveCircle(px, pz, 0.42);
    px = resolved.x;
    pz = resolved.z;
    for (const c of cars) {
      if (c.hp <= 0) continue;
      const dx = px - c.x;
      const dz = pz - c.z;
      const min = 1.7;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 0.001) {
        px = c.x + (dx / d) * min;
        pz = c.z + (dz / d) * min;
        if (Math.abs(c.speed) > 8) hurtPlayer((Math.abs(c.speed) - 8) * 1.4);
      }
    }
    const paceNow = Math.hypot(vx, vz);
    if (footMoving) {
      if (paceNow < 0.22) footMoving = false;
    } else if (paceNow > 0.55) footMoving = true;
    const space = held("Space");
    const hop = ((space && !jumpHeld) || touch.jumpQueued || padJump) && py <= 0.02 && vy === 0 && air !== "up" && air !== "hang";
    jumpHeld = space;
    touch.jumpQueued = false;
    padJump = false;
    if (hop) {
      vy = hopVelocity();
      air = "up";
      airT = 0.28;
    }
    if (py > 0 || vy !== 0) {
      const next = stepHop(py, vy, dt);
      const wasUp = py > 0.001;
      py = next.py;
      vy = next.vy;
      if (next.landed && wasUp) {
        air = "land";
        airT = 0.28;
      } else if (air === "up") {
        airT -= dt;
        if (airT <= 0) air = "hang";
      }
    } else if (air === "land") {
      airT -= dt;
      if (airT <= 0) air = "none";
    }
    const aimNow = gAim || rightLook || held("ControlLeft") || held("ControlRight");
    const combatFace = aimNow || shootPose > 0 || playerMelee > 0;
    if (!combatFace && paceNow > 0.45) {
      const face = travelYaw(vx, vz);
      let diff = wrap(face - bodyYaw);
      // A reverse or a first step snaps. A slow damp here is the moonwalk.
      if (Math.abs(diff) > 0.9) bodyYaw = face;
      else {
        const stepTurn = 9 * dt;
        if (diff > stepTurn) diff = stepTurn;
        else if (diff < -stepTurn) diff = -stepTurn;
        bodyYaw += diff;
      }
    } else {
      bodyYaw += wrap(camYaw - bodyYaw) * Math.min(1, 14 * dt);
    }
    if (held("KeyQ")) camYaw += 1.7 * dt;
    if (held("KeyE")) camYaw -= 1.7 * dt;
    if (inHall) {
      const here = localHall();
      if (here.z < 0.4 && Math.abs(here.x) < 1.8) exitHall();
    }
    if (roomId) {
      const here = localRoom();
      if (here.z < 0.4 && Math.abs(here.x) < 1.8) exitRoom();
    }
  }

  function autoDrive(car: Car, tx: number, tz: number, dt: number, turn: number, targetSpeed: number) {
    const desired = yawTo(car.x, car.z, tx, tz);
    const diff = wrap(desired - car.yaw);
    const steer = clamp(diff / 0.5, -1, 1);
    const sf = clamp(Math.abs(car.speed) / 5, 0.45, 1);
    car.yaw += steer * turn * sf * dt;
    if (car.speed < targetSpeed) car.speed += 18 * dt;
    else car.speed -= 22 * dt;
    const ox = car.x;
    const oz = car.z;
    car.x += -Math.sin(car.yaw) * car.speed * dt;
    car.z += -Math.cos(car.yaw) * car.speed * dt;
    car.lat *= Math.exp(-4 * dt);
    car.x += Math.cos(car.yaw) * car.lat * dt;
    car.z += -Math.sin(car.yaw) * car.lat * dt;
    const resolved = resolveCircle(car.x, car.z, carRadius(car.ride));
    if (resolved.hit && car.speed > 8) car.speed *= 0.7;
    car.x = resolved.x;
    car.z = resolved.z;
    car.spin += car.speed * dt;
    const moved = Math.hypot(car.x - ox, car.z - oz);
    if (moved < 0.05 && targetSpeed > 3) car.stuckT += dt;
    else car.stuckT = Math.max(0, car.stuckT - dt);
    if (car.stuckT > 2.2) {
      const spot = nearestRoad(car.x + (rand() - 0.5) * 10, car.z + (rand() - 0.5) * 10);
      car.x = spot.x;
      car.z = spot.z;
      car.yaw = spot.yaw;
      car.speed = 8;
      car.stuckT = 0;
    }
    return Math.abs(diff);
  }

  function velOf(c: Car) {
    const fx = -Math.sin(c.yaw);
    const fz = -Math.cos(c.yaw);
    const rx = Math.cos(c.yaw);
    const rz = -Math.sin(c.yaw);
    return { x: fx * c.speed + rx * c.lat, z: fz * c.speed + rz * c.lat };
  }

  function kick(c: Car, ix: number, iz: number) {
    if (c.mode === "locked" || c.hp <= 0) return;
    const fx = -Math.sin(c.yaw);
    const fz = -Math.cos(c.yaw);
    const rx = Math.cos(c.yaw);
    const rz = -Math.sin(c.yaw);
    const m = RIDES[c.ride].mass;
    c.speed = clamp(c.speed + (ix * fx + iz * fz) / m, -14, RIDES[c.ride].vmax);
    c.lat = clamp(c.lat + (ix * rx + iz * rz) / m, -12, 12);
  }

  function updateCars(dt: number) {
    const me = playerPos();
    const police = cars.filter((c) => c.police && c.mode !== "player" && c.hp > 0);
    police.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
    for (const c of police) {
      if (c.block && wanted >= 4) c.mode = "block";
      else c.block = false;
    }
    const free = police.filter((c) => !c.block);
    let searchN = 0;
    let chaseN = 0;
    if (started && wanted === 1) searchN = 1;
    else if (started && wanted === 2) chaseN = 2;
    else if (started && wanted === 3) chaseN = Math.min(3, free.length);
    else if (started && wanted >= 4) chaseN = Math.min(2, free.length);
    free.forEach((c, i) => {
      if (i < searchN) c.mode = "search";
      else if (i < searchN + chaseN) c.mode = "chase";
      else c.mode = c.wps.length ? "traffic" : "idle";
    });

    for (let i = 0; i < cars.length; i++) {
      const car = cars[i]!;
      if (car.mode === "player" || car.mode === "locked" || car.hp <= 0) continue;
      if (car.mode === "coast" || car.mode === "idle") {
        car.speed *= Math.exp(-1.4 * dt);
        car.lat *= Math.exp(-3 * dt);
        if (Math.abs(car.speed) < 0.3) car.speed = 0;
        car.x += -Math.sin(car.yaw) * car.speed * dt + Math.cos(car.yaw) * car.lat * dt;
        car.z += -Math.cos(car.yaw) * car.speed * dt - Math.sin(car.yaw) * car.lat * dt;
        const resolved = resolveCircle(car.x, car.z, carRadius(car.ride));
        car.x = resolved.x;
        car.z = resolved.z;
        continue;
      }
      if (car.mode === "block") {
        car.speed *= Math.exp(-3 * dt);
        car.lat *= Math.exp(-3 * dt);
        const dist = Math.hypot(car.x - me.x, car.z - me.z);
        if (dist < 16 || wanted < 4) {
          car.block = false;
          car.mode = "chase";
        }
        continue;
      }
      if (car.mode === "search") {
        const dist = Math.hypot(car.x - me.x, car.z - me.z);
        const orbit = dist < 18;
        const tx = orbit ? me.x + Math.cos(sirenFlip) * 16 : me.x;
        const tz = orbit ? me.z + Math.sin(sirenFlip) * 16 : me.z;
        autoDrive(car, tx, tz, dt, 2.1, orbit ? 8 : 16);
        continue;
      }
      if (car.mode === "tail") {
        const fy = -Math.sin(me.yaw);
        const fz = -Math.cos(me.yaw);
        autoDrive(car, me.x - fy * 7, me.z - fz * 7, dt, 2.7, 34);
        continue;
      }
      if (car.mode === "chase") {
        const lead = driving ? clamp(cars[playerCar]!.speed, 0, 20) * 0.45 : 0;
        const fy = -Math.sin(me.yaw);
        const fz = -Math.cos(me.yaw);
        autoDrive(car, me.x + fy * lead, me.z + fz * lead, dt, 2.55, angSpeed(car, me));
        car.shootCd -= dt;
        const dist = Math.hypot(car.x - me.x, car.z - me.z);
        if (wanted >= 3 && car.shootCd <= 0 && dist < 26 && los(car.x, car.z, me.x, me.z)) {
          car.shootCd = 0.95;
          const aimY = driving ? 1.1 : 1.3;
          npcShoot(car.x, car.z, me.x, aimY, me.z, wanted >= 5 ? 0.1 : 0.16, wanted >= 4 ? 8 : 6, i);
        }
        continue;
      }
      if (car.wps.length === 0) continue;
      const wp = car.wps[car.wp % car.wps.length]!;
      const dxp = me.x - car.x;
      const dzp = me.z - car.z;
      const distP = Math.hypot(dxp, dzp);
      const fx = -Math.sin(car.yaw);
      const fz = -Math.cos(car.yaw);
      const ahead = dxp * fx + dzp * fz;
      let tx = wp.x;
      let tz = wp.z;
      let spd = car.maxSpeed;
      if (distP < 15 && ahead > 0 && ahead < 14) {
        const rx = Math.cos(car.yaw);
        const rz = -Math.sin(car.yaw);
        const side = dxp * rx + dzp * rz;
        const away = side >= 0 ? -1 : 1;
        tx = car.x + fx * 8 + rx * away * 6;
        tz = car.z + fz * 8 + rz * away * 6;
        spd = Math.min(spd, 6);
      }
      const ang = autoDrive(car, tx, tz, dt, 2.1, spd);
      if (Math.hypot(car.x - wp.x, car.z - wp.z) < 7 || ang > 2.4) car.wp = (car.wp + 1) % car.wps.length;
    }

    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i]!;
        const b = cars[j]!;
        if (a.hp <= 0 || b.hp <= 0) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz) || 0.001;
        const min = carRadius(a.ride) + carRadius(b.ride);
        if (d >= min) continue;
        const push = (min - d) * 0.5;
        const nx = dx / d;
        const nz = dz / d;
        if (a.mode !== "locked") {
          a.x -= nx * push;
          a.z -= nz * push;
        }
        if (b.mode !== "locked") {
          b.x += nx * push;
          b.z += nz * push;
        }
        const va = velOf(a);
        const vb = velOf(b);
        const relN = (va.x - vb.x) * nx + (va.z - vb.z) * nz;
        if (relN > 1) {
          const inv = 1 / RIDES[a.ride].mass + 1 / RIDES[b.ride].mass;
          const j = clamp(relN / inv, 0, 18);
          kick(a, -nx * j, -nz * j);
          kick(b, nx * j, nz * j);
          const sideA = nx * Math.cos(a.yaw) - nz * Math.sin(a.yaw);
          a.yaw += sideA * clamp(relN, 0, 20) * 0.012;
          const sideB = nx * Math.cos(b.yaw) - nz * Math.sin(b.yaw);
          b.yaw -= sideB * clamp(relN, 0, 20) * 0.012;
        }
        if (relN > 6) {
          damageCar(i, relN * 2.4, b.mode === "player");
          damageCar(j, relN * 2.4, a.mode === "player");
          if ((a.mode === "player" || b.mode === "player") && started) {
            hurtPlayer(Math.min(28, relN * 0.28));
            shake = Math.max(shake, 0.16);
            if (crunchCd <= 0) {
              audio.crunch();
              crunchCd = 0.2;
            }
          }
        }
      }
    }

    for (const c of cars) {
      if (c.mode === "locked" || c.hp <= 0) continue;
      const pushed = resolveCircle(c.x, c.z, carRadius(c.ride) * 0.92);
      c.x = pushed.x;
      c.z = pushed.z;
    }

    const driver = driving ? cars[playerCar]! : null;
    if (driver && Math.abs(driver.speed) > 8) {
      for (const p of peds) {
        if (!p.active || p.state === "down") continue;
        if (Math.hypot(p.x - driver.x, p.z - driver.z) < 2.15) {
          dropPed(p, true);
          driver.speed *= 0.92;
          say("Hit someone");
        }
      }
    }
  }

  function angSpeed(car: Car, me: { x: number; z: number }) {
    const diff = Math.abs(wrap(yawTo(car.x, car.z, me.x, me.z) - car.yaw));
    return diff > 1 ? 14 : 33;
  }

  function enemiesOf(p: Ped) {
    const list: Array<{ x: number; z: number; ped?: Ped }> = [];
    if (p.ally) {
      for (const o of peds) {
        if (o === p || !o.active || o.state === "down" || o.ally) continue;
        if (o.faction === "civ") continue;
        const copHeat = o.faction === "cop" && wanted >= 2;
        const gang = o.faction === "amber" || o.faction === "teal";
        if (copHeat || gang) list.push({ x: o.x, z: o.z, ped: o });
      }
      return list;
    }
    for (const o of peds) {
      if (o === p || !o.active || o.state === "down") continue;
      const hostile =
        (p.faction === "amber" && o.faction === "teal") ||
        (p.faction === "teal" && o.faction === "amber") ||
        (p.faction === "cop" && o.faction !== "cop") ||
        ((p.faction === "amber" || p.faction === "teal") && o.faction === "cop");
      if (hostile) list.push({ x: o.x, z: o.z, ped: o });
    }
    if (started && alive && p.faction !== "civ" && engagePlayer.has(p)) {
      const me = playerPos();
      list.push({ x: me.x, z: me.z });
    }
    return list;
  }

  function updatePeds(dt: number) {
    const needCops = started && wanted >= 3 ? Math.min(4, wanted) : 0;
    let cops = 0;
    for (const p of peds) if (p.faction === "cop" && p.active && p.state !== "down") cops++;
    if (cops < needCops) {
      for (const p of peds) {
        if (p.faction !== "cop" || (p.active && p.state !== "down")) continue;
        if (p.respawn > 0) continue;
        if (cops >= needCops) break;
        const me = playerPos();
        const spot = nearestRoad(me.x + (rand() - 0.5) * 36, me.z + (rand() - 0.5) * 36);
        if (Math.hypot(spot.x - me.x, spot.z - me.z) < 14) continue;
        p.x = spot.x;
        p.z = spot.z;
        p.hp = p.maxHp;
        p.state = "fight";
        p.active = true;
        p.cd = 0.4;
        p.fall = 0;
        p.downFor = 0;
        p.er = false;
        p.settled = false;
        p.byPlayer = false;
        p.linger = 0;
        p.shootPose = 0;
        p.shotGen = 0;
        p.flinch = 0;
        p.flinchGen = 0;
        p.react = "chest";
        p.melee = 0;
        p.meleeKind = 0;
        p.meleeGen = 0;
        p.brawl = 0;
        p.speed = 0;
        p.prevX = p.x;
        p.prevZ = p.z;
        p.fleeFor = 0;
        cops++;
      }
    }
    if (needCops === 0) {
      for (const p of peds) if (p.faction === "cop" && p.state !== "down") p.active = false;
    }

    engagePlayer = new Set();
    if (started && alive) {
      const me = playerPos();
      const ranked: Array<{ p: Ped; d: number }> = [];
      for (const p of peds) {
        if (!p.active || p.state === "down" || p.faction === "civ" || p.ally) continue;
        const d = Math.hypot(p.x - me.x, p.z - me.z);
        const shot = sinceShot < 5 && d < 18;
        const turf = d < 8 && ((p.faction === "amber" && me.x < -55) || (p.faction === "teal" && me.x > 55));
        const cop = p.faction === "cop" && wanted >= 3 && d < 26;
        if (shot || turf || cop) ranked.push({ p, d });
      }
      ranked.sort((a, b) => a.d - b.d);
      for (const row of ranked.slice(0, 3)) engagePlayer.add(row.p);
    }
    const throwHands = (p: Ped, tx: number, tz: number, victim: Ped | null, hitPlayer: boolean) => {
      p.state = "fight";
      p.linger = 0;
      p.yaw = yawTo(p.x, p.z, tx, tz);
      const dist = Math.hypot(tx - p.x, tz - p.z);
      if (dist > 1.45) {
        const nx = p.x + -Math.sin(p.yaw) * 3.3 * dt;
        const nz = p.z + -Math.cos(p.yaw) * 3.3 * dt;
        if (!blocks.some((b) => circleHitsAABB(nx, nz, 0.34, b)) && !overlapsFoot(nx, nz)) {
          p.x = nx;
          p.z = nz;
        }
        return;
      }
      if (p.cd > 0 || p.melee > 0) return;
      p.cd = 0.72;
      p.melee = 0.4;
      p.meleeKind = p.meleeGen % 2 === 0 ? 0 : 1;
      p.meleeGen++;
      meleeContacts.set(p, { left: 0.16, victim, player: hitPlayer });
    };
    for (const p of peds) {
      if (!p.active) {
        meleeContacts.delete(p);
        p.respawn = Math.max(0, p.respawn - dt);
        if (p.state === "down" && p.faction !== "cop" && p.respawn <= 0) {
          const me = playerPos();
          if (Math.hypot(p.x - me.x, p.z - me.z) > 36) wakePed(p);
        }
        continue;
      }
      p.bob += dt * (p.state === "fight" ? 0 : 6);
      p.cd -= dt;
      p.shootPose = Math.max(0, p.shootPose - dt);
      p.flinch = Math.max(0, p.flinch - dt);
      p.melee = Math.max(0, p.melee - dt);
      const contact = meleeContacts.get(p);
      if (contact) {
        contact.left -= dt;
        if (p.state === "down" || p.hp <= 0 || p.flinch > 0) meleeContacts.delete(p);
        else if (contact.left <= 0) {
          meleeContacts.delete(p);
          const target = contact.player ? (!driving && alive ? { x: px, z: pz } : null) : contact.victim;
          if (target && Math.hypot(target.x - p.x, target.z - p.z) < 1.85) {
            const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
            if (contact.player) { hurtPlayer(11); vx += fx * 2.4; vz += fz * 2.4; }
            else if (contact.victim?.active && contact.victim.hp > 0 && contact.victim.state !== "down") hurtBare(contact.victim, 14, fx, fz, 0.55, false);
          }
        }
      }
      p.brawl = Math.max(0, p.brawl - dt);
      p.dive = Math.max(0, p.dive - dt);
      p.mark = Math.max(0, p.mark - dt);
      if (p.state === "down") {
        p.fall = Math.min(1, p.fall + dt / 0.42);
        p.downFor += dt;
        p.dive = 0;
        if (p.hp > 0 && !p.settled) {
          if (p.er && p.downFor > 6.4) {
            const me = playerPos();
            if (Math.hypot(p.x - me.x, p.z - me.z) < 30) say("Ambulance took them");
            p.active = false;
            p.respawn = 22;
            p.hp = p.maxHp;
          } else if (!p.er) {
            p.hp -= 7 * dt;
            if (p.hp <= 0) dropPed(p, p.byPlayer);
          }
        }
        if (p.hp <= 0 && p.downFor > (p.faction === "civ" ? 10 : 13)) {
          p.active = false;
          p.respawn = p.faction === "cop" ? 10 : 16;
        }
        continue;
      }
      if (p.hp <= 0) {
        p.ally = false;
        dropPed(p, p.byPlayer);
        continue;
      }
      if (channel && channel.ped >= 0 && peds[channel.ped] === p) continue;
      if (p.ally) {
        if (hold.crewT <= 0) {
          p.ally = false;
          p.state = "walk";
          continue;
        }
        const me = playerPos();
        const near = Math.hypot(p.x - me.x, p.z - me.z);
        let target: { x: number; z: number; ped?: Ped } | null = null;
        let best = 28;
        for (const e of enemiesOf(p)) {
          if (e.ped?.ally) continue;
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (d < best && los(p.x, p.z, e.x, e.z)) {
            best = d;
            target = e;
          }
        }
        if (target && best < 1.6) {
          throwHands(p, target.x, target.z, target.ped ?? null, false);
          continue;
        }
        if (target && best < 22) {
          p.state = "fight";
          p.yaw = yawTo(p.x, p.z, target.x, target.z);
          if (p.cd <= 0) {
            p.cd = 0.42;
            p.shootPose = shootHold(gunFor(p.faction, p.look));
            p.shotGen++;
            npcShoot(p.x, p.z, target.x, 1.25, target.z, 0.05, 8, -1);
          }
          continue;
        }
        p.state = "walk";
        if (near > 3.2) {
          p.yaw = yawTo(p.x, p.z, me.x, me.z);
          const nx = p.x + -Math.sin(p.yaw) * 5.4 * dt;
          const nz = p.z + -Math.cos(p.yaw) * 5.4 * dt;
          if (!blocks.some((b) => circleHitsAABB(nx, nz, 0.34, b)) && !overlapsFoot(nx, nz)) {
            p.x = nx;
            p.z = nz;
          }
        }
        continue;
      }
      const me = playerPos();
      const near = Math.hypot(p.x - me.x, p.z - me.z);
      const hotCar = driving && Math.abs(cars[playerCar]!.speed) > 12 && near < 8;
      const scared = p.faction === "civ" && ((sinceShot < 1.5 && near < 12) || (sinceCrime < 2 && near < 7) || hotCar);
      if (scared) {
        p.state = "flee";
        p.linger = 0;
        p.fleeFor = Math.max(p.fleeFor, 2.4);
      }
      if (p.state === "flee") {
        p.fleeFor = Math.max(0, p.fleeFor - dt);
        if (p.fleeFor <= 0 && !scared) {
          p.state = "walk";
        } else {
          const away = Math.atan2(-(p.x - me.x), -(p.z - me.z)) + Math.PI;
          p.yaw = away;
          const nx = p.x + -Math.sin(p.yaw) * 5.2 * dt;
          const nz = p.z + -Math.cos(p.yaw) * 5.2 * dt;
          if (!blocks.some((b) => circleHitsAABB(nx, nz, 0.35, b))) {
            p.x = nx;
            p.z = nz;
          } else p.yaw += 1.4;
          continue;
        }
      }
      if (p.faction === "civ" && p.brawl > 0 && !driving && alive) {
        throwHands(p, me.x, me.z, null, true);
        continue;
      }
      let target: { x: number; z: number; ped?: Ped } | null = null;
      let best = p.faction === "cop" ? 36 : 22;
      for (const e of enemiesOf(p)) {
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (d < best && los(p.x, p.z, e.x, e.z)) {
          best = d;
          target = e;
        }
      }
      if (target && best < 1.6 && !(driving && !target.ped)) {
        const hittingPlayer = !target.ped && !driving;
        throwHands(p, target.x, target.z, hittingPlayer ? null : (target.ped ?? null), hittingPlayer);
        continue;
      }
      if (target) {
        p.state = "fight";
        p.yaw = yawTo(p.x, p.z, target.x, target.z);
        if (p.cd <= 0) {
          p.cd = p.faction === "cop" ? 0.48 : 0.72;
          p.shootPose = shootHold(gunFor(p.faction, p.look));
          p.shotGen++;
          const isPlayer = Math.hypot(target.x - me.x, target.z - me.z) < 0.8;
          npcShoot(p.x, p.z, target.x, isPlayer && driving ? 1.1 : 1.25, target.z, 0.07, p.faction === "cop" ? 9 : 7, -1);
        }
        continue;
      }
      p.state = "walk";
      if (p.faction === "civ") {
        const stop = p.goals[p.goal % p.goals.length];
        if (stop) {
          const dist = Math.hypot(stop.x - p.x, stop.z - p.z);
          if (dist < 1.35) {
            p.linger += dt;
            if (p.linger >= p.lingerFor) {
              p.linger = 0;
              p.lingerFor = 4 + rand() * 6;
              p.goal++;
            }
            continue;
          }
          p.linger = 0;
          p.yaw = yawTo(p.x, p.z, stop.x, stop.z);
        }
        const cx = p.x + -Math.sin(p.yaw) * p.walkPace * dt;
        const cz = p.z + -Math.cos(p.yaw) * p.walkPace * dt;
        if (blocks.some((b) => circleHitsAABB(cx, cz, 0.34, b)) || Math.abs(cx) > HALF - 6 || Math.abs(cz) > HALF - 6) {
          p.yaw += Math.PI / 2;
        } else if (!overlapsFoot(cx, cz)) {
          p.x = cx;
          p.z = cz;
        }
        continue;
      }
      const goal = p.goals[p.goal % p.goals.length];
      if (goal) {
        p.yaw = yawTo(p.x, p.z, goal.x, goal.z);
        if (Math.hypot(goal.x - p.x, goal.z - p.z) < 2) p.goal++;
      }
      const sp = p.faction === "cop" ? 6.4 : 1.7;
      const nx = p.x + -Math.sin(p.yaw) * sp * dt;
      const nz = p.z + -Math.cos(p.yaw) * sp * dt;
      if (blocks.some((b) => circleHitsAABB(nx, nz, 0.34, b)) || Math.abs(nx) > HALF - 6 || Math.abs(nz) > HALF - 6) {
        p.yaw += Math.PI / 2;
      } else if (!overlapsFoot(nx, nz)) {
        p.x = nx;
        p.z = nz;
      }
    }
    separateLiving();
  }

  function updatePickups() {
    if (!started || !alive) return;
    const me = playerPos();
    for (const k of pickups) {
      if (k.wait > 0) continue;
      if (Math.hypot(k.x - me.x, k.z - me.z) < 1.7) {
        if (k.kind === "med") {
          health = Math.min(100, health + 45);
          say("Patched up");
        } else {
          armor = Math.min(100, armor + 50);
          say("Vest on");
        }
        k.wait = 22;
        audio.blip(520, 0.1, "sine", 0.04);
      }
    }
  }

  function nearLot() {
    const me = playerPos();
    return Math.hypot(me.x - LOT.x, me.z - LOT.z) < 8 || Math.hypot(me.x - 16, me.z + 8) < 6;
  }

  function jobLine() {
    if (!job.active) return "";
    const secs = Math.max(0, Math.ceil(job.t));
    if (job.kind === "deliver") return job.flag ? `Drop the ride · ${secs}s` : `Get in the marked ride · ${secs}s`;
    if (job.kind === "shake") return `Lose the tail · ${secs}s`;
    return job.flag
      ? `Get off their block · ${secs}s`
      : job.faction === "teal"
        ? `Drop a Teal on their block · ${secs}s`
        : `Drop a King on their block · ${secs}s`;
  }

  function inCover(x: number, z: number) {
    if (inHall) return false;
    if (roomId) return true;
    for (const id of deeds.ownedHouses) {
      const home = spots.find((s) => s.id === id);
      if (home && Math.hypot(x - home.x, z - home.z) < 7) return true;
    }
    for (const rx of roadXs) if (Math.abs(x - rx) < ROAD * 0.5 - 0.6) return false;
    for (const rz of roadZs) if (Math.abs(z - rz) < ROAD * 0.5 - 0.6) return false;
    for (const b of staticBlocks) {
      if (b.h < 4) continue;
      const dx = x < b.minX ? b.minX - x : x > b.maxX ? x - b.maxX : 0;
      const dz = z < b.minZ ? b.minZ - z : z > b.maxZ ? z - b.maxZ : 0;
      const d2 = dx * dx + dz * dz;
      if (d2 < 9 && d2 > 0.04) return true;
    }
    return false;
  }

  function placeBlock() {
    const me = playerPos();
    const fx = -Math.sin(me.yaw);
    const fz = -Math.cos(me.yaw);
    const rx = Math.cos(me.yaw);
    const rz = -Math.sin(me.yaw);
    let bestX = 0;
    let bestZ = 0;
    let best = -1e9;
    for (const x of roadXs) {
      for (const z of roadZs) {
        const dx = x - me.x;
        const dz = z - me.z;
        const along = dx * fx + dz * fz;
        if (along < 26 || along > 80) continue;
        const lateral = Math.abs(dx * rx + dz * rz);
        const score = along - lateral * 1.5;
        if (score > best) {
          best = score;
          bestX = x;
          bestZ = z;
        }
      }
    }
    if (best < 0) return;
    const cops = cars
      .map((c, i) => ({ c, i }))
      .filter((o) => o.c.police && o.c.mode !== "player" && o.c.hp > 40)
      .sort((a, b) => Math.hypot(b.c.x - me.x, b.c.z - me.z) - Math.hypot(a.c.x - me.x, a.c.z - me.z));
    if (cops.length === 0) return;
    cops.slice(0, 2).forEach((o, n) => {
      const side = n === 0 ? -2.6 : 2.6;
      o.c.x = bestX + rx * side;
      o.c.z = bestZ + rz * side;
      o.c.yaw = yawTo(o.c.x, o.c.z, me.x, me.z);
      o.c.speed = 0;
      o.c.lat = 0;
      o.c.mode = "block";
      o.c.block = true;
      o.c.hp = Math.max(o.c.hp, 160);
    });
    say("Roadblock ahead");
  }

  function startReload() {
    if (reloadT > 0) return;
    const spec = GUNS[gun];
    const a = ammo[gun];
    if (a.mag >= spec.mag || a.reserve <= 0) return;
    reloadT = spec.reload;
    say("Reloading");
  }

  function cycleGun() {
    const order: GunId[] = ["pistol", "shotgun", "smg"];
    const have = order.filter((id) => owned[id]);
    const i = Math.max(0, have.indexOf(gun));
    gun = have[(i + 1) % have.length] ?? "pistol";
    say(gun === "smg" ? "SMG" : gun === "shotgun" ? "Shotgun" : "Pistol");
  }

  function selectGun(id: GunId) {
    if (!owned[id]) {
      say(id === "smg" ? "Take one off a cop" : "Buy it at the lot");
      return;
    }
    gun = id;
    say(id === "smg" ? "SMG" : id === "shotgun" ? "Shotgun" : "Pistol");
  }

  function cycleRadio() {
    radioTrack = (radioTrack + 1) % RADIO.length;
    say(RADIO[radioTrack] ?? "NIGHTLINE");
  }

  function selectRadio(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= RADIO.length) return;
    radioTrack = index;
    say(RADIO[index] ?? "NIGHTLINE");
  }

  function tryBuy(kind: BuyKind) {
    if (!started || !alive || phase !== "play") return;
    if (!nearLot()) {
      say("The lot is in the plaza");
      return;
    }
    if (kind === "bail") buySpend("bribe");
    else if (kind === "vest") buySpend("vest");
    else if (kind === "shotgun") buySpend("shotgun");
    else if (catalog?.kind === "car") confirmCatalog();
    else openCatalog("car");
  }

  function farDrop(x: number, z: number) {
    const corners = [
      { x: roadXs[1]! + LANE, z: roadZs[1]! + LANE },
      { x: roadXs[4]! - LANE, z: roadZs[1]! + LANE },
      { x: roadXs[1]! + LANE, z: roadZs[4]! - LANE },
      { x: roadXs[4]! - LANE, z: roadZs[4]! - LANE },
    ];
    let best = corners[0]!;
    let bd = -1;
    for (const c of corners) {
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d > bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  function releaseTail() {
    if (job.tail < 0) return;
    const c = cars[job.tail];
    if (c && c.mode === "tail") {
      c.mode = "traffic";
      c.color = job.prevColor;
      c.ride = job.prevRide;
      c.maxSpeed = job.prevSpeed;
    }
    job.tail = -1;
  }

  function finishJob(ok: boolean, pay: number, msg: string) {
    if (!job.active) return;
    job.active = false;
    job.cool = 8;
    job.show = false;
    releaseTail();
    if (ok && pay > 0) bankCash(pay);
    say(msg);
  }

  function startJob() {
    if (!alive || phase !== "play") return;
    const order: JobKind[] = ["deliver", "shake", "hit"];
    const kind = order[job.next % 3]!;
    job.next += 1;
    job.flag = false;
    job.hold = 0;
    job.kind = kind;
    if (kind === "deliver") {
      let idx = -1;
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i]!;
        if (c.forSale || c.police || c.hp < 60) continue;
        if (i === playerCar && driving) continue;
        if (c.mode === "idle" || c.mode === "coast") {
          idx = i;
          break;
        }
      }
      if (idx < 0) {
        job.cool = 3;
        job.next -= 1;
        return;
      }
      const c = cars[idx]!;
      const drop = farDrop(c.x, c.z);
      job.car = idx;
      job.x = drop.x;
      job.z = drop.z;
      job.bx = c.x;
      job.bz = c.z;
      job.active = true;
      job.t = 55;
      job.show = true;
      say("Job: deliver that ride");
      return;
    }
    if (kind === "shake") {
      const me = playerPos();
      let idx = -1;
      let best = 1e9;
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i]!;
        if (c.police || c.forSale || c.hp < 50 || c.mode === "player" || c.mode === "locked") continue;
        const d = Math.hypot(c.x - me.x, c.z - me.z);
        if (d < 12 || d > 75) continue;
        if (d < best) {
          best = d;
          idx = i;
        }
      }
      if (idx < 0) {
        for (let i = 0; i < cars.length; i++) {
          const c = cars[i]!;
          if (!c.police && !c.forSale && c.mode !== "player" && c.mode !== "locked" && c.hp > 40) {
            idx = i;
            break;
          }
        }
      }
      if (idx < 0) {
        job.cool = 3;
        job.next -= 1;
        return;
      }
      const c = cars[idx]!;
      if (Math.hypot(c.x - me.x, c.z - me.z) > 70) {
        const back = nearestRoad(me.x + Math.sin(me.yaw) * 18, me.z + Math.cos(me.yaw) * 18);
        c.x = back.x;
        c.z = back.z;
        c.yaw = back.yaw;
      }
      job.prevColor = c.color;
      job.prevRide = c.ride;
      job.prevSpeed = c.maxSpeed;
      c.mode = "tail";
      c.color = 0xc44536;
      c.ride = "sport";
      c.maxSpeed = 36;
      c.hp = Math.max(c.hp, 90);
      job.tail = idx;
      job.bx = c.x;
      job.bz = c.z;
      job.active = true;
      job.t = 40;
      job.show = true;
      say("Job: shake the tail");
      return;
    }
    job.faction = job.next % 2 === 0 ? "teal" : "amber";
    job.x = job.faction === "teal" ? 66 : -66;
    job.z = 12;
    job.bx = job.x;
    job.bz = job.z;
    job.active = true;
    job.t = 50;
    job.show = true;
    say(job.faction === "teal" ? "Job: drop a Teal, then get out" : "Job: drop a King, then get out");
  }

  function updateJob(dt: number) {
    if (!job.active) return;
    job.t -= dt;
    if (job.t <= 0) {
      finishJob(false, 0, "Job blown");
      return;
    }
    const me = playerPos();
    if (job.kind === "deliver") {
      const c = cars[job.car];
      if (!c || c.hp <= 0) {
        finishJob(false, 0, "The ride's dead");
        return;
      }
      const drivingIt = driving && playerCar === job.car;
      job.flag = drivingIt;
      if (drivingIt) {
        job.bx = job.x;
        job.bz = job.z;
        if (Math.hypot(c.x - job.x, c.z - job.z) < 8) finishJob(true, 260, "Delivered +$260");
      } else {
        job.bx = c.x;
        job.bz = c.z;
      }
      return;
    }
    if (job.kind === "shake") {
      const c = cars[job.tail];
      if (!c || c.hp <= 0 || c.mode !== "tail") {
        finishJob(true, 140, "Tail's scrap +$140");
        return;
      }
      job.bx = c.x;
      job.bz = c.z;
      const d = Math.hypot(c.x - me.x, c.z - me.z);
      if (d > 64) job.hold += dt;
      else job.hold = 0;
      if (job.hold > 5) finishJob(true, 200, "Lost them +$200");
      return;
    }
    job.bx = job.x;
    job.bz = job.z;
    if (job.flag) {
      const zone = me.x < -30 ? "amber" : me.x > 30 ? "teal" : "mid";
      if (zone !== job.faction) finishJob(true, 220, "Out clean +$220");
    }
  }

  function rumble(ms: number, strong: number) {
    const pads = readGamepads(navigator);
    for (const g of pads) {
      if (!g) continue;
      const dual = g as Gamepad & {
        vibrationActuator?: { playEffect: (type: string, params: object) => Promise<void> };
        hapticActuators?: { pulse: (value: number, duration: number) => Promise<void> }[];
      };
      if (dual.vibrationActuator) {
        void dual.vibrationActuator
          .playEffect("dual-rumble", { duration: ms, strongMagnitude: strong, weakMagnitude: Math.min(1, strong * 0.7) })
          .catch(() => {});
        continue;
      }
      const pulse = dual.hapticActuators?.[0];
      if (pulse) void pulse.pulse(Math.min(1, strong), ms).catch(() => {});
    }
  }

  function pollPad(dt: number) {
    padLive = padWindowLive({ hidden: document.hidden });
    const list = padLive ? readGamepads(navigator) : [];
    padIndex = padLive ? choosePadIndex(list, padIndex) : -1;
    const pad = padIndex >= 0 ? list[padIndex] : null;
    if (!padLive) {
      padStatus = "Tab hidden — controller paused";
    } else if (typeof navigator.getGamepads !== "function") {
      padStatus = window.isSecureContext
        ? "This browser has no controller API"
        : "Controller blocked. Open http://localhost:8080/";
    } else if (!pad) {
      padStatus = "Listening — press any controller button";
    }
    gx = 0;
    gy = 0;
    gGas = 0;
    gBrake = 0;
    gSprint = false;
    gFire = false;
    gAim = false;
    gLook = false;
    if (!pad) {
      if (padOn) {
        padOn = false;
        pushHud();
      }
      padEdge.fill(false);
      return;
    }
    const name = (pad.id || "Controller").replace(/\s*\(.*$/, "").trim().slice(0, 28) || "Controller";
    padStatus = phase === "menu" ? `${name} connected. Press A to start.` : `${name} connected`;
    if (!padOn) {
      padOn = true;
      say(`${name} connected`);
      pushHud();
    }
    const rise = (i: number) => {
      const button = pad.buttons[i];
      const down = !!(button?.pressed || (button?.value ?? 0) > 0.55);
      const hit = down && !padEdge[i];
      padEdge[i] = down;
      return hit;
    };
    const axes = sampleAxes(pad, layoutFor(pad));
    const move = radialDeadzone(axes.lx, axes.ly, 0.16);
    const look = radialDeadzone(axes.rx, axes.ry, 0.14);
    gx = responseCurve(move.x, 1.25);
    gy = responseCurve(-move.y, 1.25);
    gGas = triggerFeel(axes.rt);
    gBrake = triggerFeel(axes.lt);
    gAim = !driving && gBrake > 0.28;
    gSprint = !!(pad.buttons[1]?.pressed || pad.buttons[10]?.pressed);
    const lookX = responseCurve(look.x, 2.05);
    const lookY = responseCurve(look.y, 2.05);
    gLook = Math.hypot(lookX, lookY) > 0;
    if (gLook && started && alive && phase === "play") {
      const yawRate = driving ? LOOK_YAW_DRIVE : LOOK_YAW_FOOT;
      const pitchRate = driving ? LOOK_PITCH_DRIVE : LOOK_PITCH_FOOT;
      if (driving) {
        lookOffset = clamp(lookOffset - lookX * yawRate * dt, -1.2, 1.2);
        lookPitch = clamp(lookPitch - lookY * pitchRate * dt, -0.7, 0.4);
      } else {
        camYaw -= lookX * yawRate * dt;
        camPitch = clamp(camPitch - lookY * pitchRate * dt, -0.85, 0.7);
      }
    }
    if (!driving && Math.hypot(gx, gy) > 0.9) gSprint = true;
    gFire = driving ? !!pad.buttons[5]?.pressed : gGas > 0.45;
    if (phase === "pause") {
      gFire = false;
      gAim = false;
      gLook = false;
      gSprint = false;
      if (rise(9) || rise(1)) resumeGame();
      else if (rise(0)) confirmPause();
      else if (rise(12)) movePause(-1);
      else if (rise(13)) movePause(1);
      return;
    }
    if (!started && phase === "menu") {
      const current = PLAYABLES.findIndex((p) => p.id === chosenCharacter);
      if (rise(14) || rise(4)) selectCharacter(PLAYABLES[(current + PLAYABLES.length - 1) % PLAYABLES.length]!.id);
      if (rise(15) || rise(5)) selectCharacter(PLAYABLES[(current + 1) % PLAYABLES.length]!.id);
      if (castReady && (rise(0) || rise(9))) start();
    }
    else if (phase === "dead" && rise(0)) respawn();
    else if (started && alive && phase === "play") {
      if (rise(0)) padUse = true;
      if (rise(2)) padReload = true;
      if (rise(3) || rise(4)) padGun = true;
      if (rise(14)) padRadio = true;
      if (rise(12)) padHustle = true;
      if (rise(13)) padBank = true;
      if (!driving && rise(5)) padMelee = true;
      else if (driving) rise(5);
      if (!driving && rise(11)) padJump = true;
      else rise(11);
      if (rise(9)) pauseGame();
      if (rise(1) && catalog) poke("back");
      rise(6);
      rise(7);
      rise(10);
      rise(15);
    } else {
      for (let i = 0; i < 16; i++) rise(i);
    }
  }

  function step(dt: number) {
    pollPad(dt);
    liveDesk = buildDesk();
    if (liveDesk && liveDesk.kind !== "jobs" && liveDesk.kind !== "mug" && document.pointerLockElement === canvas) document.exitPointerLock?.();
    drainCmds();
    if (phase === "pause") {
      aiming = false;
      navPause(dt);
      return;
    }
    starLock = Math.max(0, starLock - dt);
    sinceCrime += dt;
    sinceShot += dt;
    invuln = Math.max(0, invuln - dt);
    shootCd = Math.max(0, shootCd - dt);
    shootPose = Math.max(0, shootPose - dt);
    playerFlinch = Math.max(0, playerFlinch - dt);
    playerMelee = Math.max(0, playerMelee - dt);
    if (playerContact > 0) {
      playerContact -= dt;
      if (playerContact <= 0) { playerContact = 0; playerMeleeContact(); }
    }
    meleeCd = Math.max(0, meleeCd - dt);
    toastT = Math.max(0, toastT - dt);
    shake *= Math.exp(-4.5 * dt);
    lastHurt += dt;
    for (const k of pickups) k.wait = Math.max(0, k.wait - dt);
    for (let i = shots.length - 1; i >= 0; i--) {
      shots[i]!.life -= dt;
      if (shots[i]!.life <= 0) shots.splice(i, 1);
    }
    sirenFlip += dt;
    crunchCd = Math.max(0, crunchCd - dt);
    flashT = Math.max(0, flashT - dt);
    for (const s of spots) s.cool = Math.max(0, s.cool - dt);
    if (reloadT > 0) {
      reloadT -= dt;
      if (reloadT <= 0) {
        reloadT = 0;
        const spec = GUNS[gun];
        const a = ammo[gun];
        const need = spec.mag - a.mag;
        const take = Math.min(need, a.reserve);
        a.mag += take;
        a.reserve -= take;
      }
    }

    if (phase === "dead") {
      if (job.active) {
        job.active = false;
        job.show = false;
        releaseTail();
        job.cool = 6;
      }
      deathLeft -= dt;
      if (deathLeft <= 0) respawn();
      updateCars(dt * 0.4);
      return;
    }

    if (started && alive) {
      if (touch.useQueued || padUse) {
        touch.useQueued = false;
        padUse = false;
        tryUse();
      }
      if (touch.reloadQueued || padReload) {
        touch.reloadQueued = false;
        padReload = false;
        startReload();
      }
      if (touch.cycleGunQueued || padGun) {
        touch.cycleGunQueued = false;
        padGun = false;
        cycleGun();
      }
      if (touch.radioQueued || padRadio) {
        touch.radioQueued = false;
        padRadio = false;
        cycleRadio();
      }
      if (touch.hustleQueued || padHustle) {
        touch.hustleQueued = false;
        padHustle = false;
        if (liveDesk) poke("confirm");
        else beginHustle();
      }
      if (touch.bankQueued || padBank) {
        touch.bankQueued = false;
        padBank = false;
        if (blackjackHand()) hallCycle();
        else if (liveDesk) poke("next");
        else cycleSpot();
      }
      if (touch.buy) {
        const kind = touch.buy;
        touch.buy = "";
        tryBuy(kind);
      }
      const tap = (code: string, slot: keyof typeof edge) => {
        const down = held(code);
        const fire = down && !edge[slot];
        edge[slot] = down;
        return fire;
      };
      if (tap("KeyR", "r")) startReload();
      if (tap("KeyN", "n")) cycleRadio();
      if (tap("KeyB", "b")) tryBuy("bail");
      if (tap("KeyV", "v")) tryBuy("vest");
      if (tap("KeyG", "g")) tryBuy("shotgun");
      if (tap("KeyH", "h")) tryBuy("sport");
      if (tap("Digit1", "d1")) selectGun("pistol");
      if (tap("Digit2", "d2")) selectGun("shotgun");
      if (tap("Digit3", "d3")) selectGun("smg");
      if (tap("KeyJ", "j")) {
        if (liveDesk) poke("confirm");
        else beginHustle();
      }
      if (tap("KeyK", "k")) {
        if (blackjackHand()) hallCycle();
        else if (liveDesk) poke("next");
        else cycleSpot();
      }
      if (inHall && tap("KeyU", "u")) hallAlt("u");
      if (inHall && tap("KeyI", "i")) hallAlt("i");
      if (touch.meleeQueued || padMelee || tap("KeyC", "c")) {
        touch.meleeQueued = false;
        padMelee = false;
        playerSwing();
      }
      const use = held("KeyF");
      if (use && !prevF) tryUse();
      prevF = use;
      if (touch.lookX || touch.lookY) {
        if (driving) {
          lookOffset -= touch.lookX * 0.004;
          lookPitch -= touch.lookY * 0.0035;
          lookPitch = clamp(lookPitch, -0.7, 0.4);
        } else {
          camYaw -= touch.lookX * 0.0045;
          camPitch -= touch.lookY * 0.0038;
          camPitch = clamp(camPitch, -0.95, 1.05);
        }
        touch.lookX = 0;
        touch.lookY = 0;
      }
      updatePlayer(dt);
      updateChannel(dt);
      updateHoldings(dt);
      aiming = !driving && (gAim || rightLook || held("ControlLeft") || held("ControlRight"));
      if (playerMelee <= 0 && (mouseFire || touch.fire || gFire)) playerShoot(false);
      if (lastHurt > 6 && health < 100 && health > 0) {
        regenT += dt;
        health = Math.min(100, health + 10 * dt);
      }
      const meNow = playerPos();
      coverNow = inCover(meNow.x, meNow.z);
      if (wanted >= 5 && !coverNow) {
        seenX = meNow.x;
        seenZ = meNow.z;
        lit = true;
        coverSaid = false;
      } else if (wanted >= 5 && coverNow) {
        lit = false;
        if (!coverSaid) {
          coverSaid = true;
          say("Off the light");
        }
      } else {
        lit = false;
        coverSaid = false;
      }
      if (wanted >= 4 && !blockLive) {
        placeBlock();
        blockLive = true;
      }
      if (wanted < 4 && blockLive) {
        blockLive = false;
        for (const c of cars) c.block = false;
      }
      if (job.active) updateJob(dt);
      else if (alive && !inHall && !roomId) {
        job.cool -= dt;
        if (job.cool <= 0) startJob();
      }
      if (inHall || roomId) clearT = 0;
      else if (wanted >= 5 && lit) clearT = 0;
      else if (wanted > 0 && sinceCrime > 8) {
        let nearest = 1e9;
        for (const c of cars) {
          if (!c.police || c.hp <= 0 || c.mode === "player") continue;
          nearest = Math.min(nearest, Math.hypot(c.x - meNow.x, c.z - meNow.z));
        }
        for (const p of peds) {
          if (p.faction !== "cop" || !p.active || p.state === "down") continue;
          nearest = Math.min(nearest, Math.hypot(p.x - meNow.x, p.z - meNow.z));
        }
        const far = nearest > (wanted >= 5 ? 50 : 62);
        if (far) clearT += dt;
        else clearT = 0;
        if (clearT > Math.max(2.5, 5 - hold.lux * 0.6)) {
          wanted -= 1;
          clearT = 0;
          if (wanted < 4) {
            blockLive = false;
            for (const c of cars) c.block = false;
          }
          say(wanted <= 0 ? "Lost them" : "Heat dropping");
        }
      } else clearT = 0;
    } else {
      prevF = held("KeyF");
    }

    updateCars(dt);
    updatePeds(dt);
    updatePickups();

    if (audio.ctx && audio.engine && audio.engineGain && audio.sirenGain) {
      const sp = driving ? Math.abs(cars[playerCar]!.speed) : 0;
      const lat = driving ? Math.abs(cars[playerCar]!.lat) : 0;
      audio.engine.frequency.value = 42 + sp * 3.4 + lat * 0.6;
      audio.engineGain.gain.value = started && driving ? Math.min(0.035, 0.008 + sp * 0.0008) : 0;
      const sirenDistances: number[] = [];
      if (started && wanted > 0) {
        const me = playerPos();
        for (const c of cars) {
          if (!c.police || c.hp <= 0 || c.mode === "player") continue;
          if (c.mode !== "chase" && c.mode !== "search" && c.mode !== "block") continue;
          sirenDistances.push(Math.hypot(c.x - me.x, c.z - me.z));
        }
        for (const p of peds) {
          if (p.faction !== "cop" || !p.active || p.state === "down") continue;
          sirenDistances.push(Math.hypot(p.x - me.x, p.z - me.z));
        }
        if (wanted >= 5) sirenDistances.push(Math.hypot(heliX - me.x, heliZ - me.z) + 18);
      }
      const threat = sirenThreat(sirenDistances);
      const sirenOn = threat > 0.04;
      const targetGain = sirenOn ? threat * 0.04 : 0;
      audio.sirenGain.gain.value += (targetGain - audio.sirenGain.gain.value) * Math.min(1, dt * 4);
      if (audio.sirenA && audio.sirenB) {
        const wail = 0.5 + 0.5 * Math.sin(sirenFlip * 2.6);
        audio.sirenA.frequency.value = 560 + 160 * wail;
        audio.sirenB.frequency.value = 420 + 90 * (1 - wail);
      }
      if (audio.tireGain) {
        const screech = started && driving && (lat > 3.2 || (drifting && sp > 8));
        audio.tireGain.gain.value = screech ? clamp((lat + (drifting ? 4 : 0)) / 90, 0, 0.04) : 0;
      }
      if (audio.radioGain && audio.radioA && audio.radioB) {
        const tracks = [
          { a: 110, b: 164.8 },
          { a: 98, b: 146.8 },
          { a: 130.8, b: 196 },
          { a: 82.4, b: 123.5 },
        ];
        const tr = tracks[radioTrack] ?? tracks[0]!;
        audio.radioA.frequency.value = tr.a;
        audio.radioB.frequency.value = tr.b;
        const pulse = 0.65 + 0.35 * Math.sin(sirenFlip * (radioTrack === 3 ? 8 : 3));
        audio.radioGain.gain.value = started && radioOn ? 0.015 * pulse * (sirenOn ? 0.4 : 1) : 0;
      }
    }
  }

  function syncWorld(elapsed: number) {
    const placed = fleet;
    if (!placed) {
      bodyMesh.instanceMatrix.needsUpdate = true;
      cabinMesh.instanceMatrix.needsUpdate = true;
      glassMesh.instanceMatrix.needsUpdate = true;
      hoodMesh.instanceMatrix.needsUpdate = true;
      wheelMesh.instanceMatrix.needsUpdate = true;
      rimMesh.instanceMatrix.needsUpdate = true;
      headMesh.instanceMatrix.needsUpdate = true;
      tailMesh.instanceMatrix.needsUpdate = true;
    } else {
      placed.sync(cars);
    }
    barMesh.instanceMatrix.needsUpdate = true;
    shadowMesh.instanceMatrix.needsUpdate = true;
    const blink = Math.sin(sirenFlip * 14) > 0;
    cars.forEach((car, i) => {
      const dead = car.hp <= 0;
      const rs = RIDES[car.ride].scale;
      const squat = dead ? 0.42 : car.hp < car.maxHp * 0.4 ? 0.82 : 1;
      q.setFromAxisAngle(up, car.yaw + Math.PI);
      const gyCar = groundY(car.x, car.z);
      const hop = (dead ? 0.16 : 0.62) * rs[1] * squat + gyCar;
      if (!placed) {
        v.set(car.x, hop, car.z);
        scaleBody.set(rs[0], rs[1] * squat, rs[2]);
        m.compose(v, q, scaleBody);
        bodyMesh.setMatrixAt(i, m);
        v2.set(0, 0.42 * rs[1], -0.2 * rs[2]).applyQuaternion(q);
        v.set(car.x, hop, car.z).add(v2);
        m.compose(v, q, scaleBody);
        cabinMesh.setMatrixAt(i, m);
        scaleBody.set(rs[0] * 0.96, rs[1] * squat * 0.92, rs[2] * 0.96);
        m.compose(v, q, dead ? scale0 : scaleBody);
        glassMesh.setMatrixAt(i, m);
        v2.set(0, 0.02 * rs[1], 0.95 * rs[2]).applyQuaternion(q);
        v.set(car.x, hop, car.z).add(v2);
        scaleBody.set(rs[0], rs[1] * squat * 0.85, rs[2]);
        m.compose(v, q, dead ? scale0 : scaleBody);
        hoodMesh.setMatrixAt(i, m);
        tint.setHex(dead ? 0x2a2a2a : car.color);
        bodyMesh.setColorAt(i, tint);
        hoodMesh.setColorAt(i, tint);
        const wheelLocal: Array<[number, number, number]> = [
          [-0.78 * rs[0], -0.28 * rs[1], 1.25 * rs[2]],
          [0.78 * rs[0], -0.28 * rs[1], 1.25 * rs[2]],
          [-0.78 * rs[0], -0.28 * rs[1], -1.25 * rs[2]],
          [0.78 * rs[0], -0.28 * rs[1], -1.25 * rs[2]],
        ];
        q2.setFromAxisAngle(axle, car.spin);
        qw.multiplyQuaternions(q, q2);
        scaleWheel.set(0.85 + rs[0] * 0.2, 0.85 + rs[0] * 0.2, 0.85 + rs[0] * 0.2);
        wheelLocal.forEach((off, w) => {
          v2.set(off[0], off[1], off[2]).applyQuaternion(q);
          v.set(car.x, hop, car.z).add(v2);
          m.compose(v, qw, dead ? scale0 : scaleWheel);
          wheelMesh.setMatrixAt(i * 4 + w, m);
          m.compose(v, qw, dead ? scale0 : scale1);
          rimMesh.setMatrixAt(i * 4 + w, m);
        });
        const lights: Array<[number, number, number]> = [
          [-0.55 * rs[0], 0.05, 2.02 * rs[2]],
          [0.55 * rs[0], 0.05, 2.02 * rs[2]],
        ];
        lights.forEach((off, k) => {
          v2.set(off[0], off[1], off[2]).applyQuaternion(q);
          v.set(car.x, hop, car.z).add(v2);
          m.compose(v, q, dead ? scale0 : scale1);
          headMesh.setMatrixAt(i * 2 + k, m);
        });
        const tails: Array<[number, number, number]> = [
          [-0.55 * rs[0], 0.05, -2.02 * rs[2]],
          [0.55 * rs[0], 0.05, -2.02 * rs[2]],
        ];
        tails.forEach((off, k) => {
          v2.set(off[0], off[1], off[2]).applyQuaternion(q);
          v.set(car.x, hop, car.z).add(v2);
          m.compose(v, q, dead ? scale0 : scale1);
          tailMesh.setMatrixAt(i * 2 + k, m);
        });
      }
      v.set(car.x, 0.04 + gyCar, car.z);
      if (placed) {
        const len = car.ride === "van" ? 1.9 : car.ride === "sport" ? 1.55 : car.ride === "cruiser" ? 1.8 : 1.7;
        const wid = car.ride === "van" ? 1.4 : 1.28;
        scaleBody.set(wid, 1, len);
      } else {
        scaleBody.set(rs[0] * 1.15, 1, rs[2] * 1.25);
      }
      m.compose(v, q, dead ? scale0 : scaleBody);
      shadowMesh.setMatrixAt(i, m);
      const fleetSquat = dead ? 0.46 : car.hp < car.maxHp * 0.4 ? 0.82 : 1;
      const barBase = placed ? placed.roof(car.body) * fleetSquat + gyCar : hop;
      const barLift = placed ? 0.06 : 0.7 * rs[1];
      [-0.28, 0.28].forEach((xOff, k) => {
        v2.set(xOff, barLift, -0.15).applyQuaternion(q);
        v.set(car.x, barBase, car.z).add(v2);
        m.compose(v, q, car.police && !dead ? scale1 : scale0);
        barMesh.setMatrixAt(i * 2 + k, m);
        tint.setHex(!blink === (k === 0) ? 0xff2a2a : 0x3a6dff);
        barMesh.setColorAt(i * 2 + k, tint);
      });
    });
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    if (hoodMesh.instanceColor) hoodMesh.instanceColor.needsUpdate = true;
    if (barMesh.instanceColor) barMesh.instanceColor.needsUpdate = true;

    const motionDt = Math.max(dtFrame, 1 / 120);
    for (const p of peds) {
      const hop = Math.hypot(p.x - p.prevX, p.z - p.prevZ);
      p.speed = hop > 4 ? 0 : Math.min(12, hop / motionDt);
      p.prevX = p.x;
      p.prevZ = p.z;
    }
    const animDt = phase === "pause" ? 0 : dtFrame;
    gunKick = Math.max(0, gunKick - dtFrame * 1.6);
    if (castReady) {
      const viewX = started ? (driving ? cars[playerCar]!.x : px) : 0;
      const viewZ = started ? (driving ? cars[playerCar]!.z : pz) : 0;
      const animSlot = animationFrame++ % 3;
      peds.forEach((p, i) => {
        const actor = pedActors[i];
        if (!actor) return;
        if (!p.active) {
          parkActor(actor);
          return;
        }
        actorAnimTime[i] = Math.min(0.15, (actorAnimTime[i] ?? 0) + animDt);
        const dist = Math.hypot(p.x - viewX, p.z - viewZ);
        if (dist > (p.state === "down" ? 120 : 78)) {
          parkActor(actor);
          return;
        }
        placeActor(actor, p.x, groundY(p.x, p.z), p.z, p.yaw);
        const close = dist < 36 || p.state === "down";
        if (!close && i % 3 !== animSlot) return;
        updateActor(
          actor,
          {
            down: p.state === "down",
            reloading: false,
            shooting: p.shootPose > 0,
            aiming: false,
            pitch: 0,
            diving: p.dive > 0.2,
            speed: p.speed,
            fighting: p.state === "fight",
            armed: p.faction !== "civ",
            lingering: p.faction === "civ" && p.state === "walk" && p.linger > 0,
            beat: p.beat,
            flinch: p.flinch > 0 && p.state !== "down",
            react: p.react,
            melee: p.melee > 0 ? (p.meleeKind === 2 ? "shove" : p.meleeKind === 1 ? "cross" : "jab") : "none",
            gun: gunFor(p.faction, p.look) ?? "pistol",
          },
          p.shotGen,
          actorAnimTime[i]!,
          p.shootPose > 0 ? 0.6 : 0,
          p.flinchGen,
          p.meleeGen,
        );
        actorAnimTime[i] = 0;
      });
      if (playerActor) {
        const showPlayer = started && !driving && (alive || phase === "dead");
        playerGroup.visible = false;
        studio.visible = !started;
        if (!started) {
          placeActor(playerActor, 0, 40, 0, previewYaw);
          setHeldGun(playerActor, null);
          updateActor(playerActor, { down: false, reloading: false, shooting: false, aiming: false, pitch: 0, diving: false, speed: previewWalk ? 1.6 : 0, fighting: false, armed: false, lingering: !previewWalk, beat: playerActor.profile.idle }, 0, animDt, 0);
        }
        else if (!showPlayer) playerActor.root.visible = false;
        else {
          const pace = Math.hypot(vx, vz);
          const aimPose = aiming && alive;
          const shownPace = alive ? clipPace(vx, vz, aimPose || shootPose > 0 ? camYaw : bodyYaw, aimPose || shootPose > 0) : 0;
          const bob = phase === "dead" || pace <= 0.4 || py > 0.05 ? 0 : Math.abs(Math.sin(elapsed * 9)) * 0.035;
          placeActor(playerActor, px, groundY(px, pz) + bob + py, pz, bodyYaw);
          setHeldGun(playerActor, gun);
          updateActor(
            playerActor,
            {
              down: phase === "dead" || !alive,
              reloading: reloadT > 0 && alive,
              shooting: shootPose > 0 && alive,
              aiming: aimPose,
              pitch: camPitch,
              diving: false,
              speed: shownPace,
              ...(aimPose || shootPose > 0 ? locomotionPose(vx, vz, bodyYaw) : {}),
              moving: footMoving && shownPace > 0.05,
              air: alive ? air : "none",
              fighting: false,
              armed: true,
              lingering: false,
              beat: "idle",
              flinch: playerFlinch > 0 && alive,
              react: playerReact,
              melee: playerMelee > 0 ? playerMeleeKind : "none",
              gun,
            },
            playerShotGen,
            animDt,
            gunKick,
            playerFlinchGen,
            playerMeleeGen,
          );
        }
      }
    } else {
      pedBody.instanceMatrix.needsUpdate = true;
      pedHead.instanceMatrix.needsUpdate = true;
      pedHair.instanceMatrix.needsUpdate = true;
      pedLeg.instanceMatrix.needsUpdate = true;
      pedArm.instanceMatrix.needsUpdate = true;
      peds.forEach((p, i) => {
        if (!p.active) {
          m.compose(v.set(0, -10, 0), qid, scale0);
          pedBody.setMatrixAt(i, m);
          pedHead.setMatrixAt(i, m);
          pedHair.setMatrixAt(i, m);
          pedLeg.setMatrixAt(i * 2, m);
          pedLeg.setMatrixAt(i * 2 + 1, m);
          pedArm.setMatrixAt(i * 2, m);
          pedArm.setMatrixAt(i * 2 + 1, m);
          return;
        }
        const lie = p.state === "down" ? p.fall * p.fall * (3 - 2 * p.fall) : 0;
        const crouch = p.state !== "down" && p.dive > 0.2 ? 0.32 : 0;
        q.setFromAxisAngle(up, p.yaw);
        if (lie > 0) {
          q2.setFromAxisAngle(axle, lie * (Math.PI / 2));
          q.multiply(q2);
        }
        const bob = lie > 0 ? 0 : Math.abs(Math.sin(p.bob)) * 0.05;
        const stride = lie > 0 ? 0 : Math.sin(p.bob);
        const baseY = 0.92 * (1 - lie) + 0.16 * lie - crouch + bob + groundY(p.x, p.z);
        v.set(p.x, baseY, p.z);
        m.compose(v, q, scale1);
        pedBody.setMatrixAt(i, m);
        v2.set(0, 0.48, -0.02).applyQuaternion(q);
        v.set(p.x, baseY, p.z).add(v2);
        m.compose(v, q, scale1);
        pedHead.setMatrixAt(i, m);
        v2.set(0, 0.58, -0.04).applyQuaternion(q);
        v.set(p.x, baseY, p.z).add(v2);
        m.compose(v, q, scale1);
        pedHair.setMatrixAt(i, m);
        q2.setFromAxisAngle(axle, stride * 0.7);
        qw.multiplyQuaternions(q, q2);
        v2.set(-0.12, -0.42, 0).applyQuaternion(q);
        v.set(p.x, baseY - 0.08, p.z).add(v2);
        m.compose(v, lie > 0 ? q : qw, scale1);
        pedLeg.setMatrixAt(i * 2, m);
        q2.setFromAxisAngle(axle, -stride * 0.7);
        qw.multiplyQuaternions(q, q2);
        v2.set(0.12, -0.42, 0).applyQuaternion(q);
        v.set(p.x, baseY - 0.08, p.z).add(v2);
        m.compose(v, lie > 0 ? q : qw, scale1);
        pedLeg.setMatrixAt(i * 2 + 1, m);
        q2.setFromAxisAngle(axle, -stride * 0.55);
        qw.multiplyQuaternions(q, q2);
        v2.set(-0.28, 0.02, 0).applyQuaternion(q);
        v.set(p.x, baseY, p.z).add(v2);
        m.compose(v, lie > 0 ? q : qw, scale1);
        pedArm.setMatrixAt(i * 2, m);
        q2.setFromAxisAngle(axle, stride * 0.55);
        qw.multiplyQuaternions(q, q2);
        v2.set(0.28, 0.02, 0).applyQuaternion(q);
        v.set(p.x, baseY, p.z).add(v2);
        m.compose(v, lie > 0 ? q : qw, scale1);
        pedArm.setMatrixAt(i * 2 + 1, m);
      });

      const onFoot = started && !driving && alive;
      aimBlend += ((onFoot && aiming ? 1 : 0) - aimBlend) * (1 - Math.exp(-12 * dtFrame));
      const castShown = castReady && !!playerActor?.root.visible;
      playerGroup.visible = onFoot && !castShown;
      pistolMesh.visible = gun === "pistol";
      shotgunMesh.visible = gun === "shotgun";
      smgMesh.visible = gun === "smg";
      if (onFoot) {
        const pace = Math.hypot(vx, vz);
        const bob = pace > 0.4 ? Math.abs(Math.sin(elapsed * 9)) * 0.035 : 0;
        const stepSwing = pace > 0.4 ? Math.sin(elapsed * (pace > 7 ? 12 : 8)) : 0;
        playerGroup.position.set(px, groundY(px, pz) + bob + py, pz);
        playerGroup.rotation.set(0, bodyYaw, 0);
        const pitch = camPitch;
        rightPivot.rotation.set(
          (0.55 - stepSwing * 0.35) * (1 - aimBlend) + (Math.PI / 2 + pitch) * aimBlend,
          0,
          0.08 * (1 - aimBlend) - 0.08 * aimBlend,
        );
        leftPivot.rotation.set(
          (0.2 + stepSwing * 0.35) * (1 - aimBlend) + (Math.PI / 2 * 0.82 + pitch * 0.5) * aimBlend,
          0,
          -0.06 * (1 - aimBlend) + 0.55 * aimBlend,
        );
        gunRoot.position.set(0, -0.5 + gunKick * 0.16, 0);
        gunRoot.rotation.set(-Math.PI / 2, 0, 0);
      }
    }
    water.position.y = plazaY + 0.9 + Math.sin(elapsed * 1.6) * 0.03;
    jet.scale.y = 0.85 + Math.sin(elapsed * 6) * 0.12;
    jet.position.y = plazaY + 1.55 + jet.scale.y * 0.15;

    pickupMesh.instanceMatrix.needsUpdate = true;
    pickups.forEach((p, i) => {
      const hide = p.wait > 0;
      q.setFromAxisAngle(up, elapsed * 1.4 + i);
      v.set(p.x, hide ? -5 : groundY(p.x, p.z) + 0.85 + Math.sin(elapsed * 3 + i) * 0.08, p.z);
      m.compose(v, q, hide ? scale0 : scale1);
      pickupMesh.setMatrixAt(i, m);
    });

    for (let i = 0; i < MAX_SHOTS; i++) {
      const s = shots[i];
      if (!s) {
        shotMesh.setMatrixAt(i, shotHide);
        continue;
      }
      v.set(s.x2 - s.x, s.y2 - s.y, s.z2 - s.z);
      const len = v.length();
      if (len < 0.05) {
        shotMesh.setMatrixAt(i, shotHide);
        continue;
      }
      v.multiplyScalar(1 / len);
      q.setFromUnitVectors(axleZ, v);
      v2.set((s.x + s.x2) * 0.5, (s.y + s.y2) * 0.5, (s.z + s.z2) * 0.5);
      m.compose(v2, q, shotScale.set(0.045, 0.045, len));
      shotMesh.setMatrixAt(i, m);
    }
    shotMesh.instanceMatrix.needsUpdate = true;

    const car = cars[playerCar]!;
    if (!started) {
      const mobile = canvas.clientWidth < 760;
      camera.position.set(.15, 41.15, mobile ? -5.8 : -2.8);
      camHold.copy(camera.position);
      camera.lookAt(mobile ? -.3 : .78, mobile ? 38.8 : 41.0, 0);
      head.intensity = 0;
    } else {
      const looking = document.pointerLockElement === canvas || rightLook || gLook;
      const yaw = driving ? car.yaw + lookOffset : camYaw;
      const pitch = clamp(driving ? lookPitch : camPitch, -0.85, 0.7);
      const cosP = Math.cos(pitch);
      const fx = -Math.sin(yaw) * cosP;
      const fy = Math.sin(pitch);
      const fz = -Math.cos(yaw) * cosP;
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const originX = driving ? car.x : px;
      const originZ = driving ? car.z : pz;
      const originY = (driving ? 1.2 : 1.5 + py) + groundY(originX, originZ);
      const dist = driving ? 11.6 : 4.35 - aimBlend * 1.35;
      const shoulder = driving ? 0.35 : 0.55 + aimBlend * 0.24;
      const lift = driving ? 2.15 : 0.42 + aimBlend * 0.16;
      const lookAhead = driving ? 7.5 : 22;
      const lx = originX + fx * lookAhead;
      const ly = originY + (driving ? 1.05 : fy * 22);
      const lz = originZ + fz * lookAhead;
      let cx = originX - fx * dist + rx * shoulder;
      let cy = originY - fy * dist + lift;
      let cz = originZ - fz * dist + rz * shoulder;
      const dx = cx - originX;
      const dy = cy - originY;
      const dz = cz - originZ;
      const len = Math.hypot(dx, dy, dz) || 1;
      const hit = trace(originX, originY, originZ, dx / len, dy / len, dz / len, len, driving ? playerCar : -1, -1, false);
      if (hit && hit.kind === "world" && hit.t < len - 0.25) {
        const t = Math.max(0.75, hit.t - 0.35);
        cx = originX + (dx / len) * t;
        cy = originY + (dy / len) * t;
        cz = originZ + (dz / len) * t;
      }
      const sx = Math.sin(elapsed * 73) * shake;
      const sy = Math.cos(elapsed * 57) * shake;
      camHold.lerp(v.set(cx + sx, cy + sy, cz), 1 - Math.exp((driving ? -6.5 : -14) * dtFrame));
      camera.position.copy(camHold);
      camera.lookAt(lx, ly, lz);
      if (driving) camera.rotateZ(clamp(-car.lat * 0.01, -0.1, 0.1));
      const footPace = Math.hypot(vx, vz);
      camera.fov = 62 + (driving ? Math.min(14, Math.abs(car.speed) * 0.32 + Math.abs(car.lat) * 0.6) : footPace > 7 ? 4 : 0);
      camera.updateProjectionMatrix();
      if (driving && car.hp > 0) {
        const nfx = -Math.sin(car.yaw);
        const nfz = -Math.cos(car.yaw);
        const headY = groundY(car.x, car.z);
        head.position.set(car.x + nfx * 2.1, 0.9 + headY, car.z + nfz * 2.1);
        head.target.position.set(car.x + nfx * 16, 0.4 + headY, car.z + nfz * 16);
        head.intensity = 14;
      } else head.intensity = 0;
      if (driving && !looking) {
        lookOffset *= Math.exp(-3.2 * dtFrame);
        lookPitch += (-0.06 - lookPitch) * (1 - Math.exp(-2.4 * dtFrame));
      }
    }
    water.position.y = plazaY + 0.9 + Math.sin(elapsed * 2) * 0.04;
    water.rotation.z = elapsed * 0.35;
    const waterMat = water.material as THREE.MeshStandardMaterial;
    waterMat.emissiveIntensity = 0.55 + Math.sin(elapsed * 3.1) * 0.2;
    lip.scale.setScalar(1 + Math.sin(elapsed * 2.1) * 0.035);
    jet.rotation.y = elapsed * 2.4;
    const bulbMat = bulbMesh.material as THREE.MeshStandardMaterial;
    bulbMat.emissiveIntensity = 4.8 + Math.sin(elapsed * 9) * 0.45;
    const pulse = 0.78 + Math.sin(elapsed * 2.4) * 0.22;
    for (const mesh of signMeshes) {
      (mesh.material as THREE.MeshBasicMaterial).color.setScalar(pulse);
    }
    (amberSign.material as THREE.MeshBasicMaterial).color.setScalar(0.85 + Math.sin(elapsed * 3.2) * 0.15);
    (tealSign.material as THREE.MeshBasicMaterial).color.setScalar(0.85 + Math.sin(elapsed * 2.6 + 1) * 0.15);

    const cycle = elapsed % 10;
    const nsGo = cycle < 4.2;
    const ewGo = cycle >= 5 && cycle < 9.2;
    const amber = !nsGo && !ewGo;
    sigs.forEach((s, i) => {
      const go = s.ns ? nsGo : ewGo;
      tint.setHex(amber ? 0xffb020 : go ? 0x3dff6a : 0xff2a2a);
      sigBulb.setColorAt(i, tint);
    });
    if (sigBulb.instanceColor) sigBulb.instanceColor.needsUpdate = true;

    canopyMesh.instanceMatrix.needsUpdate = true;
    canopy2.instanceMatrix.needsUpdate = true;
    treeSpots.forEach((t, i) => {
      const sway = Math.sin(elapsed * 0.7 + t.x * 0.07) * 0.22;
      m.compose(new THREE.Vector3(t.x + sway, 2.55 + t.y, t.z), qid, new THREE.Vector3(t.s, t.s, t.s));
      canopyMesh.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x + 0.15 + sway * 1.3, 3.35 + t.y, t.z - 0.1), qid, new THREE.Vector3(t.s * 0.85, t.s * 0.9, t.s * 0.85));
      canopy2.setMatrixAt(i, m);
    });

    steamMesh.instanceMatrix.needsUpdate = true;
    vents.forEach((vent, i) => {
      const rise = (elapsed * 0.32 + i * 0.17) % 1;
      const s = 0.25 + rise * 1.15;
      m.compose(new THREE.Vector3(vent.x, groundY(vent.x, vent.z) + 0.35 + rise * 3.4, vent.z), qid, new THREE.Vector3(s, s * 1.5, s));
      steamMesh.setMatrixAt(i, m);
    });

    const meX = started ? (driving ? cars[playerCar]!.x : px) : 0;
    const meZ = started ? (driving ? cars[playerCar]!.z : pz) : 0;
    birdMesh.instanceMatrix.needsUpdate = true;
    birds.forEach((b, i) => {
      const bx = Math.cos(b.ang) * b.r;
      const bz = Math.sin(b.ang * 0.85) * b.r;
      const dist = Math.hypot(bx - meX, bz - meZ);
      b.spook = dist < 16 ? Math.min(1, b.spook + dtFrame * 2.4) : Math.max(0, b.spook - dtFrame * 0.6);
      b.ang += dtFrame * (0.18 + b.spook * 0.7);
      const flap = Math.sin(elapsed * (6 + b.spook * 10) + i) * (0.45 + b.spook * 0.4);
      q.setFromAxisAngle(up, -b.ang);
      q2.setFromAxisAngle(axle, flap);
      qw.multiplyQuaternions(q, q2);
      v.set(Math.cos(b.ang) * b.r, b.y + Math.sin(elapsed * 1.6 + i) * 0.7 + b.spook * 7, Math.sin(b.ang * 0.85) * b.r);
      scaleBody.set(1.15, 0.12, 0.38);
      m.compose(v, qw, scaleBody);
      birdMesh.setMatrixAt(i, m);
    });

    scrapMesh.instanceMatrix.needsUpdate = true;
    scraps.forEach((scrap, i) => {
      const x = ((((scrap.x + elapsed * (3.2 + (i % 3))) % WORLD) + WORLD) % WORLD) - HALF;
      const hop = Math.abs(Math.sin(elapsed * 3.4 + i)) * 0.45;
      q.setFromAxisAngle(axle, elapsed * 2.2 + i);
      const sz = scrap.z + Math.sin(elapsed * 0.8 + i) * 0.6;
      v.set(x, groundY(x, sz) + 0.12 + hop, sz);
      scaleBody.set(scrap.s, scrap.s, scrap.s);
      m.compose(v, q, scaleBody);
      scrapMesh.setMatrixAt(i, m);
    });

    cloudMesh.instanceMatrix.needsUpdate = true;
    clouds.forEach((c, i) => {
      const x = ((((c.x + elapsed * (1.4 + i * 0.35)) % (WORLD + 80)) + WORLD + 80) % (WORLD + 80)) - HALF - 40;
      m.compose(new THREE.Vector3(x, 86 + i * 4, c.z), qid, new THREE.Vector3(c.s, c.s * 0.35, c.s * 0.6));
      cloudMesh.setMatrixAt(i, m);
    });

    const fly = (elapsed * 0.035) % 1;
    craft.position.set(-HALF - 40 + fly * (WORLD + 80), 74, 36);
    craft.rotation.y = Math.PI / 2;
    (nav.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(elapsed * 7) > 0 ? 0xff3030 : 0x3a1010);

    beacon.visible = started && job.active && job.show;
    beacon.position.set(job.bx, 5.2 + groundY(job.bx, job.bz), job.bz);
    beacon.rotation.y = elapsed;
    const showRing = beacon.visible && job.kind !== "shake" && !(job.kind === "deliver" && !job.flag);
    ring.visible = showRing;
    if (showRing) {
      const rx = job.kind === "deliver" ? job.x : job.bx;
      const rz = job.kind === "deliver" ? job.z : job.bz;
      ring.position.set(rx, 0.18 + groundY(rx, rz), rz);
    }

    const showHeli = started && wanted >= 5;
    beam.visible = showHeli;
    heliSpot.intensity = showHeli ? (lit ? 5 : 1.4) : 0;
    if (showHeli) {
      const txh = seenX;
      const tzh = seenZ;
      heliX += (txh - heliX) * (1 - Math.exp(-2.4 * dtFrame));
      heliZ += (tzh - heliZ) * (1 - Math.exp(-2.4 * dtFrame));
      heliSpot.position.set(heliX, 34, heliZ);
      heliSpot.target.position.set(heliX, 0.2 + groundY(heliX, heliZ), heliZ);
      beam.position.set(heliX, 17, heliZ);
      const mat = beam.material as THREE.MeshBasicMaterial;
      mat.opacity = lit ? 0.06 : 0.025;
    }
    flash.visible = flashT > 0;
    if (flash.visible) flash.position.set(flashX, flashY, flashZ);

    smokeMesh.instanceMatrix.needsUpdate = true;
    let puff = 0;
    for (let i = 0; i < cars.length && puff < 24; i++) {
      const car = cars[i]!;
      if (car.hp <= 0 || car.hp > car.maxHp * 0.72) continue;
      const rise = (elapsed * 0.7 + puff * 0.37) % 1;
      const s = 0.35 + rise * 1.3;
      v.set(car.x + Math.sin(elapsed + puff) * 0.35, groundY(car.x, car.z) + 1.1 + rise * 2.4, car.z + Math.cos(elapsed * 0.8 + puff) * 0.35);
      scaleBody.set(s, s, s);
      m.compose(v, qid, scaleBody);
      smokeMesh.setMatrixAt(puff, m);
      puff++;
    }
    for (let i = puff; i < 24; i++) {
      m.compose(v.set(0, -20, 0), qid, scale0);
      smokeMesh.setMatrixAt(i, m);
    }
  }

  let dtFrame = 0;

  function drawMini() {
    const ctx = minimap.getContext("2d");
    if (!ctx) return;
    const S = minimap.width;
    const pad = 18;
    const scale = (S - pad * 2) / WORLD;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = "#0c0e13";
    ctx.fillRect(0, 0, S, S);
    if (inHall) {
      const here = localHall();
      ctx.fillStyle = "#141018";
      ctx.fillRect(0, 0, S, S);
      const hx = (x: number) => pad + ((x + 12) / 24) * (S - pad * 2);
      const hz = (z: number) => pad + (z / 18) * (S - pad * 2);
      ctx.strokeStyle = "#e04090";
      ctx.lineWidth = 2;
      ctx.strokeRect(pad, pad, S - pad * 2, S - pad * 2);
      ctx.font = "700 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const entry of CASINO_FLOOR.entries) {
        ctx.fillStyle = "#f3efe4";
        ctx.beginPath();
        ctx.arc(hx(entry.x), hz(entry.z), 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(entry.label.slice(0, 2).toUpperCase(), hx(entry.x), hz(entry.z) - 10);
      }
      ctx.save();
      ctx.translate(hx(here.x), hz(here.z));
      ctx.rotate(-camYaw);
      ctx.fillStyle = "#ffb020";
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5, 6);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#f3efe4";
      ctx.font = "700 13px sans-serif";
      ctx.fillText("HALL", S / 2, 10);
      return;
    }
    if (roomId) {
      const spec = roomById(roomId);
      if (spec) {
        const here = localRoom();
        ctx.fillStyle = "#141018";
        ctx.fillRect(0, 0, S, S);
        const hx = (x: number) => pad + ((x + spec.width / 2) / spec.width) * (S - pad * 2);
        const hz = (z: number) => pad + (z / spec.depth) * (S - pad * 2);
        ctx.strokeStyle = "#e0b040";
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, pad, S - pad * 2, S - pad * 2);
        ctx.save();
        ctx.translate(hx(here.x), hz(here.z));
        ctx.rotate(-camYaw);
        ctx.fillStyle = "#ffb020";
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(5, 6);
        ctx.lineTo(-5, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#f3efe4";
        ctx.font = "700 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(spec.title.toUpperCase(), S / 2, 10);
        return;
      }
    }
    const project = (x: number, z: number) => ({
      x: pad + (x + HALF) * scale,
      y: pad + (z + HALF) * scale,
    });
    ctx.fillStyle = "#2c3038";
    for (const x of roadXs) {
      const a = project(x - ROAD / 2, -HALF);
      const b = project(x + ROAD / 2, HALF);
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    for (const z of roadZs) {
      const a = project(-HALF, z - ROAD / 2);
      const b = project(HALF, z + ROAD / 2);
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    ctx.fillStyle = "#1a1d24";
    for (const b of staticBlocks) {
      const c0 = project(b.minX, b.minZ);
      const c1 = project(b.maxX, b.minZ);
      const c2 = project(b.maxX, b.maxZ);
      const c3 = project(b.minX, b.maxZ);
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.lineTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(c3.x, c3.y);
      ctx.closePath();
      ctx.fill();
    }
    const lot = project(LOT.x, LOT.z);
    ctx.strokeStyle = "#ffb020";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lot.x - 4, lot.y - 4, 8, 8);
    for (const c of cars) {
      if (c.mode === "player") continue;
      const p = project(c.x, c.z);
      ctx.fillStyle = c.police ? "#e23b3b" : "#f3efe4";
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    for (const p of peds) {
      if (!p.active || p.state === "down") continue;
      const pt = project(p.x, p.z);
      ctx.fillStyle = p.faction === "cop" ? "#e23b3b" : p.faction === "amber" ? "#ffb020" : p.faction === "teal" ? "#3ee0c5" : "#8a8478";
      ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
    }
    ctx.font = "700 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labels: { x: number; y: number }[] = [];
    for (const s of spots) {
      const p = project(s.x, s.z);
      const brand = BRAND[s.id];
      ctx.fillStyle = s.cool > 0 ? "#e23b3b" : (brand?.map ?? "#ffb020");
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      const ownedSpot = deeds.ownedHouses.includes(s.id as HouseId) || deeds.ownedShops.some((shop) => shop.id === s.id);
      if (ownedSpot) {
        ctx.strokeStyle = "#f3efe4";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      let lx = p.x;
      let ly = p.y - 9;
      for (const prev of labels) {
        if (Math.hypot(prev.x - lx, prev.y - ly) < 18) ly += 12;
      }
      labels.push({ x: lx, y: ly });
      const code = brand?.code ?? "•";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#0c0e13";
      ctx.strokeText(code, lx, ly);
      ctx.fillStyle = "#f7f4ee";
      ctx.fillText(code, lx, ly);
    }
    if (job.active && job.show) {
      const p = project(job.bx, job.bz);
      ctx.strokeStyle = "#ffb020";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    const me = started ? playerPos() : { x: 0, z: 0, yaw: 0, speed: 0 };
    const yaw = started ? (driving ? cars[playerCar]!.yaw : camYaw) : 0;
    const meP = project(me.x, me.z);
    ctx.save();
    ctx.translate(meP.x, meP.y);
    ctx.rotate(-yaw);
    ctx.fillStyle = "#ffb020";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#f3efe4";
    ctx.font = "700 13px sans-serif";
    ctx.fillText("N", S / 2, 10);
  }

  const scenePass = pass(scene, camera);
  const sceneColor = scenePass.getTextureNode("output");
  const bloomPass = bloom(sceneColor, qualityHigh ? 0.34 : 0.16, 0.42, 0.74);
  bloomPass.setResolutionScale(qualityHigh ? 0.55 : 0.35);
  const post = new THREE.RenderPipeline(renderer);
  const vignette = smoothstep(float(0.85), float(0.2), length(screenUV.sub(vec2(0.5))));
  post.outputNode = sceneColor.add(bloomPass).mul(mix(float(0.84), float(1), vignette));

  function resize() {
    const w = canvas.clientWidth || window.innerWidth || 1;
    const h = canvas.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function respawn() {
    alive = true;
    phase = started ? "play" : "menu";
    health = 100;
    armor = 20;
    wanted = 0;
    invuln = 2.4;
    driving = false;
    hallHandle?.setOpen(false);
    roomsHandle?.setActive(null);
    inHall = false;
    roomId = null;
    bj = null;
    const house = bestHouse();
    const home = house ? spots.find((s) => s.id === house.id) : undefined;
    if (home) {
      px = home.x;
      pz = home.z + 2;
    } else {
      px = 14;
      pz = -8;
    }
    vx = 0;
    vz = 0;
    py = 0;
    vy = 0;
    air = "none";
    footMoving = false;
    camYaw = Math.PI;
    bodyYaw = Math.PI;
    camPitch = -0.05;
    const safe = resolveCircle(px, pz, 0.45);
    px = safe.x;
    pz = safe.z;
    say("Back on the block", 1.8);
    pushHud();
  }

  function hush() {
    if (audio.engineGain) audio.engineGain.gain.value = 0;
    if (audio.sirenGain) audio.sirenGain.gain.value = 0;
    if (audio.tireGain) audio.tireGain.gain.value = 0;
  }

  function pauseGame() {
    if (!started || !alive || phase !== "play") return;
    phase = "pause";
    pauseSel = 0;
    pauseHold = 0;
    pauseLatch = performance.now();
    keys.clear();
    mouseFire = false;
    rightLook = false;
    gFire = false;
    gAim = false;
    aiming = false;
    document.exitPointerLock?.();
    hush();
    pushHud();
  }

  function resumeGame() {
    if (phase !== "pause") return;
    if (performance.now() - pauseLatch < 280) return;
    phase = "play";
    keys.clear();
    mouseFire = false;
    rightLook = false;
    pauseLatch = performance.now();
    pushHud();
  }

  function movePause(dir: number) {
    pauseSel = (pauseSel + dir + 2) % 2;
    pushHud();
  }

  function confirmPause() {
    if (pauseSel === 0) resumeGame();
    else quitToMenu();
  }

  function navPause(dt: number) {
    const stick = gy > 0.55 ? -1 : gy < -0.55 ? 1 : 0;
    if (!stick) pauseHold = 0;
    else {
      pauseHold -= dt;
      if (pauseHold <= 0) {
        movePause(stick > 0 ? 1 : -1);
        pauseHold = 0.45;
      }
    }
  }

  function quitToMenu() {
    reviewView = null;
    phase = "menu";
    started = false;
    alive = true;
    driving = false;
    hallHandle?.setOpen(false);
    roomsHandle?.setActive(null);
    inHall = false;
    roomId = null;
    wanted = 0;
    clearT = 0;
    mouseFire = false;
    rightLook = false;
    keys.clear();
    const mine = cars[playerCar];
    if (mine) {
      mine.mode = "idle";
      mine.speed = 0;
    }
    for (const c of cars) {
      if (c.mode === "chase" || c.mode === "search" || c.mode === "block" || c.mode === "tail") {
        c.mode = "traffic";
        c.block = false;
      }
    }
    hush();
    pushHud();
  }

  function start() {
    if (started || !castReady) return;
    hallHandle?.setOpen(false);
    roomsHandle?.setActive(null);
    inHall = false;
    roomId = null;
    started = true;
    phase = "play";
    alive = true;
    driving = true;
    const car = cars[playerCar]!;
    car.mode = "player";
    car.x = playerStart.x;
    car.z = playerStart.z;
    car.yaw = 0;
    car.speed = 0;
    lookOffset = 0;
    lookPitch = -0.08;
    audio.ensure();
    say(`${playableById(chosenCharacter).name}: “${playableById(chosenCharacter).quote}”`);
    pushHud();
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) {
      keys.add(e.code);
    } else keys.add(e.code);
    if (e.code === "Escape") {
      e.preventDefault();
      if (phase === "pause") resumeGame();
      else if (phase === "play") pauseGame();
    }
    if (phase === "menu" && !e.repeat && ["ArrowLeft", "ArrowRight"].includes(e.code)) {
      const index = PLAYABLES.findIndex((p) => p.id === chosenCharacter);
      selectCharacter(PLAYABLES[(index + (e.code === "ArrowLeft" ? -1 : 1) + PLAYABLES.length) % PLAYABLES.length]!.id);
    }
    if (phase === "pause") {
      if (e.code === "ArrowDown" || e.code === "KeyS") movePause(1);
      if (e.code === "ArrowUp" || e.code === "KeyW") movePause(-1);
      if (e.code === "Enter" || e.code === "Space") confirmPause();
    }
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };
  function syncPadLive() {
    padLive = padWindowLive({ hidden: document.hidden });
  }
  // Calling getGamepads() in the same turn as a click or a connect event
  // registers this document as the window the browser hands the controller to.
  // Focusing the canvas is skipped for buttons so Start still receives the click,
  // and skipped during pointer lock so the lock stays.
  function claimPadWindow(allowCanvasFocus = true) {
    try {
      window.focus();
    } catch {
      /* ignore */
    }
    const locked = document.pointerLockElement === canvas;
    if (allowCanvasFocus && !locked) {
      canvas.tabIndex = 0;
      try {
        canvas.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
    readGamepads(navigator);
  }
  const onActivate = (e: Event) => {
    padLive = true;
    const target = e.target;
    const tag = target instanceof Element ? target.tagName : "";
    const keepTarget = tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "TEXTAREA";
    claimPadWindow(!keepTarget);
  };
  const onGamepadConnected = (e: GamepadEvent) => {
    padLive = true;
    if (e.gamepad && e.gamepad.index >= 0) padIndex = e.gamepad.index;
    claimPadWindow(true);
  };
  const onGamepadDisconnected = (e: GamepadEvent) => {
    const index = e.gamepad?.index ?? -1;
    if (index >= 0) forgetPadLayout(index);
    if (index === padIndex) {
      padIndex = -1;
      padOn = false;
      padEdge.fill(false);
    }
  };
  const onBlur = () => {
    keys.clear();
    mouseFire = false;
    rightLook = false;
    // Do not drop the controller here. Pointer lock and a pad click blur
    // this window for one turn, and that was throwing the connection away.
    requestAnimationFrame(syncPadLive);
  };
  const onFocus = () => {
    syncPadLive();
    if (padLive) claimPadWindow(document.activeElement === canvas || document.activeElement === document.body);
  };
  const onVis = () => {
    if (document.hidden) {
      keys.clear();
      padLive = false;
      return;
    }
    syncPadLive();
    if (padLive) claimPadWindow(false);
  };
  const onPointerLock = () => {
    if (document.pointerLockElement === canvas) {
      padLive = true;
      claimPadWindow(false);
      return;
    }
    syncPadLive();
    if (phase === "play" && !(liveDesk && liveDesk.kind !== "jobs" && liveDesk.kind !== "mug")) pauseGame();
  };
  const onMouseDown = (e: PointerEvent) => {
    if (!started || phase !== "play") return;
    if (e.button === 2) {
      rightLook = true;
      return;
    }
    if (e.button !== 0) return;
    if (liveDesk && liveDesk.kind !== "jobs" && liveDesk.kind !== "mug") return;
    if (document.pointerLockElement === canvas || matchMedia("(pointer: coarse)").matches) mouseFire = true;
    else canvas.requestPointerLock?.();
  };
  const onMouseUp = (e: PointerEvent) => {
    if (e.button === 2) rightLook = false;
    mouseFire = false;
  };
  const onMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== canvas && !rightLook) return;
    const sens = 0.0024;
    if (driving) {
      lookOffset -= e.movementX * sens;
      lookPitch -= e.movementY * sens;
      lookOffset = clamp(lookOffset, -1.2, 1.2);
      lookPitch = clamp(lookPitch, -0.65, 0.45);
    } else {
      camYaw -= e.movementX * sens;
      camPitch -= e.movementY * sens;
      camPitch = clamp(camPitch, -0.95, 1.05);
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  window.addEventListener("pointerdown", onActivate, true);
  window.addEventListener("touchstart", onActivate, true);
  window.addEventListener("gamepadconnected", onGamepadConnected);
  window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
  document.addEventListener("visibilitychange", onVis);
  document.addEventListener("pointerlockchange", onPointerLock);
  canvas.addEventListener("pointerdown", onMouseDown);
  window.addEventListener("pointerup", onMouseUp);
  document.addEventListener("mousemove", onMove);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  window.__controlsTest = {
    getYaw: () => (driving ? cars[playerCar]!.yaw : camYaw),
    getBodyYaw: () => bodyYaw,
    getHeight: () => py,
    getSpeed: () => {
      if (!started) return 0;
      if (driving) return cars[playerCar]!.speed;
      return Math.hypot(vx, vz);
    },
    getPhase: () => phase,
    setKeys: (codes: string[]) => {
      injected.clear();
      steerOverride = null;
      for (const code of codes) injected.add(code);
    },
    setSteer: (v: number) => {
      steerOverride = v;
    },
  };

  window.__brookriver = {
    snap: () => ({
      driving,
      speed: driving ? cars[playerCar]!.speed : Math.hypot(vx, vz),
      yaw: driving ? cars[playerCar]!.yaw : camYaw,
      wanted,
      health,
      cash,
      bank: bankBal,
      loot,
      x: driving ? cars[playerCar]!.x : px,
      z: driving ? cars[playerCar]!.z : pz,
      down: peds.filter((p) => p.state === "down").length,
      alive: peds.filter((p) => p.active && p.state !== "down").length,
      phase,
      job: job.active ? `${job.kind}:${Math.ceil(job.t)}` : `wait:${job.cool.toFixed(1)}:${job.next}`,
      idle: cars.filter((c) => (c.mode === "idle" || c.mode === "coast") && c.hp >= 60 && !c.forSale && !c.police).length,
    }),
    exit: () => {
      if (driving) tryUse();
    },
    enter: () => {
      if (!driving) tryUse();
    },
    fire: () => playerShoot(true),
    dummy: () => {
      const e = eye();
      const flatYaw = driving ? cars[playerCar]!.yaw : camYaw;
      const fx = -Math.sin(flatYaw);
      const fz = -Math.cos(flatYaw);
      const ped = peds.find((p) => p.faction === "teal")!;
      ped.active = true;
      ped.state = "walk";
      ped.hp = 100;
      ped.x = (driving ? cars[playerCar]!.x : px) + fx * 7;
      ped.z = (driving ? cars[playerCar]!.z : pz) + fz * 7;
      if (driving) {
        lookOffset = 0;
        lookPitch = 0;
      } else camPitch = 0;
      void e;
    },
    books: () => ({ cash: Math.floor(cash), bank: Math.floor(bankBal), loot: Math.floor(loot) }),
    goto: (id: string) => {
      const s = spots.find((sp) => sp.id === id);
      if (!s) return false;
      if (inHall) exitHall();
      if (roomId) exitRoom();
      if (driving) tryUse();
      driving = false;
      inHall = false;
      roomId = null;
      const car = cars[playerCar];
      if (car && car.mode === "player") car.mode = "idle";
      px = s.x;
      pz = s.z + 1.6;
      const safe = resolveCircle(px, pz, 0.45);
      px = safe.x;
      pz = safe.z;
      vx = 0;
      vz = 0;
      return true;
    },
    pump: () => {
      if (!channel) return false;
      channel.left = 0;
      return true;
    },
    buy: (id: string) => buySpend(id),
    hold: () => ({
      tunes: hold.tunes,
      house: hold.house,
      lux: hold.lux,
      biz: hold.biz,
      packs: hold.packs,
      invite: hold.invite,
      crew: Math.ceil(hold.crewT),
      tape: tapeValue(),
    }),
    pad: (n: number) => {
      cash = Math.max(0, Math.floor(cash + n));
      noteWorth();
      return Math.floor(cash);
    },
  };

  const textState = () => ({
    coordinates: "meters; +Y up; yaw 0 faces -Z; +yaw turns left",
    ...window.__brookriver!.snap(),
    ready: { city: !!cityHandle, cast: castReady, fleet: !!fleet, renderer: gpuReady },
    character: { id: chosenCharacter, name: playableById(chosenCharacter).name, brand: playableById(chosenCharacter).brand, model: playerActor?.root.name, profile: playerActor?.profile.id, preview: !started },
    player: { x: driving ? cars[playerCar]!.x : px, y: driving ? groundY(cars[playerCar]!.x, cars[playerCar]!.z) : groundY(px, pz) + py, z: driving ? cars[playerCar]!.z : pz, bodyYaw, clip: playerActor?.intent, legTurn: playerActor?.legTurn, air, reload: reloadT, melee: playerMelee, contact: playerContact, ammo: ammo[gun].mag },
    nearby: peds.map((p, i) => ({ x: p.x, z: p.z, hp: p.hp, faction: p.faction, active: p.active, state: p.state, look: pedActors[i]?.root.name, identity: pedActors[i]?.profile, clip: pedActors[i]?.intent })).filter((p) => p.active && Math.hypot(p.x - (driving ? cars[playerCar]!.x : px), p.z - (driving ? cars[playerCar]!.z : pz)) < 18),
  });
  window.render_game_to_text = () => JSON.stringify(textState());
  let manualTime = false;
  let manualElapsed = 0;
  let reviewView: number[] | null = null;
  const reviewCamera = () => {
    if (reviewView) {
      camera.position.set(reviewView[0]!, reviewView[1]!, reviewView[2]!);
      camera.lookAt(reviewView[3]!, reviewView[4]!, reviewView[5]!);
    }
  };
  window.advanceTime = (ms: number) => {
    manualTime = true;
    const count = Math.max(1, Math.min(600, Math.round(ms / (1000 / 60))));
    dtFrame = 1 / 60;
    for (let n = 0; n < count; n++) {
      step(dtFrame);
      manualElapsed += dtFrame;
      syncWorld(manualElapsed);
      if (phase !== "pause") hallHandle?.tick(dtFrame);
    }
    reviewCamera();
    drawMini();
    if (gpuReady) post.render();
    pushHud();
  };
  if (new URLSearchParams(location.search).has("qa")) window.__brookriverReview = {
    pose(x, z, yaw = 0) {
      if (inHall) exitHall();
      if (roomId) exitRoom();
      driving = false; started = true; phase = "play"; alive = true;
      cars[playerCar]!.mode = "idle";
      px = x; pz = z; py = 0; vx = 0; vz = 0; camYaw = bodyYaw = yaw;
      liveDesk = null;
    },
    camera(x, y, z, tx, ty, tz) { reviewView = [x, y, z, tx, ty, tz]; reviewCamera(); },
    crowd(start = 0) {
      peds.forEach((p, i) => {
        p.active = i >= start && i < start + 12; p.state = "walk"; p.hp = 100; p.linger = 100; p.beat = "idle";
        p.x = -14 + ((i - start) % 6) * 2.7; p.z = -12 + Math.floor((i - start) / 6) * 3; p.yaw = Math.PI;
        p.prevX = p.x; p.prevZ = p.z; p.goals = [{ x: p.x, z: p.z }]; p.goal = 0; p.linger = 0.1; p.lingerFor = 1000;
      });
    },
    melee() {
      peds.forEach((p) => { p.active = false; });
      const p = peds[0]!;
      p.active = true; p.state = "walk"; p.hp = 100; p.x = px; p.z = pz - 1.5; p.linger = 100;
      p.prevX = p.x; p.prevZ = p.z; p.goals = [{ x: p.x, z: p.z }]; p.goal = 0; p.linger = 0.1; p.lingerFor = 1000;
    },
  };

  let freezeClock = false;
  let frozenAt = 0;
  let acc = 0;
  const loop = () => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    if (manualTime) return;
    timer.update();
    dtFrame = Math.min(timer.getDelta(), 0.05);
    acc += dtFrame;
    const stepDt = 1 / 60;
    let guard = 0;
    while (acc >= stepDt && guard < 4) {
      step(stepDt);
      acc -= stepDt;
      guard++;
    }
    if (guard === 4) acc = 0;
    if (phase === "pause") {
      if (!freezeClock) {
        freezeClock = true;
        frozenAt = timer.getElapsed();
      }
    } else freezeClock = false;
    syncWorld(freezeClock ? frozenAt : timer.getElapsed());
    if (qualityHigh) {
      const focus = driving ? cars[playerCar] : null;
      const sx = focus ? focus.x : px;
      const sz = focus ? focus.z : pz;
      moon.position.set(sx - 46, 78, sz - 20);
      moon.target.position.set(sx, 0, sz);
    }
    if (phase !== "pause") hallHandle?.tick(dtFrame);
    drawMini();
    reviewCamera();
    if (gpuReady) post.render();
    hudAcc += dtFrame;
    if (hudAcc > 0.12) {
      hudAcc = 0;
      pushHud();
    }
  };
  noteWorth();
  pushHud();
  raf = requestAnimationFrame(loop);

  return {
    touch,
    selectCharacter,
    previewCharacter(action) { if (phase !== "menu") return; if (action === "turn") previewYaw += Math.PI / 2; else previewWalk = !previewWalk; },
    start,
    respawn,
    resume: resumeGame,
    quit: quitToMenu,
    focusPause: (index: number) => {
      pauseSel = index === 1 ? 1 : 0;
      pushHud();
    },
    command(cmd: UiCmd) {
      uiCmds.push(cmd);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      timer.disconnect();
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pointerdown", onActivate, true);
      window.removeEventListener("touchstart", onActivate, true);
      window.removeEventListener("gamepadconnected", onGamepadConnected);
      window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("pointerlockchange", onPointerLock);
      canvas.removeEventListener("pointerdown", onMouseDown);
      window.removeEventListener("pointerup", onMouseUp);
      document.removeEventListener("mousemove", onMove);
      if (audio.ctx) void audio.ctx.close();
      pavingGeo.dispose();
      pavingMat.dispose();
      post.dispose();
      renderer.dispose();
      if (window.__controlsTest) delete window.__controlsTest;
      if (window.__brookriver) delete window.__brookriver;
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.__brookriverReview;
      castReady = false;
      for (const actor of pedActors) actor.root.removeFromParent();
      for (const actor of playableActors.values()) actor.root.removeFromParent();
      for (const mesh of [studioFloor, studioBackdrop, studioGround]) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
      studio.removeFromParent();
      pedActors = [];
      playerActor = null;
      if (castLib) {
        disposeCast(castLib);
        castLib = null;
      }
      cityHandle?.dispose();
      cityHandle = null;
      dressingHandle?.dispose();
      dressingHandle = null;
      hallHandle?.dispose();
      hallHandle = null;
      roomsHandle?.dispose();
      roomsHandle = null;
      fleet?.dispose();
      fleet = null;
      if (!cacheWasEnabled) {
        THREE.Cache.clear();
        THREE.Cache.enabled = false;
      }
    },
  };
}
