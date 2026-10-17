import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three/webgpu";
import { DISTRICT, districtLook, layoutDistrict, lotMasses, type BKind, type BlockBox, type Face, type Placement, type Spec } from "./city.ts";

const specs: Record<BKind, Spec> = {
  large: { width: 20.64, depth: 16.64 },
  medium: { width: 15.06, depth: 13.06 },
  small: { width: 12.46, depth: 14.54 },
};

function aabb(p: Placement, spec: Spec) {
  const depth = spec.depth * p.sx;
  const width = spec.width * p.sx;
  const face = p.face as Face;
  if (face === "west") return { minX: p.x, maxX: p.x + depth, minZ: p.z - width / 2, maxZ: p.z + width / 2 };
  if (face === "east") return { minX: p.x - depth, maxX: p.x, minZ: p.z - width / 2, maxZ: p.z + width / 2 };
  if (face === "south") return { minX: p.x - width / 2, maxX: p.x + width / 2, minZ: p.z, maxZ: p.z + depth };
  return { minX: p.x - width / 2, maxX: p.x + width / 2, minZ: p.z - depth, maxZ: p.z };
}

function overlaps(a: ReturnType<typeof aabb>, b: ReturnType<typeof aabb>) {
  return a.minX < b.maxX - 0.05 && a.maxX > b.minX + 0.05 && a.minZ < b.maxZ - 0.05 && a.maxZ > b.minZ + 0.05;
}

describe("district layout", () => {
  const placed = layoutDistrict(specs);
  const half = (DISTRICT.grid * DISTRICT.cell) / 2;
  const lines: number[] = [];
  for (let i = 0; i <= DISTRICT.grid; i++) lines.push(-half + i * DISTRICT.cell);

  it("covers every crossing and breaks the lots into different fronts", () => {
    assert.equal(placed.filter((p) => p.kind === "cross").length, 36);
    assert.equal(placed.filter((p) => p.kind === "street").length, 300);
    const faces = placed.filter((p) => p.face);
    assert.ok(faces.length > 24 && faces.length < 220);
    const halfW = (DISTRICT.grid * DISTRICT.cell) / 2;
    const counts = new Map<string, number>();
    for (const p of faces) {
      const key = `${Math.floor((p.x + halfW) / DISTRICT.cell)},${Math.floor((p.z + halfW) / DISTRICT.cell)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const lots = [...counts.values()];
    assert.ok(new Set(lots).size >= 3);
    assert.ok(lots.some((n) => n >= 3));
    assert.ok(lots.some((n) => n <= 2));
    const center = placed.find((p) => p.face && Math.abs(p.x) < 8 && Math.abs(p.z) < 8);
    assert.equal(center, undefined);
  });

  it("keeps building fronts on the sidewalk and out of the roadway", () => {
    const road = DISTRICT.road / 2;
    for (const p of placed) {
      if (!p.face) continue;
      const onRow = lines.some((x) => Math.abs(p.x - x) <= road + 0.2);
      const onCol = lines.some((z) => Math.abs(p.z - z) <= road + 0.2);
      assert.equal(onRow && onCol, false);
      const box = aabb(p, specs[p.kind as BKind]);
      assert.ok(box.maxX > box.minX && box.maxZ > box.minZ);
    }
  });

  it("does not stack opposite buildings inside a lot", () => {
    const buildings = placed.filter((p) => p.face);
    for (let i = 0; i < buildings.length; i++) {
      for (let j = i + 1; j < buildings.length; j++) {
        const a = buildings[i]!;
        const b = buildings[j]!;
        if (Math.hypot(a.x - b.x, a.z - b.z) > 40) continue;
        const aa = aabb(a, specs[a.kind as BKind]);
        const bb = aabb(b, specs[b.kind as BKind]);
        assert.equal(overlaps(aa, bb), false, `${a.face} ${a.kind} hits ${b.face} ${b.kind}`);
      }
    }
  });

  it("butts street tiles against the intersection instead of through it", () => {
    for (const p of placed) {
      if (p.kind !== "street") continue;
      const onX = lines.some((x) => Math.abs(p.x - x) < 0.01);
      const onZ = lines.some((z) => Math.abs(p.z - z) < 0.01);
      assert.equal(onX || onZ, true);
      assert.equal(onX && onZ, false);
      const along = Math.abs(p.yaw) < 0.01 ? p.x : p.z;
      const nearest = lines.reduce((best, line) => Math.min(best, Math.abs(along - line)), 1e9);
      const halfTile = (6 * p.sx) / 2;
      assert.ok(nearest - halfTile >= 8.9, `tile enters the crossing ${nearest - halfTile}`);
    }
  });

  it("points the door outward from the lot", () => {
    const q = new THREE.Quaternion();
    const front = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const want: Record<Face, [number, number]> = {
      east: [1, 0],
      west: [-1, 0],
      north: [0, 1],
      south: [0, -1],
    };
    for (const face of Object.keys(want) as Face[]) {
      const sample = placed.find((p) => p.face === face);
      assert.ok(sample);
      q.setFromAxisAngle(up, sample.yaw);
      front.set(0, 0, 1).applyQuaternion(q);
      const [x, z] = want[face];
      assert.ok(Math.abs(front.x - x) < 1e-5 && Math.abs(front.z - z) < 1e-5);
    }
  });

  it("keeps lot masses off the roadway and out of each other", () => {
    const masses = lotMasses();
    const halfW = (DISTRICT.grid * DISTRICT.cell) / 2;
    const lines: number[] = [];
    for (let i = 0; i <= DISTRICT.grid; i++) lines.push(-halfW + i * DISTRICT.cell);
    const road = DISTRICT.road / 2;
    const hit = (a: BlockBox, b: BlockBox) =>
      a.minX < b.maxX - 0.05 && a.maxX > b.minX + 0.05 && a.minZ < b.maxZ - 0.05 && a.maxZ > b.minZ + 0.05;
    for (let i = 0; i < masses.length; i++) {
      const a = masses[i]!;
      assert.ok(a.maxX > a.minX && a.maxZ > a.minZ && a.h > 0);
      if (a.h > 2) {
        for (const line of lines) {
          assert.equal(a.minX < line + road && a.maxX > line - road, false);
          assert.equal(a.minZ < line + road && a.maxZ > line - road, false);
        }
      }
      for (let j = i + 1; j < masses.length; j++) assert.equal(hit(a, masses[j]!), false);
    }
    const built = masses.filter((b) => b.h > 2);
    const perLot = new Map<string, number[]>();
    for (const b of built) {
      const key = `${Math.floor((b.minX + halfW) / DISTRICT.cell)},${Math.floor((b.minZ + halfW) / DISTRICT.cell)}`;
      const list = perLot.get(key) ?? [];
      list.push(b.h);
      perLot.set(key, list);
    }
    const sizes = [...perLot.values()];
    assert.ok(sizes.some((h) => h.length >= 4));
    assert.ok(sizes.some((h) => h.length === 2));
    assert.ok(sizes.some((h) => h.length === 1 || h.length === 3));
    assert.equal(built.some((b) => Math.abs((b.minX + b.maxX) / 2) < 8 && Math.abs((b.minZ + b.maxZ) / 2) < 8), false);
    const row = sizes.find((h) => h.length >= 4)!;
    assert.ok(Math.max(...row) - Math.min(...row) > 0.4);
  });

  it("gives the west a different tint and a taller large block", () => {
    const west = districtLook(-80, 0, "large");
    const east = districtLook(80, 0, "small");
    assert.notEqual(west.tint, east.tint);
    assert.ok(west.height > 1);
    assert.ok(west.height > east.height);
  });
});
