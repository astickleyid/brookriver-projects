/**
 * Browser gamepad sampling.
 *
 * Standard mapping (Chrome, Firefox, Safari once the pad is woken):
 *   axes 0/1 left stick, 2/3 right stick. Axis Y is positive downward.
 *   buttons 6/7 are the analog triggers.
 * Raw pads that never get `mapping: "standard"` are classified once from
 * their rest pose so triggers sitting at -1 are not read as a stick.
 */

export type Layout = "standard" | "triggers-tail" | "lt-before-right";

export type PadLike = {
  index: number;
  connected: boolean;
  mapping: string;
  timestamp: number;
  id?: string;
  axes: ArrayLike<number>;
  buttons: ArrayLike<{ pressed: boolean; value: number } | null>;
};

export type PadAxes = {
  /** Left stick X, positive right. */
  lx: number;
  /** Left stick Y, positive down (browser axis sign). */
  ly: number;
  /** Right stick X, positive right. */
  rx: number;
  /** Right stick Y, positive down. */
  ry: number;
  lt: number;
  rt: number;
};

const layouts = new Map<number, Layout>();

export function resetPadLayouts() {
  layouts.clear();
}

export function forgetPadLayout(index: number) {
  layouts.delete(index);
}

/**
 * Poll whenever the tab is visible. Chrome reports the document as blurred
 * during pointer lock and for a turn after a controller click, and gating
 * on that drops the pad before it can connect. A hidden tab still stops.
 */
export function padWindowLive(state: { hidden: boolean }) {
  return !state.hidden;
}

/** `getGamepads()` throws SecurityError outside a secure context. Never let that kill the frame. */
export function readGamepads(nav: { getGamepads?: () => ArrayLike<PadLike | null> | null } | null | undefined): Array<PadLike | null> {
  if (!nav?.getGamepads) return [];
  try {
    const pads = nav.getGamepads();
    return pads ? Array.from(pads) : [];
  } catch {
    return [];
  }
}

export function radialDeadzone(x: number, y: number, dead = 0.17) {
  const mag = Math.hypot(x, y);
  if (mag < dead || mag === 0) return { x: 0, y: 0 };
  const scale = Math.min(1, (mag - dead) / (1 - dead)) / mag;
  return { x: x * scale, y: y * scale };
}

/** Softens the center of a -1..1 axis. Full tilt still reaches ±1. */
export function responseCurve(v: number, power: number) {
  const a = Math.min(1, Math.abs(v));
  return Math.sign(v) * a ** power;
}

/** Light trigger stays gentle. A full pull still reaches 1. */
export function triggerFeel(v: number, dead = 0.1) {
  if (v <= dead) return 0;
  const t = Math.min(1, (v - dead) / (1 - dead));
  return t * t * (3 - 2 * t);
}

function axisTrigger(v: number) {
  if (v > -0.4 && v < 0.85) return 0;
  return Math.min(1, Math.max(0, (v + 1) * 0.5));
}

export function inferLayout(pad: { mapping: string; axes: ArrayLike<number> }): Layout | null {
  if (pad.mapping === "standard") return "standard";
  const a = pad.axes;
  if (a.length < 6) return null;
  const a2 = a[2] ?? 0;
  const a3 = a[3] ?? 0;
  const a4 = a[4] ?? 0;
  const a5 = a[5] ?? 0;
  if (a2 < -0.65 && Math.abs(a3) < 0.25 && Math.abs(a4) < 0.25 && a5 < -0.65) return "lt-before-right";
  if (Math.abs(a2) < 0.25 && Math.abs(a3) < 0.25 && a4 < -0.65 && a5 < -0.65) return "triggers-tail";
  return null;
}

export function layoutFor(pad: { index: number; mapping: string; axes: ArrayLike<number> }): Layout {
  const saved = layouts.get(pad.index);
  if (saved) return saved;
  const next = inferLayout(pad);
  if (next) layouts.set(pad.index, next);
  return next ?? "standard";
}

function buttonValue(pad: PadLike, index: number) {
  const b = pad.buttons[index];
  if (!b) return 0;
  if (b.value > 0) return b.value;
  return b.pressed ? 1 : 0;
}

export function sampleAxes(pad: PadLike, layout: Layout): PadAxes {
  const ax = (i: number) => pad.axes[i] ?? 0;
  let rx = ax(2);
  let ry = ax(3);
  let lt = buttonValue(pad, 6);
  let rt = buttonValue(pad, 7);
  if (layout === "lt-before-right") {
    lt = Math.max(lt, axisTrigger(ax(2)));
    rt = Math.max(rt, axisTrigger(ax(5)));
    rx = ax(3);
    ry = ax(4);
  } else if (layout === "triggers-tail" || (layout === "standard" && lt < 0.02 && rt < 0.02 && pad.axes.length >= 6)) {
    lt = Math.max(lt, axisTrigger(ax(4)));
    rt = Math.max(rt, axisTrigger(ax(5)));
  }
  return { lx: ax(0), ly: ax(1), rx, ry, lt, rt };
}

/** Keep a live pad. A standard pad replaces a stuck non-standard slot. */
export function choosePadIndex(pads: Array<Pick<PadLike, "index" | "connected" | "mapping" | "timestamp"> | null>, current: number) {
  const at = (i: number) => (i >= 0 && i < pads.length ? pads[i] : null);
  const cur = at(current);
  if (cur?.connected && cur.mapping === "standard") return current;
  let best = cur?.connected ? current : -1;
  for (const g of pads) {
    if (!g?.connected) continue;
    if (best < 0) {
      best = g.index;
      continue;
    }
    const b = at(best);
    if (!b) {
      best = g.index;
      continue;
    }
    const gStd = g.mapping === "standard";
    const bStd = b.mapping === "standard";
    if (gStd && !bStd) best = g.index;
    else if (gStd === bStd && g.timestamp > b.timestamp) best = g.index;
  }
  return best;
}

/** Stick right is negative steer, matching keyboard D. */
export function driveSteer(stickRight: number) {
  return -stickRight;
}

/** Stick up is positive throttle. `rawY` uses the browser sign (positive down). */
export function throttleFromStick(rawY: number) {
  return -rawY;
}

/** Stick right turns the view the same way a rightward mouse move does. */
export function yawDelta(stickRight: number, rate: number, dt: number) {
  return -stickRight * rate * dt;
}

/** Stick down pitches the view the same way a downward mouse move does. */
export function pitchDelta(stickDown: number, rate: number, dt: number) {
  return -stickDown * rate * dt;
}

export const LOOK_YAW_FOOT = 5.4;
export const LOOK_PITCH_FOOT = 3.4;
export const LOOK_YAW_DRIVE = 2.5;
export const LOOK_PITCH_DRIVE = 1.7;
