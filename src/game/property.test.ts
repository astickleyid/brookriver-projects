import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreSpend, type SpendDef } from "./economy.ts";
import {
  affordable,
  buyCar,
  buyHouse,
  buyShop,
  catalogCars,
  catalogHouses,
  catalogShops,
  deathLoss,
  depositStash,
  emptyProperty,
  healRates,
  parkCar,
  sellHouse,
  sellShop,
  shopTick,
  shopVisit,
  starClear,
  takeCar,
  withdrawStash,
  type DepositResult,
  type PropertyResult,
  type StateResult,
  type WithdrawResult,
} from "./property.ts";

function spend(id: string, name: string, kind: SpendDef["kind"], price: number, power: number, heat: number, upkeep: number): SpendDef {
  return { id, name, kind, price, power, heat, upkeep };
}

function mustPay(result: PropertyResult) {
  if ("error" in result) assert.fail(result.error);
  return result;
}

function mustState(result: StateResult) {
  if ("error" in result) assert.fail(result.error);
  return result;
}

function mustDeposit(result: DepositResult) {
  if ("error" in result) assert.fail(result.error);
  return result;
}

function mustWithdraw(result: WithdrawResult) {
  if ("error" in result) assert.fail(result.error);
  return result;
}

describe("house catalog", () => {
  it("prices three houses strictly up, and the duplex clears 2000", () => {
    const houses = catalogHouses();
    assert.deepEqual(
      houses.map((house) => house.id),
      ["home1", "home2", "home3"],
    );
    assert.ok(houses[0]!.cost < houses[1]!.cost);
    assert.ok(houses[1]!.cost < houses[2]!.cost);
    assert.ok(houses[2]!.cost > 2000);

    const ratings = [
      { id: "home1" as const, price: 3, power: 2, heat: 0, upkeep: 1, kind: "house" as const },
      { id: "home2" as const, price: 4, power: 3, heat: 0, upkeep: 1, kind: "house" as const },
      { id: "home3" as const, price: 5, power: 4, heat: 0, upkeep: 2, kind: "house" as const },
    ];
    for (const rating of ratings) {
      const house = houses.find((item) => item.id === rating.id)!;
      const scored = scoreSpend(spend(rating.id, house.name, rating.kind, rating.price, rating.power, rating.heat, rating.upkeep));
      assert.equal(house.cost, scored.cost);
      assert.equal(house.stars, 0);
      assert.equal(house.heat, 0);
      assert.deepEqual(
        [house.price, house.power, house.heat, house.upkeep],
        [rating.price, rating.power, rating.heat, rating.upkeep],
      );
    }

    assert.deepEqual(
      houses.map((house) => [house.address.x, house.address.z]),
      [
        [31, -75],
        [69, 25],
        [-25, 69],
      ],
    );
    assert.deepEqual(
      houses.map((house) => [house.stashCap, house.bays, house.starInterval, house.deathMultiplier, house.healHp, house.healArmor]),
      [
        [8, 1, 6, 0.75, 10, 3],
        [16, 2, 4, 0.6, 14, 5],
        [28, 3, 2.5, 0.5, 18, 6],
      ],
    );
  });

  it("refuses a house the cash cannot cover, and the same address twice", () => {
    const duplex = catalogHouses()[2]!;
    const start = emptyProperty();
    const broke = buyHouse(start, duplex.id, duplex.cost - 1);
    assert.ok("error" in broke);
    assert.equal(start.ownedHouses.length, 0);

    const bought = mustPay(buyHouse(start, "home1", catalogHouses()[0]!.cost));
    assert.equal(bought.cash, 0);
    assert.deepEqual(bought.state.ownedHouses, ["home1"]);
    const twice = buyHouse(bought.state, "home1", 10_000);
    assert.ok("error" in twice);
    assert.deepEqual(bought.state.ownedHouses, ["home1"]);
  });

  it("sells for 60% and refuses while stash or a parked car remains", () => {
    const listing = catalogHouses()[0]!;
    const bought = mustPay(buyHouse(emptyProperty(), "home1", 100_000));
    const sold = mustPay(sellHouse(bought.state, "home1", bought.cash));
    assert.equal(sold.cost, Math.round(bought.cost * 0.6));
    assert.equal(sold.cash, bought.cash + sold.cost);
    assert.deepEqual(sold.state.ownedHouses, []);

    const again = mustPay(buyHouse(sold.state, "home1", sold.cash));
    const stashed = mustDeposit(depositStash(again.state, 1, 20));
    const blockedStash = sellHouse(stashed.state, "home1", again.cash);
    assert.ok("error" in blockedStash);
    assert.deepEqual(stashed.state.ownedHouses, ["home1"]);
    assert.equal(stashed.state.stash, 1);

    const cleared = mustWithdraw(withdrawStash(stashed.state, 1));
    const car = mustPay(buyCar(cleared.state, "van", again.cash));
    const carId = car.state.ownedCars[0]!.id;
    const parked = mustState(parkCar(car.state, carId, "home1"));
    const blockedCar = sellHouse(parked.state, "home1", car.cash);
    assert.ok("error" in blockedCar);
    assert.equal(parked.state.garage.length, 1);

    const taken = mustState(takeCar(parked.state, carId));
    const soldAgain = mustPay(sellHouse(taken.state, "home1", car.cash));
    assert.deepEqual(soldAgain.state.ownedHouses, []);
    assert.equal(soldAgain.cash - car.cash, Math.round(listing.cost * 0.6));
    assert.equal(soldAgain.state.ownedCars[0]!.parked, false);
  });
});

describe("stash and garage", () => {
  it("caps the stash at the best house owned", () => {
    assert.ok("error" in depositStash(emptyProperty(), 1, 10));

    const row = mustPay(buyHouse(emptyProperty(), "home1", 100_000));
    assert.ok("error" in depositStash(row.state, 5, 4));
    assert.ok("error" in depositStash(row.state, 0, 10));
    assert.ok("error" in depositStash(row.state, -2, 10));
    const full = mustDeposit(depositStash(row.state, 8, 8));
    assert.equal(full.state.stash, 8);
    assert.equal(full.carried, 0);
    assert.ok("error" in depositStash(full.state, 1, 10));

    const walk = mustPay(buyHouse(full.state, "home2", 100_000));
    const raised = mustDeposit(depositStash(walk.state, 8, 8));
    assert.equal(raised.state.stash, 16);
    assert.ok("error" in depositStash(raised.state, 1, 10));

    const duplex = mustPay(buyHouse(row.state, "home3", 100_000));
    assert.ok("error" in depositStash(duplex.state, 29, 29));
    const top = mustDeposit(depositStash(duplex.state, 28, 28));
    assert.equal(top.state.stash, 28);

    const out = mustWithdraw(withdrawStash(top.state, 28));
    assert.equal(out.state.stash, 0);
    assert.equal(out.amount, 28);
    assert.ok("error" in withdrawStash(out.state, 1));
  });

  it("enforces garage bays per house", () => {
    let state = emptyProperty();
    let cash = 1_000_000;
    for (const id of ["home1", "home2", "home3"] as const) {
      const bought = mustPay(buyHouse(state, id, cash));
      state = bought.state;
      cash = bought.cash;
    }
    const bodies = ["mobil", "kamaro", "van", "jeep", "armor", "italia", "lamb"] as const;
    const ids: string[] = [];
    for (const body of bodies) {
      const bought = mustPay(buyCar(state, body, cash));
      state = bought.state;
      cash = bought.cash;
      ids.push(state.ownedCars[state.ownedCars.length - 1]!.id);
    }

    state = mustState(parkCar(state, ids[0]!, "home1")).state;
    assert.ok("error" in parkCar(state, ids[1]!, "home1"));
    state = mustState(parkCar(state, ids[1]!, "home2")).state;
    state = mustState(parkCar(state, ids[2]!, "home2")).state;
    assert.ok("error" in parkCar(state, ids[3]!, "home2"));
    state = mustState(parkCar(state, ids[3]!, "home3")).state;
    state = mustState(parkCar(state, ids[4]!, "home3")).state;
    state = mustState(parkCar(state, ids[5]!, "home3")).state;
    assert.ok("error" in parkCar(state, ids[6]!, "home1"));
    assert.ok("error" in parkCar(state, ids[6]!, "home2"));
    assert.ok("error" in parkCar(state, ids[6]!, "home3"));
    assert.equal(state.garage.filter((slot) => slot.bayHouse === "home1").length, 1);
    assert.equal(state.garage.filter((slot) => slot.bayHouse === "home2").length, 2);
    assert.equal(state.garage.filter((slot) => slot.bayHouse === "home3").length, 3);

    const freed = mustState(takeCar(state, ids[0]!));
    assert.equal(freed.state.ownedCars.find((car) => car.id === ids[0])!.parked, false);
    const reused = mustState(parkCar(freed.state, ids[0]!, "home1"));
    assert.equal(reused.state.garage.filter((slot) => slot.bayHouse === "home1").length, 1);

    const bare = mustPay(buyCar(emptyProperty(), "coupe", 100_000));
    assert.ok("error" in parkCar(bare.state, bare.state.ownedCars[0]!.id, "home1"));
    assert.ok("error" in parkCar(state, "missing", "home2"));
  });
});

describe("door and death", () => {
  it("drops one star per home1 interval and keeps the leftover", () => {
    assert.deepEqual(starClear(3, 6, "home1"), { stars: 2, secondsLeft: 0 });
    assert.deepEqual(starClear(3, 13, "home1"), { stars: 1, secondsLeft: 1 });
    assert.deepEqual(starClear(1, 100, "home1"), { stars: 0, secondsLeft: 94 });
    assert.deepEqual(starClear(2, 5, "home3"), { stars: 0, secondsLeft: 0 });
  });

  it("uses the best death multiplier and the best heal", () => {
    assert.equal(deathLoss(1000, ["home1", "home3"]), 500);
    assert.equal(deathLoss(10, ["home1"]), 7);
    assert.equal(deathLoss(10, ["home2", "home1"]), 6);
    assert.equal(deathLoss(10.5, []), 10.5);
    assert.deepEqual(healRates(["home1", "home3"]), { hp: 18, armor: 6 });
    assert.deepEqual(healRates(["home2"]), { hp: 14, armor: 5 });
    assert.deepEqual(healRates([]), { hp: 0, armor: 0 });
  });
});

describe("shops", () => {
  it("adds till only while wanted is under 4, and selling pays that till", () => {
    const shops = catalogShops();
    assert.deepEqual(
      shops.map((shop) => [shop.id, shop.kind, shop.address.x, shop.address.z]),
      [
        ["store1", "mart", -19, 25],
        ["store2", "late", 75, -31],
        ["pawn", "counter", -31, -25],
      ],
    );
    const late = shops[1]!;
    const pawn = shops[2]!;
    const lateScore = scoreSpend(spend(late.id, late.name, "business", 4, 4, 1, 3));
    const pawnScore = scoreSpend(spend(pawn.id, pawn.name, "business", 4, 3, 2, 2));
    assert.equal(late.cost, lateScore.cost);
    assert.equal(late.income - late.upkeepCash, lateScore.income - lateScore.upkeepCash);
    assert.equal(pawn.cost, pawnScore.cost);
    assert.equal(pawn.stars, pawnScore.stars);
    assert.ok(pawn.stars >= 1);
    const net = late.income - late.upkeepCash;
    assert.ok(net > 0);

    assert.equal(shopTick(emptyProperty(), "store2", 80, 0).shopTill.store2 ?? 0, 0);

    const bought = mustPay(buyShop(emptyProperty(), "store2", late.cost));
    assert.equal(bought.state.ownedShops[0]!.kind, "late");
    const half = shopTick(bought.state, "store2", 4, 0);
    assert.equal(half.shopTill.store2 ?? 0, 0);
    const open = shopTick(half, "store2", 4, 3);
    assert.equal(open.shopTill.store2, net);
    const two = shopTick(bought.state, "store2", 16, 0);
    assert.equal(two.shopTill.store2, net * 2);

    const almost = shopTick(bought.state, "store2", 7, 0);
    const paused = shopTick(almost, "store2", 5, 4);
    assert.equal(paused.shopTill.store2 ?? 0, 0);
    assert.equal(paused.shopClock.store2, almost.shopClock.store2);
    assert.equal(shopTick(open, "store2", 80, 4).shopTill.store2, open.shopTill.store2);
    assert.equal(shopTick(open, "store2", 80, 6).shopTill.store2, open.shopTill.store2);

    const till = open.shopTill.store2 ?? 0;
    const sold = mustPay(sellShop(open, "store2", bought.cash));
    assert.equal(sold.cash - bought.cash, Math.round(late.cost * 0.6) + till);
    assert.equal(sold.state.shopTill.store2 ?? 0, 0);
    assert.ok(!sold.state.ownedShops.some((shop) => shop.id === "store2"));

    const mart = shopVisit("store1");
    assert.equal(mart.effect, "heal");
    if (mart.effect === "heal") assert.equal(mart.heal, 40);
    const ammo = shopVisit("store2");
    assert.equal(ammo.effect, "ammo");
    if (ammo.effect === "ammo") assert.equal(ammo.ammoPacks, late.power);
    assert.equal(shopVisit("pawn").effect, "board");
  });
});

describe("cars", () => {
  it("lists each body once and does not sell police", () => {
    const cars = catalogCars();
    const bodies = cars.map((car) => car.body);
    assert.deepEqual(bodies, [
      "mobil",
      "kamaro",
      "italia",
      "lamb",
      "fenyr",
      "coupe",
      "rally",
      "ghini",
      "van",
      "jeep",
      "armor",
    ]);
    assert.equal(new Set(bodies).size, bodies.length);
    assert.equal(new Set(cars.map((car) => car.id)).size, cars.length);
    const names = bodies.map(String);
    assert.ok(!names.includes("police"));
    assert.ok(!names.includes("cruiser"));
    assert.ok(cars.every((car) => car.ride === "sedan" || car.ride === "sport" || car.ride === "van"));
    assert.equal(cars.find((car) => car.body === "armor")!.ride, "van");
    assert.equal(cars.find((car) => car.body === "armor")!.tier, "armor");

    const sedan = cars.find((car) => car.body === "mobil")!;
    const sport = cars.find((car) => car.body === "italia")!;
    const van = cars.find((car) => car.body === "jeep")!;
    const armor = cars.find((car) => car.body === "armor")!;
    assert.equal(sedan.cost, scoreSpend(spend(sedan.id, sedan.name, "ride", 2, 2, 0, 1)).cost);
    assert.equal(sport.cost, scoreSpend(spend(sport.id, sport.name, "ride", 3, 4, 0, 1)).cost);
    assert.equal(van.cost, scoreSpend(spend(van.id, van.name, "ride", 2, 2, 0, 1)).cost);
    assert.equal(armor.cost, scoreSpend(spend(armor.id, armor.name, "ride", 4, 3, 1, 2)).cost);
    assert.equal(armor.stars, scoreSpend(spend(armor.id, armor.name, "ride", 4, 3, 1, 2)).stars);
    assert.ok(sedan.cost < sport.cost);

    assert.equal(affordable(sedan.cost, cars).some((car) => car.body === "italia"), false);
    assert.ok("error" in buyCar(emptyProperty(), "police", 1_000_000));
    assert.ok("error" in buyCar(emptyProperty(), "armor", armor.cost - 1));
    const first = mustPay(buyCar(emptyProperty(), "mobil", 100_000));
    const second = mustPay(buyCar(first.state, "mobil", first.cash));
    assert.equal(first.cost, second.cost);
    assert.notEqual(second.state.ownedCars[0]!.id, second.state.ownedCars[1]!.id);
    assert.equal(second.state.ownedCars[1]!.parked, false);
    assert.equal(second.state.ownedCars[1]!.ride, "sedan");
  });
});
