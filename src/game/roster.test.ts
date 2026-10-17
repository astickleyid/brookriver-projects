import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three/webgpu";
import { PLAYABLES, playableById, playableProfile } from "./roster.ts";
import { coatHem, sculptBody, tailoredWardrobe } from "./roster-model.ts";

describe("playable cast", () => {
  it("has six authored identities and safely recovers old or corrupt choices", () => {
    assert.equal(PLAYABLES.length, 6);
    for (const key of [
      "id",
      "name",
      "brand",
      "voice",
      "personality",
      "story",
      "body",
      "fashion",
    ] as const) {
      assert.equal(new Set(PLAYABLES.map((p) => p[key])).size, 6, key);
    }
    assert.equal(playableById("sana").id, "sana");
    for (const unknown of [null, undefined, "player-m", "__proto__", {}, 3])
      assert.equal(playableById(unknown).id, "mara");
    const profile = playableProfile(PLAYABLES[0]!);
    profile.accessories.push("test");
    assert.ok(!PLAYABLES[0]!.profile.accessories.includes("test"));
  });
  it("sculpts different body and face geometry while preserving animation weights", () => {
    const source = new THREE.BufferGeometry();
    source.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0.18, 1.09, 0.12, -0.18, 1.09, 0.12, 0.1, 1.62, 0.09, 0.02, 1.69, 0.12],
        3,
      ),
    );
    source.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
    );
    const original = Array.from(source.getAttribute("position").array);
    const bodies = PLAYABLES.map((hero) => sculptBody(source, hero));
    assert.equal(
      new Set(bodies.map((geo) => Array.from(geo.getAttribute("position").array).join())).size,
      6,
    );
    assert.deepEqual(Array.from(source.getAttribute("position").array), original);
    for (const geo of bodies) {
      assert.deepEqual(
        Array.from(geo.getAttribute("skinWeight").array),
        Array.from(source.getAttribute("skinWeight").array),
      );
      for (const n of geo.getAttribute("position").array) assert.ok(Number.isFinite(n));
      geo.dispose();
    }
    source.dispose();
  });
  it("keeps coat hems skinned and split for animated strides", () => {
    const body = new THREE.SkinnedMesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial(),
    );
    const bones = ["pelvis", "thigh_l", "thigh_r"].map((name) => {
      const b = new THREE.Bone();
      b.name = name;
      return b;
    });
    body.bind(new THREE.Skeleton(bones));
    const root = new THREE.Group();
    root.add(body);
    coatHem(body, PLAYABLES[0]!);
    const hem = root.children[1] as THREE.SkinnedMesh;
    assert.ok(hem.isSkinnedMesh);
    assert.equal(hem.skeleton, body.skeleton);
    const weights = hem.geometry.getAttribute("skinWeight");
    for (let i = 0; i < weights.count; i++)
      assert.ok(Math.abs(weights.getX(i) + weights.getY(i) - 1) < 1e-6);
    assert.ok(weights.getY(weights.count - 1) > 0.7);
    assert.ok(hem.geometry.getIndex()!.count < 7 * 32 * 6);
  });
  it("weights every tailored garment vertex and preserves only exposed body triangles", () => {
    const names = [
      "pelvis",
      "spine_01",
      "spine_02",
      "spine_03",
      "Head",
      "upperarm_l",
      "lowerarm_l",
      "hand_l",
      "upperarm_r",
      "lowerarm_r",
      "hand_r",
      "thigh_l",
      "calf_l",
      "foot_l",
      "thigh_r",
      "calf_r",
      "foot_r",
    ];
    const bones = names.map((name) => {
      const bone = new THREE.Bone();
      bone.name = name;
      return bone;
    });
    const source = new THREE.BufferGeometry();
    source.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          0, 1.65, 0.1, 0.05, 1.66, 0.1, -0.05, 1.66, 0.1, 0, 1.2, 0.1, 0.05, 1.2, 0.1, -0.05, 1.2,
          0.1,
        ],
        3,
      ),
    );
    source.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(
        [4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0],
        4,
      ),
    );
    source.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(
        Array.from({ length: 24 }, (_, i) => (i % 4 === 0 ? 1 : 0)),
        4,
      ),
    );
    source.setIndex([0, 1, 2, 3, 4, 5]);
    const body = new THREE.SkinnedMesh(source, new THREE.MeshStandardMaterial());
    const root = new THREE.Group();
    root.add(body, ...bones);
    root.updateMatrixWorld(true);
    body.bind(new THREE.Skeleton(bones));
    const garment = tailoredWardrobe(body, PLAYABLES[0]!);
    const geometry = garment.geometry;
    assert.ok(geometry.getAttribute("position").count > 0);
    assert.deepEqual(Array.from(source.getIndex()!.array), [0, 1, 2]);
    const w = geometry.getAttribute("skinWeight"),
      j = geometry.getAttribute("skinIndex");
    for (let i = 0; i < w.count; i++) {
      assert.ok(Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 1e-6);
      for (let c = 0; c < 4; c++) {
        assert.ok(w.getComponent(i, c) >= 0);
        assert.ok(j.getComponent(i, c) < bones.length);
      }
    }
    for (const value of geometry.getAttribute("position").array) assert.ok(Number.isFinite(value));
    assert.equal(garment.skeleton, body.skeleton);
  });
});
