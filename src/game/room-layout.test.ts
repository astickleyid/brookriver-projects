import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three/webgpu";
import { CASINO_FLOOR } from "./casino.ts";
import { HALL_ORIGIN, hallWalls } from "./hall.ts";
import {
  CARD_EULER,
  DOOR_HALF,
  FACE_PLAYER_Y,
  ROOM_SPAWN_Z,
  casinoStationLocal,
  pocketOffset,
  roomById,
  roomList,
  roomLocalBoxes,
  roomProps,
  roomShell,
  standClear,
  wheelYaw,
} from "./room-layout.ts";

function overlap(a: { minX: number; maxX: number; minZ: number; maxZ: number }, b: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  return a.minX < b.maxX - 1e-6 && a.maxX > b.minX + 1e-6 && a.minZ < b.maxZ - 1e-6 && a.maxZ > b.minZ + 1e-6;
}

describe("walk-in rooms", () => {
  it("keeps every room outside the city and clear of the others", () => {
    const rooms = roomList();
    assert.equal(rooms.length, 10);
    for (const room of rooms) {
      assert.ok(Math.abs(room.origin.x) > 200 && Math.abs(room.origin.z) > 200, room.id);
      assert.ok(standClear(room, 0, ROOM_SPAWN_Z, 0.42), `${room.id} spawn is blocked`);
      const props = roomProps(room);
      for (const prop of props) {
        for (const wall of roomShell(room)) assert.equal(overlap(prop, wall), false, `${room.id} ${prop.id} hits a wall`);
      }
      for (let i = 0; i < props.length; i++) {
        for (let j = i + 1; j < props.length; j++) assert.equal(overlap(props[i]!, props[j]!), false, `${room.id} props overlap`);
      }
    }
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i]!;
        const b = rooms[j]!;
        const d = Math.hypot(a.origin.x - b.origin.x, a.origin.z - b.origin.z);
        assert.ok(d > a.depth + b.depth, `${a.id} overlaps ${b.id}`);
      }
    }
  });

  it("leaves a door wider than the player", () => {
    assert.ok(DOOR_HALF > 0.42 + 0.8);
    const row = roomById("home1");
    assert.ok(row);
    const south = roomShell(row).filter((box) => box.maxZ < 1);
    assert.equal(south.length, 2);
    const gap = DOOR_HALF * 2;
    assert.ok(gap > 3);
    assert.equal(roomLocalBoxes(row).length, roomShell(row).length + roomProps(row).length);
  });
});

describe("dice hall furniture", () => {
  it("keeps station columns on the same spots the floor uses", () => {
    assert.deepEqual(casinoStationLocal("slots", -6, 16), { minX: -6.4, maxX: -5.6, minZ: 15.75, maxZ: 16.35, h: 5 });
    assert.deepEqual(casinoStationLocal("blackjack", -6, 6), { minX: -7.05, maxX: -4.95, minZ: 5.15, maxZ: 6.85, h: 5 });
    const walls = hallWalls();
    for (const entry of CASINO_FLOOR.entries) {
      const local = casinoStationLocal(entry.game, entry.x, entry.z);
      const found = walls.some(
        (box) =>
          Math.abs(box.minX - (HALL_ORIGIN.x + local.minX)) < 1e-6 &&
          Math.abs(box.maxX - (HALL_ORIGIN.x + local.maxX)) < 1e-6 &&
          Math.abs(box.minZ - (HALL_ORIGIN.z + local.minZ)) < 1e-6 &&
          Math.abs(box.maxZ - (HALL_ORIGIN.z + local.maxZ)) < 1e-6,
      );
      assert.equal(found, true, entry.id);
    }
  });

  it("lands the winning pocket on the player side and lays cards upright", () => {
    const index = 5;
    const wheel = new THREE.Group();
    const pocket = new THREE.Object3D();
    const at = pocketOffset(index);
    pocket.position.set(at.x, 0, at.z);
    wheel.add(pocket);
    wheel.rotation.y = wheelYaw(index);
    wheel.updateMatrixWorld(true);
    const world = new THREE.Vector3();
    pocket.getWorldPosition(world);
    assert.ok(world.z < -0.98, `pocket z ${world.z}`);
    assert.ok(Math.abs(world.x) < 0.02, `pocket x ${world.x}`);

    const card = new THREE.Object3D();
    card.rotation.set(CARD_EULER.x, CARD_EULER.y, CARD_EULER.z);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(card.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(card.quaternion);
    assert.ok(normal.y > 0.98);
    assert.ok(up.z > 0.98);

    const screen = new THREE.Object3D();
    screen.rotation.y = FACE_PLAYER_Y;
    const face = new THREE.Vector3(0, 0, 1).applyQuaternion(screen.quaternion);
    assert.ok(face.z < -0.98);
  });
});
