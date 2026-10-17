import { useState, type ReactNode } from "react";
import type { CarBody } from "@/game/property";
import type { RoomId } from "@/game/room-layout";
import { money, type Desk, type UiCmd } from "@/game/desk";
import { CarStage } from "@/components/desk/car-stage";
import { DeskButton, FloorPlan, Pips, Shell } from "@/components/desk/widgets";

const TIER: Record<string, string> = {
  sedan: "Sedan",
  sport: "Sport",
  van: "Van",
  armor: "Armor",
};

export function CarsBoard({ desk, send }: { desk: Extract<Desk, { kind: "cars" }>; send: (cmd: UiCmd) => void }) {
  const [body, setBody] = useState<CarBody>(desk.cars[0]?.body ?? "mobil");
  const [shots, setShots] = useState<Record<string, string>>({});
  const car = desk.cars.find((item) => item.body === body) ?? desk.cars[0];
  const maxTop = Math.max(1, ...desk.cars.map((item) => item.top));
  const maxAccel = Math.max(1, ...desk.cars.map((item) => item.accel));
  const maxTurn = Math.max(0.01, ...desk.cars.map((item) => item.turn));
  const maxHp = Math.max(1, ...desk.cars.map((item) => item.hp));
  if (!car) {
    return (
      <Shell kicker="LOT" title="No cars" wallet={desk.wallet} onBack={() => send({ op: "close" })}>
        <p className="text-sm text-muted">Nothing is on the sheet.</p>
      </Shell>
    );
  }
  return (
    <Shell kicker="LOT" title={car.name} wallet={desk.wallet} onBack={() => send({ op: "close" })}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
        <CarStage body={car.body} bodies={desk.cars.map((item) => item.body)} onThumbs={setShots} />
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs tracking-widest text-amber">{TIER[car.tier] ?? car.tier}</p>
            <p className="font-display text-5xl leading-none text-fg">{car.name}</p>
            <p className="mt-2 font-display text-4xl leading-none text-amber tabular-nums">{money(car.cost)}</p>
            {car.stars > 0 ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-blood">
                <Pips count={car.stars} />
                on the buy
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted">No heat on the buy</p>
            )}
            {car.owned > 0 ? <p className="mt-1 text-xs text-muted">You already keep {car.owned}</p> : null}
          </div>
          <dl className="grid gap-3">
            <Meter label="Top" value={`${car.top}`} unit="mph" fill={car.top / maxTop} />
            <Meter label="Accel" value={car.accel.toFixed(0)} fill={car.accel / maxAccel} />
            <Meter label="Turn" value={car.turn.toFixed(2)} fill={car.turn / maxTurn} />
            <Meter label="Body" value={String(car.hp)} fill={car.hp / maxHp} />
          </dl>
          {car.tier === "armor" ? <p className="text-xs text-muted">Armored body. It drives with the van.</p> : null}
          <DeskButton mark="play" tone="amber" disabled={!car.affordable} onClick={() => send({ op: "buy-car", body: car.body })}>
            {car.affordable ? `Buy ${car.name}` : "Short cash"}
          </DeskButton>
        </div>
      </div>
      <ul className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {desk.cars.map((item) => {
          const on = item.body === car.body;
          return (
            <li key={item.body} className="w-40 shrink-0">
              <button
                type="button"
                data-desk=""
                onClick={() => setBody(item.body)}
                className={`flex w-full flex-col border text-left ${on ? "border-amber bg-surface" : "border-line"} ${item.affordable ? "" : "opacity-50"}`}
              >
                {shots[item.body] ? (
                  <img src={shots[item.body]} alt="" className="h-24 w-full bg-bg object-contain" />
                ) : (
                  <span className="flex h-24 flex-col items-center justify-center bg-bg">
                    <span className="font-display text-4xl leading-none text-fg tabular-nums">{item.top}</span>
                    <span className="text-xs tracking-widest text-muted">MPH</span>
                  </span>
                )}
                <span className="px-2 py-2">
                  <span className="block text-xs tracking-widest text-muted">{TIER[item.tier] ?? item.tier}</span>
                  <span className="block font-display text-2xl leading-none text-fg">{item.name}</span>
                  <span className="text-xs text-amber tabular-nums">{money(item.cost)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs tracking-widest text-muted">BODIES BY COSMO</p>
    </Shell>
  );
}

function Meter({ label, value, unit, fill }: { label: string; value: string; unit?: string; fill: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <dt className="text-xs tracking-widest text-muted">{label}</dt>
        <dd className="font-display text-2xl leading-none text-fg tabular-nums">
          {value}
          {unit ? <span className="ml-1 text-sm text-muted">{unit}</span> : null}
        </dd>
      </div>
      <div className="h-1.5 bg-line">
        <div className="h-full bg-amber" style={{ width: `${Math.max(4, Math.min(100, fill * 100))}%` }} />
      </div>
    </div>
  );
}

export function HousesBoard({ desk, send }: { desk: Extract<Desk, { kind: "houses" }>; send: (cmd: UiCmd) => void }) {
  return (
    <Shell kicker="DEEDS" title="Houses" wallet={desk.wallet} onBack={() => send({ op: "close" })}>
      <ul className="grid gap-3 lg:grid-cols-3">
        {desk.houses.map((house) => (
          <li key={house.id} className="flex flex-col border border-line bg-surface">
            <FloorPlan id={house.id} className="h-48 w-full border-b border-line bg-bg" />
            <div className="flex flex-1 flex-col gap-3 p-3">
              <div>
                <p className="text-xs tracking-widest text-muted">{house.address}</p>
                <p className="font-display text-4xl leading-none text-fg">{house.name}</p>
                <p className="mt-1 font-display text-3xl leading-none text-amber tabular-nums">{money(house.cost)}</p>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-line text-sm">
                <Fact label="Stash" value={money(house.stashCap)} />
                <Fact label="Bays" value={String(house.bays)} />
                <Fact label="A star" value={`${house.starInterval}s`} />
                <Fact label="Hospital" value={`${Math.round(house.deathMultiplier * 100)}%`} />
              </dl>
              <p className="text-xs text-muted">
                Inside, +{house.healHp} hp and +{house.healArmor} armor. Hospital keeps {Math.round(house.deathMultiplier * 100)}% of the usual loss.
              </p>
              <DeskButton
                tone={house.owned ? "ghost" : "amber"}
                disabled={house.owned || !house.affordable}
                onClick={() => send({ op: "buy-house", id: house.id })}
              >
                {house.owned ? "Yours" : house.affordable ? `Buy ${house.name}` : "Short cash"}
              </DeskButton>
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg px-2 py-2">
      <dt className="text-xs tracking-widest text-muted">{label}</dt>
      <dd className="font-display text-2xl leading-none text-fg tabular-nums">{value}</dd>
    </div>
  );
}

const SHOP_KICKER: Record<string, string> = {
  mart: "COUNTER",
  late: "NIGHT WINDOW",
  counter: "CAGE",
};

export function ShopsBoard({ desk, send }: { desk: Extract<Desk, { kind: "shops" }>; send: (cmd: UiCmd) => void }) {
  return (
    <Shell kicker="DEEDS" title="Shops" wallet={desk.wallet} onBack={() => send({ op: "close" })}>
      <ul className="grid gap-3 lg:grid-cols-3">
        {desk.shops.map((shop) => (
          <li key={shop.id} className="flex flex-col border border-line bg-surface">
            <FloorPlan id={shop.id} className="h-44 w-full border-b border-line bg-bg" />
            <div className="flex flex-1 flex-col gap-3 p-3">
              <p className="text-xs tracking-widest text-amber">{SHOP_KICKER[shop.kind] ?? "SHOP"}</p>
              <p className="text-xs tracking-widest text-muted">{shop.address}</p>
              <p className="font-display text-4xl leading-none text-fg">{shop.name}</p>
              <p className="font-display text-3xl leading-none text-amber tabular-nums">{money(shop.cost)}</p>
              <p className="text-sm text-fg">{shop.counter}</p>
              <p className="font-display text-3xl leading-none text-fg tabular-nums">
                {money(shop.till)} <span className="text-lg text-muted">every 8s</span>
              </p>
              {shop.stars > 0 ? (
                <p className="flex items-center gap-2 text-xs text-blood">
                  <Pips count={shop.stars} />
                  on the buy
                </p>
              ) : null}
              <p className="text-xs text-muted">The till stops paying at 4 stars.</p>
              <DeskButton
                tone={shop.owned ? "ghost" : "amber"}
                disabled={shop.owned || !shop.affordable}
                onClick={() => send({ op: "buy-shop", id: shop.id })}
              >
                {shop.owned ? "Yours" : shop.affordable ? `Buy ${shop.name}` : "Short cash"}
              </DeskButton>
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

export function FixerBoard({ desk, send }: { desk: Extract<Desk, { kind: "fixer" }>; send: (cmd: UiCmd) => void }) {
  const books = desk.items.filter((item) => item.action !== "spend");
  const goods = desk.items.filter((item) => item.action === "spend");
  const open = (action: (typeof books)[number]["action"], id: string) => {
    if (action === "catalog-house") send({ op: "catalog", kind: "house" });
    else if (action === "catalog-shop") send({ op: "catalog", kind: "shop" });
    else if (action === "catalog-car") send({ op: "catalog", kind: "car" });
    else send({ op: "spend", id });
  };
  return (
    <Shell kicker={desk.where === "lot" ? "PLAZA LOT" : "FIXER"} title={desk.where === "lot" ? "The lot" : "The desk"} wallet={desk.wallet}>
      <p className="text-xs tracking-widest text-amber">CATALOGS</p>
      <ul className={`mt-2 grid gap-2 ${books.length > 1 ? "sm:grid-cols-3" : ""}`}>
        {books.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              data-desk=""
              disabled={!item.enabled}
              onClick={() => open(item.action, item.id)}
              className="flex min-h-32 w-full flex-col items-start justify-between border border-line bg-surface px-3 py-3 text-left disabled:opacity-40"
            >
              <span className="text-xs tracking-widest text-muted">{item.price}</span>
              <span className="font-display text-4xl leading-none text-fg">{item.name}</span>
              <span className="text-xs text-muted">{item.note}</span>
            </button>
          </li>
        ))}
      </ul>
      {goods.length > 0 ? <p className="mt-5 text-xs tracking-widest text-amber">ON THE COUNTER</p> : null}
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {goods.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              data-desk=""
              disabled={!item.enabled}
              onClick={() => open(item.action, item.id)}
              className="flex min-h-20 w-full flex-col items-start justify-between border border-line bg-bg px-3 py-3 text-left disabled:opacity-40"
            >
              <span className="flex w-full items-baseline justify-between gap-3">
                <span className="font-display text-3xl leading-none text-fg">{item.name}</span>
                <span className="font-display text-2xl leading-none text-amber tabular-nums">{item.price}</span>
              </span>
              <span className="mt-2 text-xs text-muted">{item.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

export function BankBoard({ desk, send }: { desk: Extract<Desk, { kind: "bank" }>; send: (cmd: UiCmd) => void }) {
  return (
    <Shell kicker="CIVIC BANK" title="Teller" wallet={desk.wallet}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col justify-between border border-line bg-surface p-4">
          <div>
            <p className="text-xs tracking-widest text-muted">ON YOU</p>
            <p className="font-display text-6xl leading-none text-fg tabular-nums sm:text-7xl">{money(desk.wallet)}</p>
            <p className="mt-2 max-w-xs text-xs text-muted">The street can still take this. The bank cannot.</p>
          </div>
          <div className="mt-4">
            <DeskButton mark="play" tone="amber" disabled={desk.wallet <= 0} onClick={() => send({ op: "deposit" })}>
              {desk.wallet > 0 ? `Deposit ${money(desk.wallet)}` : "Wallet's empty"}
            </DeskButton>
          </div>
        </div>
        <div className={`flex flex-col justify-between border p-4 ${desk.hot ? "border-blood bg-bg" : "border-line bg-surface"}`}>
          <div>
            <p className="text-xs tracking-widest text-muted">IN THE BANK</p>
            <p className="font-display text-6xl leading-none text-amber tabular-nums sm:text-7xl">{money(desk.bank)}</p>
            <p className={`mt-2 max-w-xs text-xs ${desk.hot ? "text-blood" : "text-muted"}`}>
              {desk.hot ? "Four stars. The drawer stays shut." : "A draw is one chunk, up to $500."}
            </p>
          </div>
          <div className="mt-4">
            <DeskButton tone="fg" disabled={desk.hot || desk.bank <= 0} onClick={() => send({ op: "withdraw" })}>
              {desk.hot ? "Too hot to draw" : desk.bank > 0 ? `Withdraw ${money(desk.draw)}` : "Bank's empty"}
            </DeskButton>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function HomeBoard({ desk, send }: { desk: Extract<Desk, { kind: "home" }>; send: (cmd: UiCmd) => void }) {
  const room = Math.max(0, desk.cap - desk.stash);
  const stashNow = Math.min(desk.goods, room);
  return (
    <Shell kicker="HOUSE" title={desk.name} wallet={null}>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <FloorPlan id={desk.spotId as RoomId} className="h-52 w-full border border-line bg-surface" />
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Stash</span>
              <span className="tabular-nums">
                {money(desk.stash)} / {money(desk.cap)}
              </span>
            </div>
            <div className="h-3 bg-line">
              <div className="h-full bg-amber" style={{ width: `${desk.cap > 0 ? Math.min(100, (desk.stash / desk.cap) * 100) : 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">Goods on you {money(desk.goods)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DeskButton tone="amber" disabled={stashNow <= 0} onClick={() => send({ op: "door", spotId: desk.spotId, act: "Stash goods" })}>
              {stashNow > 0 ? `Stash ${money(stashNow)}` : desk.goods <= 0 ? "Nothing to stash" : "Stash is full"}
            </DeskButton>
            <DeskButton disabled={desk.stash <= 0} onClick={() => send({ op: "door", spotId: desk.spotId, act: "Pull stash" })}>
              {desk.stash > 0 ? `Pull ${money(desk.stash)}` : "Stash is empty"}
            </DeskButton>
            <DeskButton onClick={() => send({ op: "door", spotId: desk.spotId, act: "Park car" })}>Park the car out front</DeskButton>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: desk.bayCount }, (_, index) => {
              const bay = desk.bays[index];
              return (
                <li key={index} className="flex min-h-28 flex-col justify-between border border-line bg-surface p-3">
                  <p className="text-xs tracking-widest text-muted">BAY {index + 1}</p>
                  <p className={`font-display text-3xl leading-none ${bay ? "text-fg" : "text-muted"}`}>{bay ? bay.name : "Open"}</p>
                  {bay ? (
                    <DeskButton onClick={() => send({ op: "door", spotId: desk.spotId, act: "Take car", carId: bay.carId })}>Take it</DeskButton>
                  ) : (
                    <p className="text-xs text-muted">Park from the street</p>
                  )}
                </li>
              );
            })}
          </ul>
          <div>
            <DeskButton tone="blood" disabled={!!desk.sellBlock} onClick={() => send({ op: "door", spotId: desk.spotId, act: "Sell house" })}>
              {desk.sellBlock || `Sell for ${money(desk.refund)}`}
            </DeskButton>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function CounterBoard({ desk, send }: { desk: Extract<Desk, { kind: "counter" }>; send: (cmd: UiCmd) => void }) {
  return (
    <Shell kicker="SHOP" title={desk.name} wallet={null}>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <FloorPlan id={desk.spotId as RoomId} className="h-48 w-full border border-line bg-surface" />
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs tracking-widest text-muted">TILL</p>
            <p className="font-display text-6xl leading-none text-amber tabular-nums">{money(desk.till)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DeskButton tone="amber" disabled={desk.till <= 0} onClick={() => send({ op: "door", spotId: desk.spotId, act: "Collect till" })}>
              {desk.till > 0 ? "Collect till" : "Till is empty"}
            </DeskButton>
            <DeskButton tone="fg" disabled={desk.busy > 0} onClick={() => send({ op: "door", spotId: desk.spotId, act: desk.use })}>
              {desk.busy > 0 ? `Busy ${Math.ceil(desk.busy)}s` : desk.use}
            </DeskButton>
          </div>
          <p className="max-w-sm text-sm text-muted">{desk.useDetail}</p>
          <p className="text-xs text-muted">The till stops paying at 4 stars. Close-out includes whatever is still in it.</p>
          <DeskButton tone="blood" onClick={() => send({ op: "door", spotId: desk.spotId, act: "Sell shop" })}>
            Close out {money(desk.payout)}
          </DeskButton>
        </div>
      </div>
    </Shell>
  );
}

function Dock({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-30 p-3 sm:bottom-4 sm:p-4 lg:pr-72">
      <section className="desk-in pointer-events-auto ml-auto max-h-[42vh] w-full max-w-3xl overflow-auto border border-line border-l-4 border-l-amber bg-bg/95">
        <header className="flex items-end justify-between gap-3 border-b border-line px-4 py-2">
          <div>
            <p className="text-xs tracking-widest text-amber">{kicker}</p>
            <h2 className="font-display text-4xl leading-none text-fg">{title}</h2>
          </div>
          <p className="text-xs text-muted">J takes it. K moves.</p>
        </header>
        <div className="p-3">{children}</div>
      </section>
    </div>
  );
}

export function JobsBoard({ desk, send }: { desk: Extract<Desk, { kind: "jobs" }>; send: (cmd: UiCmd) => void }) {
  const cooling = desk.cool > 0;
  return (
    <Dock kicker={cooling ? `HOT ${Math.ceil(desk.cool)}s` : "ON THE SPOT"} title={desk.title}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {desk.jobs.map((job) => (
          <li key={job.id}>
            <button
              type="button"
              data-desk=""
              disabled={cooling}
              onClick={() => send({ op: "hustle", id: job.id })}
              className="flex min-h-28 w-full flex-col items-start gap-2 border border-line bg-surface px-3 py-3 text-left disabled:opacity-40"
            >
              <span className="flex w-full items-baseline justify-between gap-3">
                <span className="font-display text-3xl leading-none text-fg">{job.name}</span>
                <span className="text-right font-display text-2xl leading-none text-amber">{job.pay}</span>
              </span>
              <span className="text-xs text-muted">{job.detail}</span>
              <span className="mt-auto flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>{job.seconds}s</span>
                {job.stake > 0 ? <span>Stake {money(job.stake)}</span> : null}
                {job.stars > 0 ? <Pips count={job.stars} /> : <span>Quiet</span>}
                {job.hurt > 0 ? <span>Hurts {job.hurt}</span> : null}
                <span className="ml-auto text-blood">{Math.round(job.fail * 100)}% bust</span>
              </span>
              <span className="h-1 w-full bg-line">
                <span className="block h-full bg-blood" style={{ width: `${Math.round(job.fail * 100)}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dock>
  );
}

export function MugBoard({ desk, send }: { desk: Extract<Desk, { kind: "mug" }>; send: (cmd: UiCmd) => void }) {
  const job = desk.job;
  return (
    <Dock kicker="CLOSE" title={job.name}>
      <div className="flex max-w-md flex-col gap-3">
        <p className="font-display text-6xl leading-none text-amber">{job.pay}</p>
        <p className="text-sm text-muted">{job.detail}</p>
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>{job.seconds}s</span>
          {job.stars > 0 ? <Pips count={job.stars} /> : <span>Quiet</span>}
          <span className="text-blood">{Math.round(job.fail * 100)}% bust</span>
        </p>
        <DeskButton tone="amber" onClick={() => send({ op: "hustle", id: job.id })}>
          Do it
        </DeskButton>
      </div>
    </Dock>
  );
}
