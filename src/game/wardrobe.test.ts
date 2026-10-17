import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three/webgpu";
import { characterProfile, garmentGeometry } from "./wardrobe.ts";

describe("resident wardrobe", () => {
  it("gives the whole population stable distinct names and varied styling", () => {
    const cast = Array.from({ length: 60 }, (_, i) =>
      characterProfile(`civ-m-${["tee", "hoodie", "jacket", "worker", "suit"][i % 5]}`, i),
    );
    assert.equal(new Set(cast.map((p) => p.id)).size, 60);
    assert.equal(new Set(cast.map((p) => p.name)).size, 60);
    assert.ok(new Set(cast.map((p) => p.role)).size >= 12);
    assert.ok(new Set(cast.map((p) => p.accessories.join())).size >= 10);
    assert.ok(new Set(cast.map((p) => p.fabric)).size >= 7);
    for (const p of cast) assert.ok(p.accessories.length >= 2 && p.manner.length > 15);
    assert.deepEqual(characterProfile("civ-f-suit-a", 22), characterProfile("civ-f-suit-a", 22));
  });
  it("keeps police equipment and crew identities legible", () => {
    const cop = characterProfile("cop-f", 55);
    assert.equal(cop.outfit, "uniform");
    assert.ok(cop.accessories.includes("policecap") && cop.accessories.includes("dutybelt"));
    assert.equal(characterProfile("amber-m", 50).role, "West Corner crew");
    assert.equal(characterProfile("teal-f", 53).role, "East Corner crew");
    assert.notEqual(characterProfile("amber-m", 50).fabric, characterProfile("teal-f", 53).fabric);
  });
  it("adds cloth volume without changing the source mesh or skin weights", () => {
    const source = new THREE.BoxGeometry(0.3, 0.4, 0.18);
    source.translate(0, 1.25, 0);
    const weights = new Float32Array(source.getAttribute("position").count * 4);
    for (let i = 0; i < weights.length; i += 4) weights[i] = 1;
    source.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
    source.setAttribute("skinIndex", new THREE.BufferAttribute(new Uint16Array(weights.length), 4));
    const original = Array.from(source.getAttribute("position").array);
    const shell = garmentGeometry(source, "hoodie", characterProfile("civ-m-hoodie-a", 3));
    assert.deepEqual(Array.from(source.getAttribute("position").array), original);
    assert.deepEqual(Array.from(shell.getAttribute("skinWeight").array), Array.from(weights));
    assert.ok(shell.getIndex()!.count > 0);
    shell.computeBoundingBox();
    source.computeBoundingBox();
    assert.ok(shell.boundingBox!.max.x > source.boundingBox!.max.x + 0.02);
    assert.ok(shell.getAttribute("color"));
    source.dispose();
    shell.dispose();
  });
});
