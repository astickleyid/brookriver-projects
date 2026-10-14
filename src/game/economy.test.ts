import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HUSTLES, hustleById, resolveHustle, scoreHustle, scoreSpend, spendById, SPENDS } from "./economy.ts";

function scored(id: string) {
  const def = hustleById(id);
  assert.ok(def);
  return scoreHustle(def);
}

describe("hustle scale", () => {
  it("pays more as earning potential climbs, with a risk premium on top", () => {
    const mug = scored("mug");
    const home = scored("home");
    const store = scored("store");
    const whale = scored("roller");
    const bank = scored("vault");
    assert.ok(mug.gross < home.gross);
    assert.ok(home.gross < store.gross);
    assert.ok(store.gross < whale.gross);
    assert.ok(whale.gross < bank.gross);
  });

  it("turns the four ratings into heat, health, time, and buy-in", () => {
    const mug = scored("mug");
    const bank = scored("vault");
    const dice = scored("dice");
    const table = scored("table");
    const deal = scored("deal");
    const whale = scored("roller");
    assert.equal(mug.stars, 1);
    assert.equal(bank.stars, 4);
    assert.equal(bank.bustStars, 5);
    assert.ok(bank.hurt > mug.hurt);
    assert.ok(whale.hurt > deal.hurt);
    assert.ok(bank.seconds > storeSeconds());
    assert.ok(table.stakeCash > dice.stakeCash);
    assert.ok(table.stakeCash > deal.stakeCash / 2);
    assert.ok(dice.winChance > table.winChance);
    assert.ok(dice.winPay > dice.stakeCash);
    assert.ok(table.winPay > table.stakeCash);
    assert.ok(scored("pawn").fenceCut > 0.45 && scored("pawn").fenceCut < 0.7);
    assert.ok(bank.fail > mug.fail);
    assert.equal(scored("pawn").stakeCash, 0);
  });

  it("keeps every catalog hustle inside the scale", () => {
    for (const def of HUSTLES) {
      const s = scoreHustle(def);
      assert.ok(s.fail >= 0.04 && s.fail <= 0.78);
      assert.ok(s.seconds >= 1.8);
      assert.ok(s.stars >= 0 && s.stars <= 5);
      assert.ok(s.bustStars >= s.stars && s.bustStars <= 5);
      assert.ok(s.low <= s.gross && s.gross <= s.high);
      if (def.stake === 0) assert.equal(s.stakeCash, 0);
      if (def.stake > 0) assert.ok(s.stakeCash > 0);
    }
  });

  it("busts a hostile mark and fences goods at the cut", () => {
    const mug = hustleById("mug");
    const pawn = hustleById("pawn");
    assert.ok(mug && pawn);
    const shot = resolveHustle(mug, () => 0, 0, true);
    assert.equal(shot.ok, false);
    assert.equal(shot.wallet, 0);
    assert.ok(shot.stars >= 1);
    const cut = scoreHustle(pawn).fenceCut;
    const sold = resolveHustle(pawn, () => 0.99, 200, false);
    assert.equal(sold.ok, true);
    assert.equal(sold.wallet, Math.round(200 * cut));
    assert.equal(sold.clearLoot, true);
    const empty = resolveHustle(pawn, () => 0.99, 0, false);
    assert.equal(empty.ok, false);
    assert.match(empty.line, /Nothing/);
  });

  it("pays a winning dice roll back above the stake", () => {
    const dice = hustleById("dice");
    assert.ok(dice);
    const rolls = [0.01, 0.99];
    let n = 0;
    const hit = resolveHustle(dice, () => rolls[n++] ?? 0.99, 0, false);
    assert.equal(hit.ok, true);
    assert.ok(hit.wallet > scoreHustle(dice).stakeCash);
    assert.match(hit.line, /^Up /);
  });
});

describe("spend scale", () => {
  it("charges more for a higher price class and a stronger good", () => {
    const ammo = scoreSpend(spendById("ammo")!);
    const tune = scoreSpend(spendById("tune")!);
    const sport = scoreSpend(spendById("sport")!);
    const house = scoreSpend(spendById("house")!);
    assert.ok(ammo.cost < tune.cost);
    assert.ok(tune.cost < sport.cost);
    assert.ok(sport.cost < house.cost);
    assert.ok(house.cost > 2000);
  });

  it("stacks upgrade prices and keeps a shop ahead of its upkeep", () => {
    const tune = spendById("tune")!;
    const shop = spendById("business")!;
    assert.ok(scoreSpend(tune, 2).cost > scoreSpend(tune, 1).cost);
    assert.ok(scoreSpend(tune, 1).cost > scoreSpend(tune, 0).cost);
    const biz = scoreSpend(shop);
    assert.ok(biz.income > biz.upkeepCash);
    assert.equal(scoreSpend(spendById("bribe")!).stars, 1);
    assert.ok(scoreSpend(spendById("hit")!).stars >= 2);
  });

  it("prices every spend from the four ratings", () => {
    for (const def of SPENDS) {
      const s = scoreSpend(def);
      assert.ok(s.cost > 0);
      assert.ok(s.stars >= 0 && s.stars <= 5);
      assert.ok(s.seconds > 0);
      if (def.power === 0) assert.equal(s.income, 0);
      if (def.upkeep === 0) assert.equal(s.upkeepCash, 0);
    }
  });
});

function storeSeconds() {
  return scored("store").seconds;
}
