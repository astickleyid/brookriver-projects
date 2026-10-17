import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type Wardrobe = "tee" | "hoodie" | "jacket" | "worker" | "suit" | "uniform";
export type CharacterProfile = {
  id: string;
  name: string;
  role: string;
  manner: string;
  outfit: Wardrobe;
  fabric: number;
  trousers: number;
  accent: number;
  accessories: string[];
  idle: "idle" | "talk" | "phone" | "dance";
  gait: number;
  height: number;
  build: number;
};

const FIRST = [
  "Mara",
  "Leon",
  "Imani",
  "Theo",
  "Rosa",
  "Ezra",
  "Nia",
  "Vince",
  "Jules",
  "Kai",
  "Ada",
  "Dante",
];
const LAST = ["Mercer", "Ortiz", "Bennett", "Reed", "Park", "Hayes", "Vega", "Cole"];
const PALETTES = [
  [0x365c62, 0x232e3a, 0xd4a15b],
  [0x934d43, 0x272932, 0xe1c89a],
  [0x7a8057, 0x343b42, 0xe5a64e],
  [0x455675, 0x222733, 0xb7c1cb],
  [0xa58c68, 0x34444f, 0xb95748],
  [0x6c536c, 0x282b36, 0xd6a95e],
  [0x394b40, 0x403b38, 0xb99a71],
  [0x9b793a, 0x272f3c, 0xe2d2b1],
];
const PERSONAS = {
  hoodie: [
    ["Bicycle courier", "Always on a deadline", "cap", "backpack"],
    ["Art student", "Sketches the city after dark", "beanie", "glasses", "satchel"],
    ["Skater", "Knows every cut-through", "beanie", "headphones"],
  ],
  tee: [
    ["Record collector", "Never misses a night set", "headphones", "satchel"],
    ["Club regular", "Knows everyone at the door", "chain", "earrings"],
    ["Street photographer", "Finds stories in the side streets", "cap", "satchel"],
  ],
  jacket: [
    ["Motorcycle mechanic", "Keeps old machines alive", "glasses", "chain"],
    ["Night promoter", "Works the late crowd", "earrings", "satchel"],
    ["Local musician", "Waiting for the next gig", "headphones", "chain"],
  ],
  worker: [
    ["Transit electrician", "Fixes the things nobody notices", "hardhat", "toolbelt"],
    ["Dock worker", "First shift starts before sunrise", "beanie", "toolbelt"],
    ["Building caretaker", "Has a key to half the block", "cap", "satchel"],
  ],
  suit: [
    ["Gallery owner", "Stays late for the opening", "glasses", "earrings"],
    ["Defense attorney", "Always takes the call", "glasses", "satchel"],
    ["Hotel night manager", "Remembers every face", "chain", "glasses"],
  ],
  uniform: [["Patrol officer", "Watching the junction", "policecap", "dutybelt"]],
} as const;

/** Each resident has an identity independent of their shared animation rig. */
export function characterProfile(key: string, index: number): CharacterProfile {
  const outfit =
    (["hoodie", "jacket", "worker", "suit", "uniform", "tee"] as Wardrobe[]).find((v) =>
      key.includes(v),
    ) ?? (key.startsWith("cop") ? "uniform" : key.startsWith("amber") ? "jacket" : "hoodie");
  const n = Math.abs(index);
  const choices = PERSONAS[outfit];
  const persona = choices[n % choices.length]!;
  const palette = PALETTES[(n * 5 + Math.floor(n / 7)) % PALETTES.length]!;
  const faction = key.split("-")[0];
  const fabric =
    faction === "amber"
      ? [0xa66f36, 0xc08a3e, 0x80512c][n % 3]!
      : faction === "teal"
        ? [0x2e7774, 0x315d69, 0x3d8d87][n % 3]!
        : faction === "cop"
          ? 0x283c58
          : palette[0]!;
  return {
    id: `${faction}-${n}`,
    name:
      faction === "player"
        ? "You"
        : `${FIRST[n % FIRST.length]} ${LAST[(n * 5 + Math.floor(n / FIRST.length)) % LAST.length]}`,
    role:
      faction === "amber"
        ? "West Corner crew"
        : faction === "teal"
          ? "East Corner crew"
          : persona[0],
    manner: persona[1],
    outfit,
    fabric,
    trousers: palette[1]!,
    accent: palette[2]!,
    accessories: [...persona.slice(2)],
    idle:
      persona[0].includes("musician") || persona[0].includes("Club")
        ? "dance"
        : persona[0].includes("attorney")
          ? "phone"
          : n % 3 === 0
            ? "talk"
            : "idle",
    gait: 0.92 + (n % 7) * 0.028,
    height: 0.94 + (n % 8) * 0.018,
    build: 0.91 + ((n * 3) % 9) * 0.025,
  };
}

function material(color: number, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: metalness ? 0.36 : 0.94, metalness });
}

/** A separately skinned cloth shell: softer, fuller sleeves and trousers replace
 * the muscle definition of the base skin. It retains the exact bone weights. */
export function garmentGeometry(
  source: THREE.BufferGeometry,
  outfit: Wardrobe,
  profile: CharacterProfile,
  boneNames: string[] = [],
) {
  const geo = source.clone();
  const pos = geo.getAttribute("position"),
    normal = geo.getAttribute("normal");
  const color = new Float32Array(pos.count * 3);
  const kept: number[] = [];
  const index = geo.getIndex();
  const limit = index?.count ?? pos.count;
  const joints = geo.getAttribute("skinIndex"),
    weights = geo.getAttribute("skinWeight");
  const isCloth = (i: number) => {
    if (boneNames.length && joints && weights) {
      let exposed = 0;
      for (let c = 0; c < 4; c++) {
        const name = boneNames[joints.getComponent(i, c)] ?? "";
        if (/^(Head|neck_|hand_|index_|middle_|ring_|pinky_|thumb_)/.test(name))
          exposed += weights.getComponent(i, c);
      }
      if (exposed > 0.35) return false;
    }
    const y = pos.getY(i),
      x = Math.abs(pos.getX(i));
    if ((y > 1.56 && x < 0.14) || y > 1.64 || (!boneNames.length && x > 0.74)) return false; // head / neck / hands
    if (outfit === "tee" && y > 1.18 && x > 0.41) return false;
    return true;
  };
  for (let i = 0; i < limit; i += 3) {
    const a = index ? index.getX(i) : i,
      b = index ? index.getX(i + 1) : i + 1,
      c = index ? index.getX(i + 2) : i + 2;
    if (isCloth(a) && isCloth(b) && isCloth(c)) kept.push(a, b, c);
  }
  const cloth = new THREE.Color(profile.fabric),
    pants = new THREE.Color(profile.trousers),
    shoes = new THREE.Color(0x24272b);
  const bulk =
    outfit === "hoodie"
      ? 0.055
      : outfit === "jacket"
        ? 0.045
        : outfit === "worker"
          ? 0.04
          : outfit === "suit"
            ? 0.026
            : 0.018;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const amount = y < 0.14 ? 0.025 : y < 0.98 ? 0.035 : bulk;
    pos.setXYZ(
      i,
      pos.getX(i) + normal.getX(i) * amount,
      y + normal.getY(i) * amount,
      pos.getZ(i) + normal.getZ(i) * amount,
    );
    const tint = y < 0.14 ? shoes : y < 0.98 ? pants : cloth;
    color.set([tint.r, tint.g, tint.b], i * 3);
  }
  geo.setIndex(kept);
  geo.setAttribute("color", new THREE.BufferAttribute(color, 3));
  geo.computeVertexNormals();
  return geo;
}

export function dressCharacter(rig: THREE.Object3D, profile: CharacterProfile) {
  rig.updateMatrixWorld(true);
  let body: THREE.SkinnedMesh | undefined;
  rig.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && /superhero/i.test(o.name))
      body = o as THREE.SkinnedMesh;
  });
  if (!body) return;
  // Match the exposed collar and sleeve edges to the overlying garment. Skin
  // pixels use the shared-atlas mask, so face/hands never inherit fabric tint.
  const baseMat = body.material as THREE.MeshStandardMaterial;
  const skinMask = baseMat.map?.userData.skinMask as Uint8Array | undefined;
  if (baseMat.map && skinMask) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(baseMat.map.image as CanvasImageSource, 0, 0, 512, 512);
    const pixels = ctx.getImageData(0, 0, 512, 512),
      d = pixels.data;
    const tint = new THREE.Color(profile.fabric).convertLinearToSRGB();
    for (let i = 0; i < d.length; i += 4)
      if (!skinMask[i / 4]) {
        d[i] = tint.r * 180;
        d[i + 1] = tint.g * 180;
        d[i + 2] = tint.b * 180;
      }
    ctx.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.flipY = baseMat.map.flipY;
    const mat = baseMat.clone();
    mat.map = map;
    mat.normalMap = null;
    mat.roughness = 0.95;
    body.material = mat;
  }
  const shell = new THREE.SkinnedMesh(
    garmentGeometry(
      body.geometry,
      profile.outfit,
      profile,
      body.skeleton.bones.map((b) => b.name),
    ),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }),
  );
  shell.name = `${profile.name} · ${profile.outfit}`;
  shell.bind(body.skeleton, body.bindMatrix);
  shell.frustumCulled = false;
  body.parent!.add(shell);

  const black = material(0x252a30),
    cloth = material(profile.fabric),
    accent = material(profile.accent),
    metal = material(0xb2ac92, 0.7),
    lens = material(0x1b2833, 0.45);
  const attachments: THREE.Mesh[] = [];
  const head = rig.getObjectByName("Head"),
    chest = rig.getObjectByName("spine_03"),
    hips = rig.getObjectByName("pelvis");
  const headH = profile.outfit === "uniform" || !rig.name.includes("-f") ? 1.73 : 1.685;
  const add = (
    bone: THREE.Object3D | undefined,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    scale: [number, number, number] = [1, 1, 1],
    rx = 0,
    rz = 0,
  ) => {
    if (!bone) {
      geo.dispose();
      return;
    }
    const transform = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z + (bone === chest && z > 0 ? 0.055 : 0)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)),
      new THREE.Vector3(...scale),
    );
    const local = bone.matrixWorld.clone().invert().multiply(rig.matrixWorld).multiply(transform);
    geo.applyMatrix4(local);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `wardrobe:${profile.name}`;
    bone.add(mesh);
    attachments.push(mesh);
  };
  const box = (
    bone: THREE.Object3D | undefined,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rz = 0,
  ) => add(bone, new THREE.BoxGeometry(w, h, d), mat, x, y, z, [1, 1, 1], 0, rz);
  if (profile.outfit === "hoodie") {
    add(
      chest,
      new THREE.TorusGeometry(0.115, 0.045, 8, 16),
      cloth,
      0,
      1.47,
      -0.045,
      [1.25, 1, 0.8],
      Math.PI / 2,
    );
    box(chest, accent, -0.035, 1.35, 0.155, 0.008, 0.16, 0.012);
    box(chest, accent, 0.035, 1.35, 0.155, 0.008, 0.16, 0.012);
    box(chest, black, 0, 1.08, 0.16, 0.24, 0.11, 0.035);
  }
  if (profile.outfit === "jacket" || profile.outfit === "suit") {
    box(chest, accent, -0.065, 1.35, 0.15, 0.045, 0.18, 0.026, -0.25);
    box(chest, accent, 0.065, 1.35, 0.15, 0.045, 0.18, 0.026, 0.25);
    box(chest, black, 0, 1.22, 0.16, 0.012, 0.37, 0.02);
    if (profile.outfit === "suit") box(chest, accent, 0, 1.37, 0.18, 0.025, 0.2, 0.018);
  }
  if (profile.outfit === "worker") {
    for (const x of [-0.115, 0.115]) box(chest, accent, x, 1.25, 0.16, 0.045, 0.4, 0.022);
    box(chest, accent, 0, 1.11, 0.18, 0.32, 0.045, 0.022);
  }
  if (profile.outfit === "uniform") {
    box(chest, black, 0, 1.28, 0.13, 0.33, 0.36, 0.085);
    box(chest, metal, -0.1, 1.4, 0.184, 0.045, 0.055, 0.014);
    box(chest, black, 0.12, 1.42, 0.17, 0.055, 0.1, 0.055);
  }
  for (const item of profile.accessories) {
    if (["cap", "beanie", "hardhat", "policecap"].includes(item)) {
      const mat = item === "hardhat" ? accent : item === "beanie" ? cloth : black;
      add(
        head,
        new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        mat,
        0,
        headH,
        0,
        [1, item === "beanie" ? 1.25 : 0.85, 1.08],
      );
      if (item !== "beanie") box(head, mat, 0, headH + 0.008, 0.125, 0.23, 0.025, 0.16);
      if (item === "beanie")
        add(
          head,
          new THREE.TorusGeometry(0.115, 0.023, 6, 16),
          mat,
          0,
          headH,
          0,
          [1, 1, 1.08],
          Math.PI / 2,
        );
    }
    if (item === "glasses") {
      for (const x of [-0.046, 0.046])
        box(head, lens, x, headH - 0.033, 0.111, 0.079, 0.045, 0.025);
      box(head, metal, 0, headH - 0.027, 0.116, 0.025, 0.009, 0.015);
    }
    if (item === "earrings") {
      for (const x of [-0.105, 0.105])
        add(head, new THREE.TorusGeometry(0.023, 0.005, 6, 12), metal, x, headH - 0.095, 0.025);
    }
    if (item === "headphones") {
      add(head, new THREE.TorusGeometry(0.144, 0.018, 6, 16, Math.PI), black, 0, headH - 0.01, 0);
      for (const x of [-0.14, 0.14]) box(head, accent, x, headH - 0.065, 0, 0.055, 0.12, 0.085);
    }
    if (item === "chain")
      add(chest, new THREE.TorusGeometry(0.105, 0.008, 6, 20), metal, 0, 1.41, 0.105, [1, 0.9, 1]);
    if (item === "backpack") {
      box(chest, black, 0, 1.24, -0.2, 0.29, 0.37, 0.16);
      box(chest, accent, 0, 1.18, -0.295, 0.21, 0.16, 0.055);
      for (const x of [-0.13, 0.13]) box(chest, black, x, 1.3, 0.147, 0.035, 0.36, 0.03);
    }
    if (item === "satchel") {
      box(hips, cloth, -0.23, 0.91, 0.03, 0.18, 0.25, 0.12);
      box(chest, black, 0, 1.28, 0.18, 0.032, 0.56, 0.025, -0.55);
    }
    if (item === "toolbelt" || item === "dutybelt") {
      box(hips, black, 0, 0.98, 0, 0.36, 0.07, 0.34);
      for (const x of [-0.23, 0.23])
        box(hips, item === "toolbelt" ? accent : black, x, 0.91, 0.01, 0.11, 0.17, 0.1);
    }
  }
  // Bake rigid details sharing a bone/material together. A zipper, lapels and
  // straps should not each cost a draw call for every visible resident.
  const batches = new Map<string, THREE.Mesh[]>();
  for (const mesh of attachments) {
    const key = `${mesh.parent!.uuid}:${(mesh.material as THREE.Material).uuid}`;
    const group = batches.get(key) ?? [];
    group.push(mesh);
    batches.set(key, group);
  }
  for (const group of batches.values()) {
    if (group.length < 2) continue;
    const geo = mergeGeometries(group.map((m) => m.geometry));
    if (!geo) continue;
    const merged = new THREE.Mesh(geo, group[0]!.material);
    merged.name = `wardrobe:${profile.name}`;
    group[0]!.parent!.add(merged);
    for (const mesh of group) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
  }
  const used = new Set(attachments.map((m) => m.material));
  for (const mat of [black, cloth, accent, metal, lens]) if (!used.has(mat)) mat.dispose();
}
