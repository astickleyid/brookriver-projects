import * as THREE from "three/webgpu";
import { roomList, roomProps, roomShell, type RoomId, type RoomProp } from "./room-layout.ts";

/**
 * Interiors for houses, shops, the bank, the vault, the fixer, and the suite.
 * Built from three.js geometry. No pack covers these rooms.
 * Quaternius still dresses the street. These rooms are original.
 */

export type RoomsHandle = {
  dispose: () => void;
  setActive: (id: RoomId | null) => void;
  setParked: (id: RoomId, bodies: readonly string[]) => void;
};

const KIND_COLOR: Record<RoomProp["kind"], number> = {
  safe: 0x2a241c,
  bed: 0x3a2a28,
  bay: 0x1a1c22,
  counter: 0x4a3428,
  shelf: 0x3a2e26,
  vault: 0x3a4048,
  desk: 0x4a3420,
  bar: 0x2a1830,
  table: 0x3a2048,
};

function signTexture(text: string, bg: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#f3efe4";
  g.font = "700 36px Impact, Arial Narrow, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function mountRooms(scene: THREE.Scene): RoomsHandle {
  const roots = new Map<RoomId, THREE.Group>();
  const owned: THREE.BufferGeometry[] = [];
  const ownedMat: THREE.Material[] = [];
  const bays = new Map<RoomId, Array<{ car: THREE.Mesh; label: THREE.Mesh }>>();

  const track = (mesh: THREE.Mesh) => {
    owned.push(mesh.geometry);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    ownedMat.push(...mats);
  };

  const addBox = (parent: THREE.Object3D, propBox: { minX: number; maxX: number; minZ: number; maxZ: number; h: number }, mat: THREE.Material, y0 = 0) => {
    const w = propBox.maxX - propBox.minX;
    const d = propBox.maxZ - propBox.minZ;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, propBox.h, d), mat);
    mesh.position.set((propBox.minX + propBox.maxX) / 2, y0 + propBox.h / 2, (propBox.minZ + propBox.maxZ) / 2);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    track(mesh);
    return mesh;
  };

  for (const spec of roomList()) {
    const root = new THREE.Group();
    root.position.set(spec.origin.x, 0, spec.origin.z);
    root.visible = false;
    scene.add(root);
    roots.set(spec.id, root);

    const floorMat = new THREE.MeshStandardMaterial({ color: spec.floor, roughness: 0.86, metalness: 0.04, emissive: spec.floor, emissiveIntensity: 0.18 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(spec.width, 0.2, spec.depth), floorMat);
    floor.position.set(0, -0.1, spec.depth / 2);
    floor.receiveShadow = true;
    root.add(floor);
    track(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: spec.wall, roughness: 0.8, metalness: 0.05 });
    for (const box of roomShell(spec)) addBox(root, { ...box, h: 4.8 }, wallMat);
    const ceil = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width, 0.16, spec.depth),
      new THREE.MeshStandardMaterial({ color: 0x100e14, roughness: 0.9, emissive: spec.accent, emissiveIntensity: 0.08 }),
    );
    ceil.position.set(0, 4.7, spec.depth / 2);
    root.add(ceil);
    track(ceil);

    const title = signTexture(spec.title.toUpperCase(), "#141018");
    if (title) {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.46), new THREE.MeshBasicMaterial({ map: title, side: THREE.DoubleSide }));
      board.position.set(0, 2.4, spec.depth - 0.2);
      board.rotation.y = Math.PI;
      root.add(board);
      track(board);
    }

    const bayList: Array<{ car: THREE.Mesh; label: THREE.Mesh }> = [];
    for (const item of roomProps(spec)) {
      const color = KIND_COLOR[item.kind];
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: item.kind === "safe" || item.kind === "vault" ? 0.4 : 0.72,
        metalness: item.kind === "safe" || item.kind === "vault" ? 0.55 : 0.08,
        emissive: item.kind === "bar" || item.kind === "table" ? spec.accent : color,
        emissiveIntensity: item.kind === "bar" || item.kind === "table" ? 0.35 : 0.12,
      });
      addBox(root, item, mat);
      const labelText = item.kind === "bay" ? "BAY" : item.kind === "counter" || item.kind === "desk" || item.kind === "bar" ? spec.counter : item.kind === "safe" ? "SAFE" : "";
      if (labelText) {
        const tex = signTexture(labelText, "#141018");
        if (tex) {
          const label = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
          label.position.set((item.minX + item.maxX) / 2, item.h + 0.22, item.minZ - 0.02);
          label.rotation.y = Math.PI;
          root.add(label);
          track(label);
          if (item.kind === "bay") {
            const car = new THREE.Mesh(
              new THREE.BoxGeometry((item.maxX - item.minX) * 0.82, 0.7, (item.maxZ - item.minZ) * 0.7),
              new THREE.MeshStandardMaterial({ color: spec.accent, roughness: 0.45, metalness: 0.2, emissive: spec.accent, emissiveIntensity: 0.25 }),
            );
            car.position.set((item.minX + item.maxX) / 2, 0.55, (item.minZ + item.maxZ) / 2);
            car.visible = false;
            root.add(car);
            track(car);
            bayList.push({ car, label });
          }
        }
      }
    }
    if (bayList.length > 0) bays.set(spec.id, bayList);
  }

  return {
    setActive(id) {
      for (const [key, root] of roots) root.visible = key === id;
    },
    setParked(id, bodies) {
      const slots = bays.get(id);
      if (!slots) return;
      slots.forEach((slot, index) => {
        const body = bodies[index] ?? "";
        slot.car.visible = body.length > 0;
        const mat = slot.label.material as THREE.MeshBasicMaterial;
        const prev = mat.map;
        mat.map = signTexture(body ? body.toUpperCase() : "EMPTY", "#141018");
        mat.needsUpdate = true;
        prev?.dispose();
      });
    },
    dispose() {
      for (const root of roots.values()) root.removeFromParent();
      for (const geo of owned) geo.dispose();
      for (const mat of ownedMat) {
        const mapped = mat as THREE.MeshBasicMaterial;
        mapped.map?.dispose();
        mat.dispose();
      }
      roots.clear();
      bays.clear();
    },
  };
}

