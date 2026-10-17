import type { BaccaratResult, BaccaratSide, BlackjackState, CrapsResult, RouletteKind, RouletteResult, SlotsResult } from "@/game/casino";
import type { CarBody, CarTier, HouseId, RideKind, ShopId, ShopKind } from "@/game/property";

/**
 * Screens that replace the one-line J/K lists.
 * The game fills a snapshot. The overlay sends a command back.
 * Payouts, prices, and hustle math stay where they already are.
 */

export type GunId = "pistol" | "shotgun" | "smg";

export type UiCmd =
  | { op: "close" }
  | { op: "catalog"; kind: "house" | "shop" | "car" }
  | { op: "buy-house"; id: HouseId }
  | { op: "buy-shop"; id: ShopId }
  | { op: "buy-car"; body: CarBody }
  | { op: "spend"; id: string }
  | { op: "door"; spotId: string; act: string; carId?: string }
  | { op: "deposit" }
  | { op: "withdraw" }
  | { op: "hustle"; id: string }
  | { op: "bet"; amount: number }
  | { op: "play" }
  | { op: "stand" }
  | { op: "double" }
  | { op: "split" }
  | { op: "pick-roulette"; kind: RouletteKind; pick: number }
  | { op: "pick-side"; side: BaccaratSide }
  | { op: "gun"; id: GunId }
  | { op: "radio"; index: number };

export type CarCard = {
  body: CarBody;
  name: string;
  ride: RideKind;
  tier: CarTier;
  cost: number;
  stars: number;
  top: number;
  accel: number;
  turn: number;
  hp: number;
  affordable: boolean;
  owned: number;
};

export type HouseCard = {
  id: HouseId;
  name: string;
  address: string;
  cost: number;
  stars: number;
  stashCap: number;
  bays: number;
  starInterval: number;
  deathMultiplier: number;
  healHp: number;
  healArmor: number;
  owned: boolean;
  affordable: boolean;
};

export type ShopCard = {
  id: ShopId;
  kind: ShopKind;
  name: string;
  address: string;
  cost: number;
  stars: number;
  till: number;
  owned: boolean;
  affordable: boolean;
  counter: string;
};

export type FixerItem = {
  id: string;
  name: string;
  price: string;
  note: string;
  enabled: boolean;
  action: "spend" | "catalog-house" | "catalog-shop" | "catalog-car";
};

export type BaySlot = { carId: string; name: string };

export type JobCard = {
  id: string;
  name: string;
  pay: string;
  detail: string;
  stake: number;
  seconds: number;
  stars: number;
  hurt: number;
  fail: number;
};

export type Desk =
  | { kind: "cars"; wallet: number; cars: CarCard[] }
  | { kind: "houses"; wallet: number; houses: HouseCard[] }
  | { kind: "shops"; wallet: number; shops: ShopCard[] }
  | { kind: "fixer"; wallet: number; where: "fixer" | "lot"; items: FixerItem[] }
  | { kind: "bank"; wallet: number; bank: number; draw: number; hot: boolean }
  | {
      kind: "home";
      spotId: string;
      name: string;
      stash: number;
      cap: number;
      goods: number;
      room: number;
      bays: BaySlot[];
      bayCount: number;
      refund: number;
      sellBlock: string;
    }
  | {
      kind: "counter";
      spotId: string;
      name: string;
      till: number;
      use: string;
      useDetail: string;
      payout: number;
      busy: number;
    }
  | { kind: "jobs"; title: string; cool: number; selected: number; jobs: JobCard[] }
  | { kind: "mug"; job: JobCard; resident?: { name: string; role: string; manner: string } }
  | { kind: "blackjack"; wallet: number; bet: number; bets: number[]; state: BlackjackState | null }
  | { kind: "roulette"; wallet: number; bet: number; bets: number[]; pickKind: RouletteKind; pick: number; last: RouletteResult | null }
  | { kind: "slots"; wallet: number; bet: number; bets: number[]; machine: string; last: SlotsResult | null }
  | { kind: "craps"; wallet: number; bet: number; bets: number[]; last: CrapsResult | null }
  | { kind: "baccarat"; wallet: number; bet: number; bets: number[]; side: BaccaratSide; last: BaccaratResult | null }
  | { kind: "cage"; wallet: number };

export function money(n: number) {
  const whole = Math.floor(Math.abs(n));
  const body = `$${whole.toLocaleString("en-US")}`;
  return n < 0 ? `−${body}` : body;
}

export function blockAt(x: number, z: number) {
  const part = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(Math.round(n))}`;
  return `${part(x)}, ${part(z)}`;
}

export function deskKey(desk: Desk) {
  if (desk.kind === "jobs") return `jobs:${desk.title}`;
  if (desk.kind === "home") return `home:${desk.spotId}`;
  if (desk.kind === "counter") return `counter:${desk.spotId}`;
  if (desk.kind === "slots") return `slots:${desk.machine}`;
  return desk.kind;
}
