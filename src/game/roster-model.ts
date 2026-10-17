import * as THREE from "three/webgpu";
import type { PlayableCharacter } from "./roster.ts";

/** Preserve the detailed source face while independently shaping its jaw and nose.
 * Clothing and body silhouettes now come from authored GLB meshes. */
export function sculptHead(source: THREE.BufferGeometry, hero: PlayableCharacter) {
  const geometry = source.clone(),
    p = geometry.getAttribute("position");
  const female = hero.sex === "f",
    jawY = female ? 1.57 : 1.62,
    noseY = female ? 1.64 : 1.69;
  const falloff = (y: number, center: number, span: number) =>
    Math.exp(-(((y - center) / span) ** 2));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    if (y < (female ? 1.49 : 1.54) || Math.abs(x) > 0.16) continue;
    p.setXYZ(
      i,
      x * (1 + (hero.shape.jaw - 1) * falloff(y, jawY, 0.075)),
      y,
      z + (z > 0.06 ? (hero.shape.nose - 1) * 0.12 * falloff(y, noseY, 0.025) : 0),
    );
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Height alone also selects the upper arms in the source T-pose. Keep only
 * triangles supported by the head/neck bones so no old body pokes through clothes. */
export function isolateHead(
  source: THREE.BufferGeometry,
  boneNames: readonly string[],
  hero: PlayableCharacter,
) {
  const geometry = sculptHead(source, hero);
  const p = geometry.getAttribute("position"),
    joints = geometry.getAttribute("skinIndex"),
    weights = geometry.getAttribute("skinWeight"),
    index = geometry.getIndex();
  const headBones = new Set(
    boneNames.flatMap((name, i) => (/^(Head|neck_01)$/.test(name) ? [i] : [])),
  );
  const belongs = (v: number) => {
    let support = 0;
    for (let c = 0; c < 4; c++)
      if (headBones.has(joints.getComponent(v, c))) support += weights.getComponent(v, c);
    return p.getY(v) > (hero.sex === "f" ? 1.445 : 1.49) && support > 0.25;
  };
  const kept: number[] = [];
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const tri = [0, 1, 2].map((c) => (index ? index.getX(i + c) : i + c));
    if (tri.every(belongs)) kept.push(...tri);
  }
  geometry.setIndex(kept);
  return geometry;
}
