/**
 * Walk-in casino. Not the street dice hustle.
 * Cash comes out of the wallet before the hand. A win pays the stake back
 * plus the stated odds. A loss keeps the stake. Nothing is free.
 *
 * Bets are integers. Minimum 10, maximum 500, and never more than the cash
 * the player is holding.
 */

export const MIN_BET = 10;
export const MAX_BET = 500;

export type Rng = () => number;

export function betError(cash: number, bet: number): string | null {
  if (typeof bet !== "number" || !Number.isInteger(bet)) return "Bet must be an integer";
  if (bet < MIN_BET) return `Minimum bet is ${MIN_BET}`;
  if (bet > MAX_BET) return `Maximum bet is ${MAX_BET}`;
  if (typeof cash !== "number" || !Number.isFinite(cash) || cash < bet) return "Not enough cash";
  return null;
}

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export const SUITS = ["C", "D", "H", "S"] as const;
export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

/** `hidden` is display-only. The hole card stays in the array, rank and all. */
export type Card = { rank: Rank; suit: Suit; hidden?: boolean };

export function standardDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit });
  }
  return deck;
}

/**
 * Fisher-Yates, high index down to 1.
 * At i, j = Math.floor(rng() * (i + 1)), then swap i and j.
 * One pass uses 51 rng draws. The dealt shoe starts at index 0.
 */
export function shuffleDeck(rng: Rng): Card[] {
  const deck = standardDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const span = i + 1;
    let j = Math.floor(rng() * span);
    if (j < 0) j = 0;
    if (j >= span) j = span - 1;
    const a = deck[i];
    const b = deck[j];
    if (!a || !b) break;
    deck[i] = b;
    deck[j] = a;
  }
  return deck;
}

function draw(shoe: Card[], rng: Rng): { card: Card; shoe: Card[] } {
  const source = shoe.length > 0 ? shoe : shuffleDeck(rng);
  const next = source[0];
  if (!next) throw new Error("Empty shoe");
  return { card: { rank: next.rank, suit: next.suit }, shoe: source.slice(1) };
}

export type HandScore = { total: number; soft: boolean };

export function scoreHand(cards: readonly Card[]): HandScore {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (card.rank === "10" || card.rank === "J" || card.rank === "Q" || card.rank === "K") {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

function isTen(rank: Rank): boolean {
  return rank === "10" || rank === "J" || rank === "Q" || rank === "K";
}

function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && scoreHand(cards).total === 21;
}

/** 3:2 profit, stake not included. 15 on a 10, 22 on a 15 (16.5 rounded down). */
export function blackjackProfit(bet: number): number {
  return Math.floor((bet * 3) / 2);
}

export type HandResult = "win" | "lose" | "push" | "bust" | "blackjack";

export type BjHand = {
  cards: Card[];
  bet: number;
  done: boolean;
  result: HandResult | null;
};

export type BlackjackState = {
  player: Card[];
  dealer: Card[];
  /** True while the dealer's second card should not be shown. The card is still `dealer[1]`. */
  holeHidden: boolean;
  bet: number;
  cash: number;
  phase: "player" | "done";
  log: string;
  shoe: Card[];
  hands: BjHand[];
  /** Index of the hand that may hit or stand. Meaningless once phase is "done". */
  active: number;
  split: boolean;
  /** Chips handed back when the hand ends, including returned stake. 0 on a loss or mid-hand. */
  payout: number;
  outcome: HandResult | null;
};

function label(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function resultWord(result: HandResult): string {
  if (result === "bust") return "Bust";
  if (result === "push") return "Push";
  if (result === "lose") return "Lose";
  if (result === "blackjack") return "Blackjack";
  return "Win";
}

function freshHand(cards: Card[], bet: number): BjHand {
  return { cards, bet, done: false, result: null };
}

function reveal(dealer: readonly Card[]): Card[] {
  return dealer.map((card, index) => (index === 1 ? { ...card, hidden: false } : { ...card }));
}

function handReturn(result: HandResult, bet: number): number {
  if (result === "lose" || result === "bust") return 0;
  if (result === "push") return bet;
  if (result === "blackjack") return bet + blackjackProfit(bet);
  return bet * 2;
}

function settleHand(total: number, dealerTotal: number, natural: boolean): HandResult {
  if (total > 21) return "bust";
  if (dealerTotal > 21 || total > dealerTotal) return natural ? "blackjack" : "win";
  if (total === dealerTotal) return "push";
  return "lose";
}

function settlementLog(dealerTotal: number, dealerBust: boolean, hands: readonly BjHand[]): string {
  const dealer = dealerBust ? `Dealer busts ${dealerTotal}` : `Dealer ${dealerTotal}`;
  const only = hands[0];
  if (hands.length === 1 && only?.result) {
    if (only.result === "bust") return `Bust. ${dealer}.`;
    return `${dealer}. ${resultWord(only.result)}.`;
  }
  const parts = hands.map((hand, index) => `Hand ${index + 1} ${resultWord(hand.result ?? "lose")}`);
  return `${dealer}. ${parts.join(". ")}.`;
}

/**
 * Dealer stands on 17 or more, soft 17 included.
 * A busted player hand still loses if the dealer busts afterwards.
 */
function finishDealer(state: BlackjackState, rng: Rng): BlackjackState {
  let dealer = reveal(state.dealer);
  let shoe = state.shoe;
  while (scoreHand(dealer).total < 17) {
    const pulled = draw(shoe, rng);
    shoe = pulled.shoe;
    dealer = [...dealer, pulled.card];
  }
  const dealerTotal = scoreHand(dealer).total;
  const settled = state.hands.map((hand) => {
    const natural = !state.split && isNatural(hand.cards);
    const result = settleHand(scoreHand(hand.cards).total, dealerTotal, natural);
    return { ...hand, done: true, result };
  });
  let payout = 0;
  for (const hand of settled) payout += handReturn(hand.result ?? "lose", hand.bet);
  const cash = state.cash + payout;
  const only = settled[0];
  let outcome: HandResult = "push";
  if (settled.length === 1 && only?.result) outcome = only.result;
  else {
    const staked = settled.reduce((sum, hand) => sum + hand.bet, 0);
    const net = payout - staked;
    outcome = net > 0 ? "win" : net < 0 ? "lose" : "push";
  }
  return {
    ...state,
    player: settled[0]?.cards ?? state.player,
    dealer,
    holeHidden: false,
    shoe,
    hands: settled,
    active: 0,
    phase: "done",
    payout,
    cash,
    outcome,
    log: settlementLog(dealerTotal, dealerTotal > 21, settled),
  };
}

function advance(state: BlackjackState, rng: Rng): BlackjackState {
  if (state.split) {
    const next = state.hands.findIndex((hand, index) => index > state.active && !hand.done);
    if (next >= 0) {
      const hand = state.hands[next];
      return hand ? { ...state, active: next, player: state.hands[0]?.cards ?? state.player, log: state.log } : state;
    }
  }
  return finishDealer(state, rng);
}

function closed(state: BlackjackState, patch: Partial<BlackjackState> & { log: string; outcome: HandResult; payout: number }): BlackjackState {
  const hands = (patch.hands ?? state.hands).map((hand) => ({ ...hand, done: true, result: hand.result }));
  return {
    ...state,
    ...patch,
    hands,
    dealer: patch.dealer ?? reveal(state.dealer),
    holeHidden: false,
    phase: "done",
    active: 0,
    player: hands[0]?.cards ?? state.player,
  };
}

export function startBlackjack(cash: number, bet: number, rng: Rng): BlackjackState | string {
  const error = betError(cash, bet);
  if (error) return error;
  let shoe = shuffleDeck(rng);
  const first = draw(shoe, rng);
  const up = draw(first.shoe, rng);
  const second = draw(up.shoe, rng);
  const hole = draw(second.shoe, rng);
  shoe = hole.shoe;
  const player = [first.card, second.card];
  const dealer = [up.card, { ...hole.card, hidden: true }];
  const state: BlackjackState = {
    player,
    dealer,
    holeHidden: true,
    bet,
    cash: cash - bet,
    phase: "player",
    log: `Dealt ${player.map(label).join(" ")} vs ${label(up.card)}.`,
    shoe,
    hands: [freshHand(player, bet)],
    active: 0,
    split: false,
    payout: 0,
    outcome: null,
  };
  const dealerPeek = up.card.rank === "A" || isTen(up.card.rank);
  const dealerNatural = isNatural(dealer);
  const playerNatural = isNatural(player);
  if (dealerPeek && dealerNatural) {
    if (playerNatural) {
      return closed(state, {
        outcome: "push",
        payout: bet,
        cash: state.cash + bet,
        log: "Push.",
        hands: [{ ...state.hands[0], cards: player, bet, done: true, result: "push" }],
      });
    }
    return closed(state, {
      outcome: "lose",
      payout: 0,
      cash: state.cash,
      log: "Dealer blackjack.",
      hands: [{ ...state.hands[0], cards: player, bet, done: true, result: "lose" }],
    });
  }
  if (playerNatural) {
    const payout = bet + blackjackProfit(bet);
    return closed(state, {
      outcome: "blackjack",
      payout,
      cash: state.cash + payout,
      log: "Blackjack.",
      hands: [{ ...state.hands[0], cards: player, bet, done: true, result: "blackjack" }],
    });
  }
  return state;
}

export function hit(state: BlackjackState, rng: Rng): BlackjackState | string {
  if (state.phase !== "player") return "Hand is over";
  const hand = state.hands[state.active];
  if (!hand || hand.done) return "Hand is over";
  const pulled = draw(state.shoe, rng);
  const cards = [...hand.cards, pulled.card];
  const total = scoreHand(cards).total;
  const bust = total > 21;
  const hands = state.hands.map((entry, index) => (index === state.active ? { ...entry, cards, done: bust } : entry));
  const next: BlackjackState = {
    ...state,
    shoe: pulled.shoe,
    hands,
    player: hands[0]?.cards ?? cards,
    log: bust ? `Bust ${total}.` : `Hit ${label(pulled.card)}. ${total}.`,
  };
  if (!bust) return next;
  return advance(next, rng);
}

export function stand(state: BlackjackState, rng: Rng): BlackjackState | string {
  if (state.phase !== "player") return "Hand is over";
  const hand = state.hands[state.active];
  if (!hand || hand.done) return "Hand is over";
  const hands = state.hands.map((entry, index) => (index === state.active ? { ...entry, done: true } : entry));
  return advance({ ...state, hands, player: hands[0]?.cards ?? state.player, log: `Stand ${scoreHand(hand.cards).total}.` }, rng);
}

export function double(state: BlackjackState, rng: Rng): BlackjackState | string {
  if (state.phase !== "player") return "Hand is over";
  if (state.split) return "No double after split";
  const hand = state.hands[state.active];
  if (!hand || hand.done) return "Hand is over";
  if (hand.cards.length !== 2) return "Double only on two cards";
  if (state.cash < hand.bet) return "Not enough cash";
  const pulled = draw(state.shoe, rng);
  const cards = [...hand.cards, pulled.card];
  const bet = hand.bet * 2;
  const hands = state.hands.map((entry, index) => (index === state.active ? { ...entry, cards, bet, done: true } : entry));
  return finishDealer(
    {
      ...state,
      shoe: pulled.shoe,
      hands,
      player: hands[0]?.cards ?? cards,
      cash: state.cash - hand.bet,
      bet,
      log: `Double ${label(pulled.card)}.`,
    },
    rng,
  );
}

/**
 * Opening two cards of the same rank, and cash for a second equal bet.
 * One card is dealt to each hand immediately. No resplit. No double after.
 * A two-card 21 on a split hand is 21, not a blackjack.
 */
export function split(state: BlackjackState, rng: Rng): BlackjackState | string {
  if (state.phase !== "player") return "Hand is over";
  if (state.split) return "No resplit";
  const hand = state.hands[state.active];
  if (!hand || hand.done) return "Hand is over";
  if (hand.cards.length !== 2) return "Split only on the opening two cards";
  const left = hand.cards[0];
  const right = hand.cards[1];
  if (!left || !right || left.rank !== right.rank) return "Cards must match to split";
  if (state.cash < hand.bet) return "Not enough cash";
  const first = draw(state.shoe, rng);
  const second = draw(first.shoe, rng);
  const hands = [freshHand([left, first.card], hand.bet), freshHand([right, second.card], hand.bet)];
  return {
    ...state,
    split: true,
    shoe: second.shoe,
    cash: state.cash - hand.bet,
    hands,
    active: 0,
    player: hands[0]?.cards ?? state.player,
    log: `Split ${left.rank}s.`,
  };
}

// --- roulette ----------------------------------------------------------------

/**
 * European wheel, clockwise from zero.
 * rng() in [0, 1) maps to a pocket by index:
 *   EUROPEAN_WHEEL[Math.floor(rng() * 37)]
 * Index i is forced by any value in [i/37, (i+1)/37). 0 maps to pocket 0.
 */
export const EUROPEAN_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
] as const;

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36] as const;

const RED = new Set<number>(RED_NUMBERS);

export type RouletteKind = "straight" | "red" | "black" | "odd" | "even" | "dozen";

export type RouletteResult = {
  pocket: number;
  color: "red" | "black" | "green";
  payout: number;
  cash: number;
  win: boolean;
  log: string;
};

export function pocketFromRng(unit: number): number {
  const n = EUROPEAN_WHEEL.length;
  let index = Math.floor(unit * n);
  if (index < 0) index = 0;
  if (index >= n) index = n - 1;
  return EUROPEAN_WHEEL[index] ?? 0;
}

function pocketColor(pocket: number): "red" | "black" | "green" {
  if (pocket === 0) return "green";
  return RED.has(pocket) ? "red" : "black";
}

export function spinRoulette(cash: number, bet: number, kind: RouletteKind, pick: number, rng: Rng): RouletteResult | string {
  const error = betError(cash, bet);
  if (error) return error;
  if (kind === "straight" && (!Number.isInteger(pick) || pick < 0 || pick > 36)) return "Straight pick must be 0 through 36";
  if (kind === "dozen" && pick !== 1 && pick !== 2 && pick !== 3) return "Dozen pick must be 1, 2, or 3";
  if (kind !== "straight" && kind !== "red" && kind !== "black" && kind !== "odd" && kind !== "even" && kind !== "dozen") {
    return "Unknown roulette bet";
  }
  const pocket = pocketFromRng(rng());
  const color = pocketColor(pocket);
  let win = false;
  let multiple = 0;
  if (kind === "straight") {
    win = pocket === pick;
    multiple = 36;
  } else if (kind === "red" || kind === "black") {
    win = color === kind;
    multiple = 2;
  } else if (kind === "odd") {
    win = pocket !== 0 && pocket % 2 === 1;
    multiple = 2;
  } else if (kind === "even") {
    win = pocket !== 0 && pocket % 2 === 0;
    multiple = 2;
  } else {
    const dozen = pocket === 0 ? 0 : Math.ceil(pocket / 12);
    win = dozen === pick;
    multiple = 3;
  }
  const payout = win ? bet * multiple : 0;
  const next = cash - bet + payout;
  const name = kind === "straight" ? `Straight ${pick}` : kind === "dozen" ? `Dozen ${pick}` : kind;
  const log = `Pocket ${pocket} ${color}. ${win ? `${name} wins.` : `${name} loses.`}`;
  return { pocket, color, payout, cash: next, win, log };
}

// --- slots -------------------------------------------------------------------

/**
 * Six symbols. Each reel is one rng() draw:
 *   SLOT_SYMBOLS[Math.floor(rng() * 6)]
 * spinSlots reads three times, left reel first.
 * 0 bar, 1 seven, 2 cherry, 3 bell, 4 gem, 5 coin.
 */
export const SLOT_SYMBOLS = ["bar", "seven", "cherry", "bell", "gem", "coin"] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

export type SlotsResult = {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  multiplier: number;
  payout: number;
  cash: number;
  log: string;
};

export function symbolFromRng(unit: number): SlotSymbol {
  let index = Math.floor(unit * SLOT_SYMBOLS.length);
  if (index < 0) index = 0;
  if (index >= SLOT_SYMBOLS.length) index = SLOT_SYMBOLS.length - 1;
  return SLOT_SYMBOLS[index] ?? "bar";
}

/** Total return multiple. 0 loses the stake. 50 returns 50 * bet, stake included in that 50. */
export function slotMultiplier(reels: readonly SlotSymbol[]): number {
  const [a, b, c] = reels;
  if (a && a === b && b === c) {
    if (a === "seven") return 50;
    if (a === "bar") return 20;
    return 8;
  }
  const sevens = reels.filter((symbol) => symbol === "seven").length;
  if (sevens === 2) return 2;
  return 0;
}

export function spinSlots(cash: number, bet: number, rng: Rng): SlotsResult | string {
  const error = betError(cash, bet);
  if (error) return error;
  const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [symbolFromRng(rng()), symbolFromRng(rng()), symbolFromRng(rng())];
  const multiplier = slotMultiplier(reels);
  const payout = bet * multiplier;
  const log = multiplier === 0 ? `${reels.join(" ")}. Lose.` : `${reels.join(" ")}. ${multiplier}x.`;
  return { reels, multiplier, payout, cash: cash - bet + payout, log };
}

// --- craps -------------------------------------------------------------------

/**
 * One die is 1 + Math.floor(rng() * 6).
 * Each roll consumes two rng calls, first die then second.
 * Pass line only: the hand rolls until it wins or loses.
 */
export function dieFromRng(unit: number): number {
  let face = Math.floor(unit * 6);
  if (face < 0) face = 0;
  if (face > 5) face = 5;
  return face + 1;
}

export type CrapsRoll = { d1: number; d2: number; total: number };

export type CrapsResult = {
  rolls: CrapsRoll[];
  point: number | null;
  outcome: "win" | "lose";
  payout: number;
  cash: number;
  log: string;
};

function nextRoll(rng: Rng): CrapsRoll {
  const d1 = dieFromRng(rng());
  const d2 = dieFromRng(rng());
  return { d1, d2, total: d1 + d2 };
}

export function rollCraps(cash: number, bet: number, rng: Rng): CrapsResult | string {
  const error = betError(cash, bet);
  if (error) return error;
  const rolls: CrapsRoll[] = [];
  const come = nextRoll(rng);
  rolls.push(come);
  const pay = (outcome: "win" | "lose", point: number | null, log: string): CrapsResult => {
    const payout = outcome === "win" ? bet * 2 : 0;
    return { rolls, point, outcome, payout, cash: cash - bet + payout, log };
  };
  if (come.total === 7 || come.total === 11) return pay("win", null, `Come-out ${come.total}. Pass wins.`);
  if (come.total === 2 || come.total === 3 || come.total === 12) return pay("lose", null, `Come-out ${come.total}. Craps.`);
  const point = come.total;
  for (let guard = 0; guard < 200; guard += 1) {
    const roll = nextRoll(rng);
    rolls.push(roll);
    if (roll.total === point) return pay("win", point, `Point ${point} made.`);
    if (roll.total === 7) return pay("lose", point, `Point ${point}. Seven out.`);
  }
  return "Craps ran too long";
}

// --- baccarat ----------------------------------------------------------------

export type BaccaratSide = "player" | "banker" | "tie";

export function baccaratPip(rank: Rank): number {
  if (rank === "A") return 1;
  if (rank === "10" || rank === "J" || rank === "Q" || rank === "K") return 0;
  const n = Number(rank);
  return n >= 2 && n <= 9 ? n : 0;
}

export function baccaratTotal(ranks: readonly Rank[]): number {
  let sum = 0;
  for (const rank of ranks) sum += baccaratPip(rank);
  return sum % 10;
}

/** Player draws on 0–5 unless either hand is a natural 8 or 9. */
export function playerDrawsThird(playerTotal: number, bankerTotal: number): boolean {
  if (playerTotal >= 8 || bankerTotal >= 8) return false;
  return playerTotal <= 5;
}

/**
 * Banker third-card tableau.
 * `playerThird` is null when the player stood. Value is the third card's pip, 0–9.
 * Banker totals are the first two cards. A natural 8 or 9 never draws.
 */
export function bankerDrawsThird(bankerTotal: number, playerThird: number | null): boolean {
  if (bankerTotal >= 8) return false;
  if (playerThird === null) return bankerTotal <= 5;
  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return playerThird !== 8;
  if (bankerTotal === 4) return playerThird >= 2 && playerThird <= 7;
  if (bankerTotal === 5) return playerThird >= 4 && playerThird <= 7;
  if (bankerTotal === 6) return playerThird === 6 || playerThird === 7;
  return false;
}

function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value);
}

export type BaccaratResult = {
  player: Rank[];
  banker: Rank[];
  playerTotal: number;
  bankerTotal: number;
  winner: "player" | "banker" | "tie";
  side: BaccaratSide;
  playerDrew: boolean;
  bankerDrew: boolean;
  payout: number;
  cash: number;
  outcome: "win" | "lose" | "push";
  /** 5% of a banker win, floored, but never less than 1. 0 unless the banker bet won. */
  commission: number;
  log: string;
};

function winnerOf(playerTotal: number, bankerTotal: number): "player" | "banker" | "tie" {
  if (playerTotal > bankerTotal) return "player";
  if (bankerTotal > playerTotal) return "banker";
  return "tie";
}

function commissionOn(bet: number): number {
  return Math.max(1, Math.floor((bet * 5) / 100));
}

function paySide(winner: "player" | "banker" | "tie", side: BaccaratSide, bet: number, cash: number): Pick<BaccaratResult, "payout" | "cash" | "outcome" | "commission" | "log"> {
  if (winner === "tie" && side !== "tie") {
    return { payout: bet, cash, outcome: "push", commission: 0, log: "Tie. Push." };
  }
  if (side === "tie") {
    if (winner === "tie") {
      const payout = bet * 9;
      return { payout, cash: cash - bet + payout, outcome: "win", commission: 0, log: "Tie pays 8 to 1." };
    }
    return { payout: 0, cash: cash - bet, outcome: "lose", commission: 0, log: "Tie bet loses." };
  }
  if (winner !== side) {
    return { payout: 0, cash: cash - bet, outcome: "lose", commission: 0, log: `${winner === "player" ? "Player" : "Banker"} wins.` };
  }
  if (side === "banker") {
    const commission = commissionOn(bet);
    const payout = bet * 2 - commission;
    return { payout, cash: cash - bet + payout, outcome: "win", commission, log: `Banker wins. Commission ${commission}.` };
  }
  const payout = bet * 2;
  return { payout, cash: cash - bet + payout, outcome: "win", commission: 0, log: "Player wins." };
}

/**
 * Two cards each: the tableau draws from `draw`, player first.
 * Three cards already on a side: those cards are the finished hand.
 */
export function resolveBaccarat(
  playerCards: readonly Rank[],
  bankerCards: readonly Rank[],
  side: BaccaratSide,
  bet: number,
  cash: number,
  draw: readonly Rank[] = [],
): BaccaratResult | string {
  const error = betError(cash, bet);
  if (error) return error;
  if (side !== "player" && side !== "banker" && side !== "tie") return "Unknown side";
  if (playerCards.length < 2 || bankerCards.length < 2 || playerCards.length > 3 || bankerCards.length > 3) return "Bad baccarat hand";
  for (const rank of [...playerCards, ...bankerCards, ...draw]) {
    if (!isRank(rank)) return "Bad card";
  }
  const player: Rank[] = [...playerCards];
  const banker: Rank[] = [...bankerCards];
  let playerDrew = player.length > 2;
  let bankerDrew = banker.length > 2;
  if (player.length === 2 && banker.length === 2) {
    const player0 = baccaratTotal(player);
    const banker0 = baccaratTotal(banker);
    let cursor = 0;
    let third: number | null = null;
    if (playerDrawsThird(player0, banker0)) {
      const card = draw[cursor];
      cursor += 1;
      if (!card) return "Not enough cards";
      player.push(card);
      playerDrew = true;
      third = baccaratPip(card);
    }
    if (player0 < 8 && banker0 < 8 && bankerDrawsThird(banker0, third)) {
      const card = draw[cursor];
      if (!card) return "Not enough cards";
      banker.push(card);
      bankerDrew = true;
    }
  }
  const playerTotal = baccaratTotal(player);
  const bankerTotal = baccaratTotal(banker);
  const winner = winnerOf(playerTotal, bankerTotal);
  const paid = paySide(winner, side, bet, cash);
  return { player, banker, playerTotal, bankerTotal, winner, side, playerDrew, bankerDrew, ...paid };
}

export function playBaccarat(cash: number, bet: number, side: BaccaratSide, rng: Rng): BaccaratResult | string {
  const error = betError(cash, bet);
  if (error) return error;
  if (side !== "player" && side !== "banker" && side !== "tie") return "Unknown side";
  const shoe = shuffleDeck(rng);
  const ranks = shoe.map((card) => card.rank);
  const p1 = ranks[0];
  const b1 = ranks[1];
  const p2 = ranks[2];
  const b2 = ranks[3];
  if (!p1 || !b1 || !p2 || !b2) return "Not enough cards";
  return resolveBaccarat([p1, p2], [b1, b2], side, bet, cash, ranks.slice(4));
}

// --- floor -------------------------------------------------------------------

export type CasinoGame = "blackjack" | "roulette" | "craps" | "baccarat" | "slots" | "cage";

export type CasinoSpot = {
  id: string;
  game: CasinoGame;
  x: number;
  z: number;
  label: string;
};

/**
 * Local room, origin at the south door. 24 wide on x (centered), 18 deep on z.
 * Inside the room is +z.
 */
export const CASINO_FLOOR = {
  width: 24,
  depth: 18,
  door: { x: 0, z: 0 },
  entries: [
    { id: "bj", game: "blackjack", x: -6, z: 6, label: "Blackjack" },
    { id: "roulette", game: "roulette", x: 6, z: 6, label: "Roulette" },
    { id: "craps", game: "craps", x: -6, z: 12, label: "Craps" },
    { id: "baccarat", game: "baccarat", x: 6, z: 12, label: "Baccarat" },
    { id: "slot-l", game: "slots", x: -6, z: 16, label: "Slots" },
    { id: "slot-m", game: "slots", x: 0, z: 16, label: "Slots" },
    { id: "slot-r", game: "slots", x: 6, z: 16, label: "Slots" },
    { id: "cage", game: "cage", x: 0, z: 3, label: "Cage" },
  ],
} as const satisfies { width: number; depth: number; door: { x: number; z: number }; entries: readonly CasinoSpot[] };
