import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  choosePadIndex,
  driveSteer,
  forgetPadLayout,
  inferLayout,
  layoutFor,
  padWindowLive,
  readGamepads,
  pitchDelta,
  radialDeadzone,
  resetPadLayouts,
  responseCurve,
  sampleAxes,
  throttleFromStick,
  triggerFeel,
  yawDelta,
  type PadLike,
} from "./gamepad.ts";

function pad(partial: Partial<PadLike> & Pick<PadLike, "axes">): PadLike {
  return {
    index: 0,
    connected: true,
    mapping: "",
    timestamp: 1,
    buttons: [],
    ...partial,
  };
}

describe("gamepad", () => {
  it("drops stick drift and still reaches the corner", () => {
    const idle = radialDeadzone(0.08, -0.09, 0.17);
    assert.equal(idle.x, 0);
    assert.equal(idle.y, 0);
    const full = radialDeadzone(0.72, 0.72, 0.17);
    assert.ok(Math.hypot(full.x, full.y) > 0.95);
  });

  it("keeps a full tilt after the response curve", () => {
    assert.equal(responseCurve(1, 2), 1);
    assert.equal(responseCurve(-1, 1.4), -1);
    assert.ok(responseCurve(0.4, 2) < 0.4);
  });

  it("eases the start of a trigger pull", () => {
    assert.equal(triggerFeel(0.05), 0);
    assert.ok(triggerFeel(0.3) < 0.3);
    assert.ok(triggerFeel(1) > 0.99);
  });

  it("steers and looks with the same signs as the keyboard and mouse", () => {
    assert.ok(driveSteer(-1) > 0, "stick left steers left");
    assert.ok(driveSteer(1) < 0, "stick right steers right");
    assert.ok(throttleFromStick(-1) > 0, "stick up is throttle");
    assert.ok(yawDelta(1, 5, 0.016) < 0, "stick right yaws like mouse right");
    assert.ok(pitchDelta(1, 3, 0.016) < 0, "stick down pitches like mouse down");
    assert.ok(pitchDelta(-1, 3, 0.016) > 0, "stick up looks up");
  });

  it("reads trigger axes that rest at -1 without treating a centered stick as gas", () => {
    resetPadLayouts();
    const raw = pad({
      mapping: "",
      axes: [0, 0, 0, 0, -1, -1],
    });
    assert.equal(inferLayout(raw), "triggers-tail");
    const rest = sampleAxes(raw, "triggers-tail");
    assert.equal(rest.lt, 0);
    assert.equal(rest.rt, 0);
    assert.equal(rest.rx, 0);
    const pressed = sampleAxes(pad({ mapping: "", axes: [0, 0, 0.4, -0.2, 1, -1] }), "triggers-tail");
    assert.ok(pressed.lt > 0.9);
    assert.equal(pressed.rt, 0);
    assert.ok(Math.abs(pressed.rx - 0.4) < 0.001);
  });

  it("puts the right stick after a leading trigger axis", () => {
    assert.equal(inferLayout(pad({ mapping: "", axes: [0, 0, -1, 0, 0, -1] })), "lt-before-right");
    const sample = sampleAxes(pad({ mapping: "", axes: [0, 0, -1, 0.5, -0.25, -1] }), "lt-before-right");
    assert.equal(sample.lt, 0);
    assert.equal(sample.rt, 0);
    assert.ok(Math.abs(sample.rx - 0.5) < 0.001);
    assert.ok(Math.abs(sample.ry - -0.25) < 0.001);
  });

  it("keeps polling a visible tab even when the document looks blurred", () => {
    assert.equal(padWindowLive({ hidden: false }), true);
    assert.equal(padWindowLive({ hidden: true }), false);
  });

  it("reads a pad list and swallows a blocked gamepad API", () => {
    const seen = readGamepads({
      getGamepads: () => [{ index: 0, connected: true, mapping: "standard", timestamp: 1, axes: [0], buttons: [] }],
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.index, 0);
    assert.deepEqual(readGamepads({ getGamepads: () => { throw new Error("SecurityError"); } }), []);
    assert.deepEqual(readGamepads(null), []);
    resetPadLayouts();
    const raw = pad({ index: 4, mapping: "", axes: [0, 0, 0, 0, -1, -1] });
    assert.equal(layoutFor(raw), "triggers-tail");
    forgetPadLayout(4);
    assert.equal(layoutFor({ ...raw, mapping: "standard" }), "standard");
  });

  it("keeps a standard pad and will not stick to a dead non-standard slot", () => {
    const pads = [
      { index: 0, connected: true, mapping: "", timestamp: 50 },
      { index: 1, connected: true, mapping: "standard", timestamp: 10 },
    ];
    assert.equal(choosePadIndex(pads, -1), 1);
    assert.equal(choosePadIndex(pads, 1), 1);
    assert.equal(choosePadIndex(pads, 0), 1);
  });
});
