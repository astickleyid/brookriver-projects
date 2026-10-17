import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three/webgpu";
import { bodyFor, driveQuaternion } from "./fleet.ts";

describe("car bodies", () => {
  it("spreads meshes inside a ride and keeps every cruiser on the police body", () => {
    assert.equal(bodyFor("cruiser", 0), "police");
    assert.equal(bodyFor("cruiser", 3), "police");
    assert.notEqual(bodyFor("sport", 0), bodyFor("sport", 1));
    assert.equal(bodyFor("sedan", 0), bodyFor("sedan", 2));
    assert.notEqual(bodyFor("van", 0), bodyFor("van", 1));
  });
});

describe("car facing", () => {
  it("points the glTF nose along the drive forward at yaw 0", () => {
    const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(driveQuaternion(0));
    assert.ok(Math.abs(nose.x) < 1e-5);
    assert.ok(Math.abs(nose.z + 1) < 1e-5);
  });

  it("keeps the same yaw sign as the box cars", () => {
    const up = new THREE.Vector3(0, 1, 0);
    const box = new THREE.Quaternion().setFromAxisAngle(up, 0.4 + Math.PI);
    const drive = driveQuaternion(0.4);
    assert.ok(Math.abs(box.x - drive.x) < 1e-6);
    assert.ok(Math.abs(box.y - drive.y) < 1e-6);
    assert.ok(Math.abs(box.z - drive.z) < 1e-6);
    assert.ok(Math.abs(box.w - drive.w) < 1e-6);
  });
});
