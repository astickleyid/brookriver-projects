import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import * as THREE from "three/webgpu";
import { PLAYABLES, playableById, playableProfile } from "./roster.ts";
import { sculptHead, isolateHead } from "./roster-model.ts";

function glb(file: string) {
  const bytes = readFileSync(file);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const offset = 20 + bytes.readUInt32LE(12) + 8,
    binary = bytes.subarray(offset);
  const values = (id: number) => {
    const a = json.accessors[id],
      v = json.bufferViews[a.bufferView],
      width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type as string]!;
    const type = (
      { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array } as Record<
        number,
        typeof Float32Array | typeof Uint8Array | typeof Uint16Array | typeof Uint32Array
      >
    )[a.componentType]!;
    const copy = binary.subarray(
      (v.byteOffset ?? 0) + (a.byteOffset ?? 0),
      (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + a.count * width * type.BYTES_PER_ELEMENT,
    );
    return new type(Uint8Array.from(copy).buffer);
  };
  return { json, values };
}
describe("playable arcade cast", () => {
  it("has nine distinct identities, three new masculine options and safe save recovery", () => {
    assert.equal(PLAYABLES.length, 9);
    for (const key of [
      "id",
      "name",
      "brand",
      "voice",
      "personality",
      "story",
      "body",
      "fashion",
      "asset",
    ] as const)
      assert.equal(new Set(PLAYABLES.map((p) => p[key])).size, 9, key);
    for (const id of ["rhett", "cole", "briggs"]) {
      const hero = playableById(id);
      assert.equal(hero.id, id);
      assert.equal(hero.sex, "m");
      assert.ok(hero.shape.waist < hero.shape.chest);
    }
    for (const unknown of [null, undefined, "player-m", "__proto__", {}, 3])
      assert.equal(playableById(unknown).id, "rhett");
    const profile = playableProfile(PLAYABLES[0]!);
    profile.accessories.push("test");
    assert.ok(!PLAYABLES[0]!.profile.accessories.includes("test"));
  });
  it("sculpts faces without modifying source geometry or animation weights", () => {
    const source = new THREE.BufferGeometry();
    source.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0.1, 1.62, 0.09, 0.02, 1.69, 0.12, 0.09, 1.57, 0.09, 0.02, 1.64, 0.12],
        3,
      ),
    );
    source.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
    );
    const before = Array.from(source.getAttribute("position").array),
      faces = PLAYABLES.map((hero) => sculptHead(source, hero));
    assert.equal(
      new Set(faces.map((g) => Array.from(g.getAttribute("position").array).join())).size,
      9,
    );
    assert.deepEqual(Array.from(source.getAttribute("position").array), before);
    for (const face of faces)
      assert.deepEqual(
        Array.from(face.getAttribute("skinWeight").array),
        Array.from(source.getAttribute("skinWeight").array),
      );
  });
  it("excludes old shoulders at the same T-pose height as the retained head", () => {
    const source = new THREE.BufferGeometry();
    source.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -0.08, 1.65, 0.08, 0.08, 1.65, 0.08, 0, 1.75, 0.08, 0.25, 1.6, 0, 0.35, 1.6, 0, 0.3, 1.55,
          0.1,
        ],
        3,
      ),
    );
    source.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0],
        4,
      ),
    );
    source.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(
        [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        4,
      ),
    );
    source.setIndex([0, 1, 2, 3, 4, 5]);
    const head = isolateHead(source, ["Head", "neck_01", "upperarm_l"], playableById("rhett"));
    assert.deepEqual(Array.from(head.getIndex()!.array), [0, 1, 2]);
    assert.equal(source.getIndex()!.count, 6);
  });
  it("ships real, bounded, weighted clothes and graphics on the original animation skeleton", () => {
    const manifest = JSON.parse(readFileSync("public/models/cast/manifest.json", "utf8"));
    assert.equal(manifest.characters.length, 9);
    for (const hero of PLAYABLES) {
      if (hero.nativeCharacter) continue;
      const { json, values } = glb(`public${hero.asset}`),
        skin = json.skins[0],
        names = skin.joints.map((i: number) => json.nodes[i].name);
      for (const name of [
        "Head",
        "pelvis",
        "spine_03",
        "hand_r",
        "thigh_l",
        "foot_r",
        "index_01_r",
      ])
        assert.ok(names.includes(name), `${hero.id}: ${name}`);
      assert.ok(json.nodes.some((n: { name: string }) => n.name.endsWith(":graphic")));
      const primitive = json.meshes[0].primitives[0],
        positions = values(primitive.attributes.POSITION),
        weights = values(primitive.attributes.WEIGHTS_0),
        joints = values(primitive.attributes.JOINTS_0);
      assert.ok(positions.length > 3000 && positions.length < 90000);
      for (let i = 0; i < weights.length; i += 4) {
        assert.ok(
          Math.abs(weights[i]! + weights[i + 1]! + weights[i + 2]! + weights[i + 3]! - 1) < 1e-5,
        );
        for (let c = 0; c < 4; c++) {
          assert.ok(joints[i + c]! < names.length);
          assert.ok(weights[i + c]! >= 0);
        }
      }
      for (const value of positions) assert.ok(Number.isFinite(value));
      const positionAccessor = json.accessors[primitive.attributes.POSITION];
      assert.ok(positionAccessor.min[1] > -0.12);
      assert.ok(positionAccessor.max[1] < 2.2);
      assert.ok(
        manifest.characters.find((p: { id: string }) => p.id === hero.id).triangles < 10000,
      );
    }
  });
  it("keeps bind bone rotations identical to the source animation rig", () => {
    for (const hero of PLAYABLES) {
      if (hero.nativeCharacter) continue;
      const { json } = glb(`public${hero.asset}`),
        file = hero.sex === "m" ? "male/Superhero_Male" : "female/Superhero_Female";
      const original = JSON.parse(
        readFileSync(
          `public/vendor/quaternius/universal-base-characters/${file}_FullBody.gltf`,
          "utf8",
        ),
      );
      for (const name of ["Head", "pelvis", "spine_03", "upperarm_l", "hand_r", "foot_l"]) {
        const actual = json.nodes.find((n: { name: string }) => n.name === name),
          expected = original.nodes.find((n: { name: string }) => n.name === name);
        assert.deepEqual(actual.rotation, expected.rotation, `${hero.id}: ${name}`);
      }
    }
  });
  it("ships the complete credited source character with its own rig, textures and gameplay clips", () => {
    const hero = playableById("briggs");
    assert.equal(hero.nativeCharacter, true);
    const { json } = glb(`public${hero.asset}`);
    assert.match(json.asset.copyright, /THEUNSEENVULGA/);
    assert.equal(json.asset.extras.license, "CC0-1.0");
    assert.equal(json.scenes[0].extras.brookriver.nativeCharacter, true);
    assert.equal(json.scenes[0].extras.brookriver.gripBasis.length, 4);
    for (const name of ["Head", "pelvis", "spine_03", "hand_r", "foot_l"])
      assert.ok(json.skins[0].joints.some((i: number) => json.nodes[i].name === name));
    for (const name of ["Idle_Loop", "Walk_Loop", "Sprint_Loop", "Jump_Start", "Jump_Land", "Punch_Jab", "Punch_Cross", "Pistol_Shoot", "Pistol_Reload"])
      assert.ok(json.animations.some((a: { name: string; channels: unknown[] }) => a.name === name && a.channels.length > 40), name);
    for (const name of ["hair", "beard", "eyes", "jacket", "pants", "boots"])
      assert.ok(json.nodes.some((n: { name: string }) => n.name.startsWith(name)), name);
    assert.ok(json.images.length >= 3);
    assert.ok(json.images.every((i: { mimeType: string }) => i.mimeType === "image/webp"));
    assert.ok(json.extensionsRequired.includes("EXT_meshopt_compression"));
    assert.ok(readFileSync(`public${hero.asset}`).length < 1_500_000);
    assert.match(readFileSync("public/models/sourced/ATTRIBUTION.md", "utf8"), /CC0-1.0/);
  });
});
