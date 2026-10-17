/** Import THEUNSEENVULGA's CC0 Diesel without reshaping its mesh or replacing its head.
 * Usage: node --experimental-strip-types scripts/import-diesel.mjs /path/to/Diesel.glb
 * Retarget the CC0 Universal clips offline in world space, accounting for both bind poses.
 * Texture optimization is a separate glTF Transform step documented in ASSETS.md.
 */
import fs from "node:fs";
import * as T from "three";
import { streetClipNames, lockInPlace } from "../src/game/cast.ts";

function read(file) {
  const b = fs.readFileSync(file), length = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + length).toString());
  const binary = b.subarray(28 + length);
  const get = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView];
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    const format = { 5126: ["getFloat32",4], 5123: ["getUint16",2], 5121: ["getUint8",1] }[a.componentType];
    if (!format) throw new Error(`Unsupported component ${a.componentType}`);
    const out = new Float32Array(a.count * width), data = new DataView(binary.buffer, binary.byteOffset);
    for (let n = 0; n < a.count; n++) for (let c = 0; c < width; c++)
      out[n * width + c] = data[format[0]]((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + n * (v.byteStride ?? width * format[1]) + c * format[1], true);
    return out;
  };
  return { json, binary, get };
}

function hierarchy(json) {
  const nodes = json.nodes.map((n) => {
    const o = new T.Object3D(); o.name = n.name;
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    if (n.matrix) { o.matrix.fromArray(n.matrix); o.matrix.decompose(o.position, o.quaternion, o.scale); }
    return o;
  });
  json.nodes.forEach((n, i) => n.children?.forEach(c => nodes[i].add(nodes[c])));
  const scene = new T.Group();
  json.scenes[json.scene ?? 0].nodes.forEach(i => scene.add(nodes[i]));
  scene.updateMatrixWorld(true);
  return { scene, nodes, byName: new Map(nodes.map(o => [o.name, o])) };
}

function canonical(n) {
  if (!n.startsWith("mixamorig:")) return n;
  const base = n.slice(10);
  const direct = { Hips: "pelvis", Spine: "spine_01", Spine1: "spine_02", Spine2: "spine_03", Neck: "neck_01", Head: "Head" };
  if (direct[base]) return direct[base];
  const match = base.match(/^(Left|Right)(.+)$/);
  if (!match) return base;
  const side = match[1] === "Left" ? "l" : "r", part = match[2];
  const limb = { Shoulder: "clavicle", Arm: "upperarm", ForeArm: "lowerarm", Hand: "hand", UpLeg: "thigh", Leg: "calf", Foot: "foot", ToeBase: "ball" }[part];
  if (limb) return `${limb}_${side}`;
  const finger = part.match(/^Hand(Thumb|Index|Middle|Ring|Pinky)([1-4])$/);
  if (finger) return `${finger[1].toLowerCase()}_${finger[2].padStart(2,"0")}_${side}`;
  return `${part}_${side}`;
}

/** Reach the support wrist without scaling the source's shorter stylized arms. */
function supportHand(rig, target) {
  const hand = rig.byName.get("hand_l"), orientation = hand.getWorldQuaternion(new T.Quaternion());
  for (let pass = 0; pass < 6; pass++) {
    for (const name of ["lowerarm_l", "upperarm_l"]) {
      const joint = rig.byName.get(name), origin = joint.getWorldPosition(new T.Vector3());
      const from = hand.getWorldPosition(new T.Vector3()).sub(origin).normalize();
      const to = target.clone().sub(origin).normalize();
      const world = joint.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromUnitVectors(from,to));
      joint.quaternion.copy(joint.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));
      joint.updateMatrixWorld(true);
    }
  }
  hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(orientation));
  hand.updateMatrixWorld(true);
}

const input = process.argv[2];
if (!input) throw new Error("Supply the creator's downloaded Diesel.glb");
const target = read(input);
target.json.nodes.forEach(n => n.name = canonical(n.name));
// The source includes three alternative eyebrow meshes. Keep the thick authored pair.
target.json.nodes.forEach(n => { if (n.children) n.children = n.children.filter(i => !/^(mid_eyebrow|small_eye_brow)/.test(target.json.nodes[i].name)); });
const dst = hierarchy(target.json), wanted = new Set(streetClipNames());
const destination = target.json.skins[0].joints.map(i => ({ index: i, bone: dst.nodes[i], name: dst.nodes[i].name }));
const inverse = target.get(target.json.skins[0].inverseBindMatrices);
const bootNode = target.json.nodes.find(n => n.name.startsWith("boots"));
const bootPrimitive = target.json.meshes[bootNode.mesh].primitives[0];
const bootPositions = target.get(bootPrimitive.attributes.POSITION), bootJoints = target.get(bootPrimitive.attributes.JOINTS_0), bootWeights = target.get(bootPrimitive.attributes.WEIGHTS_0);
function soleHeight() {
  const matrices = destination.map((d,i) => d.bone.matrixWorld.clone().multiply(new T.Matrix4().fromArray(inverse,i*16)));
  let low = Infinity;
  for (let i=0;i<bootPositions.length/3;i++) {
    const v = new T.Vector3().fromArray(bootPositions,i*3); let y=0;
    for (let c=0;c<4;c++) {
      const w = bootWeights[i*4+c]; if (!w) continue;
      const m = matrices[bootJoints[i*4+c]].elements;
      y += w * (m[1]*v.x + m[5]*v.y + m[9]*v.z + m[13]);
    }
    low=Math.min(low,y);
  }
  return low;
}
const rest = new Map(dst.nodes.map(o => [o.name, { world: o.getWorldQuaternion(new T.Quaternion()), position: o.position.clone() }]));
const chunks = [target.binary], buffers = target.json.bufferViews, accessors = target.json.accessors;
let offset = target.binary.length;
const append = (values, type) => {
  const pad = (4 - offset % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  const data = Buffer.from(values.buffer, values.byteOffset, values.byteLength), width = type === "SCALAR" ? 1 : type === "VEC3" ? 3 : 4;
  const v = buffers.push({ buffer: 0, byteOffset: offset, byteLength: data.length }) - 1;
  chunks.push(data); offset += data.length;
  const a = { bufferView: v, componentType: 5126, count: values.length / width, type };
  if (type === "SCALAR") { a.min = [values[0]]; a.max = [values[values.length - 1]]; }
  return accessors.push(a) - 1;
};
const animations = [], results = [];
for (const file of ["public/vendor/quaternius/universal-animation-library/UAL1_Standard.glb", "public/vendor/quaternius/universal-animation-library-2/UAL2_Standard.glb"]) {
  const source = read(file);
  for (const a of source.json.animations) {
    if (!wanted.has(a.name)) continue;
    wanted.delete(a.name);
    const src = hierarchy(source.json), srcRest = new Map(src.nodes.map(o => [o.name, o.getWorldQuaternion(new T.Quaternion())]));
    const sourceHip = src.byName.get("pelvis"), hipRest = sourceHip.getWorldPosition(new T.Vector3());
    const tracks = a.channels.map(c => {
      const s = a.samplers[c.sampler], name = source.json.nodes[c.target.node].name;
      const prop = { translation: "position", rotation: "quaternion", scale: "scale" }[c.target.path];
      const Track = prop === "quaternion" ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack;
      return new Track(`${name}.${prop}`, source.get(s.input), source.get(s.output), s.interpolation === "STEP" ? T.InterpolateDiscrete : T.InterpolateLinear);
    });
    const clip = lockInPlace(new T.AnimationClip(a.name, -1, tracks), /^(Death01|Hit_)/.test(a.name));
    const mixer = new T.AnimationMixer(src.scene); mixer.clipAction(clip).setLoop(T.LoopOnce, 1).play();
    const frames = Math.ceil(clip.duration * 30) + 1, times = Float32Array.from({ length: frames }, (_, i) => Math.min(clip.duration - 1e-6, i / 30));
    const mapped = destination.filter(d => src.byName.has(d.name));
    const rotations = new Map(mapped.map(d => [d.name, new Float32Array(frames * 4)])), hips = new Float32Array(frames * 3);
    const ratio = rest.get("pelvis").position.y / hipRest.y;
    let firstSole = 0;
    for (let frame = 0; frame < frames; frame++) {
      mixer.setTime(times[frame]); src.scene.updateMatrixWorld(true);
      // Traverse the target hierarchy parent first, regardless of glTF joint order.
      dst.scene.traverse(o => {
        const s = src.byName.get(o.name); if (!s || !rotations.has(o.name)) return;
        const world = s.getWorldQuaternion(new T.Quaternion()).multiply(srcRest.get(o.name).clone().invert()).multiply(rest.get(o.name).world);
        const parent = o.parent.getWorldQuaternion(new T.Quaternion());
        o.quaternion.copy(parent.invert().multiply(world));
        o.updateMatrixWorld(true);
      });
      const p = sourceHip.getWorldPosition(new T.Vector3()).sub(hipRest).multiplyScalar(ratio);
      const hip = dst.byName.get("pelvis");
      // In-place horizontal motion; preserve the authored vertical stride and jump motion.
      hip.position.copy(rest.get("pelvis").position); hip.position.y += p.y;
      dst.scene.updateMatrixWorld(true);
      if (a.name.startsWith("Pistol_")) {
        const sourceGap = src.byName.get("hand_l").getWorldPosition(new T.Vector3()).sub(src.byName.get("hand_r").getWorldPosition(new T.Vector3()));
        supportHand(dst, dst.byName.get("hand_r").getWorldPosition(new T.Vector3()).add(sourceGap.multiplyScalar(0.82)));
      }
      const sole = soleHeight();
      if (frame === 0) firstSole = sole;
      // World physics supplies jump height. Standing and walking must keep a sole on the floor.
      const grounded = /^(Idle_|Walk_|Jog_|Sprint_|Pistol_|Crouch_|Punch_|Push_|Interact|Fixing|PickUp|Sitting_)/.test(a.name);
      hip.position.y -= grounded ? sole : firstSole;
      hip.position.toArray(hips, frame * 3);
      for (const d of mapped) d.bone.quaternion.toArray(rotations.get(d.name), frame * 4);
    }
    const samplerInput = append(times, "SCALAR"), samplers = [], channels = [];
    for (const d of mapped) {
      const output = append(rotations.get(d.name), "VEC4");
      channels.push({ sampler: samplers.length, target: { node: d.index, path: "rotation" } });
      samplers.push({ input: samplerInput, output, interpolation: "LINEAR" });
    }
    channels.push({ sampler: samplers.length, target: { node: destination.find(d => d.name === "pelvis").index, path: "translation" } });
    samplers.push({ input: samplerInput, output: append(hips, "VEC3"), interpolation: "LINEAR" });
    animations.push({ name: a.name, samplers, channels }); results.push({ name: a.name, bones: mapped.length, frames });
    mixer.stopAllAction(); mixer.uncacheRoot(src.scene);
    // Reset destination before the next clip.
    target.json.nodes.forEach((n, i) => { const o = dst.nodes[i]; o.quaternion.fromArray(n.rotation ?? [0,0,0,1]); o.position.copy(rest.get(o.name).position); });
    dst.scene.updateMatrixWorld(true);
  }
}
if (wanted.size) throw new Error(`Missing clips: ${[...wanted]}`);
const srcHand = hierarchy(read("public/vendor/quaternius/universal-animation-library/UAL1_Standard.glb").json).byName.get("hand_r").getWorldQuaternion(new T.Quaternion());
target.json.asset.copyright = "Diesel by THEUNSEENVULGA (CC0). Animations by Quaternius (CC0).";
target.json.asset.extras = { source: "https://theunseenvulga.itch.io/3d-charater-riggeddiesel", license: "CC0-1.0", changes: "Bone naming, bind-aware animation retargeting, one eyebrow alternative selected; authored geometry and textures retained." };
target.json.scenes[target.json.scene ?? 0].extras = { brookriver: { nativeCharacter: true, gripBasis: rest.get("hand_r").world.clone().invert().multiply(srcHand).toArray() } };
target.json.animations = animations; target.json.buffers = [{ byteLength: offset }];
const binary = Buffer.concat(chunks), jb = Buffer.from(JSON.stringify(target.json));
const jpad = Buffer.concat([jb, Buffer.alloc((4-jb.length%4)%4, 0x20)]), bpad = Buffer.concat([binary, Buffer.alloc((4-binary.length%4)%4)]);
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2,4); header.writeUInt32LE(28+jpad.length+bpad.length,8);
const jh=Buffer.alloc(8), bh=Buffer.alloc(8); jh.writeUInt32LE(jpad.length); jh.writeUInt32LE(0x4e4f534a,4); bh.writeUInt32LE(bpad.length); bh.writeUInt32LE(0x004e4942,4);
fs.mkdirSync("public/models/sourced", { recursive:true });
fs.writeFileSync("public/models/sourced/diesel-unoptimized.glb",Buffer.concat([header,jh,jpad,bh,bpad]));
console.log(JSON.stringify({ clips: results, bytes: 28+jpad.length+bpad.length },null,2));
