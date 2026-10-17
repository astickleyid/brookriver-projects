import { scoreSpend, type SpendDef } from "./economy.ts";

/**
 * Houses, shops, and cars the player can own.
 * Stickers come from scoreSpend. A buy's heat is the returned `stars` — this module does not apply it.
 * Shop till sits on the deed until the player sells; it is not paid into the bank.
 */

export const PROPERTY_VERSION = 1;

const SALE = 0.6;
const TILL_SECONDS = 8;

export type HouseId = "home1" | "home2" | "home3";
export type ShopId = "store1" | "store2" | "pawn";
export type ShopKind = "mart" | "late" | "counter";
export type RideKind = "sedan" | "sport" | "van";
export type CarTier = "sedan" | "sport" | "van" | "armor";
export type CarBody =
  | "mobil"
  | "kamaro"
  | "italia"
  | "lamb"
  | "fenyr"
  | "coupe"
  | "rally"
  | "ghini"
  | "van"
  | "jeep"
  | "armor";

export type Address = { x: number; z: number };

export type HouseListing = {
  id: HouseId;
  name: string;
  address: Address;
  cost: number;
  price: number;
  power: number;
  heat: number;
  upkeep: number;
  stars: number;
  stashCap: number;
  bays: number;
  starInterval: number;
  deathMultiplier: number;
  healHp: number;
  healArmor: number;
};

export type ShopListing = {
  id: ShopId;
  kind: ShopKind;
  name: string;
  address: Address;
  cost: number;
  price: number;
  power: number;
  heat: number;
  upkeep: number;
  stars: number;
  income: number;
  upkeepCash: number;
};

export type CarListing = {
  id: CarBody;
  name: string;
  body: CarBody;
  ride: RideKind;
  tier: CarTier;
  address: null;
  cost: number;
  price: number;
  power: number;
  heat: number;
  upkeep: number;
  stars: number;
};

export type OwnedShop = { id: ShopId; kind: ShopKind };
export type GarageSlot = { carId: string; body: CarBody; ride: RideKind; bayHouse: HouseId };
export type OwnedCar = { id: string; body: CarBody; ride: RideKind; parked: boolean };

export type PropertyState = {
  version: 1;
  ownedHouses: HouseId[];
  ownedShops: OwnedShop[];
  stash: number;
  garage: GarageSlot[];
  ownedCars: OwnedCar[];
  shopTill: Partial<Record<ShopId, number>>;
  /** Seconds toward the next 8s till payment. Wanted at 4 or more does not advance it. */
  shopClock: Partial<Record<ShopId, number>>;
};

export type PropertyReceipt = { state: PropertyState; cash: number; cost: number };
export type PropertyError = { error: string };
export type PropertyResult = PropertyReceipt | PropertyError;
export type StateResult = { state: PropertyState } | PropertyError;
export type DepositResult = { state: PropertyState; carried: number } | PropertyError;
export type WithdrawResult = { state: PropertyState; amount: number } | PropertyError;
export type StarClear = { stars: number; secondsLeft: number };
export type HealRates = { hp: number; armor: number };
export type ShopVisit =
  | { id: "store1"; kind: "mart"; effect: "heal"; heal: number }
  | { id: "store2"; kind: "late"; effect: "ammo"; ammoPacks: number }
  | { id: "pawn"; kind: "counter"; effect: "board" };

type HouseSpec = {
  id: HouseId;
  name: string;
  address: Address;
  price: number;
  power: number;
  heat: number;
  upkeep: number;
  stashCap: number;
  bays: number;
  starInterval: number;
  deathMultiplier: number;
  healHp: number;
  healArmor: number;
};

type ShopSpec = {
  id: ShopId;
  kind: ShopKind;
  name: string;
  address: Address;
  price: number;
  power: number;
  heat: number;
  upkeep: number;
};

type TierSpec = {
  tier: CarTier;
  ride: RideKind;
  price: number;
  power: number;
  heat: number;
  upkeep: number;
  bodies: readonly CarBody[];
};

const HOUSES: readonly HouseSpec[] = [
  {
    id: "home1",
    name: "Row House",
    address: { x: 31, z: -75 },
    price: 3,
    power: 2,
    heat: 0,
    upkeep: 1,
    stashCap: 8,
    bays: 1,
    starInterval: 6,
    deathMultiplier: 0.75,
    healHp: 10,
    healArmor: 3,
  },
  {
    id: "home2",
    name: "Walk-up",
    address: { x: 69, z: 25 },
    price: 4,
    power: 3,
    heat: 0,
    upkeep: 1,
    stashCap: 16,
    bays: 2,
    starInterval: 4,
    deathMultiplier: 0.6,
    healHp: 14,
    healArmor: 5,
  },
  {
    id: "home3",
    name: "Duplex",
    address: { x: -25, z: 69 },
    price: 5,
    power: 4,
    heat: 0,
    upkeep: 2,
    stashCap: 28,
    bays: 3,
    starInterval: 2.5,
    deathMultiplier: 0.5,
    healHp: 18,
    healArmor: 6,
  },
];

const SHOPS: readonly ShopSpec[] = [
  {
    id: "store1",
    kind: "mart",
    name: "Corner Mart",
    address: { x: -19, z: 25 },
    price: 3,
    power: 3,
    heat: 1,
    upkeep: 2,
  },
  {
    id: "store2",
    kind: "late",
    name: "Late Shop",
    address: { x: 75, z: -31 },
    price: 4,
    power: 4,
    heat: 1,
    upkeep: 3,
  },
  {
    id: "pawn",
    kind: "counter",
    name: "Back Room",
    address: { x: -31, z: -25 },
    price: 4,
    power: 3,
    heat: 2,
    upkeep: 2,
  },
];

const TIERS: readonly TierSpec[] = [
  {
    tier: "sedan",
    ride: "sedan",
    price: 2,
    power: 2,
    heat: 0,
    upkeep: 1,
    bodies: ["mobil", "kamaro"],
  },
  {
    tier: "sport",
    ride: "sport",
    price: 3,
    power: 4,
    heat: 0,
    upkeep: 1,
    bodies: ["italia", "lamb", "fenyr", "coupe", "rally", "ghini"],
  },
  {
    tier: "van",
    ride: "van",
    price: 2,
    power: 2,
    heat: 0,
    upkeep: 1,
    bodies: ["van", "jeep"],
  },
  {
    tier: "armor",
    ride: "van",
    price: 4,
    power: 3,
    heat: 1,
    upkeep: 2,
    bodies: ["armor"],
  },
];

const CAR_NAMES: Record<CarBody, string> = {
  mobil: "Mobil",
  kamaro: "Kamaro",
  italia: "Italia",
  lamb: "Lamb",
  fenyr: "Fenyr",
  coupe: "Coupe",
  rally: "Rally",
  ghini: "Ghini",
  van: "Van",
  jeep: "Jeep",
  armor: "Armor",
};

function asSpend(
  id: string,
  name: string,
  kind: SpendDef["kind"],
  price: number,
  power: number,
  heat: number,
  upkeep: number,
): SpendDef {
  return { id, name, kind, price, power, heat, upkeep };
}

function toHouse(spec: HouseSpec): HouseListing {
  const scored = scoreSpend(asSpend(spec.id, spec.name, "house", spec.price, spec.power, spec.heat, spec.upkeep));
  return {
    id: spec.id,
    name: spec.name,
    address: { x: spec.address.x, z: spec.address.z },
    cost: scored.cost,
    price: spec.price,
    power: spec.power,
    heat: spec.heat,
    upkeep: spec.upkeep,
    stars: scored.stars,
    stashCap: spec.stashCap,
    bays: spec.bays,
    starInterval: spec.starInterval,
    deathMultiplier: spec.deathMultiplier,
    healHp: spec.healHp,
    healArmor: spec.healArmor,
  };
}

function toShop(spec: ShopSpec): ShopListing {
  const scored = scoreSpend(
    asSpend(spec.id, spec.name, "business", spec.price, spec.power, spec.heat, spec.upkeep),
  );
  return {
    id: spec.id,
    kind: spec.kind,
    name: spec.name,
    address: { x: spec.address.x, z: spec.address.z },
    cost: scored.cost,
    price: spec.price,
    power: spec.power,
    heat: spec.heat,
    upkeep: spec.upkeep,
    stars: scored.stars,
    income: scored.income,
    upkeepCash: scored.upkeepCash,
  };
}

function toCar(tier: TierSpec, body: CarBody): CarListing {
  const name = CAR_NAMES[body];
  const scored = scoreSpend(asSpend(body, name, "ride", tier.price, tier.power, tier.heat, tier.upkeep));
  return {
    id: body,
    name,
    body,
    ride: tier.ride,
    tier: tier.tier,
    address: null,
    cost: scored.cost,
    price: tier.price,
    power: tier.power,
    heat: tier.heat,
    upkeep: tier.upkeep,
    stars: scored.stars,
  };
}

function houseById(id: HouseId): HouseListing | undefined {
  const spec = HOUSES.find((house) => house.id === id);
  return spec ? toHouse(spec) : undefined;
}

function shopById(id: ShopId): ShopListing | undefined {
  const spec = SHOPS.find((shop) => shop.id === id);
  return spec ? toShop(spec) : undefined;
}

function carByBody(body: string): CarListing | undefined {
  for (const tier of TIERS) {
    if (tier.bodies.some((candidate) => candidate === body)) return toCar(tier, body as CarBody);
  }
  return undefined;
}

function copyState(state: PropertyState): PropertyState {
  return {
    version: PROPERTY_VERSION,
    ownedHouses: [...state.ownedHouses],
    ownedShops: state.ownedShops.map((shop) => ({ id: shop.id, kind: shop.kind })),
    stash: state.stash,
    garage: state.garage.map((slot) => ({
      carId: slot.carId,
      body: slot.body,
      ride: slot.ride,
      bayHouse: slot.bayHouse,
    })),
    ownedCars: state.ownedCars.map((car) => ({
      id: car.id,
      body: car.body,
      ride: car.ride,
      parked: car.parked,
    })),
    shopTill: { ...state.shopTill },
    shopClock: { ...state.shopClock },
  };
}

function nextCarId(state: PropertyState): string {
  let max = 0;
  for (const car of state.ownedCars) {
    const n = Number(car.id.slice("car-".length));
    if (car.id.startsWith("car-") && Number.isInteger(n) && n > max) max = n;
  }
  return `car-${max + 1}`;
}

function ownedHouseIds(ids: readonly HouseId[]): HouseListing[] {
  const found: HouseListing[] = [];
  for (const id of ids) {
    const house = houseById(id);
    if (house) found.push(house);
  }
  return found;
}

export function emptyProperty(): PropertyState {
  return {
    version: PROPERTY_VERSION,
    ownedHouses: [],
    ownedShops: [],
    stash: 0,
    garage: [],
    ownedCars: [],
    shopTill: {},
    shopClock: {},
  };
}

export function catalogHouses(): HouseListing[] {
  return HOUSES.map(toHouse);
}

export function catalogShops(): ShopListing[] {
  return SHOPS.map(toShop);
}

export function catalogCars(): CarListing[] {
  const cars: CarListing[] = [];
  for (const tier of TIERS) {
    for (const body of tier.bodies) cars.push(toCar(tier, body));
  }
  return cars;
}

export function affordable<T extends { cost: number }>(cash: number, list: readonly T[]): T[] {
  return list.filter((item) => item.cost <= cash);
}

export function buyHouse(state: PropertyState, id: HouseId, cash: number): PropertyResult {
  const house = houseById(id);
  if (!house) return { error: "unknown house" };
  if (state.ownedHouses.includes(id)) return { error: "already owned" };
  if (!(cash >= house.cost)) return { error: "short cash" };
  const next = copyState(state);
  next.ownedHouses.push(id);
  return { state: next, cash: cash - house.cost, cost: house.cost };
}

export function sellHouse(state: PropertyState, id: HouseId, cash: number): PropertyResult {
  const house = houseById(id);
  if (!house) return { error: "unknown house" };
  if (!state.ownedHouses.includes(id)) return { error: "not owned" };
  // One stash. Empty it before any sale so a smaller deed is not left holding it.
  if (state.stash > 0) return { error: "stash still inside" };
  if (state.garage.some((slot) => slot.bayHouse === id)) return { error: "car in the garage" };
  const refund = Math.round(house.cost * SALE);
  const next = copyState(state);
  next.ownedHouses = next.ownedHouses.filter((owned) => owned !== id);
  return { state: next, cash: cash + refund, cost: refund };
}

export function buyShop(state: PropertyState, id: ShopId, cash: number): PropertyResult {
  const shop = shopById(id);
  if (!shop) return { error: "unknown shop" };
  if (state.ownedShops.some((owned) => owned.id === id)) return { error: "already owned" };
  if (!(cash >= shop.cost)) return { error: "short cash" };
  const next = copyState(state);
  next.ownedShops.push({ id: shop.id, kind: shop.kind });
  return { state: next, cash: cash - shop.cost, cost: shop.cost };
}

export function sellShop(state: PropertyState, id: ShopId, cash: number): PropertyResult {
  const shop = shopById(id);
  if (!shop) return { error: "unknown shop" };
  if (!state.ownedShops.some((owned) => owned.id === id)) return { error: "not owned" };
  const till = state.shopTill[id] ?? 0;
  const refund = Math.round(shop.cost * SALE);
  const payout = refund + till;
  const next = copyState(state);
  next.ownedShops = next.ownedShops.filter((owned) => owned.id !== id);
  delete next.shopTill[id];
  delete next.shopClock[id];
  return { state: next, cash: cash + payout, cost: payout };
}

export function depositStash(state: PropertyState, amount: number, carried: number): DepositResult {
  if (!(amount > 0) || !Number.isFinite(amount)) return { error: "bad amount" };
  if (amount > carried) return { error: "not carrying that much" };
  const cap = ownedHouseIds(state.ownedHouses).reduce((best, house) => Math.max(best, house.stashCap), 0);
  if (state.stash + amount > cap) return { error: "stash is full" };
  const next = copyState(state);
  next.stash += amount;
  return { state: next, carried: carried - amount };
}

export function withdrawStash(state: PropertyState, amount: number): WithdrawResult {
  if (!(amount > 0) || !Number.isFinite(amount)) return { error: "bad amount" };
  if (amount > state.stash) return { error: "stash is short" };
  const next = copyState(state);
  next.stash -= amount;
  return { state: next, amount };
}

export function parkCar(state: PropertyState, carId: string, houseId: HouseId): StateResult {
  const house = houseById(houseId);
  if (!house) return { error: "unknown house" };
  if (!state.ownedHouses.includes(houseId)) return { error: "not owned" };
  const car = state.ownedCars.find((owned) => owned.id === carId);
  if (!car) return { error: "unknown car" };
  if (car.parked || state.garage.some((slot) => slot.carId === carId)) return { error: "already parked" };
  const used = state.garage.filter((slot) => slot.bayHouse === houseId).length;
  if (used >= house.bays) return { error: "garage is full" };
  const next = copyState(state);
  next.garage.push({ carId, body: car.body, ride: car.ride, bayHouse: houseId });
  next.ownedCars = next.ownedCars.map((owned) => (owned.id === carId ? { ...owned, parked: true } : owned));
  return { state: next };
}

export function takeCar(state: PropertyState, carId: string): StateResult {
  const car = state.ownedCars.find((owned) => owned.id === carId);
  if (!car) return { error: "unknown car" };
  if (!car.parked && !state.garage.some((slot) => slot.carId === carId)) return { error: "not parked" };
  const next = copyState(state);
  next.garage = next.garage.filter((slot) => slot.carId !== carId);
  next.ownedCars = next.ownedCars.map((owned) => (owned.id === carId ? { ...owned, parked: false } : owned));
  return { state: next };
}

export function buyCar(state: PropertyState, body: string, cash: number): PropertyResult {
  const listing = carByBody(body);
  if (!listing) return { error: "unknown car" };
  if (!(cash >= listing.cost)) return { error: "short cash" };
  const next = copyState(state);
  next.ownedCars.push({ id: nextCarId(state), body: listing.body, ride: listing.ride, parked: false });
  return { state: next, cash: cash - listing.cost, cost: listing.cost };
}

export function starClear(stars: number, secondsAtDoor: number, houseId: HouseId): StarClear {
  const house = houseById(houseId);
  let leftStars = Number.isFinite(stars) ? Math.max(0, stars) : 0;
  let leftSeconds = Number.isFinite(secondsAtDoor) ? Math.max(0, secondsAtDoor) : 0;
  if (!house || house.starInterval <= 0) return { stars: leftStars, secondsLeft: leftSeconds };
  while (leftStars > 0 && leftSeconds + 1e-9 >= house.starInterval) {
    leftSeconds -= house.starInterval;
    leftStars -= 1;
    if (leftSeconds < 1e-9) leftSeconds = 0;
  }
  if (leftStars < 0) leftStars = 0;
  return { stars: leftStars, secondsLeft: leftSeconds };
}

export function deathLoss(cashLost: number, housesOwned: readonly HouseId[]): number {
  const owned = ownedHouseIds(housesOwned);
  if (owned.length === 0) return cashLost;
  const multiplier = owned.reduce((best, house) => Math.min(best, house.deathMultiplier), Infinity);
  return Math.floor(cashLost * multiplier);
}

export function healRates(housesOwned: readonly HouseId[]): HealRates {
  const owned = ownedHouseIds(housesOwned);
  if (owned.length === 0) return { hp: 0, armor: 0 };
  const best = owned.reduce((pick, house) => {
    if (house.healHp > pick.healHp || (house.healHp === pick.healHp && house.healArmor > pick.healArmor)) return house;
    return pick;
  });
  return { hp: best.healHp, armor: best.healArmor };
}

export function shopTick(state: PropertyState, shopId: ShopId, seconds: number, wanted: number): PropertyState {
  if (!state.ownedShops.some((shop) => shop.id === shopId)) return state;
  if (!(seconds > 0) || wanted >= 4) return state;
  const shop = shopById(shopId);
  if (!shop) return state;
  const periodMs = TILL_SECONDS * 1000;
  const clockMs = Math.round(((state.shopClock[shopId] ?? 0) + seconds) * 1000);
  const steps = Math.floor(clockMs / periodMs);
  const gained = steps * (shop.income - shop.upkeepCash);
  const next = copyState(state);
  next.shopClock[shopId] = (clockMs - steps * periodMs) / 1000;
  next.shopTill[shopId] = (state.shopTill[shopId] ?? 0) + gained;
  return next;
}

export function shopVisit(shopId: ShopId): ShopVisit {
  const shop = shopById(shopId);
  if (!shop || shop.kind === "mart") return { id: "store1", kind: "mart", effect: "heal", heal: 40 };
  if (shop.kind === "late") return { id: "store2", kind: "late", effect: "ammo", ammoPacks: shop.power };
  return { id: "pawn", kind: "counter", effect: "board" };
}
