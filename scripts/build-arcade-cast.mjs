/** Offline CC0 mesh tailoring and bind-space transfer. No paid service required.
 * Authored Quaternius modular clothes replace the retired procedural tube shells.
 * Preserve the Universal skeleton so the verified gameplay clips stay compatible.
 */
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { PLAYABLES } from "../src/game/roster.ts";

class FileReaderPolyfill {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
  async readAsDataURL(blob) {
    this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
    this.onloadend?.();
  }
}
globalThis.FileReader ??= FileReaderPolyfill;
const root = path.resolve("public/vendor/quaternius"),
  output = path.resolve("public/models/cast");
fs.mkdirSync(output, { recursive: true });
const components = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function read(file) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const buffers = json.buffers.map((b) =>
    b.uri.startsWith("data:")
      ? Buffer.from(b.uri.split(",")[1], "base64")
      : fs.readFileSync(path.join(path.dirname(file), b.uri)),
  );
  const accessor = (id) => {
    const a = json.accessors[id],
      v = json.bufferViews[a.bufferView],
      bytes = buffers[v.buffer],
      Type = components[a.componentType],
      width = sizes[a.type],
      stride = v.byteStride ?? width * Type.BYTES_PER_ELEMENT;
    const result = new Type(a.count * width),
      view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const get = {
      5120: "getInt8",
      5121: "getUint8",
      5122: "getInt16",
      5123: "getUint16",
      5125: "getUint32",
      5126: "getFloat32",
    }[a.componentType];
    for (let i = 0; i < a.count; i++)
      for (let c = 0; c < width; c++)
        result[i * width + c] = view[get](
          (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * stride + c * Type.BYTES_PER_ELEMENT,
          true,
        );
    return result;
  };
  return { json, accessor };
}
function target(sex) {
  const doc = read(
      `${root}/universal-base-characters/${sex === "m" ? "male/Superhero_Male" : "female/Superhero_Female"}_FullBody.gltf`,
    ),
    skin = doc.json.skins[0];
  const joints = new Set(skin.joints),
    nodes = doc.json.nodes.map((n, i) => {
      const o = joints.has(i) ? new THREE.Bone() : new THREE.Group();
      o.name = n.name ?? "";
      if (n.translation) o.position.fromArray(n.translation);
      if (n.rotation) o.quaternion.fromArray(n.rotation);
      if (n.scale) o.scale.fromArray(n.scale);
      return o;
    });
  doc.json.nodes.forEach((n, i) =>
    n.children?.forEach((c) => {
      if (doc.json.nodes[c].mesh === undefined) nodes[i].add(nodes[c]);
    }),
  );
  const scene = new THREE.Scene();
  doc.json.scenes[doc.json.scene ?? 0].nodes.forEach((i) => {
    if (doc.json.nodes[i].mesh === undefined) scene.add(nodes[i]);
  });
  scene.updateMatrixWorld(true);
  const inv = doc.accessor(skin.inverseBindMatrices),
    bones = skin.joints.map((i) => nodes[i]),
    inverses = bones.map((_, i) => new THREE.Matrix4().fromArray(inv, i * 16));
  const skeleton = new THREE.Skeleton(bones, inverses),
    ids = new Map(bones.map((b, i) => [b.name, i]));
  return {
    scene,
    skeleton,
    ids,
    positions: inverses.map((m) => new THREE.Vector3().setFromMatrixPosition(m.clone().invert())),
  };
}
function mapped(name) {
  const direct = {
    Hips: "pelvis",
    Abdomen: "spine_01",
    Torso: "spine_02",
    Chest: "spine_03",
    Neck: "neck_01",
    Head: "Head",
    Root: "root",
    Body: "pelvis",
  };
  if (direct[name]) return direct[name];
  const match = name.match(/^(.+)\.([LR])$/);
  if (!match) return "pelvis";
  const side = match[2].toLowerCase(),
    limb = {
      Shoulder: "clavicle",
      UpperArm: "upperarm",
      LowerArm: "lowerarm",
      Wrist: "hand",
      UpperLeg: "thigh",
      LowerLeg: "calf",
      Foot: "foot",
      Toe: "ball",
      Toes: "ball",
      PT: "ball",
    }[match[1]];
  if (limb) return `${limb}_${side}`;
  const finger = match[1].match(/^(Index|Middle|Ring|Pinky|Thumb)(\d)$/);
  if (finger) {
    const name = finger[1].toLowerCase(),
      n = +finger[2];
    return `${name}_${n === 4 && name !== "thumb" ? "04_leaf" : String(Math.min(n, 3)).padStart(2, "0")}_${side}`;
  }
  return `hand_${side}`;
}
const manifest = [];
for (const hero of PLAYABLES) {
  const t = target(hero.sex),
    src = read(`${root}/${hero.source}.gltf`),
    skin = src.json.skins[0],
    inv = src.accessor(skin.inverseBindMatrices);
  const sourceNames = skin.joints.map((i) => src.json.nodes[i].name),
    sourcePositions = sourceNames.map((_, i) =>
      new THREE.Vector3().setFromMatrixPosition(
        new THREE.Matrix4().fromArray(inv, i * 16).invert(),
      ),
    );
  const map = sourceNames.map((n) => {
    const id = t.ids.get(mapped(n));
    if (id === undefined) throw new Error(`Unmapped source joint ${n} -> ${mapped(n)}`);
    return id;
  });

  const sourceAt = (name) => sourcePositions[sourceNames.indexOf(name)],
    targetAt = (name) => t.positions[t.ids.get(name)];
  const sa = sourceAt("UpperArm.L"),
    sb = sourceAt("LowerArm.L"),
    sc = sourceAt("Wrist.L"),
    ta = targetAt("upperarm_l"),
    tb = targetAt("lowerarm_l"),
    tc = targetAt("hand_l");
  const headShift = targetAt("Head").z - sourceAt("Head").z,
    footShift = targetAt("foot_l").z - sourceAt("Foot.L").z;
  const positions = [],
    normals = [],
    colors = [],
    joints = [],
    weights = [],
    indices = [],
    prints = [];
  const skinColor = new THREE.Color(hero.skinColor),
    hairColor = new THREE.Color(hero.hairTint),
    fabric = new THREE.Color(hero.profile.fabric),
    pants = new THREE.Color(hero.profile.trousers),
    accent = new THREE.Color(hero.profile.accent),
    ink = new THREE.Color(0x22252b);
  let primitiveCount = 0;
  for (const node of src.json.nodes) {
    if (node.mesh === undefined) continue;
    for (const primitive of src.json.meshes[node.mesh].primitives) {
      const p = src.accessor(primitive.attributes.POSITION),
        n = src.accessor(primitive.attributes.NORMAL),
        j = src.accessor(primitive.attributes.JOINTS_0),
        w = src.accessor(primitive.attributes.WEIGHTS_0),
        index = src.accessor(primitive.indices),
        material = src.json.materials[primitive.material]?.name ?? "";
      const offset = positions.length / 3;
      for (let i = 0; i < p.length / 3; i++) {
        const v = new THREE.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]),
          old = v.clone();
        const influences = new Map();
        for (let c = 0; c < 4; c++) {
          const source = j[i * 4 + c],
            weight = w[i * 4 + c];
          if (weight <= 0) continue;
          influences.set(map[source], (influences.get(map[source]) ?? 0) + weight);
        }
        // Fit the authored T-pose to anatomical landmarks as a continuous spatial
        // warp. Bone-by-bone translations pinch collars because the two rigs split
        // their spines at different heights; they are deliberately not used here.
        const ax = Math.abs(v.x),
          sign = Math.sign(v.x),
          armField =
            THREE.MathUtils.smoothstep(v.y, 1.2, 1.36) *
            (1 - THREE.MathUtils.smoothstep(v.y, 1.56, 1.65));
        let reach = ax;
        if (ax < sa.x) reach = ax * (ta.x / sa.x);
        else if (ax < sb.x) reach = THREE.MathUtils.lerp(ta.x, tb.x, (ax - sa.x) / (sb.x - sa.x));
        else if (ax < sc.x) reach = THREE.MathUtils.lerp(tb.x, tc.x, (ax - sb.x) / (sc.x - sb.x));
        else reach = tc.x + (ax - sc.x);
        v.x = sign * THREE.MathUtils.lerp(ax, reach, armField);
        v.y += (ta.y - sa.y) * armField;
        const bodyShift = THREE.MathUtils.lerp(
          footShift,
          headShift,
          THREE.MathUtils.clamp(v.y / 1.45, 0, 1),
        );
        const armShift = THREE.MathUtils.lerp(
          ta.z - sa.z,
          tc.z - sc.z,
          THREE.MathUtils.clamp((ax - sa.x) / (sc.x - sa.x), 0, 1),
        );
        v.z += THREE.MathUtils.lerp(
          bodyShift,
          armShift,
          armField * THREE.MathUtils.smoothstep(ax, 0.12, 0.3),
        );
        const bulk =
          hero.id === "briggs" ? 1.32 : hero.id === "rhett" ? 1.13 : hero.id === "rafa" ? 1.12 : 1;
        if (ax > sa.x && ax < sc.x) {
          const radiusScale = 1 + (bulk - 1) * armField;
          v.y = ta.y + (v.y - ta.y) * radiusScale;
          v.z = (ta.z + tc.z) / 2 + (v.z - (ta.z + tc.z) / 2) * radiusScale;
        }
        const headWeight = [...influences]
          .filter(([id]) => t.skeleton.bones[id].name === "Head")
          .reduce((a, [, w]) => a + w, 0);
        if (headWeight > 0.5) {
          const pivot = t.positions[t.ids.get("Head")];
          v.sub(pivot);
          v.x *= 1.1 * hero.shape.jaw;
          v.y *= 1.08;
          v.z *= 1.06;
          v.add(pivot);
        }
        const torso = Math.max(0, 1 - Math.abs(v.x) / 0.34),
          swell = (c, s) => Math.exp(-(((v.y - c) / s) ** 2));
        v.x *=
          1 +
          torso *
            ((hero.shape.chest - 1) * swell(1.32, 0.18) +
              (hero.shape.waist - 1) * swell(1.07, 0.12) +
              (hero.shape.hips - 1) * swell(0.88, 0.15));
        v.z *= 1 + (hero.shape.depth - 1) * torso * swell(1.2, 0.3);
        // Chunky footwear is an intentional arcade silhouette, not a torso/body swell.
        if (v.y < 0.15) {
          const sign = v.x < 0 ? -1 : 1;
          v.x = sign * 0.114 + (v.x - sign * 0.114) * 1.16;
          v.z = 0.015 + (v.z - 0.015) * 1.14;
        }
        positions.push(v.x, v.y, v.z);
        normals.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
        let color;
        if (/^Skin/.test(material))
          color = skinColor.clone().multiplyScalar(material.includes("Darker") ? 0.8 : 1);
        else if (/Eye$/.test(material)) color = ink;
        else if (
          /Hair|Eyebrows|Moustache/.test(material) ||
          (hero.source.endsWith("/Punk") && old.y > 1.7 && /Red|Pink/.test(material))
        )
          color = hairColor;
        else if (/Earring/.test(material)) color = accent;
        else if (/Feet/.test(node.name))
          color = hero.id === "rhett" ? fabric : hero.id === "briggs" ? ink : accent;
        else if (/Legs/.test(node.name)) color = pants;
        else if (/Black/.test(material)) color = ink;
        else if (/White|Grey/.test(material) && hero.source.endsWith("/Worker")) color = accent;
        else if (/Worker_Yellow/.test(material)) color = hero.id === "rafa" ? ink : accent;
        else if (/White/.test(material) && hero.source.endsWith("/Punk")) color = fabric;
        else color = fabric;
        if (
          /^Skin/.test(material) &&
          ["rhett", "briggs"].includes(hero.id) &&
          Math.abs(old.x) > 0.51 &&
          Math.abs(old.x) < 0.66
        )
          color = ink;
        colors.push(color.r, color.g, color.b);
        const merged = [...influences].sort((a, b) => b[1] - a[1]).slice(0, 4),
          sum = merged.reduce((a, [, w]) => a + w, 0);
        for (let c = 0; c < 4; c++) {
          joints.push(merged[c]?.[0] ?? 0);
          weights.push((merged[c]?.[1] ?? 0) / sum);
        }
      }
      for (let k = 0; k < index.length; k += 3) {
        const tri = [index[k], index[k + 1], index[k + 2]];
        const head = tri.every((i) => {
          let weight = 0;
          for (let c = 0; c < 4; c++)
            if (sourceNames[j[i * 4 + c]] === "Head") weight += w[i * 4 + c];
          return weight > 0.5;
        });
        const height = tri.reduce((v, i) => v + p[i * 3 + 1], 0) / 3;
        const keepHair =
          /Hair/.test(material) || (hero.source.endsWith("/Punk") && /Red|Pink/.test(material));
        if (head && !(keepHair && height > 1.7)) continue;
        for (const i of tri) indices.push(offset + i);
        const front = tri.every((i) => n[i * 3 + 2] > 0.15);
        if (
          /Body/.test(node.name) &&
          !/^Skin/.test(material) &&
          front &&
          height > 1.06 &&
          height < 1.48
        )
          for (const i of tri) prints.push(offset + i);
      }
      primitiveCount++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(joints, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const mesh = new THREE.SkinnedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
  );
  mesh.name = `${hero.id}:authored-body`;
  mesh.bind(t.skeleton, new THREE.Matrix4());
  mesh.frustumCulled = false;
  t.scene.add(mesh);
  t.scene.updateMatrixWorld(true);
  const printGeometry = new THREE.BufferGeometry();
  const printPositions = Float32Array.from(positions),
    uv = [];
  for (let i = 0; i < positions.length / 3; i++) {
    printPositions[i * 3] += normals[i * 3] * 0.004;
    printPositions[i * 3 + 1] += normals[i * 3 + 1] * 0.004;
    printPositions[i * 3 + 2] += normals[i * 3 + 2] * 0.004;
    uv.push((positions[i * 3] + 0.18) / 0.36, (positions[i * 3 + 1] - 1.07) / 0.39);
  }
  printGeometry.setAttribute("position", new THREE.BufferAttribute(printPositions, 3));
  for (const name of ["normal", "skinIndex", "skinWeight"])
    printGeometry.setAttribute(name, geometry.getAttribute(name));
  printGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  printGeometry.setIndex(prints);
  const printMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    alphaTest: 0.1,
    roughness: 0.96,
  });
  printMaterial.name = "arcade-print";
  const printMesh = new THREE.SkinnedMesh(printGeometry, printMaterial);
  printMesh.name = `${hero.id}:graphic`;
  printMesh.bind(t.skeleton, new THREE.Matrix4());
  printMesh.frustumCulled = false;
  t.scene.add(printMesh);
  const compact = (original) => {
    const used = [...new Set(original.getIndex().array)],
      ids = new Map(used.map((id, i) => [id, i])),
      result = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(original.attributes)) {
      const array = new attribute.array.constructor(used.length * attribute.itemSize);
      used.forEach((old, i) => {
        for (let c = 0; c < attribute.itemSize; c++)
          array[i * attribute.itemSize + c] = attribute.getComponent(old, c);
      });
      result.setAttribute(
        name,
        new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized),
      );
    }
    result.setIndex(Array.from(original.getIndex().array, (id) => ids.get(id)));
    result.computeBoundingBox();
    return result;
  };
  mesh.geometry = compact(geometry);
  printMesh.geometry = compact(printGeometry);
  const binary = await new GLTFExporter().parseAsync(t.scene, {
    binary: true,
    onlyVisible: true,
    animations: [],
    trs: true,
  });
  const file = path.join(output, `${hero.id}.glb`);
  fs.writeFileSync(file, Buffer.from(binary));
  const report = {
    id: hero.id,
    name: hero.name,
    source: hero.source,
    asset: hero.asset,
    vertices: mesh.geometry.getAttribute("position").count,
    triangles: indices.length / 3,
    bytes: binary.byteLength,
    sourcePrimitives: primitiveCount,
    bones: t.skeleton.bones.map((b) => b.name),
    bounds: { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() },
  };
  manifest.push(report);
  console.log(hero.id, report.vertices, report.triangles, report.bytes);
}
fs.writeFileSync(
  path.join(output, "manifest.json"),
  JSON.stringify(
    {
      license:
        "CC0 / Quaternius Ultimate Modular Men and Women; Universal Base Characters skeleton",
      pipeline: "scripts/build-arcade-cast.mjs",
      characters: manifest,
    },
    null,
    2,
  ),
);
