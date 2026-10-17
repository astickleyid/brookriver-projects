import * as THREE from "three/webgpu";
import type { PlayableCharacter } from "./roster.ts";

const bump = (y: number, center: number, span: number) => Math.exp(-(((y - center) / span) ** 2));

/** Sculpt the actual weighted vertices, independently at chest, waist, hips and face.
 * Retain the imported bind skeleton so every gameplay animation remains compatible. */
export function sculptBody(source: THREE.BufferGeometry, hero: PlayableCharacter) {
  const geo = source.clone();
  const pos = geo.getAttribute("position"),
    s = hero.shape;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const torso = Math.max(0, 1 - Math.abs(x) / 0.36);
    const spread =
      1 +
      torso *
        ((s.chest - 1) * bump(y, 1.35, 0.16) +
          (s.waist - 1) * bump(y, 1.09, 0.15) +
          (s.hips - 1) * bump(y, 0.9, 0.18));
    const face = y > 1.54 && Math.abs(x) < 0.16;
    const jaw = face ? 1 + (s.jaw - 1) * bump(y, 1.62, 0.075) : 1;
    pos.setXYZ(
      i,
      x * spread * jaw,
      y,
      z * (1 + (s.depth - 1) * torso * bump(y, 1.15, 0.37)) +
        (face && z > 0.06 ? (s.nose - 1) * 0.12 * bump(y, 1.69, 0.025) : 0),
    );
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** A weighted, split hem follows the pelvis and thighs, rather than a rigid box coat. */
export function coatHem(body: THREE.SkinnedMesh, hero: PlayableCharacter) {
  const rows = 7,
    segments = 32,
    vertices: number[] = [],
    weights: number[] = [],
    joints: number[] = [],
    indices: number[] = [];
  const bones = body.skeleton.bones;
  const hip = Math.max(
    0,
    bones.findIndex((b) => b.name === "pelvis"),
  );
  const left = Math.max(
    0,
    bones.findIndex((b) => b.name === "thigh_l"),
  );
  const right = Math.max(
    0,
    bones.findIndex((b) => b.name === "thigh_r"),
  );
  for (let r = 0; r <= rows; r++) {
    const t = r / rows,
      y = 1.08 - t * (hero.id === "mara" ? 0.5 : 0.34);
    for (let j = 0; j <= segments; j++) {
      const a = (j / segments) * Math.PI * 2,
        width = (0.22 + 0.055 * t) * hero.shape.hips;
      const x = Math.sin(a) * width,
        z = Math.cos(a) * (0.18 + 0.035 * t) * hero.shape.depth;
      vertices.push(x, y, z);
      const blend = t * 0.72;
      joints.push(hip, x > 0 ? left : right, 0, 0);
      weights.push(1 - blend, blend, 0, 0);
      // Open front and side vents prevent a tube silhouette during strides.
      if (
        r < rows &&
        j < segments &&
        !(Math.cos(a) > 0.86 || (t > 0.65 && Math.abs(Math.cos(a)) < 0.2))
      ) {
        const n = r * (segments + 1) + j;
        indices.push(n, n + segments + 1, n + 1, n + 1, n + segments + 1, n + segments + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(joints, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const coat = new THREE.SkinnedMesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: hero.profile.fabric,
      roughness: 0.94,
      side: THREE.DoubleSide,
    }),
  );
  coat.name = `${hero.id}:split-hem`;
  coat.frustumCulled = false;
  coat.bind(body.skeleton, body.bindMatrix);
  body.parent!.add(coat);
}

export function clothBinding(y: number) {
  const rings = [
    [1, "pelvis"],
    [1.08, "spine_01"],
    [1.19, "spine_02"],
    [1.34, "spine_03"],
    [1.51, "spine_03"],
  ] as const;
  for (let i = 0; i < rings.length - 1; i++) {
    const low = rings[i]!,
      high = rings[i + 1]!;
    if (y <= high[0])
      return {
        a: low[1],
        b: high[1],
        t: THREE.MathUtils.clamp((y - low[0]) / (high[0] - low[0]), 0, 1),
      };
  }
  return { a: "spine_03", b: "spine_03", t: 0 };
}

export function clothFront(hero: PlayableCharacter, x: number, y: number) {
  const rings = [
    [1, 0.19 * hero.shape.waist, 0.15 * hero.shape.depth],
    [1.08, 0.2 * hero.shape.waist, 0.16 * hero.shape.depth],
    [1.19, 0.225 * hero.shape.chest, 0.17 * hero.shape.depth],
    [1.34, 0.24 * hero.shape.chest, 0.16 * hero.shape.depth],
    [1.44, 0.23 * hero.shape.chest, 0.125 * hero.shape.depth],
    [1.51, 0.085, 0.075],
  ];
  for (let i = 0; i < rings.length - 1; i++) {
    const low = rings[i]!,
      high = rings[i + 1]!;
    if (y <= high[0]!) {
      const t = THREE.MathUtils.clamp((y - low[0]!) / (high[0]! - low[0]!), 0, 1);
      const w = THREE.MathUtils.lerp(low[1]!, high[1]!, t),
        d = THREE.MathUtils.lerp(low[2]!, high[2]!, t);
      return -0.014 + d * Math.sqrt(Math.max(0.02, 1 - (x / w) ** 2));
    }
  }
  return 0.06;
}

/** Sew continuous ring surfaces in bind space. Each ring carries explicit bone
 * weights; the coat, sleeves and trousers are independent of the body topology. */
export function tailoredWardrobe(body: THREE.SkinnedMesh, hero: PlayableCharacter) {
  const positions: number[] = [],
    colors: number[] = [],
    skinIndices: number[] = [],
    skinWeights: number[] = [],
    indices: number[] = [];
  const bones = body.skeleton.bones;
  const inverse = body.parent!.matrixWorld.clone().invert();
  const at = (name: string) => {
    const bone = bones.find((b) => b.name === name);
    return bone
      ? bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse)
      : new THREE.Vector3();
  };
  const boneId = (name: string) =>
    Math.max(
      0,
      bones.findIndex((b) => b.name === name),
    );
  type Ring = {
    p: THREE.Vector3;
    width: number;
    depth: number;
    bone: string;
    next?: string;
    blend?: number;
    color: number;
  };
  const loft = (rings: Ring[], axis: "y" | "x") => {
    const offset = positions.length / 3,
      sides = 24;
    for (const r of rings) {
      const color = new THREE.Color(r.color);
      for (let j = 0; j <= sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        const u = Math.cos(a) * r.width,
          v = Math.sin(a) * r.depth;
        positions.push(r.p.x + (axis === "y" ? u : 0), r.p.y + (axis === "x" ? u : 0), r.p.z + v);
        let tint = color;
        if (axis === "y" && r.p.y >= 1 && Math.sin(a) > 0.05) {
          const x = Math.abs(u),
            y = r.p.y;
          if (hero.id === "mara") {
            if (y > 1.27 && x < (0.055 * (y - 1.24)) / 0.27) tint = new THREE.Color(0x8c9598);
            else if (y > 1.25 && y < 1.49 && x > 0.04 && x < 0.065 + (1.49 - y) * 0.4)
              tint = new THREE.Color(0x3c4652);
          }
          if (hero.id === "jules" && y < 1.46 && y > (u < 0 ? 1.09 : 1.2) && x > 0.045 && x < 0.195)
            tint = new THREE.Color(0x34303f);
          if (hero.id === "sana" && x < 0.075 && y > 1.04) tint = new THREE.Color(0xd7cdb5);
        }
        colors.push(tint.r, tint.g, tint.b);
        skinIndices.push(boneId(r.bone), boneId(r.next ?? r.bone), 0, 0);
        skinWeights.push(1 - (r.blend ?? 0), r.blend ?? 0, 0, 0);
      }
    }
    for (let r = 0; r < rings.length - 1; r++)
      for (let j = 0; j < sides; j++) {
        const a = offset + r * (sides + 1) + j,
          b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
  };
  const softJoint = (center: THREE.Vector3, scale: THREE.Vector3, bone: string, tint: number) => {
    const g = new THREE.SphereGeometry(1, 24, 16);
    g.scale(scale.x, scale.y, scale.z);
    g.translate(center.x, center.y, center.z);
    const offset = positions.length / 3,
      p = g.getAttribute("position"),
      c = new THREE.Color(tint);
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      colors.push(c.r, c.g, c.b);
      skinIndices.push(boneId(bone), 0, 0, 0);
      skinWeights.push(1, 0, 0, 0);
    }
    for (const i of g.getIndex()!.array) indices.push(offset + i);
    g.dispose();
  };
  const cloth = hero.profile.fabric,
    trim = hero.profile.accent,
    pants = hero.profile.trousers;
  const torsoShape = [
    [1, 0.19 * hero.shape.waist, 0.15 * hero.shape.depth],
    [1.08, 0.2 * hero.shape.waist, 0.16 * hero.shape.depth],
    [1.19, 0.225 * hero.shape.chest, 0.17 * hero.shape.depth],
    [1.34, 0.24 * hero.shape.chest, 0.16 * hero.shape.depth],
    [1.44, 0.23 * hero.shape.chest, 0.125 * hero.shape.depth],
    [1.51, 0.085, 0.075],
  ];
  const torso: Ring[] = [];
  for (let i = 0; i <= 36; i++) {
    const y = 1 + (i / 36) * 0.51;
    let segment = 0;
    while (segment < torsoShape.length - 2 && y > torsoShape[segment + 1]![0]!) segment++;
    const low = torsoShape[segment]!,
      high = torsoShape[segment + 1]!;
    const t = THREE.MathUtils.clamp((y - low[0]!) / (high[0]! - low[0]!), 0, 1),
      binding = clothBinding(y);
    torso.push({
      p: new THREE.Vector3(0, y, -0.014),
      width: THREE.MathUtils.lerp(low[1]!, high[1]!, t),
      depth: THREE.MathUtils.lerp(low[2]!, high[2]!, t),
      bone: binding.a,
      next: binding.b,
      blend: binding.t,
      color: (hero.id === "imani" || hero.id === "leon") && i < 2 ? trim : cloth,
    });
  }
  loft(torso, "y");
  softJoint(
    new THREE.Vector3(0, 0.945, -0.025),
    new THREE.Vector3(0.205 * hero.shape.hips, 0.105, 0.16 * hero.shape.depth),
    "pelvis",
    pants,
  );
  for (const side of ["l", "r"]) {
    const upper = at(`upperarm_${side}`),
      elbow = at(`lowerarm_${side}`),
      hand = at(`hand_${side}`);
    const sleeve = hero.id === "jules" ? cloth : ["leon", "rafa"].includes(hero.id) ? trim : cloth;
    const size = hero.id === "leon" ? 0.115 : hero.id === "jules" ? 0.105 : 0.09;
    const sign = side === "l" ? 1 : -1;
    const rings: Ring[] = [
      {
        p: upper.clone().add(new THREE.Vector3(-sign * 0.08, 0, 0)),
        width: size * 0.45,
        depth: size * 0.5,
        bone: "spine_03",
        next: `upperarm_${side}`,
        blend: 0.15,
        color: sleeve,
      },
      {
        p: upper.clone().add(new THREE.Vector3(-sign * 0.035, 0, 0)),
        width: size * 0.95,
        depth: size * 0.95,
        bone: "spine_03",
        next: `upperarm_${side}`,
        blend: 0.6,
        color: sleeve,
      },
    ];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10,
        lower = t > 0.5,
        blend = lower ? (t - 0.5) * 2 : t * 2;
      const end =
        hero.id === "rafa" ? elbow.clone().lerp(hand, 0.38) : hand.clone().lerp(elbow, 0.05);
      const p = lower ? elbow.clone().lerp(end, blend) : upper.clone().lerp(elbow, blend);
      const radius = size * (1 - t * 0.38);
      rings.push({
        p,
        width: radius,
        depth: radius * 0.9,
        bone: lower ? `lowerarm_${side}` : `upperarm_${side}`,
        next: `lowerarm_${side}`,
        blend: lower ? 0 : Math.max(0, blend - 0.5) * 2,
        color: i > 8 && hero.id === "leon" ? cloth : sleeve,
      });
    }
    // Mirrored winding is handled by the double-sided cloth material.
    loft(rings, "x");
    const hip = at(`thigh_${side}`),
      knee = at(`calf_${side}`),
      ankle = at(`foot_${side}`);
    const wide =
      hero.id === "mara" ? 0.082 : hero.id === "rafa" ? 0.102 : hero.id === "leon" ? 0.135 : 0.119;
    const leg: Ring[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12,
        lower = t > 0.5,
        blend = lower ? (t - 0.5) * 2 : t * 2;
      const p = lower ? knee.clone().lerp(ankle, blend) : hip.clone().lerp(knee, blend);
      const radius = wide * (1.08 - 0.26 * t);
      leg.push({
        p,
        width: radius,
        depth: radius * 1.1,
        bone: lower ? `calf_${side}` : `thigh_${side}`,
        next: `calf_${side}`,
        blend: lower ? 0 : Math.max(0, blend - 0.6) * 2.5,
        color: pants,
      });
    }
    loft(leg, "y");
    const foot = at(`foot_${side}`),
      shoeColor =
        hero.id === "mara"
          ? 0x1b2029
          : hero.id === "rafa"
            ? 0x67432d
            : hero.id === "sana"
              ? 0x874535
              : trim;
    const bootWidth = hero.id === "mara" ? 0.059 : 0.079;
    loft(
      [
        {
          p: new THREE.Vector3(foot.x, 0.008, 0.015),
          width: 0.001,
          depth: 0.001,
          bone: `foot_${side}`,
          color: 0x22252a,
        },
        {
          p: new THREE.Vector3(foot.x, 0.012, 0.015),
          width: bootWidth,
          depth: 0.145,
          bone: `foot_${side}`,
          color: 0x22252a,
        },
        {
          p: new THREE.Vector3(foot.x, 0.035, 0.015),
          width: bootWidth,
          depth: 0.145,
          bone: `foot_${side}`,
          color: shoeColor,
        },
        {
          p: new THREE.Vector3(foot.x, 0.075, -0.005),
          width: bootWidth * 0.95,
          depth: 0.12,
          bone: `foot_${side}`,
          color: shoeColor,
        },
        {
          p: new THREE.Vector3(foot.x, 0.13, -0.065),
          width: bootWidth * 0.78,
          depth: 0.065,
          bone: `foot_${side}`,
          color: shoeColor,
        },
        {
          p: new THREE.Vector3(foot.x, 0.18, -0.065),
          width: bootWidth * 0.77,
          depth: 0.064,
          bone: `foot_${side}`,
          color: shoeColor,
        },
      ],
      "y",
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.SkinnedMesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide }),
  );
  mesh.name = `${hero.id}:tailored-wardrobe`;
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.frustumCulled = false;
  body.parent!.add(mesh);
  // Retain the face, neck, hands and shoes. The clothed body is hidden, avoiding
  // intersections between a sculpted physique and the independently cut fabric.
  const source = body.geometry,
    original = source.getIndex(),
    kept: number[] = [];
  const joints = source.getAttribute("skinIndex"),
    weights = source.getAttribute("skinWeight"),
    pos = source.getAttribute("position");
  const exposed = (i: number) => {
    let skin = 0;
    for (let c = 0; c < 4; c++) {
      const name = bones[joints.getComponent(i, c)]?.name ?? "";
      if (
        /^(Head|neck_|hand_|index_|middle_|ring_|pinky_|thumb_)/.test(name) ||
        (hero.id === "rafa" && name.startsWith("lowerarm_"))
      )
        skin += weights.getComponent(i, c);
    }
    return skin > 0.5;
  };
  for (let i = 0; i < (original?.count ?? pos.count); i += 3) {
    const tri = [0, 1, 2].map((n) => (original ? original.getX(i + n) : i + n));
    if (tri.some(exposed)) kept.push(...tri);
  }
  source.setIndex(kept);
  return mesh;
}
