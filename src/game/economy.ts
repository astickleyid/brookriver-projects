/**
 * One scale for every way to make money.
 *
 * A new hustle is a name, a kind, a place, and four ratings from 0 to 5.
 * Everything the player feels is derived — never hand-priced.
 *
 *   earn    earning potential (how big the score is)
 *   heat    legal heat (stars, failure, cooldown)
 *   danger  bodily risk (health lost, worse on a bust)
 *   stake   cash you must front (lost on a bust; widens the payout)
 *
 *   kind    take   — crime, pays cash and/or goods
 *           wager  — lock the stake, win it back with a multiple
 *           fence  — turn carried goods into wallet cash
 *
 * Gross pay rises with earn (superlinear) and gets a premium for heat,
 * danger, and stake, so a hotter job out-earns a safer job of the same size.
 * Failure, stars, time, and the buy-in all climb off the same four numbers.
 */

export type HustleKind = "take" | "wager" | "fence";

export type HustlePlace =
  | "civ"
  | "home"
  | "store"
  | "vault"
  | "roller"
  | "corner"
  | "pawn"
  | "casino"
  | "teller"
  | "fixer";

export type YieldKind = "cash" | "goods" | "mixed";

export type HustleDef = {
  id: string;
  name: string;
  kind: HustleKind;
  place: HustlePlace;
  yield: YieldKind;
  earn: number;
  heat: number;
  danger: number;
  stake: number;
};

export type Score = {
  gross: number;
  low: number;
  high: number;
  seconds: number;
  stars: number;
  hurt: number;
  fail: number;
  bustStars: number;
  bustHurt: number;
  stakeCash: number;
  cooldown: number;
  fenceCut: number;
  winChance: number;
  winPay: number;
};

export type RollResult = {
  ok: boolean;
  wallet: number;
  loot: number;
  clearLoot: boolean;
  stars: number;
  hurt: number;
  line: string;
};

const UNIT = 48;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function rate(n: number) {
  return clamp(n, 0, 5);
}

function starsFor(heat: number) {
  if (heat <= 0) return 0;
  if (heat <= 2) return 1;
  return Math.min(5, heat - 1);
}

export function scoreHustle(def: HustleDef): Score {
  const earn = rate(def.earn);
  const heat = rate(def.heat);
  const danger = rate(def.danger);
  const stake = rate(def.stake);
  const premium = 1 + 0.22 * heat + 0.18 * danger + 0.1 * stake;
  const gross = earn <= 0 ? 0 : Math.round(UNIT * Math.pow(earn, 1.62) * premium);
  const spread = clamp(0.1 + 0.08 * stake + 0.025 * danger, 0.1, 0.7);
  const low = Math.max(0, Math.round(gross * (1 - spread)));
  const high = Math.max(low, Math.round(gross * (1 + spread)));
  const seconds = Math.round((1.8 + earn * 0.85 + heat * 0.4 + danger * 0.2) * 10) / 10;
  const stars = starsFor(heat);
  const bustStars = heat <= 0 ? 0 : Math.min(5, stars + (heat >= 3 ? 1 : 0) + (heat >= 5 ? 1 : 0));
  const hurt = danger <= 0 ? 0 : Math.round(4 * Math.pow(danger, 1.2));
  const bustHurt = danger <= 0 ? 0 : Math.round(hurt * 1.85 + danger * 4);
  const fail = clamp(0.04 + 0.07 * danger + 0.045 * heat + 0.025 * stake, 0.04, 0.78);
  const stakeCash = stake <= 0 ? 0 : Math.round(UNIT * Math.pow(stake, 1.35));
  const cooldown = Math.round(10 + heat * 9 + earn * 4);
  const fenceCut = clamp(0.4 + 0.08 * earn - 0.04 * heat, 0.28, 0.84);
  const winChance = clamp(0.62 - 0.07 * stake, 0.18, 0.62);
  const winPay = stakeCash <= 0 ? 0 : Math.round(stakeCash * (1.5 + 0.22 * earn));
  return {
    gross,
    low,
    high,
    seconds,
    stars,
    hurt,
    fail,
    bustStars,
    bustHurt,
    stakeCash,
    cooldown,
    fenceCut,
    winChance,
    winPay,
  };
}

export function resolveHustle(def: HustleDef, rng: () => number, lootOnHand: number, hostile = false): RollResult {
  const s = scoreHustle(def);

  if (def.kind === "fence") {
    if (lootOnHand <= 0) {
      return { ok: false, wallet: 0, loot: 0, clearLoot: false, stars: 0, hurt: 0, line: "Nothing to pawn" };
    }
    const bust = hostile || rng() < s.fail;
    if (bust) {
      return {
        ok: false,
        wallet: 0,
        loot: 0,
        clearLoot: true,
        stars: s.bustStars,
        hurt: s.bustHurt,
        line: "Fence got hit. Goods gone.",
      };
    }
    const pay = Math.round(lootOnHand * s.fenceCut);
    return {
      ok: true,
      wallet: pay,
      loot: 0,
      clearLoot: true,
      stars: s.stars,
      hurt: s.hurt,
      line: `Pawned $${pay}`,
    };
  }

  if (def.kind === "wager") {
    const win = !hostile && rng() < s.winChance;
    const incident = hostile || rng() < s.fail;
    const stolen = incident && rate(def.danger) >= 4;
    const wallet = win && !stolen ? s.winPay : 0;
    const net = wallet - s.stakeCash;
    return {
      ok: wallet > 0,
      wallet,
      loot: 0,
      clearLoot: false,
      stars: incident ? s.bustStars : 0,
      hurt: incident ? s.bustHurt : Math.round(s.hurt * 0.35),
      line: wallet > 0 ? `Up $${net}` : `Down $${s.stakeCash}`,
    };
  }

  const bust = hostile || rng() < s.fail;
  if (bust) {
    return {
      ok: false,
      wallet: 0,
      loot: 0,
      clearLoot: false,
      stars: hostile ? Math.min(5, s.bustStars + 1) : s.bustStars,
      hurt: s.bustHurt,
      line: hostile ? "They came up shooting" : s.stakeCash > 0 ? "Blown. Stake's gone." : "Blown",
    };
  }

  const span = s.high - s.low;
  const payout = s.low + (span > 0 ? Math.floor(rng() * (span + 1)) : 0);
  let wallet = 0;
  let loot = 0;
  if (def.yield === "cash") wallet = payout;
  else if (def.yield === "goods") loot = payout;
  else {
    wallet = Math.round(payout * 0.42);
    loot = Math.max(0, payout - wallet);
  }
  const bit =
    loot > 0 && wallet > 0 ? `$${wallet} + $${loot} goods` : loot > 0 ? `$${loot} in goods` : `$${wallet}`;
  return {
    ok: true,
    wallet,
    loot,
    clearLoot: false,
    stars: s.stars,
    hurt: s.hurt,
    line: `${def.name} · ${bit}`,
  };
}

export function blurb(def: HustleDef): string {
  const s = scoreHustle(def);
  if (def.kind === "fence") return `${def.name} ${Math.round(s.fenceCut * 100)}%`;
  if (def.kind === "wager") return `${def.name} $${s.stakeCash}→$${s.winPay}`;
  const stake = s.stakeCash > 0 ? ` · stake $${s.stakeCash}` : "";
  return `${def.name} ~$${s.gross}${stake}`;
}

export type LedgerRow = { id: string; name: string; pay: string; risk: string };

export function ledgerLines(): LedgerRow[] {
  return HUSTLES.map((def) => {
    const s = scoreHustle(def);
    const pay =
      def.kind === "wager"
        ? `$${s.stakeCash}→$${s.winPay}`
        : def.kind === "fence"
          ? `${Math.round(s.fenceCut * 100)}%`
          : `~$${s.gross.toLocaleString("en-US")}`;
    return { id: def.id, name: def.name, pay, risk: `${def.heat}/${def.danger}/${def.stake}` };
  });
}

export const HUSTLES: HustleDef[] = [
  { id: "mug", name: "Rob civilian", kind: "take", place: "civ", yield: "mixed", earn: 1, heat: 2, danger: 2, stake: 0 },
  { id: "home", name: "Break in", kind: "take", place: "home", yield: "goods", earn: 2, heat: 2, danger: 2, stake: 0 },
  { id: "store", name: "Rob store", kind: "take", place: "store", yield: "mixed", earn: 3, heat: 3, danger: 3, stake: 0 },
  { id: "vault", name: "Rob bank", kind: "take", place: "vault", yield: "cash", earn: 5, heat: 5, danger: 4, stake: 1 },
  { id: "roller", name: "Roll a whale", kind: "take", place: "roller", yield: "mixed", earn: 4, heat: 3, danger: 4, stake: 1 },
  { id: "deal", name: "Sell a pack", kind: "take", place: "corner", yield: "cash", earn: 3, heat: 3, danger: 2, stake: 3 },
  { id: "pawn", name: "Pawn goods", kind: "fence", place: "pawn", yield: "cash", earn: 2, heat: 1, danger: 1, stake: 0 },
  { id: "dice", name: "Street dice", kind: "wager", place: "casino", yield: "cash", earn: 2, heat: 1, danger: 2, stake: 1 },
  { id: "table", name: "High-limit", kind: "wager", place: "casino", yield: "cash", earn: 4, heat: 2, danger: 1, stake: 4 },
  { id: "private", name: "Private work", kind: "take", place: "roller", yield: "cash", earn: 5, heat: 2, danger: 2, stake: 2 },
];

export function hustleById(id: string) {
  return HUSTLES.find((h) => h.id === id);
}

export function hustlesAt(place: HustlePlace) {
  return HUSTLES.filter((h) => h.place === place);
}

/**
 * Spending uses the same dollar and the same idea as hustles.
 * A new purchase is four ratings. The sticker, the heat, the upkeep,
 * and how strong the thing is all fall out of those numbers.
 *
 *   price   1–5 how big the check is
 *   power   0–5 how much it does
 *   heat    0–5 legal risk of the buy
 *   upkeep  0–5 carrying cost, variance, or a shorter hire
 *
 * Cost stacks when you buy the same upgrade again (`owned` is how many you have).
 */

export type SpendKind =
  | "tune"
  | "ride"
  | "bribe"
  | "crew"
  | "gun"
  | "ammo"
  | "armor"
  | "house"
  | "market"
  | "drug"
  | "luxury"
  | "business"
  | "hit"
  | "invite";

export type SpendDef = {
  id: string;
  name: string;
  kind: SpendKind;
  price: number;
  power: number;
  heat: number;
  upkeep: number;
};

export type SpendScore = {
  cost: number;
  stars: number;
  seconds: number;
  income: number;
  upkeepCash: number;
  power: number;
};

export function scoreSpend(def: SpendDef, owned = 0): SpendScore {
  const price = rate(def.price);
  const power = rate(def.power);
  const heat = rate(def.heat);
  const upkeep = rate(def.upkeep);
  const stack = 1 + Math.max(0, owned) * 0.55;
  const premium = 1 + 0.18 * power + 0.08 * heat + 0.05 * upkeep;
  const cost = price <= 0 ? 0 : Math.round(UNIT * 2.4 * Math.pow(price, 1.75) * premium * stack);
  const stars = heat <= 0 ? 0 : heat <= 2 ? 1 : Math.min(5, heat - 1);
  const seconds = Math.round((8 + power * 6 + price * 2) * 10) / 10;
  const income = power <= 0 ? 0 : Math.round(UNIT * 0.22 * Math.pow(power, 1.4));
  const upkeepCash = upkeep <= 0 ? 0 : Math.round(UNIT * 0.035 * Math.pow(upkeep, 1.35));
  return { cost, stars, seconds, income, upkeepCash, power };
}

export function spendBlurb(def: SpendDef, owned = 0): string {
  const s = scoreSpend(def, owned);
  return `${def.name} $${s.cost.toLocaleString("en-US")}`;
}

export function spendLines(): LedgerRow[] {
  return SPENDS.map((def) => {
    const s = scoreSpend(def);
    return { id: def.id, name: def.name, pay: `$${s.cost.toLocaleString("en-US")}`, risk: `${def.price}/${def.power}/${def.heat}/${def.upkeep}` };
  });
}

export const SPENDS: SpendDef[] = [
  { id: "ammo", name: "Buy ammo", kind: "ammo", price: 1, power: 2, heat: 0, upkeep: 0 },
  { id: "vest", name: "Buy a vest", kind: "armor", price: 1, power: 2, heat: 0, upkeep: 0 },
  { id: "tune", name: "Tune the ride", kind: "tune", price: 2, power: 3, heat: 0, upkeep: 0 },
  { id: "van", name: "Buy a van", kind: "ride", price: 2, power: 2, heat: 0, upkeep: 1 },
  { id: "bribe", name: "Bribe a badge", kind: "bribe", price: 2, power: 3, heat: 2, upkeep: 0 },
  { id: "crew", name: "Hire a gun", kind: "crew", price: 2, power: 3, heat: 2, upkeep: 1 },
  { id: "drugs", name: "Buy a brick", kind: "drug", price: 2, power: 3, heat: 2, upkeep: 1 },
  { id: "shotgun", name: "Buy shotgun", kind: "gun", price: 2, power: 3, heat: 1, upkeep: 0 },
  { id: "sport", name: "Buy a sport", kind: "ride", price: 3, power: 4, heat: 0, upkeep: 1 },
  { id: "smg", name: "Buy an SMG", kind: "gun", price: 3, power: 4, heat: 2, upkeep: 0 },
  { id: "market", name: "Buy the tape", kind: "market", price: 3, power: 3, heat: 0, upkeep: 3 },
  { id: "hit", name: "Order a hit", kind: "hit", price: 3, power: 4, heat: 3, upkeep: 0 },
  { id: "invite", name: "Buy the invite", kind: "invite", price: 3, power: 2, heat: 1, upkeep: 0 },
  { id: "luxury", name: "Buy the watch", kind: "luxury", price: 4, power: 3, heat: 0, upkeep: 1 },
  { id: "business", name: "Open a shop", kind: "business", price: 4, power: 4, heat: 1, upkeep: 3 },
  { id: "house", name: "Buy the house", kind: "house", price: 5, power: 4, heat: 0, upkeep: 2 },
];

export function spendById(id: string) {
  return SPENDS.find((s) => s.id === id);
}

