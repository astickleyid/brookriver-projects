import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three/webgpu";
import {
  actorCut,
  actorKey,
  chooseClip,
  clipPace,
  locomotionPose,
  appearanceFor,
  hopVelocity,
  sirenThreat,
  stepHop,
  streetClipNames,
  travelYaw,
  gunGripQuaternion,
  keepBaseMesh,
  lockInPlace,
  MEASURED_TOE,
  mountQuaternion,
  repairGunMaterial,
  type ClipQuery,
} from "./cast.ts";

const idle: ClipQuery = {
  down: false,
  reloading: false,
  shooting: false,
  aiming: false,
  pitch: 0,
  diving: false,
  speed: 0,
  fighting: false,
  armed: false,
  lingering: false,
  beat: "idle",
};

describe("cast facing", () => {
  it("turns the measured toe delta onto parent −Z", () => {
    // Toe delta and the eye offset both faced +Z in Blender, so this is one cue, not two.
    // The quaternion is built from +Z → −Z. Applying it to the recorded toe delta catches a missed mount.
    const toe = MEASURED_TOE.clone().applyQuaternion(mountQuaternion());
    assert.ok(toe.z < -0.1, `toe z ${toe.z}`);
    assert.ok(Math.abs(toe.x) < 0.02, `toe x ${toe.x}`);
  });
});

describe("chooseClip", () => {
  it("plays death, aim up, and the phone beat", () => {
    assert.equal(chooseClip({ ...idle, down: true, armed: true, shooting: true }).name, "Death01");
    assert.equal(chooseClip({ ...idle, down: true }).once, true);
    assert.equal(chooseClip({ ...idle, aiming: true, armed: true, pitch: 0.4 }).name, "Pistol_Aim_Up");
    assert.equal(chooseClip({ ...idle, lingering: true, beat: "phone" }).name, "Idle_TalkingPhone_Loop");
    assert.equal(chooseClip({ ...idle, speed: 7, armed: true }).name, "Sprint_Loop");
    assert.equal(chooseClip({ ...idle, fighting: true, armed: true }).name, "Pistol_Aim_Neutral");
    assert.equal(chooseClip({ ...idle, flinch: true, shooting: true, armed: true }).name, "Hit_Chest");
    assert.equal(chooseClip({ ...idle, flinch: true }).once, true);
    assert.equal(chooseClip({ ...idle, down: true, flinch: true }).name, "Death01");
    assert.equal(chooseClip({ ...idle, speed: 1, beat: "talk" }).name, "Walk_Formal_Loop");
    assert.equal(chooseClip({ ...idle, speed: 0, armed: true }).name, "Pistol_Idle_Loop");
    assert.equal(chooseClip({ ...idle, melee: "jab", armed: true, shooting: true }).name, "Punch_Jab");
    assert.equal(chooseClip({ ...idle, melee: "cross" }).name, "Punch_Cross");
    assert.equal(chooseClip({ ...idle, melee: "cross" }).once, true);
    assert.equal(chooseClip({ ...idle, melee: "shove" }).name, "Push_Loop");
    assert.equal(chooseClip({ ...idle, flinch: true, react: "head", melee: "jab" }).name, "Hit_Head");
    assert.equal(chooseClip({ ...idle, flinch: true, react: "knock" }).name, "Hit_Knockback");
    assert.equal(chooseClip({ ...idle, down: true, melee: "jab" }).name, "Death01");
    assert.equal(chooseClip({ ...idle, speed: 1, beat: "carry" }).name, "Walk_Carry_Loop");
    assert.equal(chooseClip({ ...idle, lingering: true, beat: "lean" }).name, "Idle_Rail_Loop");
    assert.equal(chooseClip({ ...idle, lingering: true, beat: "sittalk" }).name, "Sitting_Talking_Loop");
    assert.equal(chooseClip({ ...idle, lingering: true, beat: "pickup" }).name, "PickUp_Table");
    assert.equal(chooseClip({ ...idle, diving: true, speed: 3 }).name, "Roll");
    assert.equal(chooseClip({ ...idle, fighting: true, armed: true }).name, "Pistol_Aim_Neutral");
    assert.equal(chooseClip({ ...idle, aiming: true, armed: true, pitch: 0.4, gun: "shotgun" }).name, "Shotgun_Aim_Up");
    assert.equal(chooseClip({ ...idle, shooting: true, armed: true, gun: "smg" }).name, "SMG_Shoot");
    assert.equal(chooseClip({ ...idle, shooting: true, armed: true, gun: "smg" }).once, true);
    assert.equal(chooseClip({ ...idle, reloading: true, armed: true, gun: "shotgun" }).name, "Shotgun_Reload");
    assert.equal(chooseClip({ ...idle, speed: 1, armed: true, gun: "shotgun" }).name, "Walk_Loop__legs");
    assert.equal(chooseClip({ ...idle, speed: 1, armed: true, gun: "shotgun" }).arms, "Shotgun_Idle_Loop__arms");
    assert.equal(chooseClip({ ...idle, speed: 4, armed: true, gun: "pistol" }).arms, "Pistol_Idle_Loop__arms");
    assert.equal(chooseClip({ ...idle, speed: 1, aiming: true, armed: true, gun: "smg" }).arms, "SMG_Aim_Neutral__arms");
    assert.equal(chooseClip({ ...idle, speed: 1, shooting: true, armed: true, gun: "shotgun" }).armsOnce, true);
    assert.equal(chooseClip({ ...idle, speed: 0, armed: true, gun: "smg" }).name, "SMG_Idle_Loop");
    assert.equal(chooseClip({ ...idle, air: "up", speed: 7 }).name, "Jump_Start");
    assert.equal(chooseClip({ ...idle, air: "hang" }).name, "Jump_Loop");
    assert.equal(chooseClip({ ...idle, air: "land" }).once, true);
    assert.equal(chooseClip({ ...idle, air: "up", shooting: true, armed: true }).name, "Pistol_Shoot");
    assert.equal(chooseClip({ ...idle, speed: 2, armed: true, moving: false }).name, "Pistol_Idle_Loop");
    assert.equal(chooseClip({ ...idle, speed: 2, armed: true, moving: true }).name, "Walk_Loop__legs");
    assert.equal(chooseClip({ ...idle, fighting: true, armed: true, gun: "shotgun" }).name, "Shotgun_Aim_Neutral");
  });
});

describe("faces and guns", () => {
  it("keeps the head skin and turns the gun barrel forward", () => {
    assert.equal(keepBaseMesh("SuperHero_Male"), true);
    assert.equal(keepBaseMesh("Eyes"), true);
    assert.equal(keepBaseMesh("Eyebrows"), true);
    assert.equal(keepBaseMesh("Male_Peasant_Body"), false);
    const grip = gunGripQuaternion();
    const barrel = new THREE.Vector3(0, -1, 0).applyQuaternion(grip);
    const sights = new THREE.Vector3(1, 0, 0).applyQuaternion(grip);
    assert.ok(barrel.y > 0.9, `barrel y ${barrel.y}`);
    assert.ok(Math.abs(barrel.z) < 0.05, `barrel z ${barrel.z}`);
    assert.ok(sights.z > 0.9, `sights z ${sights.z}`);
    const mat = new THREE.MeshStandardMaterial({ opacity: 0, transparent: true, alphaTest: 0.5 });
    repairGunMaterial(mat);
    assert.equal(mat.opacity, 1);
    assert.equal(mat.alphaTest, 0);
    assert.equal(mat.transparent, false);
  });

  it("lets a death clip rotate the root and still pins its travel", () => {
    const times = new Float32Array([0, 1]);
    const pos = new Float32Array([0, 0, 0, 4, 0, 2]);
    const quat = new Float32Array([0, 0, 0, 1, 0, 0.7, 0, 0.7]);
    const clip = new THREE.AnimationClip("Death01", 1, [
      new THREE.VectorKeyframeTrack("root.position", times, pos),
      new THREE.QuaternionKeyframeTrack("root.quaternion", times, quat),
    ]);
    const held = lockInPlace(clip, true);
    const qTrack = held.tracks.find((track) => track.name === "root.quaternion")!;
    assert.ok(Math.abs(qTrack.values[5]! - 0.7) < 0.001);
    const pTrack = held.tracks.find((track) => track.name === "root.position")!;
    assert.equal(pTrack.values[3], 0);
    assert.equal(pTrack.values[5], 0);
    const frozen = lockInPlace(clip, false);
    const frozenQ = frozen.tracks.find((track) => track.name === "root.quaternion")!;
    assert.equal(frozenQ.values[5], 0);
  });
});

describe("cast roster", () => {
  it("puts the block in street clothes, both sexes, and separate crews", () => {
    const civ = new Set(Array.from({ length: 40 }, (_, i) => actorKey("civ", i)));
    const amber = new Set(Array.from({ length: 8 }, (_, i) => actorKey("amber", i)));
    const teal = new Set(Array.from({ length: 8 }, (_, i) => actorKey("teal", i)));
    const cops = new Set(Array.from({ length: 6 }, (_, i) => actorKey("cop", i)));
    assert.ok(civ.size >= 16);
    assert.ok([...civ].some((key) => key.includes("hoodie")));
    assert.ok([...civ].some((key) => key.includes("suit")));
    assert.ok([...civ].some((key) => key.startsWith("civ-f-")));
    assert.ok([...civ].some((key) => key.endsWith("-b")));
    assert.equal(amber.size, 4);
    assert.equal(teal.size, 4);
    assert.ok(cops.size >= 3);
    assert.equal(actorKey("player", 3), "player-rafa");
    const outfits = new Set(Array.from({ length: 40 }, (_, i) => actorCut(actorKey("civ", i))));
    assert.ok(outfits.has("hoodie"));
    assert.ok(outfits.has("suit"));
    assert.ok(outfits.has("worker"));
    assert.equal(actorCut("player-rafa"), "worker");
    assert.equal(actorCut("cop-m"), "uniform");
    assert.equal(actorCut("civ-f-tee-a"), "tee");
    for (const key of civ) assert.equal(key.includes("peasant") || key.includes("ranger"), false);
  });
});

describe("street clips", () => {
  it("covers every clip the crowd can ask for", () => {
    const have = new Set(streetClipNames());
    const queries: ClipQuery[] = [
      idle,
      { ...idle, down: true },
      { ...idle, flinch: true, react: "head" },
      { ...idle, flinch: true, react: "knock" },
      { ...idle, flinch: true },
      { ...idle, melee: "cross" },
      { ...idle, melee: "jab" },
      { ...idle, melee: "shove" },
      { ...idle, reloading: true, armed: true },
      { ...idle, shooting: true, armed: true },
      { ...idle, aiming: true, armed: true, pitch: 0.4 },
      { ...idle, aiming: true, armed: true, pitch: -0.4 },
      { ...idle, aiming: true, armed: true },
      { ...idle, diving: true, speed: 3 },
      { ...idle, diving: true, speed: 1 },
      { ...idle, diving: true, speed: 0 },
      { ...idle, fighting: true, armed: true },
      { ...idle, speed: 7 },
      { ...idle, speed: 4 },
      { ...idle, speed: 1, beat: "carry" },
      { ...idle, speed: 1, beat: "talk" },
      { ...idle, speed: 1 },
      { ...idle, lingering: true, beat: "phone" },
      { ...idle, lingering: true, beat: "talk" },
      { ...idle, lingering: true, beat: "sit" },
      { ...idle, lingering: true, beat: "sittalk" },
      { ...idle, lingering: true, beat: "dance" },
      { ...idle, lingering: true, beat: "fix" },
      { ...idle, lingering: true, beat: "lean" },
      { ...idle, lingering: true, beat: "shove" },
      { ...idle, lingering: true, beat: "pickup" },
      { ...idle, lingering: true, beat: "call" },
      { ...idle, lingering: true, beat: "carry" },
      { ...idle, beat: "lean" },
      { ...idle, beat: "talk" },
      { ...idle, beat: "phone" },
      { ...idle, armed: true },
      { ...idle, air: "up" },
      { ...idle, air: "hang" },
      { ...idle, air: "land" },
    ];
    for (const query of queries) {
      const name = chooseClip(query).name;
      assert.ok(have.has(name), name);
    }
  });
});

describe("travel and hop", () => {
  it("faces world −Z at yaw 0 and turns with velocity", () => {
    assert.ok(Math.abs(travelYaw(0, -1)) < 1e-6);
    assert.ok(Math.abs(travelYaw(-1, 0) - Math.PI / 2) < 1e-6);
    assert.ok(Math.abs(travelYaw(1, 0) + Math.PI / 2) < 1e-6);
    const back = travelYaw(0, 1);
    assert.ok(Math.abs(Math.abs(back) - Math.PI) < 1e-6);
  });

  it("keeps aimed movement animated in every direction", () => {
    assert.equal(clipPace(0, 1, 0, true), 1);
    assert.ok(clipPace(0, -4, 0, true) > 3);
    assert.ok(clipPace(0, 4, 0, false) > 3);
  });

  it("hops and comes back down", () => {
    let py = 0;
    let vy = hopVelocity();
    let peak = 0;
    let landed = false;
    for (let i = 0; i < 180; i++) {
      const hop = stepHop(py, vy, 1 / 60);
      py = hop.py;
      vy = hop.vy;
      peak = Math.max(peak, py);
      if (hop.landed) {
        landed = true;
        break;
      }
    }
    assert.ok(landed);
    assert.ok(peak > 0.8 && peak < 1.6, `peak ${peak}`);
    assert.equal(py, 0);
  });

  it("keeps the siren quiet until a unit is close", () => {
    assert.equal(sirenThreat([]), 0);
    assert.equal(sirenThreat([80, 120]), 0);
    assert.equal(sirenThreat([0]), 1);
    assert.ok(sirenThreat([23]) > 0.4 && sirenThreat([23]) < 0.6);
  });
});

describe("lockInPlace", () => {
  it("keeps pelvis drop and strips root travel", () => {
    const clip = new THREE.AnimationClip("Walk_Loop", 1, [
      new THREE.VectorKeyframeTrack("root.position", [0, 1], [0, 0, 0, 5, 1, 3]),
      new THREE.VectorKeyframeTrack("pelvis.position", [0, 1], [1, 0.9, 2, 4, 0.4, 9]),
    ]);
    const locked = lockInPlace(clip);
    const root = locked.tracks[0]!.values;
    const pelvis = locked.tracks[1]!.values;
    assert.equal(root[3], 0);
    assert.equal(root[4], 0);
    assert.equal(root[5], 0);
    assert.equal(pelvis[3], 1);
    assert.ok(Math.abs(pelvis[4] - 0.4) < 1e-5);
    assert.equal(pelvis[5], 2);
    assert.equal(clip.tracks[0]!.values[3], 5);
  });

  it("pins street Body X/Z and keeps a death drop", () => {
    const walk = new THREE.AnimationClip("Walk", 1, [
      new THREE.VectorKeyframeTrack("Body.position", [0, 1], [0, 0.8, -0.05, 0.4, 0.2, 0.9]),
      new THREE.QuaternionKeyframeTrack("Body.quaternion", [0, 1], [0, 0, 0, 1, 0.2, 0, 0, 0.98]),
    ]);
    const held = lockInPlace(walk, false);
    const pos = held.tracks[0]!.values;
    const quat = held.tracks[1]!.values;
    assert.equal(pos[3], 0);
    assert.ok(Math.abs(pos[4] - 0.2) < 1e-5);
    assert.ok(Math.abs(pos[5] + 0.05) < 1e-5);
    assert.equal(quat[4], 0);
    const death = lockInPlace(walk, true);
    assert.ok(Math.abs(death.tracks[0]!.values[3]! - 0.4) < 1e-5);
    assert.ok(Math.abs(death.tracks[1]!.values[4]! - 0.2) < 1e-5);
  });
});


describe("directional action matching", () => {
  it("backpedals with forward-facing hips and turns hips for strafing", () => {
    const back = locomotionPose(0, 4, 0);
    assert.equal(back.reverseStride, true);
    assert.ok(Math.abs(back.legYaw) < 1e-6);
    assert.ok(locomotionPose(4, 0, 0).legYaw < -1.5);
    assert.ok(locomotionPose(-4, 0, 0).legYaw > 1.5);
    assert.deepEqual(locomotionPose(0, 0, 2), { legYaw: 0, reverseStride: false });
  });
  it("keeps legs moving during reload and moving combat", () => {
    const reload = chooseClip({ ...idle, speed: 4, armed: true, reloading: true });
    assert.equal(reload.name, "Jog_Fwd_Loop__legs");
    assert.equal(reload.arms, "Pistol_Reload__arms");
    const fight = chooseClip({ ...idle, speed: 2, armed: true, fighting: true });
    assert.equal(fight.name, "Walk_Loop__legs");
    assert.equal(fight.arms, "Pistol_Aim_Neutral__arms");
  });
  it("has stable independent body and skin variation", () => {
    const keys = Array.from({ length: 20 }, (_, i) => actorKey("civ", i));
    const looks = keys.map(appearanceFor);
    assert.ok(new Set(looks.map((v) => v.height)).size >= 5);
    assert.ok(new Set(looks.map((v) => v.width)).size >= 5);
    assert.ok(new Set(looks.map((v) => v.skin.join())).size >= 4);
    assert.deepEqual(appearanceFor(keys[0]!), appearanceFor(keys[0]!));
  });
});
