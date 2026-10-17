/** Living people keep this much space between centers. Tight enough that a car still rams the pack. */
export const PED_GAP = 0.76;
/** On-foot personal space. Inside this, a body is in the player's capsule. */
export const PLAYER_BUBBLE = 1.38;

export type CrowdBody = { x: number; z: number; hold?: boolean };
export type CrowdPlayer = { x: number; z: number; vx: number; vz: number };

/**
 * Push living bodies out of each other, and out of the on-foot player.
 * Pass player as null while driving so the pack stays on the car.
 * Bodies with hold stay put (downed). Never pulls anyone toward the player.
 */
export function separateCrowd(
  bodies: CrowdBody[],
  player: CrowdPlayer | null,
  gapBody: number,
  gapPlayer: number,
  blocked: (x: number, z: number) => boolean,
): void {
  const avoidPlayer = (x: number, z: number) =>
    blocked(x, z) ||
    (player !== null && (x - player.x) * (x - player.x) + (z - player.z) * (z - player.z) < gapPlayer * gapPlayer);
  if (player) peelFromPlayer(bodies, player, gapPlayer, blocked);
  separateBodies(bodies, gapBody, avoidPlayer);
  if (player) {
    peelFromPlayer(bodies, player, gapPlayer, blocked);
    separateBodies(bodies, gapBody, avoidPlayer);
  }
}

function peelFromPlayer(
  bodies: CrowdBody[],
  player: CrowdPlayer,
  gap: number,
  blocked: (x: number, z: number) => boolean,
): void {
  let fx = player.vx;
  let fz = player.vz;
  const fs = Math.hypot(fx, fz);
  if (fs > 0.35) {
    fx /= fs;
    fz /= fs;
  } else {
    fx = 0;
    fz = 0;
  }
  const rx = fx === 0 && fz === 0 ? 1 : -fz;
  const rz = fx === 0 && fz === 0 ? 0 : fx;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!;
    if (b.hold) continue;
    const dx = b.x - player.x;
    const dz = b.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d >= gap) continue;
    const side = (i & 1) === 0 ? 1 : -1;
    let nx: number;
    let nz: number;
    if (d < 0.2) {
      const back = 0.1 + (i % 4) * 0.08;
      nx = player.x + rx * side * gap - fx * back;
      nz = player.z + rz * side * gap - fz * back;
    } else if (fs > 0.35) {
      const along = (dx / d) * fx + (dz / d) * fz;
      const have = dx * rx + dz * rz;
      const sign = Math.abs(have) < 0.04 ? side : Math.sign(have);
      const out = gap - d + 0.1;
      if (along > 0.2) {
        nx = b.x + rx * sign * out - fx * out;
        nz = b.z + rz * sign * out - fz * out;
      } else {
        nx = b.x + (dx / d) * out;
        nz = b.z + (dz / d) * out;
      }
    } else {
      nx = player.x + (dx / d) * gap;
      nz = player.z + (dz / d) * gap;
    }
    if (place(b, nx, nz, blocked)) continue;
    if (d > 0.02 && place(b, player.x + (dx / d) * gap, player.z + (dz / d) * gap, blocked)) continue;
    place(b, player.x + rx * -side * gap, player.z + rz * -side * gap, blocked);
  }
}

const shiftX: number[] = [];
const shiftZ: number[] = [];

function separateBodies(bodies: CrowdBody[], gap: number, blocked: (x: number, z: number) => boolean): void {
  const n = bodies.length;
  const gap2 = gap * gap;
  while (shiftX.length < n) {
    shiftX.push(0);
    shiftZ.push(0);
  }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < n; i++) {
      shiftX[i] = 0;
      shiftZ[i] = 0;
    }
    let any = false;
    for (let i = 0; i < n; i++) {
      const a = bodies[i]!;
      if (a.hold) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j]!;
        if (b.hold) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= gap2) continue;
        any = true;
        const d = Math.sqrt(d2);
        let ux: number;
        let uz: number;
        if (d < 1e-4) {
          const ang = (i + 1) * 2.399963229728653 + (j + 1);
          ux = Math.cos(ang);
          uz = Math.sin(ang);
        } else {
          ux = dx / d;
          uz = dz / d;
        }
        const push = (gap - d) * 0.5;
        shiftX[i] -= ux * push;
        shiftZ[i] -= uz * push;
        shiftX[j] += ux * push;
        shiftZ[j] += uz * push;
      }
    }
    if (!any) return;
    for (let i = 0; i < n; i++) {
      const a = bodies[i]!;
      if (a.hold || (shiftX[i] === 0 && shiftZ[i] === 0)) continue;
      let sx = shiftX[i]!;
      let sz = shiftZ[i]!;
      const mag = Math.hypot(sx, sz);
      if (mag > gap) {
        sx *= gap / mag;
        sz *= gap / mag;
      }
      const nx = a.x + sx;
      const nz = a.z + sz;
      if (!blocked(nx, nz)) {
        a.x = nx;
        a.z = nz;
      }
    }
  }
  for (let sweep = 0; sweep < 3; sweep++) {
    let any = false;
    for (let i = 0; i < n; i++) {
      const a = bodies[i]!;
      if (a.hold) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j]!;
        if (b.hold) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= gap2) continue;
        any = true;
        const d = Math.sqrt(d2);
        let ux: number;
        let uz: number;
        if (d < 1e-4) {
          const ang = (i + 1) * 2.399963229728653 + j;
          ux = Math.cos(ang);
          uz = Math.sin(ang);
        } else {
          ux = dx / d;
          uz = dz / d;
        }
        const push = (gap - d) * 0.5;
        const ax = a.x - ux * push;
        const az = a.z - uz * push;
        const bx = b.x + ux * push;
        const bz = b.z + uz * push;
        if (!blocked(ax, az)) {
          a.x = ax;
          a.z = az;
        }
        if (!blocked(bx, bz)) {
          b.x = bx;
          b.z = bz;
        }
      }
    }
    if (!any) return;
  }
}

function place(b: CrowdBody, x: number, z: number, blocked: (x: number, z: number) => boolean): boolean {
  if (blocked(x, z)) return false;
  b.x = x;
  b.z = z;
  return true;
}
