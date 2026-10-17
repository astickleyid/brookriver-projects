import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { groundY } from "./city.ts";

/**
 * Cosmo CC0 low-poly cars. Smooth stylized bodies, same read as the downtown kit.
 * glTF nose is +Z. Game yaw 0 faces world −Z, so the mount adds PI, same sign as the box cars.
 * Wheel cylinders are thin on local X, so spin is rotation.x.
 * Lengths are about 5 m. Uniform scale keeps the tires on the street height.
 */

export type FleetRide = "sport" | "sedan" | "van" | "cruiser";

export type FleetBody =
  | "mobil"
  | "kamaro"
  | "italia"
  | "lamb"
  | "fenyr"
  | "coupe"
  | "rally"
  | "ghini"
  | "van"
  | "jeep"
  | "armor"
  | "police";

export type FleetCar = {
  x: number;
  z: number;
  yaw: number;
  body: FleetBody;
  hp: number;
  maxHp: number;
  spin: number;
};

const RIDE_OF: Record<FleetBody, FleetRide> = {
  mobil: "sedan",
  kamaro: "sedan",
  italia: "sport",
  lamb: "sport",
  fenyr: "sport",
  coupe: "sport",
  rally: "sport",
  ghini: "sport",
  van: "van",
  jeep: "van",
  armor: "van",
  police: "cruiser",
};

const TARGET_LENGTH: Record<FleetRide, number> = {
  sedan: 4.7,
  sport: 4.35,
  van: 5.15,
  cruiser: 4.95,
};

const BODY_ROOT = "/vendor/cosmo/low-poly-cars";

export function bodyFor(ride: FleetRide, n: number): FleetBody {
  const list = (Object.keys(RIDE_OF) as FleetBody[]).filter((body) => RIDE_OF[body] === ride);
  return list[Math.abs(n) % list.length]!;
}

const UP = new THREE.Vector3(0, 1, 0);

export function driveQuaternion(yaw: number, out = new THREE.Quaternion()) {
  return out.setFromAxisAngle(UP, yaw + Math.PI);
}

type Slot = { root: THREE.Group; wheels: THREE.Object3D[]; base: number };

export type Fleet = {
  sync: (cars: FleetCar[]) => void;
  /** Roof height in meters after the uniform length scale, before the damage squat. */
  roof: (body: FleetBody) => number;
  dispose: () => void;
};

export async function loadFleet(scene: THREE.Scene, count: number, qualityHigh: boolean): Promise<Fleet> {
  const loader = new GLTFLoader();
  const protos = new Map<FleetBody, { scene: THREE.Group; scale: number; roof: number }>();
  await Promise.all(
    (Object.keys(RIDE_OF) as FleetBody[]).map(async (body) => {
      const gltf = await loader.loadAsync(`${BODY_ROOT}/${body}.glb`);
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const length = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      const scale = TARGET_LENGTH[RIDE_OF[body]] / length;
      const roof = (box.max.y - box.min.y) * scale;
      model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = qualityHigh && !/wheel/i.test(mesh.name);
        mesh.receiveShadow = qualityHigh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          std.envMapIntensity = 1.25;
          if (/glass/i.test(std.name)) {
            std.transparent = true;
            std.opacity = 0.45;
            std.depthWrite = false;
            std.roughness = Math.min(std.roughness, 0.08);
          }
          if (/light/i.test(std.name)) {
            std.emissive.set(0xfff1c8);
            std.emissiveIntensity = 2.2;
          }
        }
      });
      protos.set(body, { scene: model, scale, roof });
    }),
  );

  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const root = new THREE.Group();
    root.visible = false;
    scene.add(root);
    slots.push({ root, wheels: [], base: 1 });
  }
  const q = new THREE.Quaternion();

  function bind(slot: Slot, body: FleetBody) {
    const proto = protos.get(body)!;
    const model = proto.scene.clone(true);
    slot.root.clear();
    slot.root.add(model);
    slot.wheels = [];
    model.traverse((obj) => {
      if (/wheel/i.test(obj.name)) slot.wheels.push(obj);
    });
    slot.base = proto.scale;
    slot.root.userData.body = body;
  }

  return {
    roof(body) {
      return protos.get(body)?.roof ?? 1.2;
    },
    sync(cars) {
      cars.forEach((car, i) => {
        const slot = slots[i];
        if (!slot) return;
        if (car.hp < 0) {
          slot.root.visible = false;
          return;
        }
        if (slot.root.userData.body !== car.body) bind(slot, car.body);
        const dead = car.hp <= 0;
        const squat = dead ? 0.46 : car.hp < car.maxHp * 0.4 ? 0.82 : 1;
        slot.root.visible = true;
        slot.root.position.set(car.x, groundY(car.x, car.z), car.z);
        slot.root.quaternion.copy(driveQuaternion(car.yaw, q));
        slot.root.scale.set(slot.base, slot.base * squat, slot.base);
        for (const wheel of slot.wheels) wheel.rotation.x = car.spin;
      });
      for (let i = cars.length; i < slots.length; i++) slots[i]!.root.visible = false;
    },
    dispose() {
      for (const slot of slots) {
        slot.root.removeFromParent();
        slot.root.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
        });
      }
      slots.length = 0;
      protos.clear();
    },
  };
}
