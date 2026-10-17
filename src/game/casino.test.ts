import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CASINO_FLOOR,
  EUROPEAN_WHEEL,
  MAX_BET,
  MIN_BET,
  RED_NUMBERS,
  SLOT_SYMBOLS,
  baccaratPip,
  baccaratTotal,
  bankerDrawsThird,
  blackjackProfit,
  dieFromRng,
  double,
  hit,
  playBaccarat,
  playerDrawsThird,
  pocketFromRng,
  resolveBaccarat,
  rollCraps,
  scoreHand,
  spinRoulette,
  spinSlots,
  split,
  stand,
  standardDeck,
  startBlackjack,
  symbolFromRng,
  type Rank,
  type Suit,
} from "./casino.ts";

function ok<T>(value: T | string): T {
  assert.equal(typeof value, "object");
  if (typeof value === "string") throw new Error(value);
  return value;
}

function card(rank: Rank, suit: Suit) {
  return { rank, suit };
}

/**
 * Inverse of shuffleDeck's Fisher-Yates (i from 51 down to 1, j = floor(rng * (i + 1))).
 * The value (j + 0.5) / (i + 1) lands in the middle of bucket j.
 * Opening deal then takes index 0, 1, 2, 3 as player, dealer, player, dealer.
 */
function rngForOrder(order: { rank: Rank; suit: Suit }[]): () => number {
  const base = standardDeck();
  const desired = order.map((entry) => {
    const index = base.findIndex((card) => card.rank === entry.rank && card.suit === entry.suit);
    if (index < 0) throw new Error(`missing ${entry.rank}${entry.suit}`);
    return index;
  });
  assert.equal(desired.length, 52);
  const deck = base.map((_, index) => index);
  const fractions: number[] = [];
  for (let i = deck.length - 1; i > 0; i--) {
    const want = desired[i];
    if (want === undefined) throw new Error("short shoe");
    const j = deck.indexOf(want);
    if (j < 0 || j > i) throw new Error(`inverse failed at ${i}`);
    fractions.push((j + 0.5) / (i + 1));
    const swap = deck[i];
    deck[i] = deck[j] ?? j;
    deck[j] = swap ?? want;
  }
  let cursor = 0;
  return () => {
    const value = fractions[cursor];
    cursor += 1;
    if (value === undefined) throw new Error("rng queue empty");
    return value;
  };
}

function shoe(top: { rank: Rank; suit: Suit }[]) {
  const pool = standardDeck();
  const picked: { rank: Rank; suit: Suit }[] = [];
  for (const want of top) {
    const index = pool.findIndex((entry) => entry.rank === want.rank && entry.suit === want.suit);
    if (index < 0) throw new Error(`missing ${want.rank}${want.suit}`);
    const [pulled] = pool.splice(index, 1);
    if (!pulled) throw new Error("missing card");
    picked.push(pulled);
  }
  return rngForOrder([...picked, ...pool]);
}

/** Index i on a 37-pocket wheel, or a 6-symbol reel. Mid-bucket so floor(rng * n) is stable. */
function unit(index: number, count: number) {
  return (index + 0.5) / count;
}

function faces(dice: number[]) {
  const values = dice.map((face) => unit(face - 1, 6));
  let cursor = 0;
  return () => {
    const value = values[cursor];
    cursor += 1;
    if (value === undefined) throw new Error("rng queue empty");
    return value;
  };
}

function reels(names: (typeof SLOT_SYMBOLS)[number][]) {
  const values = names.map((name) => unit(SLOT_SYMBOLS.indexOf(name), SLOT_SYMBOLS.length));
  let cursor = 0;
  return () => {
    const value = values[cursor];
    cursor += 1;
    if (value === undefined) throw new Error("rng queue empty");
    return value;
  };
}

describe("casino floor", () => {
  it("places the door on the south wall and the tables inside +z", () => {
    assert.equal(CASINO_FLOOR.width, 24);
    assert.equal(CASINO_FLOOR.depth, 18);
    assert.deepEqual(CASINO_FLOOR.door, { x: 0, z: 0 });
    assert.deepEqual(
      CASINO_FLOOR.entries.map((entry) => entry.id),
      ["bj", "roulette", "craps", "baccarat", "slot-l", "slot-m", "slot-r", "cage"],
    );
    const spot = (id: string) => CASINO_FLOOR.entries.find((entry) => entry.id === id);
    assert.deepEqual(spot("bj"), { id: "bj", game: "blackjack", x: -6, z: 6, label: "Blackjack" });
    assert.deepEqual(spot("roulette"), { id: "roulette", game: "roulette", x: 6, z: 6, label: "Roulette" });
    assert.deepEqual(spot("craps"), { id: "craps", game: "craps", x: -6, z: 12, label: "Craps" });
    assert.deepEqual(spot("baccarat"), { id: "baccarat", game: "baccarat", x: 6, z: 12, label: "Baccarat" });
    assert.deepEqual(spot("slot-l"), { id: "slot-l", game: "slots", x: -6, z: 16, label: "Slots" });
    assert.deepEqual(spot("slot-m"), { id: "slot-m", game: "slots", x: 0, z: 16, label: "Slots" });
    assert.deepEqual(spot("slot-r"), { id: "slot-r", game: "slots", x: 6, z: 16, label: "Slots" });
    assert.deepEqual(spot("cage"), { id: "cage", game: "cage", x: 0, z: 3, label: "Cage" });
    for (const entry of CASINO_FLOOR.entries) {
      assert.ok(entry.z > 0 && entry.z < CASINO_FLOOR.depth);
      assert.ok(Math.abs(entry.x) < CASINO_FLOOR.width / 2);
    }
  });
});

describe("bets", () => {
  it("refuses a bet that is not an integer, under 10, over 500, or over cash", () => {
    assert.equal(MIN_BET, 10);
    assert.equal(MAX_BET, 500);
    assert.equal(startBlackjack(100, 9, () => 0), "Minimum bet is 10");
    assert.equal(startBlackjack(100, 0, () => 0), "Minimum bet is 10");
    assert.equal(startBlackjack(1000, 501, () => 0), "Maximum bet is 500");
    assert.equal(startBlackjack(100, 10.5, () => 0), "Bet must be an integer");
    assert.equal(startBlackjack(40, 50, () => 0), "Not enough cash");
    assert.equal(spinRoulette(100, 9, "red", 0, () => 0), "Minimum bet is 10");
    assert.equal(spinSlots(100, 501, () => 0), "Maximum bet is 500");
    assert.equal(rollCraps(20, 30, () => 0), "Not enough cash");
    assert.equal(playBaccarat(100, 10.5, "player", () => 0), "Bet must be an integer");
    assert.equal(spinRoulette(100, 10, "straight", 37, () => 0), "Straight pick must be 0 through 36");
    assert.equal(spinRoulette(100, 10, "dozen", 4, () => 0), "Dozen pick must be 1, 2, or 3");
  });
});

describe("blackjack", () => {
  it("pays a player blackjack 3:2 and rounds the profit down", () => {
    assert.equal(blackjackProfit(10), 15);
    assert.equal(blackjackProfit(15), 22);
    const dealt = ok(
      startBlackjack(100, 10, shoe([card("A", "C"), card("9", "D"), card("K", "C"), card("7", "D")])),
    );
    assert.equal(dealt.phase, "done");
    assert.equal(dealt.outcome, "blackjack");
    assert.equal(dealt.payout, 25);
    assert.equal(dealt.cash, 115);
    assert.equal(dealt.log, "Blackjack.");
    assert.equal(dealt.holeHidden, false);
    assert.deepEqual(
      dealt.player.map((entry) => entry.rank),
      ["A", "K"],
    );
    assert.equal(scoreHand(dealt.player).total, 21);
    assert.equal(hit(dealt, () => 0), "Hand is over");

    const odd = ok(startBlackjack(200, 15, shoe([card("A", "C"), card("9", "D"), card("K", "C"), card("7", "D")])));
    assert.equal(odd.payout, 37);
    assert.equal(odd.cash, 222);
  });

  it("takes the stake on a player bust and still lets the dealer play", () => {
    const dealt = ok(
      startBlackjack(100, 10, shoe([card("10", "C"), card("9", "D"), card("6", "C"), card("8", "D"), card("K", "C")])),
    );
    assert.equal(dealt.phase, "player");
    assert.equal(dealt.cash, 90);
    assert.equal(dealt.holeHidden, true);
    assert.equal(dealt.dealer[1]?.hidden, true);
    assert.equal(dealt.dealer[1]?.rank, "8");
    assert.deepEqual(
      dealt.player.map((entry) => `${entry.rank}${entry.suit}`),
      ["10C", "6C"],
    );
    assert.equal(`${dealt.dealer[0]?.rank}${dealt.dealer[0]?.suit}`, "9D");

    const busted = ok(hit(dealt, () => 0));
    assert.equal(dealt.phase, "player");
    assert.equal(dealt.cash, 90);
    assert.equal(dealt.player.length, 2);
    assert.equal(dealt.dealer[1]?.hidden, true);
    assert.equal(busted.phase, "done");
    assert.equal(busted.outcome, "bust");
    assert.equal(busted.payout, 0);
    assert.equal(busted.cash, 90);
    assert.equal(scoreHand(busted.player).total, 26);
    assert.equal(scoreHand(busted.dealer).total, 17);
    assert.equal(busted.dealer.length, 2);
    assert.equal(busted.holeHidden, false);
    assert.equal(busted.log, "Bust. Dealer 17.");
  });

  it("lets a busted player lose even when the dealer busts too", () => {
    const dealt = ok(
      startBlackjack(
        100,
        10,
        shoe([card("10", "C"), card("10", "D"), card("6", "C"), card("6", "D"), card("K", "C"), card("K", "D")]),
      ),
    );
    const busted = ok(hit(dealt, () => 0));
    assert.equal(scoreHand(busted.player).total, 26);
    assert.equal(scoreHand(busted.dealer).total, 26);
    assert.equal(busted.cash, 90);
    assert.equal(busted.outcome, "bust");
    assert.equal(busted.log, "Bust. Dealer busts 26.");
  });

  it("pays even money when the dealer busts", () => {
    const dealt = ok(
      startBlackjack(
        100,
        10,
        shoe([card("10", "C"), card("6", "D"), card("10", "H"), card("10", "S"), card("K", "C")]),
      ),
    );
    const done = ok(stand(dealt, () => 0));
    assert.equal(done.phase, "done");
    assert.equal(scoreHand(done.player).total, 20);
    assert.equal(scoreHand(done.dealer).total, 26);
    assert.equal(done.dealer.length, 3);
    assert.equal(done.outcome, "win");
    assert.equal(done.payout, 20);
    assert.equal(done.cash, 110);
    assert.equal(done.log, "Dealer busts 26. Win.");
  });

  it("returns the stake on a push", () => {
    const dealt = ok(
      startBlackjack(100, 10, shoe([card("K", "C"), card("10", "D"), card("Q", "C"), card("10", "S")])),
    );
    assert.equal(dealt.phase, "player");
    assert.equal(dealt.dealer[1]?.hidden, true);
    const done = ok(stand(dealt, () => 0));
    assert.equal(scoreHand(done.player).total, 20);
    assert.equal(scoreHand(done.dealer).total, 20);
    assert.equal(done.outcome, "push");
    assert.equal(done.payout, 10);
    assert.equal(done.cash, 100);
    assert.equal(done.log, "Dealer 20. Push.");
  });

  it("pushes when both sides have blackjack", () => {
    const dealt = ok(startBlackjack(100, 10, shoe([card("A", "C"), card("A", "D"), card("K", "C"), card("K", "D")])));
    assert.equal(dealt.phase, "done");
    assert.equal(dealt.outcome, "push");
    assert.equal(dealt.payout, 10);
    assert.equal(dealt.cash, 100);
    assert.equal(dealt.log, "Push.");
    assert.equal(dealt.dealer[1]?.rank, "K");
    assert.equal(dealt.holeHidden, false);
  });

  it("loses to a dealer blackjack after the ace or ten peek", () => {
    const dealt = ok(startBlackjack(100, 10, shoe([card("10", "C"), card("A", "C"), card("8", "D"), card("K", "C")])));
    assert.equal(dealt.phase, "done");
    assert.equal(dealt.outcome, "lose");
    assert.equal(dealt.payout, 0);
    assert.equal(dealt.cash, 90);
    assert.equal(dealt.log, "Dealer blackjack.");
    assert.equal(scoreHand(dealt.dealer).total, 21);
  });

  it("stands the dealer on soft 17", () => {
    const soft = scoreHand([card("A", "S"), card("6", "H")]);
    assert.equal(soft.total, 17);
    assert.equal(soft.soft, true);
    const dealt = ok(startBlackjack(100, 10, shoe([card("10", "C"), card("A", "C"), card("10", "D"), card("6", "C")])));
    assert.equal(dealt.phase, "player");
    const done = ok(stand(dealt, () => 0));
    assert.equal(done.dealer.length, 2);
    assert.equal(scoreHand(done.dealer).total, 17);
    assert.equal(scoreHand(done.dealer).soft, true);
    assert.equal(done.cash, 110);
    assert.equal(done.outcome, "win");
    assert.equal(done.log, "Dealer 17. Win.");
  });

  it("keeps a hit that does not bust in the player phase", () => {
    const dealt = ok(
      startBlackjack(100, 10, shoe([card("10", "C"), card("9", "D"), card("6", "C"), card("8", "D"), card("2", "H")])),
    );
    const stayed = ok(hit(dealt, () => 0));
    assert.equal(stayed.phase, "player");
    assert.equal(scoreHand(stayed.player).total, 18);
    assert.equal(stayed.cash, 90);
    const done = ok(stand(stayed, () => 0));
    assert.equal(done.cash, 110);
    assert.equal(done.outcome, "win");
    assert.equal(scoreHand(done.dealer).total, 17);
  });

  it("splits matching ranks, refuses resplit and double, and pays each hand even money", () => {
    const dealt = ok(
      startBlackjack(
        100,
        10,
        shoe([
          card("8", "C"),
          card("6", "D"),
          card("8", "H"),
          card("5", "C"),
          card("10", "C"),
          card("10", "D"),
          card("6", "H"),
        ]),
      ),
    );
    const parted = ok(split(dealt, () => 0));
    assert.equal(parted.split, true);
    assert.equal(parted.phase, "player");
    assert.equal(parted.cash, 80);
    assert.deepEqual(
      parted.hands[0]?.cards.map((entry) => entry.rank),
      ["8", "10"],
    );
    assert.deepEqual(
      parted.hands[1]?.cards.map((entry) => entry.rank),
      ["8", "10"],
    );
    assert.equal(double(parted, () => 0), "No double after split");
    assert.equal(split(parted, () => 0), "No resplit");
    assert.equal(parted.cash, 80);
    const second = ok(stand(parted, () => 0));
    assert.equal(second.phase, "player");
    assert.equal(second.active, 1);
    const done = ok(stand(second, () => 0));
    assert.equal(done.phase, "done");
    assert.equal(scoreHand(done.dealer).total, 17);
    assert.equal(done.dealer.length, 3);
    assert.equal(done.hands[0]?.result, "win");
    assert.equal(done.hands[1]?.result, "win");
    assert.equal(done.payout, 40);
    assert.equal(done.cash, 120);
    assert.equal(done.log, "Dealer 17. Hand 1 Win. Hand 2 Win.");
  });

  it("does not pay 3:2 on a two-card 21 after a split", () => {
    const dealt = ok(
      startBlackjack(
        100,
        10,
        shoe([
          card("A", "C"),
          card("9", "D"),
          card("A", "D"),
          card("7", "C"),
          card("K", "C"),
          card("5", "D"),
          card("9", "H"),
        ]),
      ),
    );
    const parted = ok(split(dealt, () => 0));
    const second = ok(stand(parted, () => 0));
    const done = ok(stand(second, () => 0));
    assert.equal(done.hands[0]?.result, "win");
    assert.notEqual(done.hands[0]?.result, "blackjack");
    assert.equal(scoreHand(done.hands[0]?.cards ?? []).total, 21);
    assert.equal(scoreHand(done.dealer).total, 25);
    assert.equal(done.cash, 120);
    assert.equal(done.payout, 40);
  });

  it("refuses a split when the ranks differ or the second bet is short", () => {
    const unmatched = ok(
      startBlackjack(100, 10, shoe([card("10", "C"), card("9", "D"), card("J", "C"), card("8", "D")])),
    );
    assert.equal(split(unmatched, () => 0), "Cards must match to split");
    assert.equal(unmatched.cash, 90);
    assert.equal(unmatched.phase, "player");

    const short = ok(startBlackjack(15, 10, shoe([card("8", "C"), card("9", "D"), card("8", "H"), card("7", "C")])));
    assert.equal(short.cash, 5);
    assert.equal(split(short, () => 0), "Not enough cash");
    assert.equal(short.cash, 5);
  });

  it("doubles for one card and pays 1:1 on the doubled stake", () => {
    const dealt = ok(
      startBlackjack(100, 10, shoe([card("5", "C"), card("10", "D"), card("6", "C"), card("7", "D"), card("K", "C")])),
    );
    const done = ok(double(dealt, () => 0));
    assert.equal(done.player.length, 3);
    assert.equal(scoreHand(done.player).total, 21);
    assert.equal(done.bet, 20);
    assert.equal(done.outcome, "win");
    assert.equal(done.payout, 40);
    assert.equal(done.cash, 120);
    assert.equal(scoreHand(done.dealer).total, 17);

    const poor = ok(
      startBlackjack(15, 10, shoe([card("5", "C"), card("10", "D"), card("6", "C"), card("7", "D"), card("K", "C")])),
    );
    assert.equal(double(poor, () => 0), "Not enough cash");
    assert.equal(poor.cash, 5);
    assert.equal(poor.phase, "player");
  });

  it("loses both stakes when a double busts", () => {
    const dealt = ok(
      startBlackjack(100, 10, shoe([card("10", "C"), card("9", "D"), card("6", "C"), card("8", "D"), card("K", "C")])),
    );
    const done = ok(double(dealt, () => 0));
    assert.equal(done.outcome, "bust");
    assert.equal(done.cash, 80);
    assert.equal(done.payout, 0);
  });

  it("can be bet down to an empty wallet", () => {
    const dealt = ok(
      startBlackjack(10, 10, shoe([card("10", "C"), card("9", "D"), card("6", "C"), card("8", "D"), card("K", "C")])),
    );
    const done = ok(hit(dealt, () => 0));
    assert.equal(done.cash, 0);
    assert.equal(done.outcome, "bust");
  });
});

describe("roulette", () => {
  it("maps rng through the European wheel", () => {
    assert.equal(EUROPEAN_WHEEL.length, 37);
    assert.equal(new Set(EUROPEAN_WHEEL).size, 37);
    assert.equal(EUROPEAN_WHEEL[0], 0);
    for (let pocket = 0; pocket <= 36; pocket += 1) {
      assert.equal(
        EUROPEAN_WHEEL.some((entry) => entry === pocket),
        true,
      );
    }
    const reds = new Set<number>(RED_NUMBERS);
    assert.equal(reds.size, 18);
    assert.equal(reds.has(32), true);
    assert.equal(reds.has(15), false);
    assert.equal(reds.has(0), false);
    assert.equal(pocketFromRng(0), 0);
    assert.equal(pocketFromRng(unit(1, 37)), 32);
    assert.equal(pocketFromRng(unit(8, 37)), 17);
  });

  it("pays a red even-money win", () => {
    const index = EUROPEAN_WHEEL.indexOf(32);
    const spun = ok(spinRoulette(100, 10, "red", 0, () => unit(index, 37)));
    assert.equal(spun.pocket, 32);
    assert.equal(spun.color, "red");
    assert.equal(spun.win, true);
    assert.equal(spun.payout, 20);
    assert.equal(spun.cash, 110);
  });

  it("pays a straight 35:1", () => {
    const index = EUROPEAN_WHEEL.indexOf(17);
    const spun = ok(spinRoulette(100, 10, "straight", 17, () => unit(index, 37)));
    assert.equal(spun.pocket, 17);
    assert.equal(spun.win, true);
    assert.equal(spun.payout, 360);
    assert.equal(spun.cash, 450);
  });

  it("lets zero kill an even bet and any other outside bet", () => {
    const spun = ok(spinRoulette(100, 10, "even", 0, () => unit(0, 37)));
    assert.equal(spun.pocket, 0);
    assert.equal(spun.color, "green");
    assert.equal(spun.win, false);
    assert.equal(spun.payout, 0);
    assert.equal(spun.cash, 90);

    const red = ok(spinRoulette(100, 10, "red", 0, () => 0));
    assert.equal(red.win, false);
    assert.equal(red.cash, 90);
    const dozen = ok(spinRoulette(100, 10, "dozen", 1, () => 0));
    assert.equal(dozen.win, false);
    assert.equal(dozen.cash, 90);

    const straight = ok(spinRoulette(100, 10, "straight", 0, () => 0));
    assert.equal(straight.win, true);
    assert.equal(straight.payout, 360);
    assert.equal(straight.cash, 450);
  });

  it("pays a dozen 2:1 and a black even-money win", () => {
    const one = EUROPEAN_WHEEL.indexOf(1);
    const dozen = ok(spinRoulette(100, 10, "dozen", 1, () => unit(one, 37)));
    assert.equal(dozen.pocket, 1);
    assert.equal(dozen.win, true);
    assert.equal(dozen.payout, 30);
    assert.equal(dozen.cash, 120);

    const black = ok(spinRoulette(500, 500, "black", 0, () => unit(EUROPEAN_WHEEL.indexOf(15), 37)));
    assert.equal(black.pocket, 15);
    assert.equal(black.color, "black");
    assert.equal(black.payout, 1000);
    assert.equal(black.cash, 1000);

    const broke = ok(spinRoulette(500, 500, "even", 0, () => 0));
    assert.equal(broke.cash, 0);
    assert.equal(broke.payout, 0);
  });
});

describe("slots", () => {
  it("reads three reels from rng", () => {
    assert.equal(symbolFromRng(unit(0, 6)), "bar");
    assert.equal(symbolFromRng(unit(1, 6)), "seven");
    assert.equal(symbolFromRng(unit(5, 6)), "coin");
    assert.deepEqual(SLOT_SYMBOLS, ["bar", "seven", "cherry", "bell", "gem", "coin"]);
  });

  it("pays 50x for three sevens", () => {
    const spun = ok(spinSlots(100, 10, reels(["seven", "seven", "seven"])));
    assert.deepEqual(spun.reels, ["seven", "seven", "seven"]);
    assert.equal(spun.multiplier, 50);
    assert.equal(spun.payout, 500);
    assert.equal(spun.cash, 590);
  });

  it("loses the stake when nothing lines up", () => {
    const spun = ok(spinSlots(100, 10, reels(["bar", "cherry", "bell"])));
    assert.equal(spun.multiplier, 0);
    assert.equal(spun.payout, 0);
    assert.equal(spun.cash, 90);

    const one = ok(spinSlots(100, 10, reels(["seven", "bar", "cherry"])));
    assert.equal(one.multiplier, 0);
    assert.equal(one.cash, 90);
  });

  it("pays the other lines: two sevens, three bars, three of anything else", () => {
    const pair = ok(spinSlots(100, 10, reels(["seven", "coin", "seven"])));
    assert.equal(pair.multiplier, 2);
    assert.equal(pair.payout, 20);
    assert.equal(pair.cash, 110);

    const bars = ok(spinSlots(100, 10, reels(["bar", "bar", "bar"])));
    assert.equal(bars.multiplier, 20);
    assert.equal(bars.payout, 200);
    assert.equal(bars.cash, 290);

    const gems = ok(spinSlots(100, 10, reels(["cherry", "cherry", "cherry"])));
    assert.equal(gems.multiplier, 8);
    assert.equal(gems.payout, 80);
    assert.equal(gems.cash, 170);
  });
});

describe("craps", () => {
  it("maps a die face from rng", () => {
    assert.equal(dieFromRng(unit(0, 6)), 1);
    assert.equal(dieFromRng(unit(5, 6)), 6);
  });

  it("wins a come-out 7", () => {
    const hand = ok(rollCraps(100, 10, faces([3, 4])));
    assert.deepEqual(hand.rolls, [{ d1: 3, d2: 4, total: 7 }]);
    assert.equal(hand.point, null);
    assert.equal(hand.outcome, "win");
    assert.equal(hand.payout, 20);
    assert.equal(hand.cash, 110);
    assert.equal(hand.log, "Come-out 7. Pass wins.");
  });

  it("makes the point", () => {
    const hand = ok(rollCraps(100, 10, faces([1, 3, 2, 3, 1, 3])));
    assert.deepEqual(
      hand.rolls.map((roll) => roll.total),
      [4, 5, 4],
    );
    assert.equal(hand.point, 4);
    assert.equal(hand.outcome, "win");
    assert.equal(hand.payout, 20);
    assert.equal(hand.cash, 110);
    assert.equal(hand.log, "Point 4 made.");
  });

  it("loses on a seven-out and on a come-out craps", () => {
    const out = ok(rollCraps(100, 10, faces([2, 3, 1, 1, 3, 4])));
    assert.deepEqual(
      out.rolls.map((roll) => roll.total),
      [5, 2, 7],
    );
    assert.equal(out.point, 5);
    assert.equal(out.outcome, "lose");
    assert.equal(out.payout, 0);
    assert.equal(out.cash, 90);
    assert.equal(out.log, "Point 5. Seven out.");

    const craps = ok(rollCraps(100, 10, faces([6, 6])));
    assert.equal(craps.rolls[0]?.total, 12);
    assert.equal(craps.point, null);
    assert.equal(craps.outcome, "lose");
    assert.equal(craps.cash, 90);
    assert.equal(craps.log, "Come-out 12. Craps.");
  });
});

describe("baccarat", () => {
  it("scores face cards as zero and aces as one", () => {
    assert.equal(baccaratPip("A"), 1);
    assert.equal(baccaratPip("10"), 0);
    assert.equal(baccaratPip("K"), 0);
    assert.equal(baccaratPip("Q"), 0);
    assert.equal(baccaratPip("J"), 0);
    assert.equal(baccaratTotal(["K", "9"]), 9);
    assert.equal(baccaratTotal(["4", "4"]), 8);
  });

  it("follows the third-card tableau", () => {
    assert.equal(playerDrawsThird(5, 4), true);
    assert.equal(playerDrawsThird(6, 4), false);
    assert.equal(playerDrawsThird(5, 9), false);
    assert.equal(playerDrawsThird(8, 3), false);
    assert.equal(bankerDrawsThird(5, null), true);
    assert.equal(bankerDrawsThird(6, null), false);
    assert.equal(bankerDrawsThird(3, 8), false);
    assert.equal(bankerDrawsThird(3, 0), true);
    assert.equal(bankerDrawsThird(4, 1), false);
    assert.equal(bankerDrawsThird(4, 2), true);
    assert.equal(bankerDrawsThird(5, 3), false);
    assert.equal(bankerDrawsThird(5, 4), true);
    assert.equal(bankerDrawsThird(6, 5), false);
    assert.equal(bankerDrawsThird(6, 7), true);
    assert.equal(bankerDrawsThird(2, 8), true);
    assert.equal(bankerDrawsThird(7, 6), false);

    const playerDraws = ok(resolveBaccarat(["2", "3"], ["2", "2"], "player", 10, 100, ["K"]));
    assert.equal(playerDraws.playerDrew, true);
    assert.equal(playerDraws.bankerDrew, false);
    assert.deepEqual(playerDraws.player, ["2", "3", "K"]);
    assert.deepEqual(playerDraws.banker, ["2", "2"]);
    assert.equal(playerDraws.playerTotal, 5);
    assert.equal(playerDraws.bankerTotal, 4);
    assert.equal(playerDraws.winner, "player");
    assert.equal(playerDraws.payout, 20);
    assert.equal(playerDraws.cash, 110);

    const bankerDraws = ok(resolveBaccarat(["K", "7"], ["A", "2"], "banker", 10, 100, ["K"]));
    assert.equal(bankerDraws.playerDrew, false);
    assert.equal(bankerDraws.bankerDrew, true);
    assert.deepEqual(bankerDraws.banker, ["A", "2", "K"]);
    assert.equal(bankerDraws.bankerTotal, 3);
    assert.equal(bankerDraws.winner, "player");
    assert.equal(bankerDraws.outcome, "lose");
    assert.equal(bankerDraws.cash, 90);

    const standsOnEight = ok(resolveBaccarat(["5", "K"], ["A", "2"], "player", 10, 100, ["8"]));
    assert.equal(standsOnEight.playerDrew, true);
    assert.equal(standsOnEight.bankerDrew, false);
    assert.equal(standsOnEight.playerTotal, 3);
    assert.equal(standsOnEight.bankerTotal, 3);
    assert.equal(standsOnEight.winner, "tie");
  });

  it("pays a tie 8:1 and returns the stake", () => {
    const tie = ok(resolveBaccarat(["4", "4"], ["3", "5"], "tie", 10, 100));
    assert.equal(tie.winner, "tie");
    assert.equal(tie.playerDrew, false);
    assert.equal(tie.bankerDrew, false);
    assert.equal(tie.outcome, "win");
    assert.equal(tie.payout, 90);
    assert.equal(tie.cash, 180);
    assert.equal(tie.log, "Tie pays 8 to 1.");

    const missed = ok(resolveBaccarat(["4", "5"], ["3", "4"], "tie", 10, 100));
    assert.equal(missed.winner, "player");
    assert.equal(missed.outcome, "lose");
    assert.equal(missed.payout, 0);
    assert.equal(missed.cash, 90);

    const push = ok(resolveBaccarat(["4", "4"], ["3", "5"], "player", 10, 100));
    assert.equal(push.outcome, "push");
    assert.equal(push.payout, 10);
    assert.equal(push.cash, 100);
    assert.equal(push.log, "Tie. Push.");
  });

  it("takes a floored 5% banker commission of at least 1", () => {
    const small = ok(resolveBaccarat(["K", "8"], ["K", "9"], "banker", 10, 100));
    assert.equal(small.winner, "banker");
    assert.equal(small.playerDrew, false);
    assert.equal(small.commission, 1);
    assert.equal(small.payout, 19);
    assert.equal(small.cash, 109);

    const large = ok(resolveBaccarat(["K", "8"], ["K", "9"], "banker", 100, 1000));
    assert.equal(large.commission, 5);
    assert.equal(large.payout, 195);
    assert.equal(large.cash, 1095);
  });

  it("deals a shoe through the tableau", () => {
    const tie = ok(playBaccarat(100, 10, "tie", shoe([card("9", "C"), card("4", "D"), card("K", "C"), card("5", "H")])));
    assert.equal(tie.playerTotal, 9);
    assert.equal(tie.bankerTotal, 9);
    assert.equal(tie.winner, "tie");
    assert.equal(tie.playerDrew, false);
    assert.equal(tie.payout, 90);
    assert.equal(tie.cash, 180);

    const drawn = ok(
      playBaccarat(
        100,
        10,
        "player",
        shoe([card("2", "C"), card("2", "D"), card("3", "C"), card("2", "H"), card("K", "C")]),
      ),
    );
    assert.deepEqual(drawn.player, ["2", "3", "K"]);
    assert.deepEqual(drawn.banker, ["2", "2"]);
    assert.equal(drawn.playerDrew, true);
    assert.equal(drawn.bankerDrew, false);
    assert.equal(drawn.winner, "player");
    assert.equal(drawn.cash, 110);
  });
});
