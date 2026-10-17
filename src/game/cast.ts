import * as THREE from "three/webgpu";
import { PLAYABLES, playableProfile } from "./roster.ts";
import { sculptBody } from "./roster-model.ts";
import { characterProfile, dressCharacter, type CharacterProfile } from "./wardrobe.ts";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

/**
 * Quaternius CC0 skeleton, face and hair sources with authored Brookriver identities.
 * Playable bodies are sculpted in bind space; separately weighted garments provide
 * their silhouettes. Residents keep the lighter shared wardrobe system.
 * Imported bodies face +Z; the mount turns their front onto the game's -Z.
 */
export const MEASURED_TOE = new THREE.Vector3(0, -0.0713, 0.1422);

const MOUNT_Q = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
);

export function mountQuaternion(): THREE.Quaternion {
  return MOUNT_Q.clone();
}

export type Beat =
  | "talk"
  | "phone"
  | "sit"
  | "sittalk"
  | "dance"
  | "fix"
  | "idle"
  | "lean"
  | "carry"
  | "pickup"
  | "shove"
  | "call";
export const BEATS: Beat[] = ["talk", "phone", "sit", "sittalk", "dance", "fix", "idle", "lean", "carry", "pickup", "shove", "call"];

export type Melee = "none" | "jab" | "cross" | "shove";
export type ReactKind = "chest" | "head" | "knock";
export type HeldGun = "pistol" | "shotgun" | "smg";

export type ClipQuery = {
  down: boolean;
  reloading: boolean;
  shooting: boolean;
  aiming: boolean;
  pitch: number;
  diving: boolean;
  speed: number;
  fighting: boolean;
  armed: boolean;
  lingering: boolean;
  beat: Beat;
  /** Short hit reaction. Optional so older callers stay valid. */
  flinch?: boolean;
  react?: ReactKind;
  /** Bare-hand swing. Plays even if a gun is equipped, so a fist reads as a fist. */
  melee?: Melee;
  /** Which weapon the hands are holding. Omitted means the pistol clips. */
  gun?: HeldGun;
  /** Airborne pose. A shot, swing, or hit still wins over a jump. */
  air?: "none" | "up" | "hang" | "land";
  /** Caller hysteresis. Omitted keeps the old speed > 0.35 walk split. */
  moving?: boolean;
  /** Lower-body travel direction relative to the aiming torso. */
  legYaw?: number;
  reverseStride?: boolean;
};

const CLIP_NAMES = [
  "Idle_Loop",
  "Idle_Talking_Loop",
  "Idle_TalkingPhone_Loop",
  "Idle_FoldArms_Loop",
  "Idle_No_Loop",
  "Idle_Rail_Loop",
  "Idle_Rail_Call",
  "Walk_Loop",
  "Walk_Formal_Loop",
  "Walk_Carry_Loop",
  "Jog_Fwd_Loop",
  "Sprint_Loop",
  "Jump_Start",
  "Jump_Loop",
  "Jump_Land",
  "Dance_Loop",
  "Death01",
  "Hit_Chest",
  "Hit_Head",
  "Hit_Knockback",
  "Fixing_Kneeling",
  "Sitting_Idle_Loop",
  "Sitting_Talking_Loop",
  "Pistol_Aim_Down",
  "Pistol_Aim_Neutral",
  "Pistol_Aim_Up",
  "Pistol_Idle_Loop",
  "Pistol_Reload",
  "Pistol_Shoot",
  "Punch_Jab",
  "Punch_Cross",
  "Push_Loop",
  "PickUp_Table",
  "Interact",
  "Roll",
  "Crouch_Idle_Loop",
  "Crouch_Fwd_Loop",
] as const;

const FADE = 0.18;

/**
 * The free Universal Animation Library, and the paid viewer, only author one firearm
 * set on this skeleton: Pistol_Aim_*, Pistol_Idle, Pistol_Shoot, Pistol_Reload.
 * There is no shotgun, SMG, or rifle clip. Shotgun_ and SMG_ names are copies of that
 * set so each gun can play it at its own rate. A moving shooter keeps the gun on the
 * arms and the walk on the legs.
 */
export type ClipChoice = { name: string; once: boolean; arms?: string; armsOnce?: boolean };

const GUN_ACT: Record<HeldGun, { idle: string; down: string; aim: string; up: string; reload: string; shoot: string }> = {
  pistol: {
    idle: "Pistol_Idle_Loop",
    down: "Pistol_Aim_Down",
    aim: "Pistol_Aim_Neutral",
    up: "Pistol_Aim_Up",
    reload: "Pistol_Reload",
    shoot: "Pistol_Shoot",
  },
  shotgun: {
    idle: "Shotgun_Idle_Loop",
    down: "Shotgun_Aim_Down",
    aim: "Shotgun_Aim_Neutral",
    up: "Shotgun_Aim_Up",
    reload: "Shotgun_Reload",
    shoot: "Shotgun_Shoot",
  },
  smg: {
    idle: "SMG_Idle_Loop",
    down: "SMG_Aim_Down",
    aim: "SMG_Aim_Neutral",
    up: "SMG_Aim_Up",
    reload: "SMG_Reload",
    shoot: "SMG_Shoot",
  },
};

export function armsClip(name: string) {
  return `${name}__arms`;
}

export function legsClip(name: string) {
  return `${name}__legs`;
}

/**
 * How long the shoot pose stays up. This does not change fire rate.
 * Pistol holds through the muzzle rise. SMG stays up across a short burst
 * so the arms do not drop to idle between 0.08s shots.
 */
export function shootHold(gun: HeldGun | null): number {
  if (gun === "shotgun") return 0.6;
  if (gun === "smg") return 0.34;
  return 0.42;
}

/** Yaw whose −Z forward matches planar velocity. yaw 0 faces world −Z. */
export function travelYaw(vx: number, vz: number) {
  return Math.atan2(-vx, -vz);
}

/** Keep feet cycling for every travel direction, including aimed backpedal. */
export function clipPace(vx: number, vz: number, _yaw: number, _aim: boolean) {
  return Math.hypot(vx, vz);
}

/** Aim remains on the target while the hips follow travel. Backpedal reverses
 * the cycle instead of turning the knees all the way around. */
export function locomotionPose(vx: number, vz: number, yaw: number) {
  if (Math.hypot(vx, vz) < 0.1) return { legYaw: 0, reverseStride: false };
  const delta = travelYaw(vx, vz) - yaw;
  const angle = Math.atan2(Math.sin(delta), Math.cos(delta));
  const reverseStride = Math.abs(angle) > Math.PI * 0.6;
  const legYaw = reverseStride ? angle - Math.sign(angle) * Math.PI : angle;
  return { legYaw, reverseStride };
}

const HOP_GRAVITY = 22;

/** Upward speed for one hop. Peak is about 1.2 m. Buildings stay solid. */
export function hopVelocity() {
  return 7.3;
}

/** Semi-implicit hop. `landed` is true on the frame the feet return to the ground. */
export function stepHop(py: number, vy: number, dt: number) {
  const nextVy = vy - HOP_GRAVITY * dt;
  const nextPy = py + nextVy * dt;
  if (nextPy <= 0) return { py: 0, vy: 0, landed: py > 0.001 || vy < 0 };
  return { py: nextPy, vy: nextVy, landed: false };
}

/** 0 when every unit is far. 1 when a cruiser or cop is on top of the listener. */
export function sirenThreat(distances: number[]) {
  let threat = 0;
  for (const d of distances) {
    if (d < 46) threat = Math.max(threat, 1 - d / 46);
  }
  return threat;
}

function gunAct(q: ClipQuery) {
  return GUN_ACT[q.gun ?? "pistol"];
}

function aimName(q: ClipQuery) {
  const act = gunAct(q);
  if (q.pitch > 0.28) return act.up;
  if (q.pitch < -0.28) return act.down;
  return act.aim;
}

function footName(q: ClipQuery) {
  if (q.speed > 6.2) return "Sprint_Loop";
  if (q.speed > 3.1) return "Jog_Fwd_Loop";
  if (q.beat === "carry") return "Walk_Carry_Loop";
  if (q.beat === "talk" || q.beat === "phone") return "Walk_Formal_Loop";
  return "Walk_Loop";
}

function onFootMoving(q: ClipQuery) {
  if (q.moving === undefined) return q.speed > 0.35;
  return q.moving && q.speed > 0.05;
}

function armedOnFoot(q: ClipQuery, arms: string, armsOnce = false): ClipChoice {
  if (onFootMoving(q)) return { name: legsClip(footName(q)), once: false, arms: armsClip(arms), armsOnce };
  return { name: arms, once: armsOnce };
}

export function chooseClip(q: ClipQuery): ClipChoice {
  if (q.down) return { name: "Death01", once: true };
  if (q.flinch) {
    if (q.react === "head") return { name: "Hit_Head", once: true };
    if (q.react === "knock") return { name: "Hit_Knockback", once: true };
    return { name: "Hit_Chest", once: true };
  }
  if (q.melee === "cross") return { name: "Punch_Cross", once: true };
  if (q.melee === "jab") return { name: "Punch_Jab", once: true };
  if (q.melee === "shove") return { name: "Push_Loop", once: true };
  const act = gunAct(q);
  if (q.reloading && q.armed) return armedOnFoot(q, act.reload, true);
  if (q.shooting && q.armed) return armedOnFoot(q, act.shoot, true);
  if (q.air === "up") return { name: "Jump_Start", once: true };
  if (q.air === "land") return { name: "Jump_Land", once: true };
  if (q.air === "hang") return { name: "Jump_Loop", once: false };
  if (q.aiming && q.armed) return armedOnFoot(q, aimName(q));
  if (q.diving) {
    if (q.speed > 2.2) return { name: "Roll", once: true };
    return { name: q.speed > 0.8 ? "Crouch_Fwd_Loop" : "Crouch_Idle_Loop", once: false };
  }
  if (q.fighting && q.armed) return armedOnFoot(q, act.aim);
  if (q.speed > 6.2) return { name: "Sprint_Loop", once: false };
  if (onFootMoving(q)) {
    if (q.armed) return { name: legsClip(footName(q)), once: false, arms: armsClip(act.idle) };
    if (q.beat === "carry") return { name: "Walk_Carry_Loop", once: false };
    if (q.beat === "talk" || q.beat === "phone") return { name: "Walk_Formal_Loop", once: false };
    return { name: "Walk_Loop", once: false };
  }
  if (q.lingering) {
    if (q.beat === "phone") return { name: "Idle_TalkingPhone_Loop", once: false };
    if (q.beat === "talk") return { name: "Idle_Talking_Loop", once: false };
    if (q.beat === "sit") return { name: "Sitting_Idle_Loop", once: false };
    if (q.beat === "sittalk") return { name: "Sitting_Talking_Loop", once: false };
    if (q.beat === "dance") return { name: "Dance_Loop", once: false };
    if (q.beat === "fix") return { name: "Fixing_Kneeling", once: false };
    if (q.beat === "lean") return { name: "Idle_Rail_Loop", once: false };
    if (q.beat === "shove") return { name: "Push_Loop", once: false };
    if (q.beat === "pickup") return { name: "PickUp_Table", once: true };
    if (q.beat === "call") return { name: "Idle_Rail_Call", once: true };
    if (q.beat === "carry") return { name: "Interact", once: true };
  }
  if (!q.armed) {
    if (q.beat === "lean") return { name: "Idle_Rail_Loop", once: false };
    if (q.beat === "talk" || q.beat === "fix" || q.beat === "carry") return { name: "Idle_FoldArms_Loop", once: false };
    if (q.beat === "phone" || q.beat === "call") return { name: "Idle_No_Loop", once: false };
  }
  if (q.armed) return { name: act.idle, once: false };
  return { name: "Idle_Loop", once: false };
}

function trackStride(name: string): number {
  if (name.endsWith("quaternion")) return 4;
  return 3;
}

/**
 * Freeze root travel so a clip cannot slide the body off the drop spot.
 * UAL names the bones `root` and `pelvis`. The street rig names them `Root`, `Body`, and `Hips`.
 * Death and hits fall on whichever of those bones the clip actually rotates. Freezing that rotation leaves a standing corpse.
 * Walk bobs on Body Y, so a non-fall clip keeps Body and hip Y and only pins X/Z.
 */
export function lockInPlace(clip: THREE.AnimationClip, keepRootRotation = false): THREE.AnimationClip {
  const tracks = clip.tracks.map((track) => {
    const next = track.clone();
    const dot = next.name.indexOf(".");
    const node = (dot < 0 ? next.name : next.name.slice(0, dot)).toLowerCase();
    const prop = dot < 0 ? "" : next.name.slice(dot + 1);
    const values = next.values;
    const freezeTurn = prop === "quaternion" && !keepRootRotation;
    if (node === "root" && (prop === "position" || prop === "scale" || freezeTurn)) {
      const stride = trackStride(prop);
      for (let i = stride; i < values.length; i++) values[i] = values[i % stride]!;
    } else if (node === "body" && prop === "quaternion" && freezeTurn) {
      for (let i = 4; i < values.length; i++) values[i] = values[i % 4]!;
    } else if ((node === "pelvis" || node === "hips" || (node === "body" && !keepRootRotation)) && prop === "position") {
      const x0 = values[0] ?? 0;
      const z0 = values[2] ?? 0;
      for (let i = 0; i < values.length; i += 3) {
        values[i] = x0;
        values[i + 2] = z0;
      }
    }
    return next;
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export type StreetOutfit = "tee" | "hoodie" | "jacket" | "worker" | "suit" | "uniform";

type ProtoSpec = {
  key: string;
  sex: "m" | "f";
  outfit: StreetOutfit;
  hair?: string;
  hairTint: number;
};

const HAIR = {
  dark: 0x241c18,
  brown: 0x6a4226,
  blonde: 0xd8b15c,
  auburn: 0x8a3828,
} as const;

function civ(sex: "m" | "f", outfit: StreetOutfit, hair: string, alt: boolean, hairTint: number): ProtoSpec {
  return { key: `civ-${sex}-${outfit}-${alt ? "b" : "a"}`, sex, outfit, hair, hairTint };
}

const PROTOS: ProtoSpec[] = [
  ...PLAYABLES.map((hero): ProtoSpec => ({ key: `player-${hero.id}`, sex: hero.sex, outfit: hero.profile.outfit, hair: hero.hair, hairTint: hero.hairTint })),
  civ("m", "tee", "parted", false, HAIR.dark),
  civ("m", "tee", "beard", true, HAIR.brown),
  civ("m", "hoodie", "buzz", false, HAIR.dark),
  civ("m", "hoodie", "parted", true, HAIR.blonde),
  civ("m", "jacket", "beard", false, HAIR.auburn),
  civ("m", "jacket", "buzz", true, HAIR.dark),
  civ("m", "worker", "parted", false, HAIR.brown),
  civ("m", "worker", "beard", true, HAIR.dark),
  civ("m", "suit", "buzz", false, HAIR.dark),
  civ("m", "suit", "parted", true, HAIR.blonde),
  civ("f", "tee", "long", false, HAIR.dark),
  civ("f", "tee", "buns", true, HAIR.blonde),
  civ("f", "hoodie", "long", false, HAIR.auburn),
  civ("f", "hoodie", "buzz-f", true, HAIR.dark),
  civ("f", "jacket", "buns", false, HAIR.brown),
  civ("f", "jacket", "long", true, HAIR.dark),
  civ("f", "worker", "buzz-f", false, HAIR.dark),
  civ("f", "worker", "buns", true, HAIR.auburn),
  civ("f", "suit", "long", false, HAIR.blonde),
  civ("f", "suit", "buns", true, HAIR.dark),
  { key: "amber-m", sex: "m", outfit: "jacket", hair: "parted", hairTint: HAIR.auburn },
  { key: "amber-m-b", sex: "m", outfit: "worker", hair: "beard", hairTint: HAIR.brown },
  { key: "amber-f", sex: "f", outfit: "jacket", hair: "long", hairTint: HAIR.auburn },
  { key: "amber-f-b", sex: "f", outfit: "worker", hair: "buns", hairTint: HAIR.blonde },
  { key: "teal-m", sex: "m", outfit: "hoodie", hair: "buzz", hairTint: HAIR.dark },
  { key: "teal-m-b", sex: "m", outfit: "suit", hair: "parted", hairTint: HAIR.dark },
  { key: "teal-f", sex: "f", outfit: "hoodie", hair: "buns", hairTint: HAIR.dark },
  { key: "teal-f-b", sex: "f", outfit: "suit", hair: "long", hairTint: HAIR.blonde },
  { key: "cop-m", sex: "m", outfit: "uniform", hair: "buzz", hairTint: HAIR.dark },
  { key: "cop-f", sex: "f", outfit: "uniform", hair: "buns", hairTint: HAIR.dark },
  { key: "cop-m-b", sex: "m", outfit: "uniform", hair: "parted", hairTint: HAIR.brown },
];

export function appearanceFor(key: string) {
  const hero = PLAYABLES.find((p) => key === `player-${p.id}`);
  if (hero) return { height: 1, width: 1, skin: hero.skin, fabric: hero.profile.fabric };
  let hash = 2166136261;
  for (const c of key) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const skins = [[0.68, 0.49, 0.36], [0.88, 0.73, 0.59], [1.08, 0.99, 0.88], [0.49, 0.34, 0.26], [0.94, 0.83, 0.7]];
  const fabric = key.startsWith("amber") ? [0xc7863f, 0x98632e] : key.startsWith("teal") ? [0x378b84, 0x275d68] : key.startsWith("cop") ? [0x293c58, 0x334963] : [0x697b68, 0x9c5950, 0x657b94, 0xb39b72, 0x7b657f, 0x495963];
  return {
    height: 0.93 + (hash % 9) * 0.018,
    width: 0.91 + ((hash >>> 4) % 8) * 0.026,
    skin: skins[(hash >>> 8) % skins.length]!,
    fabric: fabric[(hash >>> 16) % fabric.length]!,
  };
}

const CIV_KEYS = PROTOS.filter((spec) => spec.key.startsWith("civ-")).map((spec) => spec.key);
const AMBER_KEYS = PROTOS.filter((spec) => spec.key.startsWith("amber-")).map((spec) => spec.key);
const TEAL_KEYS = PROTOS.filter((spec) => spec.key.startsWith("teal-")).map((spec) => spec.key);
const COP_KEYS = PROTOS.filter((spec) => spec.key.startsWith("cop-")).map((spec) => spec.key);

export function actorKey(faction: string, index: number): string {
  if (faction === "civ") return CIV_KEYS[index % CIV_KEYS.length]!;
  if (faction === "amber") return AMBER_KEYS[index % AMBER_KEYS.length]!;
  if (faction === "teal") return TEAL_KEYS[index % TEAL_KEYS.length]!;
  if (faction === "player") return `player-${PLAYABLES[Math.abs(index) % PLAYABLES.length]!.id}`;
  return COP_KEYS[index % COP_KEYS.length]!;
}

export function actorCut(key: string): string | undefined {
  return PROTOS.find((spec) => spec.key === key)?.outfit;
}

export function gunFor(faction: string, index: number): HeldGun | null {
  if (faction === "civ" || faction === "player") return null;
  if (faction === "cop") return index % 2 === 0 ? "pistol" : "smg";
  const cycle: HeldGun[] = ["pistol", "shotgun", "smg"];
  return cycle[index % 3]!;
}

export type CastLibrary = {
  prototypes: Map<string, THREE.Object3D>;
  clips: Map<string, THREE.AnimationClip>;
  guns: Record<HeldGun, THREE.Group>;
  sources: THREE.Object3D[];
};

export type Actor = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  intent: string;
  shotSeen: number;
  flinchSeen: number;
  meleeSeen: number;
  /** 0–1 loop offset so a crowd of the same clip does not step together. */
  phase: number;
  playing: THREE.AnimationAction | null;
  overlay: THREE.AnimationAction | null;
  kick: THREE.Group | null;
  pelvis: THREE.Object3D | undefined;
  spine: THREE.Object3D | undefined;
  legTurn: number;
  profile: CharacterProfile;
};

let actorSerial = 0;

type Gltf = { scene: THREE.Group; animations: THREE.AnimationClip[] };

const BASE = "/vendor/quaternius";

/** Head, eyes, and brows stay. Outfit meshes are not part of this body. */
export function keepBaseMesh(name: string) {
  const n = name.toLowerCase();
  return n.includes("eye") || n.includes("brow") || n.includes("superhero");
}

export function streetClipNames(): string[] {
  return [...CLIP_NAMES];
}

const FALL_CLIPS = new Set(["Death01", "Hit_Chest", "Hit_Head", "Hit_Knockback"]);

const ARM_BONE = /^(clavicle_|upperarm_|lowerarm_|hand_|index_|middle_|ring_|pinky_|thumb_)/;
const PISTOL_SOURCE = ["Pistol_Idle_Loop", "Pistol_Aim_Down", "Pistol_Aim_Neutral", "Pistol_Aim_Up", "Pistol_Reload", "Pistol_Shoot"] as const;
const LEG_SOURCE = ["Walk_Loop", "Walk_Formal_Loop", "Walk_Carry_Loop", "Jog_Fwd_Loop", "Sprint_Loop"] as const;

function trackBone(name: string) {
  const dot = name.indexOf(".");
  return dot < 0 ? name : name.slice(0, dot);
}

function isArmTrack(name: string) {
  return ARM_BONE.test(trackBone(name));
}

function cloneClip(clip: THREE.AnimationClip, name: string) {
  const copy = clip.clone();
  copy.name = name;
  return copy;
}

function armsOnly(clip: THREE.AnimationClip, name: string) {
  const tracks = clip.tracks.filter((track) => isArmTrack(track.name) && !track.name.endsWith(".scale")).map((track) => track.clone());
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

function legsOnly(clip: THREE.AnimationClip, name: string) {
  const tracks = clip.tracks.filter((track) => !isArmTrack(track.name)).map((track) => track.clone());
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

/** Shotgun and SMG have no authored clip on this rig. They reuse the pistol motion under their own names. */
function addGunClips(clips: Map<string, THREE.AnimationClip>) {
  const rename = (source: string, gun: "Shotgun" | "SMG") => source.replace("Pistol_", `${gun}_`);
  for (const source of PISTOL_SOURCE) {
    const clip = clips.get(source);
    if (!clip) throw new Error(`cast missing clip ${source}`);
    for (const gun of ["Shotgun", "SMG"] as const) {
      clips.set(rename(source, gun), cloneClip(clip, rename(source, gun)));
    }
    for (const name of [source, rename(source, "Shotgun"), rename(source, "SMG")]) {
      const posed = clips.get(name);
      if (!posed) throw new Error(`cast missing clip ${name}`);
      clips.set(armsClip(name), armsOnly(posed, armsClip(name)));
    }
  }
  for (const name of LEG_SOURCE) {
    const clip = clips.get(name);
    if (!clip) throw new Error(`cast missing clip ${name}`);
    clips.set(legsClip(name), legsOnly(clip, legsClip(name)));
  }
}

function bonesOf(root: THREE.Object3D): Map<string, THREE.Bone> {
  const map = new Map<string, THREE.Bone>();
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) map.set(obj.name, obj as THREE.Bone);
  });
  return map;
}

function armatureOf(root: THREE.Object3D): THREE.Object3D {
  let arm: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (obj.name === "Armature") arm = obj;
  });
  return arm ?? root;
}

function rebind(mesh: THREE.SkinnedMesh, boneByName: Map<string, THREE.Bone>): THREE.SkinnedMesh {
  const bones = mesh.skeleton.bones.map((bone) => {
    const found = boneByName.get(bone.name);
    if (!found) throw new Error(`cast missing bone ${bone.name}`);
    return found;
  });
  const inverses = mesh.skeleton.boneInverses.map((inverse) => inverse.clone());
  const copy = mesh.clone(false);
  copy.position.set(0, 0, 0);
  copy.quaternion.identity();
  copy.scale.set(1, 1, 1);
  copy.bind(new THREE.Skeleton(bones, inverses), mesh.bindMatrix);
  copy.frustumCulled = false;
  copy.castShadow = false;
  copy.receiveShadow = false;
  return copy;
}

function harvest(source: THREE.Object3D, boneByName: Map<string, THREE.Bone>, parent: THREE.Object3D) {
  const meshes: THREE.SkinnedMesh[] = [];
  source.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(obj as THREE.SkinnedMesh);
  });
  for (const mesh of meshes) parent.add(rebind(mesh, boneByName));
}

function loadMap(url: string, colorSpace: THREE.ColorSpace) {
  return new THREE.TextureLoader().loadAsync(url).then((tex) => {
    tex.flipY = false;
    tex.colorSpace = colorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  });
}

type LookMaps = { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture };

function pixelsOf(texture: THREE.Texture) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(texture.image as CanvasImageSource, 0, 0, 512, 512);
  return { canvas, ctx, pixels: ctx.getImageData(0, 0, 512, 512) };
}

function varyLook(look: LookMaps, reference: LookMaps, other: LookMaps, key: string): LookMaps {
  const { canvas, ctx, pixels } = pixelsOf(look.color);
  const a = pixelsOf(reference.color).pixels.data;
  const b = pixelsOf(other.color).pixels.data;
  const appearance = appearanceFor(key);
  const color = new THREE.Color(appearance.fabric).convertLinearToSRGB();
  const d = pixels.data;
  const skinMask = new Uint8Array(512 * 512);
  for (let i = 0; i < d.length; i += 4) {
    const skin = Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) < 18 && a[i]! > a[i + 1]! * 1.08 && a[i + 1]! > a[i + 2]! * 1.08;
    skinMask[i / 4] = skin ? 1 : 0;
    if (skin) {
      for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, d[i + c]! * appearance.skin[c]!);
    } else if (d[i + 2]! > d[i]! * 1.05 && d[i + 2]! > 45 && d[i + 2]! < 190) {
      const light = (d[i]! + d[i + 1]! + d[i + 2]!) / (3 * 95);
      d[i] = Math.min(255, color.r * 160 * light);
      d[i + 1] = Math.min(255, color.g * 160 * light);
      d[i + 2] = Math.min(255, color.b * 160 * light);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = look.color.flipY;
  map.userData.skinMask = skinMask;
  return { ...look, color: map };
}

function applyLook(root: THREE.Object3D, spec: ProtoSpec, look: LookMaps) {
  const hairTint = new THREE.Color(spec.hairTint);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = list.map((src) => {
      const name = src.name || "";
      const mat = src.clone() as THREE.MeshStandardMaterial;
      if ("envMapIntensity" in mat) mat.envMapIntensity = 1.2;
      if (/superhero/i.test(name)) {
        mat.map = look.color;
        mat.normalMap = look.normal;
        mat.roughnessMap = look.rough;
        mat.metalnessMap = null;
        mat.metalness = 0;
        mat.color.set(0xffffff);
        if (mat.emissive) mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
      } else if (/hair/i.test(name)) {
        mat.color.multiply(hairTint);
      }
      return mat;
    });
    mesh.material = next.length === 1 ? next[0]! : next;
  });
}

/**
 * Ultimate Guns barrels run along mesh −Y and the slide sits on mesh +X. glTF alpha is 0, so a mask material draws nothing.
 * Pistol clips point the fingers along hand +Y and the back of the hand along hand +Z.
 * Rx(−90°) put the barrel on hand +Z, which is straight up in the aim pose.
 */
export function gunGripQuaternion() {
  const sights = new THREE.Vector3(0, 0, 1);
  const stock = new THREE.Vector3(0, -1, 0);
  const side = new THREE.Vector3(1, 0, 0);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(sights, stock, side));
}

export function repairGunMaterial(mat: THREE.Material) {
  const standard = mat as THREE.MeshStandardMaterial;
  standard.opacity = 1;
  standard.transparent = false;
  standard.alphaTest = 0;
  standard.depthWrite = true;
  standard.side = THREE.DoubleSide;
  standard.needsUpdate = true;
}

function takeGun(scene: THREE.Object3D, name: HeldGun): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  for (const child of [...scene.children]) group.add(child);
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 2;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = list.map((mat) => {
      const copy = mat.clone();
      repairGunMaterial(copy);
      return copy;
    });
    mesh.material = next.length === 1 ? next[0]! : next;
  });
  return group;
}

const SHOOT_NAMES = new Set(["Pistol_Shoot", "Shotgun_Shoot", "SMG_Shoot"]);

/** Playback only. The windows match GUNS.reload and must not be used as a weapon retune. */
function tuneAction(action: THREE.AnimationAction, gun: HeldGun) {
  const name = action.getClip()?.name ?? "";
  const dur = action.getClip()?.duration ?? 1;
  if (name.includes("Shoot")) {
    // The muzzle rise sits about 0.15s into the clip. SMG shots are 0.08s apart, so the copy plays faster.
    action.timeScale = gun === "smg" ? 2.4 : 1;
  } else if (name === "Punch_Jab" || name === "Punch_Cross" || name === "Push_Loop") {
    action.timeScale = dur / (name === "Push_Loop" ? 0.52 : 0.4);
  } else if (name === "Jump_Start") {
    action.timeScale = Math.max(0.2, dur) / 0.28;
  } else if (name === "Jump_Land") {
    action.timeScale = Math.max(0.2, dur) / 0.3;
  } else if (name.includes("Reload")) {
    const window = gun === "shotgun" ? 1.55 : gun === "smg" ? 1.2 : 1.05;
    action.timeScale = dur / window;
  } else {
    action.timeScale = 1;
  }
}

function startLayer(actor: Actor, name: string, once: boolean, slot: "body" | "arms", gun: HeldGun): boolean {
  let action = actor.actions.get(name);
  let loopOnce = once;
  if (!action) {
    action = actor.actions.get("Idle_Loop");
    loopOnce = false;
  }
  if (!action) return false;
  const current = slot === "body" ? actor.playing : actor.overlay;
  if (current && current !== action) current.fadeOut(FADE);
  tuneAction(action, gun);
  action.reset();
  action.setLoop(loopOnce ? THREE.LoopOnce : THREE.LoopRepeat, loopOnce ? 1 : Infinity);
  action.clampWhenFinished = loopOnce;
  action.fadeIn(loopOnce ? 0.065 : FADE).play();
  if (!loopOnce) action.time = actor.phase * (action.getClip()?.duration ?? 1);
  if (slot === "body") actor.playing = action;
  else actor.overlay = action;
  return true;
}

export function createActor(lib: CastLibrary, key: string, gun: HeldGun | "all" | null, residentIndex = 0): Actor {
  const proto = lib.prototypes.get(key);
  if (!proto) throw new Error(`missing cast prototype ${key}`);
  const rig = cloneSkinned(proto) as THREE.Object3D;
  const hero = PLAYABLES.find((p) => key === `player-${p.id}`);
  const profile = hero ? playableProfile(hero) : characterProfile(key, residentIndex);
  if (hero) rig.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh && /superhero/i.test(mesh.name)) mesh.geometry = sculptBody(mesh.geometry, hero);
  });
  dressCharacter(rig, profile);
  lib.sources.push(rig);
  const mount = new THREE.Group();
  mount.name = "mount";
  mount.quaternion.copy(mountQuaternion());
  mount.add(rig);
  const root = new THREE.Group();
  root.name = key;
  root.add(mount);
  const appearance = appearanceFor(key);
  root.scale.set(appearance.width * profile.build, appearance.height * profile.height, appearance.width * profile.build);
  root.userData.character = profile;
  const mixer = new THREE.AnimationMixer(rig);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const [name, clip] of lib.clips) actions.set(name, mixer.clipAction(clip));
  const hand = rig.getObjectByName("hand_r") ?? rig.getObjectByName("Wrist.R");
  let kick: THREE.Group | null = null;
  if (hand && gun) {
    const grip = new THREE.Group();
    grip.quaternion.copy(gunGripQuaternion());
    grip.position.set(0, 0.02, 0);
    kick = new THREE.Group();
    grip.add(kick);
    const ids: HeldGun[] = gun === "all" ? ["pistol", "shotgun", "smg"] : [gun];
    for (const id of ids) {
      const model = lib.guns[id].clone(true);
      model.name = id;
      model.visible = gun !== "all" || id === "pistol";
      kick.add(model);
    }
    hand.add(grip);
  }
  const phase = (actorSerial++ % 20) / 20;
  return { root, mixer, actions, intent: "", shotSeen: -1, flinchSeen: -1, meleeSeen: -1, phase, playing: null, overlay: null, kick, pelvis: rig.getObjectByName("pelvis"), spine: rig.getObjectByName("spine_01"), legTurn: 0, profile };
}

export function setHeldGun(actor: Actor, id: HeldGun | null) {
  if (!actor.kick) return;
  for (const child of actor.kick.children) child.visible = child.name === id;
}

export function placeActor(actor: Actor, x: number, y: number, z: number, yaw: number) {
  actor.root.visible = true;
  actor.root.position.set(x, y, z);
  actor.root.rotation.set(0, yaw, 0);
}

export function parkActor(actor: Actor) {
  actor.root.visible = false;
  actor.root.position.set(0, -10, 0);
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const spineWorld = new THREE.Quaternion(), hipWorld = new THREE.Quaternion(), parentWorld = new THREE.Quaternion(), turnQ = new THREE.Quaternion();

const HIT_CLIPS = new Set(["Hit_Chest", "Hit_Head", "Hit_Knockback"]);
const PUNCH_CLIPS = new Set(["Punch_Jab", "Punch_Cross", "Push_Loop"]);

export function updateActor(
  actor: Actor,
  query: ClipQuery,
  shotGen: number,
  dt: number,
  kick: number,
  flinchGen = 0,
  meleeGen = 0,
) {
  const choice = chooseClip(query);
  const gun = query.gun ?? "pistol";
  const intent = choice.arms ? `${choice.name}|${choice.arms}` : choice.name;
  let shootAgain = (SHOOT_NAMES.has(choice.name) || !!choice.armsOnce) && shotGen !== actor.shotSeen;
  if (shootAgain) {
    const live = choice.arms ? actor.overlay : actor.playing;
    const liveName = live?.getClip()?.name ?? "";
    const gate = gun === "smg" ? 0.22 : gun === "shotgun" ? 0.32 : 0.2;
    // A new bullet must not restart the muzzle rise before it has played.
    if (live && liveName.includes("Shoot") && live.time < gate) {
      actor.shotSeen = shotGen;
      shootAgain = false;
    }
  }
  const flinchAgain = HIT_CLIPS.has(choice.name) && flinchGen !== actor.flinchSeen;
  const punchAgain = PUNCH_CLIPS.has(choice.name) && choice.once && meleeGen !== actor.meleeSeen;
  if (shootAgain && choice.arms && actor.intent === intent) {
    const action = actor.actions.get(choice.arms);
    if (action) {
      tuneAction(action, gun);
      action.enabled = true;
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.reset().setEffectiveWeight(1).play();
      actor.overlay = action;
      actor.shotSeen = shotGen;
    }
  } else if (actor.intent !== intent || shootAgain || flinchAgain || punchAgain) {
    if (startLayer(actor, choice.name, choice.once, "body", gun)) {
      if (SHOOT_NAMES.has(choice.name)) actor.shotSeen = shotGen;
      if (HIT_CLIPS.has(choice.name)) actor.flinchSeen = flinchGen;
      if (PUNCH_CLIPS.has(choice.name)) actor.meleeSeen = meleeGen;
    }
    if (choice.arms) {
      if (startLayer(actor, choice.arms, !!choice.armsOnce, "arms", gun) && choice.armsOnce) actor.shotSeen = shotGen;
    } else if (actor.overlay) {
      actor.overlay.fadeOut(FADE);
      actor.overlay = null;
    }
    actor.intent = intent;
  }
  const paceRate = (action: THREE.AnimationAction | null) => {
    if (!action) return;
    const name = action.getClip()?.name ?? "";
    if (name.includes("Shoot") || name.includes("Reload") || name.startsWith("Jump_")) return;
    const base = name.includes("Sprint") ? 7.2 : name.includes("Jog") ? 4.2 : name.includes("Walk") ? 1.6 : 0;
    if (base > 0) action.timeScale = Math.min(1.65, Math.max(0.35, query.speed / (base * actor.profile.gait))) * (query.reverseStride ? -1 : 1);
  };
  paceRate(actor.playing);
  paceRate(actor.overlay);
  actor.mixer.update(dt);
  // Preserve the animated torso in world space while turning only hips/legs.
  // Bone-local axes differ from world up on this rig, so convert through parents.
  const turn = choice.name.endsWith("__legs") ? (query.legYaw ?? 0) : 0;
  actor.legTurn += (turn - actor.legTurn) * Math.min(1, dt * 18);
  if (actor.pelvis?.parent && actor.spine?.parent && Math.abs(actor.legTurn) > 0.001) {
    actor.root.updateMatrixWorld(true);
    actor.spine.getWorldQuaternion(spineWorld);
    actor.pelvis.getWorldQuaternion(hipWorld);
    hipWorld.premultiply(turnQ.setFromAxisAngle(WORLD_UP, actor.legTurn));
    actor.pelvis.parent.getWorldQuaternion(parentWorld);
    actor.pelvis.quaternion.copy(parentWorld.invert()).multiply(hipWorld);
    actor.pelvis.updateMatrixWorld(true);
    actor.spine.parent.getWorldQuaternion(parentWorld);
    actor.spine.quaternion.copy(parentWorld.invert()).multiply(spineWorld);
  }
  if (actor.kick) {
    actor.kick.visible = query.melee === undefined || query.melee === "none";
    // Barrel is grip −Y, so recoil travels +Y, back into the hand.
    actor.kick.position.set(0, Math.max(0, kick) * 0.08, 0);
  }
}

export function disposeCast(lib: CastLibrary) {
  const roots: THREE.Object3D[] = [...lib.prototypes.values(), ...lib.sources, ...Object.values(lib.guns)];
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  for (const root of roots) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      geos.add(mesh.geometry);
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of list) if (mat) mats.add(mat);
    });
  }
  for (const mat of mats) {
    const standard = mat as THREE.MeshStandardMaterial;
    for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"] as const) {
      const tex = standard[key];
      if (tex) textures.add(tex);
    }
    mat.dispose();
  }
  for (const tex of textures) tex.dispose();
  for (const geo of geos) geo.dispose();
}

export async function loadCast(): Promise<CastLibrary> {
  const loader = new GLTFLoader();
  const load = async (url: string) => (await loader.loadAsync(url)) as Gltf;
  const hairFile: Record<string, string> = {
    parted: "parted/Hair_SimpleParted.gltf",
    beard: "beard/Hair_Beard.gltf",
    buzz: "buzz/Hair_Buzzed.gltf",
    "buzz-f": "buzz-f/Hair_BuzzedFemale.gltf",
    buns: "buns/Hair_Buns.gltf",
    long: "long/Hair_Long.gltf",
  };
  const outfits: StreetOutfit[] = ["tee", "hoodie", "jacket", "worker", "suit", "uniform"];
  const [male, female, ual1, ual2, pistol, shotgun, smg, ...rest] = await Promise.all([
    load(`${BASE}/universal-base-characters/male/Superhero_Male_FullBody.gltf`),
    load(`${BASE}/universal-base-characters/female/Superhero_Female_FullBody.gltf`),
    load(`${BASE}/universal-animation-library/UAL1_Standard.glb`),
    load(`${BASE}/universal-animation-library-2/UAL2_Standard.glb`),
    load(`${BASE}/ultimate-guns/pistol.glb`),
    load(`${BASE}/ultimate-guns/shotgun.glb`),
    load(`${BASE}/ultimate-guns/smg.glb`),
    ...(["m", "f"] as const).flatMap((sex) => [
      loadMap(`${BASE}/street-clothes/${sex}-normal.png`, THREE.NoColorSpace),
      loadMap(`${BASE}/street-clothes/${sex}-roughness.png`, THREE.NoColorSpace),
      ...outfits.map((outfit) => loadMap(`${BASE}/street-clothes/${sex}-${outfit}.png`, THREE.SRGBColorSpace)),
    ]),
    ...Object.values(hairFile).map((file) => load(`${BASE}/universal-base-characters/hair/${file}`)),
  ]);
  const looks = new Map<string, LookMaps>();
  let cursor = 0;
  for (const sex of ["m", "f"] as const) {
    const normal = rest[cursor++] as THREE.Texture;
    const rough = rest[cursor++] as THREE.Texture;
    for (const outfit of outfits) {
      const color = rest[cursor++] as THREE.Texture;
      looks.set(`${sex}-${outfit}`, { color, normal, rough });
    }
  }
  const hairById = new Map<string, Gltf>();
  Object.keys(hairFile).forEach((id, i) => {
    const gltf = rest[cursor + i] as Gltf | undefined;
    if (gltf) hairById.set(id, gltf);
  });
  const bodies = { m: male, f: female };
  const prototypes = new Map<string, THREE.Object3D>();
  for (const spec of PROTOS) {
    const rig = cloneSkinned(bodies[spec.sex].scene) as THREE.Object3D;
    const bones = bonesOf(rig);
    const arm = armatureOf(rig);
    if (spec.hair) {
      const hair = hairById.get(spec.hair);
      if (!hair) throw new Error(`missing hair ${spec.hair}`);
      harvest(hair.scene, bones, arm);
    }
    const look = looks.get(`${spec.sex}-${spec.outfit}`);
    if (!look) throw new Error(`missing outfit ${spec.sex}-${spec.outfit}`);
    const varied = varyLook(look, looks.get(`${spec.sex}-tee`)!, looks.get(`${spec.sex}-hoodie`)!, spec.key);
    applyLook(rig, spec, varied);
    rig.name = spec.key;
    prototypes.set(spec.key, rig);
  }
  for (const look of looks.values()) look.color.dispose();
  const clips = new Map<string, THREE.AnimationClip>();
  for (const gltf of [ual1, ual2]) {
    for (const clip of gltf.animations) {
      if (!CLIP_NAMES.includes(clip.name as (typeof CLIP_NAMES)[number])) continue;
      if (clips.has(clip.name)) continue;
      clips.set(clip.name, lockInPlace(clip, FALL_CLIPS.has(clip.name)));
    }
  }
  for (const name of CLIP_NAMES) {
    if (!clips.has(name)) throw new Error(`cast missing clip ${name}`);
  }
  addGunClips(clips);
  const sources = [
    male.scene,
    female.scene,
    ual1.scene,
    ual2.scene,
    pistol.scene,
    shotgun.scene,
    smg.scene,
    ...[...hairById.values()].map((gltf) => gltf.scene),
  ];
  return {
    prototypes,
    clips,
    guns: {
      pistol: takeGun(pistol.scene, "pistol"),
      shotgun: takeGun(shotgun.scene, "shotgun"),
      smg: takeGun(smg.scene, "smg"),
    },
    sources,
  };
}
