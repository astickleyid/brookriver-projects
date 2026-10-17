import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PED_GAP, PLAYER_BUBBLE, separateCrowd, type CrowdBody } from "./crowd.ts";

const open = () => false;

function bodies(n: number, x: number, z: number, hold = false): CrowdBody[] {
  return Array.from({ length: n }, () => ({ x, z, hold }));
}

function minPair(list: CrowdBody[]) {
  let best = Infinity;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      best = Math.min(best, Math.hypot(list[i]!.x - list[j]!.x, list[i]!.z - list[j]!.z));
    }
  }
  return best;
}

describe("separateCrowd", () => {
  it("pushes a stack off the on-foot player and apart from each other", () => {
    const stack = bodies(5, 0, 0);
    separateCrowd(stack, { x: 0, z: 0, vx: 0, vz: 0 }, PED_GAP, PLAYER_BUBBLE, open);
    for (const b of stack) {
      assert.ok(Math.hypot(b.x, b.z) >= PLAYER_BUBBLE - 1e-6);
    }
    assert.ok(minPair(stack) >= PED_GAP - 0.05);
  });

  it("peels bodies to the side of a run instead of leaving them on the capsule", () => {
    const stack = bodies(5, 0, 0);
    separateCrowd(stack, { x: 0, z: 0, vx: 8, vz: 0 }, PED_GAP, PLAYER_BUBBLE, open);
    let meanX = 0;
    for (const b of stack) {
      assert.ok(Math.hypot(b.x, b.z) >= PLAYER_BUBBLE - 1e-6);
      meanX += b.x;
    }
    meanX /= stack.length;
    assert.ok(meanX <= 0.05, `pack led the run at ${meanX}`);
    assert.ok(minPair(stack) >= PED_GAP - 0.05);
  });

  it("keeps a driving pack inside the ram", () => {
    const stack = bodies(5, 3, -2);
    separateCrowd(stack, null, PED_GAP, PLAYER_BUBBLE, open);
    for (const b of stack) {
      assert.ok(Math.hypot(b.x - 3, b.z + 2) < 2.05);
    }
    assert.ok(minPair(stack) >= PED_GAP - 0.05);
  });

  it("does not move a downed body or pull someone toward the player", () => {
    const down = { x: 0, z: 0, hold: true };
    const far = { x: 5, z: 1, hold: false };
    separateCrowd([down, far], { x: 0, z: 0, vx: 0, vz: 0 }, PED_GAP, PLAYER_BUBBLE, open);
    assert.equal(down.x, 0);
    assert.equal(down.z, 0);
    assert.equal(far.x, 5);
    assert.equal(far.z, 1);
  });

  it("leaves a body where it is when every exit is blocked", () => {
    const stuck = { x: 0.2, z: 0 };
    separateCrowd([stuck], { x: 0, z: 0, vx: 0, vz: 0 }, PED_GAP, PLAYER_BUBBLE, () => true);
    assert.equal(stuck.x, 0.2);
    assert.equal(stuck.z, 0);
  });
});
