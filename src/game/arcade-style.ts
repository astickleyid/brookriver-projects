import * as THREE from "three/webgpu";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { PlayableCharacter } from "./roster.ts";

/** Actual skinned garment prints and fitted sports accessories, not portrait overlays. */
export function styleArcadeCharacter(rig: THREE.Object3D, hero: PlayableCharacter) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const accent = `#${hero.profile.accent.toString(16).padStart(6, "0")}`;
  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const marks: Record<string, string> = {
    mara: "A/H",
    leon: "DS",
    imani: "PLS",
    rafa: "TQ",
    jules: "O/S",
    sana: "SD",
    rhett: "07",
    cole: "K/F",
    briggs: "H/H",
  };
  ctx.save();
  ctx.translate(256, 250);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.font = "900 150px Arial";
  ctx.fillText(marks[hero.id] ?? hero.brand.slice(0, 2), 0, 0);
  ctx.restore();
  ctx.font = "bold 24px Arial";
  ctx.fillText(hero.brand, 256, 350);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(100, 145);
  ctx.lineTo(410, 145);
  ctx.stroke();
  if (hero.id === "rhett") {
    for (let x = 114; x < 410; x += 35) {
      ctx.fillRect(x, 385, 18, 12);
      ctx.fillRect(x + 18, 397, 18, 12);
    }
  }
  if (hero.id === "cole") {
    ctx.lineWidth = 5;
    ctx.strokeRect(97, 172, 320, 150);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = true;
  rig.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.name.endsWith("graphic")) return;
    const material = (mesh.material as THREE.MeshStandardMaterial).clone();
    material.map = map;
    material.transparent = true;
    material.alphaTest = 0.15;
    material.depthWrite = false;
    material.needsUpdate = true;
    mesh.material = material;
    mesh.renderOrder = 2;
  });

  const head = rig.getObjectByName("Head");
  if (!head) return;
  rig.updateMatrixWorld(true);
  const place = (
    geometry: THREE.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    rx = 0,
  ) => {
    const transform = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    geometry.applyMatrix4(
      head.matrixWorld.clone().invert().multiply(rig.matrixWorld).multiply(transform),
    );
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = `${hero.id}:sports-detail`;
    head.add(mesh);
  };
  const box = (color: number, x: number, y: number, z: number, w: number, h: number, d: number) =>
    place(new RoundedBoxGeometry(w, h, d, 3, 0.008), color, x, y, z);
  if (hero.id === "cole" || hero.id === "leon") {
    place(new THREE.TorusGeometry(0.145, 0.012, 8, 32, Math.PI), 0x20242b, 0, 1.7, -0.018);
    for (const side of [-1, 1]) {
      box(0x20242b, side * 0.142, 1.67, -0.015, 0.047, 0.095, 0.074);
      box(hero.profile.accent, side * 0.165, 1.67, -0.015, 0.018, 0.073, 0.05);
    }
  }
  if (hero.id === "rhett") {
    place(new THREE.TorusGeometry(0.112, 0.009, 8, 32), 0x272c34, 0, 1.755, 0, Math.PI / 2);
    for (const side of [-1, 1]) {
      box(0x262c34, side * 0.043, 1.75, 0.107, 0.087, 0.052, 0.022);
      box(0x8eb5bc, side * 0.043, 1.75, 0.122, 0.066, 0.033, 0.009);
    }
    box(0x262c34, 0, 1.75, 0.117, 0.022, 0.016, 0.015);
  }
}
