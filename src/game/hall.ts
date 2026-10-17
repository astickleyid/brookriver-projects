import * as THREE from "three/webgpu";
import {
  CASINO_FLOOR,
  EUROPEAN_WHEEL,
  RED_NUMBERS,
  type BaccaratResult,
  type CasinoGame,
  type BlackjackState,
  type Card,
  type CrapsResult,
  type RouletteResult,
  type SlotSymbol,
  type SlotsResult,
} from "./casino.ts";
import { CARD_EULER, casinoStationLocal, FACE_PLAYER_Y, pocketOffset, wheelYaw } from "./room-layout.ts";

/**
 * Walk-in Dice Hall. The street spot stays where it is.
 * The room sits outside the 250 m city so the door is a move, not a new block.
 * Tables, the wheel, and the slot cabinets are original three.js geometry.
 * No free pack had a roulette wheel or a slot machine.
 */

export const HALL_ORIGIN = { x: 400, z: 400 };

type HallBox = { minX: number; maxX: number; minZ: number; maxZ: number; h: number };

const FELT: Record<string, number> = {
  blackjack: 0x1c6b45,
  roulette: 0x6a1830,
  craps: 0x1a6b48,
  baccarat: 0x1a3058,
  slots: 0xc4a15a,
  cage: 0x8a7040,
};

const RED = new Set<number>(RED_NUMBERS);

function shift(box: { minX: number; maxX: number; minZ: number; maxZ: number; h: number }): HallBox {
  return {
    minX: HALL_ORIGIN.x + box.minX,
    maxX: HALL_ORIGIN.x + box.maxX,
    minZ: HALL_ORIGIN.z + box.minZ,
    maxZ: HALL_ORIGIN.z + box.maxZ,
    h: box.h,
  };
}

/** World-space walls. The south gap is the street door. Station columns match the furniture. */
export function hallWalls(): HallBox[] {
  const shell = [
    shift({ minX: -12.4, maxX: -11.2, minZ: -0.4, maxZ: 18.3, h: 5 }),
    shift({ minX: 11.2, maxX: 12.4, minZ: -0.4, maxZ: 18.3, h: 5 }),
    shift({ minX: -12.4, maxX: 12.4, minZ: 17.2, maxZ: 18.4, h: 5 }),
    shift({ minX: -12.4, maxX: -1.7, minZ: -0.5, maxZ: 0.55, h: 5 }),
    shift({ minX: 1.7, maxX: 12.4, minZ: -0.5, maxZ: 0.55, h: 5 }),
  ];
  for (const entry of CASINO_FLOOR.entries) shell.push(shift(casinoStationLocal(entry.game, entry.x, entry.z)));
  return shell;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cardKey(card: Card, hidden: boolean) {
  return hidden ? "back" : `${card.rank}${card.suit}`;
}

export type HallHandle = {
  dispose: () => void;
  tick: (dt: number) => void;
  setOpen: (open: boolean) => void;
  showBlackjack: (state: BlackjackState) => void;
  showRoulette: (result: RouletteResult) => void;
  showSlots: (id: string, result: SlotsResult) => void;
  showCraps: (result: CrapsResult) => void;
  showBaccarat: (result: BaccaratResult) => void;
};

type Reel = { mesh: THREE.Mesh; stop: number; symbol: SlotSymbol; elapsed: number; spinning: boolean };
type Die = { mesh: THREE.Mesh; top: THREE.MeshBasicMaterial };

export function mountHall(scene: THREE.Scene): HallHandle {
  const root = new THREE.Group();
  root.position.set(HALL_ORIGIN.x, 0, HALL_ORIGIN.z);
  root.visible = false;
  scene.add(root);
  const owned: THREE.BufferGeometry[] = [];
  const ownedMat: THREE.Material[] = [];
  const std = (color: number, roughness: number, emissive = 0x000000, emissiveIntensity = 0) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08, emissive, emissiveIntensity });
    ownedMat.push(mat);
    return mat;
  };
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    root.add(mesh);
    owned.push(geo);
    return mesh;
  };

  const floor = add(new THREE.BoxGeometry(24, 0.2, 18), std(0x14161c, 0.84), 0, -0.1, 9);
  floor.receiveShadow = true;
  const wallMat = std(0x1a1420, 0.78);
  const shell: Array<[number, number, number, number, number, number]> = [
    [-11.8, 2.5, 9, 0.5, 5, 18.4],
    [11.8, 2.5, 9, 0.5, 5, 18.4],
    [0, 2.5, 17.8, 24, 5, 0.5],
    [-7, 2.5, 0.05, 10.6, 5, 0.5],
    [7, 2.5, 0.05, 10.6, 5, 0.5],
  ];
  for (const [x, y, z, sx, sy, sz] of shell) add(new THREE.BoxGeometry(sx, sy, sz), wallMat, x, y, z);
  add(new THREE.BoxGeometry(24, 0.2, 18), std(0x100e14, 0.9, 0x3a1830, 0.12), 0, 4.9, 9);
  const marquee = canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = "#1a0a14";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ff4f9a";
    g.font = "700 64px Impact, Arial Narrow, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("DICE HALL", w / 2, h / 2);
  });
  const sign = add(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: marquee }), 0, 3.2, 17.45);
  sign.rotation.y = FACE_PLAYER_Y;
  ownedMat.push(sign.material as THREE.Material);

  const wood = std(0x5c3d2e, 0.62, 0x3a2418, 0.15);
  const cardMat = new Map<string, THREE.MeshBasicMaterial>();
  const face = (key: string, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
    let mat = cardMat.get(key);
    if (mat) return mat;
    const tex = canvasTex(128, 176, paint);
    mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    cardMat.set(key, mat);
    ownedMat.push(mat);
    return mat;
  };
  const playingCard = (key: string) =>
    face(key, (g, w, h) => {
      const hidden = key === "back";
      g.fillStyle = hidden ? "#8a1e2a" : "#f4efe4";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = hidden ? "#e8c4c4" : "#1a140e";
      g.lineWidth = 6;
      g.strokeRect(6, 6, w - 12, h - 12);
      g.textAlign = "center";
      g.textBaseline = "middle";
      if (hidden) {
        g.fillStyle = "#e8c4c4";
        g.font = "700 72px sans-serif";
        g.fillText("B", w / 2, h / 2);
        return;
      }
      const suit = key.slice(-1);
      const rank = key.slice(0, -1);
      const red = suit === "H" || suit === "D";
      const pip = suit === "H" ? "♥" : suit === "D" ? "♦" : suit === "C" ? "♣" : "♠";
      g.fillStyle = red ? "#b4232a" : "#16141c";
      g.font = "700 52px sans-serif";
      g.fillText(rank, w / 2, h / 2 - 24);
      g.font = "48px sans-serif";
      g.fillText(pip, w / 2, h / 2 + 36);
    });
  const rankCard = (rank: string, side: "player" | "banker") =>
    face(`${side}:${rank}`, (g, w, h) => {
      g.fillStyle = side === "player" ? "#f4efe4" : "#d7e4f4";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#1a140e";
      g.lineWidth = 6;
      g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = "#16141c";
      g.font = "700 64px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(rank, w / 2, h / 2);
    });

  const lay = (mesh: THREE.Mesh) => {
    mesh.rotation.set(CARD_EULER.x, CARD_EULER.y, CARD_EULER.z);
  };
  const cardPool = (n: number) => {
    const meshes: THREE.Mesh[] = [];
    const geo = new THREE.PlaneGeometry(0.2, 0.28);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, playingCard("back"));
      lay(mesh);
      mesh.visible = false;
      root.add(mesh);
      meshes.push(mesh);
    }
    owned.push(geo);
    return meshes;
  };
  const bjCards = cardPool(24);
  const bacCards = cardPool(8);

  const placeRow = (pool: THREE.Mesh[], start: number, cards: readonly { key: string }[], x: number, z: number, y: number) => {
    cards.forEach((card, i) => {
      const mesh = pool[start + i];
      if (!mesh) return;
      mesh.visible = true;
      mesh.material = card.key.startsWith("player:") || card.key.startsWith("banker:") ? rankCard(card.key.split(":")[1] ?? "", card.key.startsWith("player") ? "player" : "banker") : playingCard(card.key);
      mesh.position.set(x + (i - (cards.length - 1) / 2) * 0.24, y, z);
      lay(mesh);
    });
  };

  const bannerMatCache = new Map<string, THREE.MeshBasicMaterial>();
  const bannerMat = (key: string, text: string, win: boolean) => {
    const cached = bannerMatCache.get(key);
    if (cached) return cached;
    const tex = canvasTex(512, 96, (g, w, h) => {
      g.fillStyle = win ? "#14301c" : "#2a1214";
      g.fillRect(0, 0, w, h);
      g.fillStyle = win ? "#b6f0c2" : "#f0c2c2";
      g.font = "700 42px Impact, Arial Narrow, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text.slice(0, 22), w / 2, h / 2);
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    bannerMatCache.set(key, mat);
    ownedMat.push(mat);
    return mat;
  };

  const feltTop = (game: CasinoGame, x: number, z: number) => {
    const box = casinoStationLocal(game, x, z);
    const w = box.maxX - box.minX;
    const d = box.maxZ - box.minZ;
    const color = FELT[game] ?? 0x1c6b45;
    const body = add(new THREE.BoxGeometry(w, 0.9, d), wood, (box.minX + box.maxX) / 2, 0.45, (box.minZ + box.maxZ) / 2);
    add(new THREE.BoxGeometry(w * 0.9, 0.04, d * 0.82), std(color, 0.5, color, 0.32), body.position.x, 0.92, body.position.z);
    return { x: body.position.x, z: body.position.z, y: 0.96 };
  };

  const bj = feltTop("blackjack", -6, 6);
  const rouletteTop = feltTop("roulette", 6, 6);
  const crapsTop = feltTop("craps", -6, 12);
  const bac = feltTop("baccarat", 6, 12);

  const wheel = new THREE.Group();
  wheel.position.set(rouletteTop.x, 1.02, rouletteTop.z + 0.12);
  root.add(wheel);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.12, 37), std(0x1a120c, 0.45, 0x3a2418, 0.2));
  wheel.add(bowl);
  owned.push(bowl.geometry);
  const pocketGeo = new THREE.BoxGeometry(0.07, 0.05, 0.12);
  owned.push(pocketGeo);
  const redMat = std(0x9a1c28, 0.4, 0x9a1c28, 0.45);
  const blackMat = std(0x141418, 0.4, 0x2a2a30, 0.3);
  const greenMat = std(0x1c6b3a, 0.4, 0x1c6b3a, 0.45);
  EUROPEAN_WHEEL.forEach((pocket, index) => {
    const at = pocketOffset(index);
    const mesh = new THREE.Mesh(pocketGeo, pocket === 0 ? greenMat : RED.has(pocket) ? redMat : blackMat);
    mesh.position.set(at.x * 0.5, 0.08, at.z * 0.5);
    mesh.rotation.y = wheelYaw(index);
    wheel.add(mesh);
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf4efe4 }));
  root.add(ball);
  owned.push(ball.geometry);
  ownedMat.push(ball.material as THREE.Material);
  const pocketPlate = add(new THREE.PlaneGeometry(0.7, 0.36), bannerMat("pocket:•", "•", true), rouletteTop.x, 1.45, rouletteTop.z - 0.72);
  pocketPlate.rotation.y = FACE_PLAYER_Y;

  const symbolMat = new Map<SlotSymbol, THREE.MeshBasicMaterial>();
  const symbolPaint: Record<SlotSymbol, (g: CanvasRenderingContext2D, w: number, h: number) => void> = {
    bar: (g, w, h) => {
      g.fillStyle = "#1a140c";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#f0d070";
      g.fillRect(16, h / 2 - 22, w - 32, 44);
      g.fillStyle = "#1a140c";
      g.font = "700 36px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("BAR", w / 2, h / 2);
    },
    seven: (g, w, h) => {
      g.fillStyle = "#1a0a10";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#ff4f6a";
      g.font = "700 84px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("7", w / 2, h / 2);
    },
    cherry: (g, w, h) => {
      g.fillStyle = "#1a0c10";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#e0233a";
      g.beginPath();
      g.arc(w * 0.38, h * 0.58, 28, 0, Math.PI * 2);
      g.arc(w * 0.62, h * 0.58, 28, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#3a8a3a";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(w * 0.45, h * 0.4);
      g.lineTo(w * 0.5, h * 0.18);
      g.stroke();
    },
    bell: (g, w, h) => {
      g.fillStyle = "#1a140c";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#f0d070";
      g.beginPath();
      g.arc(w / 2, h * 0.62, 40, Math.PI, 0);
      g.lineTo(w / 2 + 40, h * 0.78);
      g.lineTo(w / 2 - 40, h * 0.78);
      g.fill();
    },
    gem: (g, w, h) => {
      g.fillStyle = "#10141c";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#49c2e0";
      g.beginPath();
      g.moveTo(w / 2, h * 0.16);
      g.lineTo(w * 0.78, h * 0.42);
      g.lineTo(w / 2, h * 0.84);
      g.lineTo(w * 0.22, h * 0.42);
      g.fill();
    },
    coin: (g, w, h) => {
      g.fillStyle = "#1a140c";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#e6c15a";
      g.beginPath();
      g.arc(w / 2, h / 2, 42, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#3a2c10";
      g.font = "700 48px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("$", w / 2, h / 2);
    },
  };
  const symbolMaterial = (symbol: SlotSymbol) => {
    let mat = symbolMat.get(symbol);
    if (mat) return mat;
    const tex = canvasTex(160, 160, symbolPaint[symbol]);
    mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    symbolMat.set(symbol, mat);
    ownedMat.push(mat);
    return mat;
  };
  const slotMachines = new Map<string, { reels: Reel[]; banner: THREE.Mesh }>();
  for (const [id, x] of [["slot-l", -6], ["slot-m", 0], ["slot-r", 6]] as const) {
    const box = casinoStationLocal("slots", x, 16);
    const cx = (box.minX + box.maxX) / 2;
    const cz = (box.minZ + box.maxZ) / 2;
    const body = std(0x1a120c, 0.5, 0xc4a15a, 0.2);
    add(new THREE.BoxGeometry(0.8, 0.28, 0.6), body, cx, 0.14, cz);
    add(new THREE.BoxGeometry(0.12, 1.35, 0.5), body, box.minX + 0.08, 0.95, cz + 0.04);
    add(new THREE.BoxGeometry(0.12, 1.35, 0.5), body, box.maxX - 0.08, 0.95, cz + 0.04);
    add(new THREE.BoxGeometry(0.8, 0.22, 0.5), body, cx, 1.55, cz + 0.04);
    add(new THREE.BoxGeometry(0.56, 1.15, 0.08), std(0x100c0a, 0.6), cx, 0.95, box.maxZ - 0.06);
    const lamp = canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = "#3a2208";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#f0d070";
      g.font = "700 36px Impact, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("SLOTS", w / 2, h / 2);
    });
    const lampMesh = add(new THREE.PlaneGeometry(0.7, 0.18), new THREE.MeshBasicMaterial({ map: lamp }), cx, 1.62, box.minZ - 0.01);
    lampMesh.rotation.y = FACE_PLAYER_Y;
    ownedMat.push(lampMesh.material as THREE.Material);
    const reels: Reel[] = [];
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22), symbolMaterial("bar"));
      mesh.position.set(cx + (i - 1) * 0.18, 1.05, box.minZ - 0.02);
      mesh.rotation.y = FACE_PLAYER_Y;
      root.add(mesh);
      owned.push(mesh.geometry);
      reels.push({ mesh, stop: 0, symbol: "bar", elapsed: 0, spinning: false });
    }
    const banner = add(new THREE.PlaneGeometry(0.7, 0.16), bannerMat(`${id}:ready`, "PULL", true), cx, 1.32, box.minZ - 0.02);
    banner.rotation.y = FACE_PLAYER_Y;
    slotMachines.set(id, { reels, banner });
  }

  const dieSide = new THREE.MeshBasicMaterial({ color: 0xf4efe4 });
  ownedMat.push(dieSide);
  const pipMat = (n: number) => {
    const tex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = "#f4efe4";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#1a140e";
      const spots: Record<number, Array<[number, number]>> = {
        1: [[0.5, 0.5]],
        2: [[0.28, 0.28], [0.72, 0.72]],
        3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
        4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
        5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
        6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
      };
      for (const [px, py] of spots[n] ?? spots[1]!) {
        g.beginPath();
        g.arc(px! * w, py! * h, 10, 0, Math.PI * 2);
        g.fill();
      }
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    ownedMat.push(mat);
    return mat;
  };
  const faces = [1, 2, 3, 4, 5, 6].map((n) => pipMat(n));
  const dice: Die[] = [];
  for (let i = 0; i < 2; i++) {
    const top = faces[0]!.clone();
    ownedMat.push(top);
    const mats = [dieSide, dieSide, top, dieSide, dieSide, dieSide];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), mats);
    mesh.position.set(crapsTop.x + (i === 0 ? -0.16 : 0.16), 1.08, crapsTop.z - 0.1);
    root.add(mesh);
    owned.push(mesh.geometry);
    dice.push({ mesh, top });
  }
  const crapsBanner = add(new THREE.PlaneGeometry(1.2, 0.22), bannerMat("craps:ready", "PASS", true), crapsTop.x, 1.4, crapsTop.z - 0.7);
  crapsBanner.rotation.y = FACE_PLAYER_Y;

  const cageBox = casinoStationLocal("cage", 0, 3);
  const cage = add(
    new THREE.BoxGeometry(cageBox.maxX - cageBox.minX, 1.15, cageBox.maxZ - cageBox.minZ),
    std(0x6a5430, 0.5, 0x8a7040, 0.22),
    (cageBox.minX + cageBox.maxX) / 2,
    0.58,
    (cageBox.minZ + cageBox.maxZ) / 2,
  );
  for (let i = 0; i < 7; i++) {
    const bar = add(new THREE.BoxGeometry(0.04, 0.7, 0.04), std(0xd8c090, 0.35, 0xd8c090, 0.25), cageBox.minX + 0.4 + i * 0.45, 1.15, cageBox.minZ);
    void bar;
  }
  const cageSign = add(new THREE.PlaneGeometry(1.4, 0.32), bannerMat("cage", "CAGE", true), cage.position.x, 1.55, cageBox.minZ - 0.02);
  cageSign.rotation.y = FACE_PLAYER_Y;

  const bjBanner = add(new THREE.PlaneGeometry(1.4, 0.24), bannerMat("bj:ready", "BLACKJACK", true), bj.x, 1.45, bj.z - 0.78);
  bjBanner.rotation.y = FACE_PLAYER_Y;
  const bacBanner = add(new THREE.PlaneGeometry(1.4, 0.24), bannerMat("bac:ready", "BACCARAT", true), bac.x, 1.45, bac.z - 0.78);
  bacBanner.rotation.y = FACE_PLAYER_Y;

  let wheelAnim: { t: number; dur: number; y0: number; y1: number; ball0: number } | null = null;
  let crapsAnim: { t: number; rolls: CrapsResult["rolls"]; step: number } | null = null;

  const setBanner = (mesh: THREE.Mesh, key: string, text: string, win: boolean) => {
    mesh.material = bannerMat(`${key}:${text}:${win ? 1 : 0}`, text, win);
  };
  const showDie = (die: Die, value: number) => {
    const src = faces[Math.max(0, Math.min(5, value - 1))]!;
    die.top.map = src.map;
    die.top.needsUpdate = true;
    die.mesh.rotation.set(0, 0, 0);
  };

  return {
    setOpen(open) {
      root.visible = open;
    },
    showBlackjack(state) {
      for (const mesh of bjCards) mesh.visible = false;
      const dealer = state.dealer.map((card, index) => ({ key: cardKey(card, index === 1 && state.holeHidden) }));
      placeRow(bjCards, 0, dealer, bj.x, bj.z + 0.28, bj.y);
      let cursor = dealer.length;
      state.hands.forEach((hand, hi) => {
        const x = state.split ? bj.x + (hi === 0 ? -0.42 : 0.42) : bj.x;
        const row = hand.cards.map((card) => ({ key: cardKey(card, false) }));
        placeRow(bjCards, cursor, row, x, bj.z - 0.28, bj.y);
        cursor += row.length;
      });
      const done = state.phase === "done";
      setBanner(bjBanner, "bj", done ? state.log : "DEAL", (state.payout ?? 0) > 0);
    },
    showRoulette(result) {
      const index = Math.max(0, EUROPEAN_WHEEL.indexOf(result.pocket as (typeof EUROPEAN_WHEEL)[number]));
      const target = wheelYaw(index);
      const y0 = wheel.rotation.y;
      let y1 = y0 + Math.PI * 8;
      const tau = Math.PI * 2;
      const mod = (n: number) => ((n % tau) + tau) % tau;
      y1 += mod(target) - mod(y1);
      if (y1 <= y0) y1 += tau;
      wheelAnim = { t: 0, dur: 1.7, y0, y1, ball0: Math.random() * tau };
      setBanner(pocketPlate, "pocket", `${result.pocket} ${result.color.toUpperCase()}`, result.win);
    },
    showSlots(id, result) {
      const machine = slotMachines.get(id);
      if (!machine) return;
      machine.reels.forEach((reel, i) => {
        reel.symbol = result.reels[i] ?? "bar";
        reel.elapsed = 0;
        reel.stop = 0.65 + i * 0.35;
        reel.spinning = true;
        reel.mesh.material = symbolMaterial(reel.symbol);
      });
      const win = result.multiplier > 0;
      setBanner(machine.banner, id, win ? `${result.multiplier}X` : "LOSE", win);
    },
    showCraps(result) {
      crapsAnim = { t: 0, rolls: result.rolls, step: 0 };
      const last = result.rolls[result.rolls.length - 1];
      if (last) {
        showDie(dice[0]!, last.d1);
        showDie(dice[1]!, last.d2);
      }
      setBanner(crapsBanner, "craps", result.outcome === "win" ? "PASS" : "SEVEN OUT", result.outcome === "win");
    },
    showBaccarat(result) {
      for (const mesh of bacCards) mesh.visible = false;
      placeRow(bacCards, 0, result.banker.map((rank) => ({ key: `banker:${rank}` })), bac.x, bac.z + 0.28, bac.y);
      placeRow(bacCards, result.banker.length, result.player.map((rank) => ({ key: `player:${rank}` })), bac.x, bac.z - 0.28, bac.y);
      setBanner(bacBanner, "bac", result.outcome === "win" ? "WIN" : result.outcome === "push" ? "PUSH" : "LOSE", result.outcome === "win");
    },
    tick(dt) {
      if (wheelAnim) {
        wheelAnim.t += dt;
        const u = Math.min(1, wheelAnim.t / wheelAnim.dur);
        const ease = 1 - (1 - u) ** 3;
        wheel.rotation.y = wheelAnim.y0 + (wheelAnim.y1 - wheelAnim.y0) * ease;
        const ang = wheelAnim.ball0 * (1 - ease);
        ball.position.set(rouletteTop.x + Math.sin(ang) * 0.36, 1.16, rouletteTop.z + 0.12 - Math.cos(ang) * 0.36);
        if (u >= 1) wheelAnim = null;
      } else ball.position.set(rouletteTop.x, 1.16, rouletteTop.z + 0.12 - 0.36);
      for (const machine of slotMachines.values()) {
        for (const reel of machine.reels) {
          if (!reel.spinning) continue;
          reel.elapsed += dt;
          if (reel.elapsed >= reel.stop) {
            reel.spinning = false;
            reel.mesh.material = symbolMaterial(reel.symbol);
          } else {
            const symbols: SlotSymbol[] = ["bar", "seven", "cherry", "bell", "gem", "coin"];
            const frame = symbols[Math.floor(reel.elapsed * 14) % symbols.length] ?? "bar";
            reel.mesh.material = symbolMaterial(frame);
          }
        }
      }
      if (crapsAnim) {
        crapsAnim.t += dt;
        const roll = crapsAnim.rolls[crapsAnim.step];
        if (roll) {
          const spin = crapsAnim.t < 0.28;
          for (const die of dice) {
            if (spin) die.mesh.rotation.x += dt * 14;
            else die.mesh.rotation.set(0, 0, 0);
          }
          if (!spin) {
            showDie(dice[0]!, roll.d1);
            showDie(dice[1]!, roll.d2);
          }
          if (crapsAnim.t >= 0.5) {
            crapsAnim.t = 0;
            crapsAnim.step += 1;
            if (crapsAnim.step >= crapsAnim.rolls.length) crapsAnim = null;
          }
        } else crapsAnim = null;
      }
    },
    dispose() {
      root.removeFromParent();
      for (const geo of owned) geo.dispose();
      for (const mat of ownedMat) {
        const mapped = mat as THREE.MeshBasicMaterial;
        mapped.map?.dispose();
        mat.dispose();
      }
    },
  };
}
