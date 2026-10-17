import { useEffect, useState } from "react";
import { scoreHand, RED_NUMBERS, type Card, type RouletteKind } from "@/game/casino";
import { money, type Desk, type UiCmd } from "@/game/desk";
import { Chips, DeskButton, Shell } from "@/components/desk/widgets";

const RED = new Set<number>(RED_NUMBERS);

function SuitMark({ suit }: { suit: string }) {
  const red = suit === "H" || suit === "D";
  if (suit === "D") {
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${red ? "text-blood" : "text-bg"}`} aria-hidden>
        <path fill="currentColor" d="M12 2 22 12 12 22 2 12z" />
      </svg>
    );
  }
  if (suit === "H") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-blood" aria-hidden>
        <path fill="currentColor" d="M12 21s-7-4.4-9.5-9A5 5 0 0 1 12 7a5 5 0 0 1 9.5 5C19 16.6 12 21 12 21z" />
      </svg>
    );
  }
  if (suit === "C") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-bg" aria-hidden>
        <path
          fill="currentColor"
          d="M12 3a3.2 3.2 0 0 0-1.2 6.2A3.4 3.4 0 0 0 8 15.6c.2 1.4 1.4 2.2 3 2.2h.2L10 21h4l-1.2-3.2h.2c1.6 0 2.8-.8 3-2.2a3.4 3.4 0 0 0-2.8-6.4A3.2 3.2 0 0 0 12 3z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-bg" aria-hidden>
      <path fill="currentColor" d="M12 2c2 4 6 6.2 6 10a4 4 0 0 1-4.6 4H14l1 6h-6l1-6h.6A4 4 0 0 1 6 12c0-3.8 4-6 6-10z" />
    </svg>
  );
}

function PlayingCard({ card, hole }: { card?: Card; hole?: boolean }) {
  if (!card || hole || card.hidden) {
    return (
      <div className="grid h-28 w-20 place-items-center border border-amber/50 bg-surface" aria-label="Hole card">
        <span className="h-20 w-12 border border-amber/40" />
      </div>
    );
  }
  const red = card.suit === "H" || card.suit === "D";
  return (
    <div className="flex h-28 w-20 flex-col justify-between bg-fg p-1.5 text-bg" aria-label={`${card.rank} ${card.suit}`}>
      <span className={`font-display text-4xl leading-none ${red ? "text-blood" : "text-bg"}`}>{card.rank}</span>
      <span className="self-end">
        <SuitMark suit={card.suit} />
      </span>
    </div>
  );
}

function shownCards(cards: Card[], hideIndex?: number) {
  return cards.filter((card, index) => !card.hidden && index !== hideIndex);
}

function handLabel(cards: Card[]) {
  if (cards.length === 0) return "";
  const score = scoreHand(cards);
  if (score.total > 21) return `${score.total} bust`;
  return score.soft && score.total < 21 ? `soft ${score.total}` : String(score.total);
}

function HandRow({ cards, holeAt }: { cards: Card[]; holeAt?: number }) {
  return (
    <div className="flex gap-2">
      {cards.map((card, index) => (
        <PlayingCard key={`${card.rank}${card.suit}${index}`} card={card} hole={holeAt === index} />
      ))}
    </div>
  );
}

export function BlackjackTable({ desk, send }: { desk: Extract<Desk, { kind: "blackjack" }>; send: (cmd: UiCmd) => void }) {
  const state = desk.state;
  const playing = state?.phase === "player";
  const dealer = state?.dealer ?? [];
  const hands = state && state.hands.length > 0 ? state.hands : null;
  const dealerOpen = shownCards(dealer, state?.holeHidden ? 1 : undefined);
  const dealerTotal = handLabel(dealerOpen);
  return (
    <Shell kicker="TABLE" title="Blackjack" wallet={desk.wallet} felt>
      <div className="grid gap-4">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs tracking-widest text-muted">DEALER</p>
            <p className={`font-display text-4xl leading-none tabular-nums ${dealerTotal.includes("bust") ? "text-blood" : "text-fg"}`}>{dealerTotal}</p>
          </div>
          <div className="mt-2">
            {dealer.length ? <HandRow cards={dealer} holeAt={state?.holeHidden ? 1 : undefined} /> : <p className="text-sm text-muted">No hand. Set a chip and deal.</p>}
          </div>
        </div>
        <div className="border-t border-line/60 pt-3">
          <p className="text-xs tracking-widest text-amber">YOU</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {hands
              ? hands.map((hand, index) => (
                  <div key={index} className={state && state.split && index === state.active && playing ? "border border-amber p-2" : "p-2"}>
                    <HandRow cards={hand.cards} />
                    <p className={`mt-1 font-display text-2xl leading-none ${scoreHand(hand.cards).total > 21 ? "text-blood" : "text-fg"}`}>
                      {handLabel(hand.cards)}
                      {hand.result ? ` · ${hand.result}` : ""}
                    </p>
                  </div>
                ))
              : state
                ? (
                    <div>
                      <HandRow cards={state.player} />
                      <p className={`mt-1 font-display text-2xl leading-none ${scoreHand(state.player).total > 21 ? "text-blood" : "text-fg"}`}>
                        {state.player.length ? handLabel(state.player) : ""}
                      </p>
                    </div>
                  )
                : null}
          </div>
        </div>
        {state?.log ? <p className="font-display text-3xl leading-none text-fg">{state.log}</p> : null}
        <Chips bets={desk.bets} bet={desk.bet} wallet={desk.wallet} send={send} />
        <div className="flex flex-wrap gap-2">
          <DeskButton mark="play" tone="amber" onClick={() => send({ op: "play" })}>
            {playing ? "Hit" : `Deal ${money(desk.bet)}`}
          </DeskButton>
          <DeskButton disabled={!playing} onClick={() => send({ op: "stand" })}>
            Stand
          </DeskButton>
          <DeskButton disabled={!playing} onClick={() => send({ op: "double" })}>
            Double
          </DeskButton>
          <DeskButton disabled={!playing} onClick={() => send({ op: "split" })}>
            Split
          </DeskButton>
        </div>
        <p className="text-xs text-muted">Dealer stands on every 17, soft included. Blackjack pays 3 to 2.</p>
      </div>
    </Shell>
  );
}

function pocketClass(n: number, on: boolean, tall = false) {
  const color = n === 0 ? "bg-zero text-fg" : RED.has(n) ? "bg-blood text-fg" : "bg-bg text-fg";
  const size = tall ? "h-auto w-10 self-stretch" : "h-9 w-9 sm:h-10 sm:w-10";
  return `grid ${size} place-items-center font-display text-lg leading-none tabular-nums ${color} ${on ? "ring-2 ring-amber ring-offset-1 ring-offset-felt" : ""}`;
}

export function RouletteTable({ desk, send }: { desk: Extract<Desk, { kind: "roulette" }>; send: (cmd: UiCmd) => void }) {
  const pick = (kind: RouletteKind, n: number) => send({ op: "pick-roulette", kind, pick: n });
  const rows = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
  const last = desk.last;
  return (
    <Shell kicker="WHEEL" title="Roulette" wallet={desk.wallet} felt>
      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center border border-line bg-bg px-4 py-3">
          <p className="text-xs tracking-widest text-muted">LAST POCKET</p>
          <p
            className={`mt-1 font-display text-7xl leading-none tabular-nums ${
              !last ? "text-muted" : last.color === "red" ? "text-blood" : last.color === "green" ? "text-zero" : "text-fg"
            }`}
          >
            {last ? last.pocket : "—"}
          </p>
          <p className="mt-2 max-w-40 text-center text-xs text-muted">{last?.log ?? "European wheel. One spin."}</p>
        </div>
        <div className="overflow-x-auto">
          <div className="flex min-w-[22rem] gap-1">
            <button type="button" data-desk="" onClick={() => pick("straight", 0)} className={pocketClass(0, desk.pickKind === "straight" && desk.pick === 0, true)}>
              0
            </button>
            <div className="grid flex-1 grid-cols-12 gap-1">
              {rows.map((start) => (
                <div key={start} className="grid gap-1">
                  {[2, 1, 0].map((offset) => {
                    const n = start + offset;
                    return (
                      <button key={n} type="button" data-desk="" onClick={() => pick("straight", n)} className={pocketClass(n, desk.pickKind === "straight" && desk.pick === n)}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {[1, 2, 3].map((dozen) => (
              <button
                key={dozen}
                type="button"
                data-desk=""
                onClick={() => pick("dozen", dozen)}
                className={`min-h-11 text-xs tracking-widest ${desk.pickKind === "dozen" && desk.pick === dozen ? "bg-amber text-bg" : "bg-surface text-fg"}`}
              >
                {dozen === 1 ? "1ST 12" : dozen === 2 ? "2ND 12" : "3RD 12"}
              </button>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-4 gap-1">
            <Outside label="EVEN" on={desk.pickKind === "even"} send={() => pick("even", 0)} />
            <Outside label="RED" on={desk.pickKind === "red"} hot send={() => pick("red", 0)} />
            <Outside label="BLACK" on={desk.pickKind === "black"} send={() => pick("black", 0)} />
            <Outside label="ODD" on={desk.pickKind === "odd"} send={() => pick("odd", 0)} />
          </div>
          <p className="mt-2 text-xs text-muted">1–18 and 19–36 are on the cloth. They are not bets. Outside pays red, black, odd, even, and the dozens. A number is a straight bet. 0 loses the outside.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Chips bets={desk.bets} bet={desk.bet} wallet={desk.wallet} send={send} />
        <DeskButton mark="play" tone="amber" onClick={() => send({ op: "play" })}>
          Spin {money(desk.bet)}
        </DeskButton>
        <p className="text-xs tracking-widest text-amber">
          {desk.pickKind === "straight" ? `STRAIGHT ${desk.pick}` : desk.pickKind === "dozen" ? `DOZEN ${desk.pick}` : desk.pickKind.toUpperCase()}
        </p>
      </div>
    </Shell>
  );
}

function Outside({ label, on, hot, disabled, send }: { label: string; on: boolean; hot?: boolean; disabled?: boolean; send: () => void }) {
  if (disabled) {
    return <div className="grid min-h-11 place-items-center bg-bg text-xs tracking-widest text-muted">{label}</div>;
  }
  return (
    <button type="button" data-desk="" onClick={send} className={`min-h-11 text-xs tracking-widest ${on ? "bg-amber text-bg" : hot ? "bg-blood text-fg" : "bg-surface text-fg"}`}>
      {label}
    </button>
  );
}

function SlotGlyph({ symbol }: { symbol: string }) {
  if (symbol === "seven") return <span className="font-display text-6xl leading-none text-blood">7</span>;
  if (symbol === "bar") return <span className="border border-fg px-2 font-display text-3xl leading-none text-fg">BAR</span>;
  if (symbol === "cherry") {
    return (
      <svg viewBox="0 0 64 64" className="h-14 w-14 text-blood" aria-label="cherry">
        <path d="M34 30c8-14 16-16 20-16" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="24" cy="42" r="12" fill="currentColor" />
        <circle cx="42" cy="40" r="11" fill="currentColor" />
      </svg>
    );
  }
  if (symbol === "bell") {
    return (
      <svg viewBox="0 0 64 64" className="h-14 w-14 text-amber" aria-label="bell">
        <path fill="currentColor" d="M32 8c-10 0-16 10-16 20v8l-6 8h44l-6-8v-8C48 18 42 8 32 8z" />
        <rect x="26" y="46" width="12" height="6" fill="currentColor" />
      </svg>
    );
  }
  if (symbol === "gem") {
    return (
      <svg viewBox="0 0 64 64" className="h-14 w-14 text-fg" aria-label="gem">
        <path fill="currentColor" d="M10 24 24 10h16l14 14-22 30z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14 text-amber" aria-label="coin">
      <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" strokeWidth="6" />
      <circle cx="32" cy="32" r="6" fill="currentColor" />
    </svg>
  );
}

const PAYS = [
  ["7 7 7", "50x"],
  ["BAR BAR BAR", "20x"],
  ["Three of a kind", "8x"],
  ["Two sevens", "2x"],
];

export function SlotsTable({ desk, send }: { desk: Extract<Desk, { kind: "slots" }>; send: (cmd: UiCmd) => void }) {
  const reels = desk.last?.reels ?? ["bar", "seven", "cherry"];
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (!desk.last) return;
    setSpinning(true);
    const timer = window.setTimeout(() => setSpinning(false), 420);
    return () => window.clearTimeout(timer);
  }, [desk.last]);
  return (
    <Shell kicker={desk.machine} title="Slots" wallet={desk.wallet}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="border border-amber bg-bg p-4">
          <div className="reel-row relative grid grid-cols-3 gap-3">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-0.5 -translate-y-1/2 bg-amber" />
            {reels.map((symbol, index) => (
              <div key={`${symbol}-${index}-${desk.last?.log ?? "idle"}`} className={`grid h-36 place-items-center bg-surface ${spinning ? "reel-stop" : ""}`}>
                <SlotGlyph symbol={symbol} />
              </div>
            ))}
          </div>
          <p className="mt-3 font-display text-3xl leading-none text-fg">{desk.last ? desk.last.log : "Three reels. The left one stops first."}</p>
        </div>
        <ul className="flex flex-col gap-2 border border-line bg-surface p-3">
          <li className="text-xs tracking-widest text-amber">PAYS</li>
          {PAYS.map(([name, mult]) => (
            <li key={name} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-fg">{name}</span>
              <span className="text-amber tabular-nums">{mult}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Chips bets={desk.bets} bet={desk.bet} wallet={desk.wallet} send={send} />
        <DeskButton mark="play" tone="amber" onClick={() => send({ op: "play" })}>
          Spin {money(desk.bet)}
        </DeskButton>
      </div>
    </Shell>
  );
}

function DieFace({ n }: { n: number }) {
  const pips: Record<number, string[]> = {
    1: ["c"],
    2: ["tl", "br"],
    3: ["tl", "c", "br"],
    4: ["tl", "tr", "bl", "br"],
    5: ["tl", "tr", "c", "bl", "br"],
    6: ["tl", "tr", "ml", "mr", "bl", "br"],
  };
  const spots = pips[n] ?? [];
  const at: Record<string, string> = {
    tl: "left-1.5 top-1.5",
    tr: "right-1.5 top-1.5",
    ml: "top-1/2 left-1.5 -translate-y-1/2",
    mr: "top-1/2 right-1.5 -translate-y-1/2",
    c: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    bl: "bottom-1.5 left-1.5",
    br: "right-1.5 bottom-1.5",
  };
  return (
    <div className="relative h-20 w-20 bg-fg" aria-label={n ? `Die ${n}` : "Die"}>
      {spots.map((spot) => (
        <span key={spot} className={`absolute h-3 w-3 rounded-full bg-bg ${at[spot]}`} />
      ))}
    </div>
  );
}

export function CrapsTable({ desk, send }: { desk: Extract<Desk, { kind: "craps" }>; send: (cmd: UiCmd) => void }) {
  const rolls = desk.last?.rolls ?? [];
  const [shown, setShown] = useState(rolls.length);
  useEffect(() => {
    if (rolls.length === 0) {
      setShown(0);
      return;
    }
    setShown(1);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(rolls.length);
      return;
    }
    const timers = rolls.slice(1).map((_, index) => window.setTimeout(() => setShown(index + 2), 380 * (index + 1)));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [desk.last]);
  const visible = rolls.slice(0, shown);
  const face = visible[visible.length - 1];
  return (
    <Shell kicker="PASS LINE" title="Craps" wallet={desk.wallet} felt>
      <div className="border border-amber/70 px-4 py-5">
        <p className="text-xs tracking-widest text-amber">PASS</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <DieFace n={face?.d1 ?? 0} />
          <DieFace n={face?.d2 ?? 0} />
          <div
            className={`grid h-20 w-20 place-items-center rounded-full border ${
              desk.last?.point ? "border-amber bg-amber text-bg" : "border-line bg-bg text-muted"
            }`}
          >
            <span className="font-display text-3xl leading-none tabular-nums">{desk.last?.point ?? "OFF"}</span>
          </div>
          <div>
            <p className="font-display text-6xl leading-none text-fg tabular-nums">{face ? face.total : "—"}</p>
            <p className="mt-1 max-w-xs text-xs text-muted">
              {desk.last?.point ? `Point is ${desk.last.point}. Make it before a seven.` : "7 or 11 wins. 2, 3, and 12 lose. Anything else sets the point."}
            </p>
          </div>
        </div>
        {desk.last ? <p className="mt-4 font-display text-3xl leading-none text-fg">{desk.last.log}</p> : null}
        {visible.length > 1 ? (
          <ol className="mt-4 flex flex-wrap gap-2">
            {visible.map((roll, index) => (
              <li key={index} className="border border-line px-2 py-1 text-xs text-muted tabular-nums">
                {roll.d1}+{roll.d2}={roll.total}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Chips bets={desk.bets} bet={desk.bet} wallet={desk.wallet} send={send} />
        <DeskButton mark="play" tone="amber" onClick={() => send({ op: "play" })}>
          Roll {money(desk.bet)}
        </DeskButton>
      </div>
    </Shell>
  );
}

function RankRow({ ranks }: { ranks: string[] }) {
  if (ranks.length === 0) return <p className="text-sm text-muted">Waiting</p>;
  return (
    <div className="flex gap-2">
      {ranks.map((rank, index) => (
        <div key={`${rank}${index}`} className="grid h-20 w-14 place-items-center bg-fg font-display text-4xl text-bg">
          {rank}
        </div>
      ))}
    </div>
  );
}

export function BaccaratTable({ desk, send }: { desk: Extract<Desk, { kind: "baccarat" }>; send: (cmd: UiCmd) => void }) {
  const last = desk.last;
  const sides = [
    { id: "player" as const, label: "Player", note: "1 to 1" },
    { id: "banker" as const, label: "Banker", note: "1 to 1, 5% commission" },
    { id: "tie" as const, label: "Tie", note: "8 to 1" },
  ];
  return (
    <Shell kicker="SHOE" title="Baccarat" wallet={desk.wallet} felt>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]">
        <div className={`border p-3 ${last?.winner === "player" ? "border-amber" : "border-line"}`}>
          <p className="text-xs tracking-widest text-muted">PLAYER</p>
          <div className="mt-2">
            <RankRow ranks={last?.player ?? []} />
          </div>
          {last ? <p className="mt-2 font-display text-4xl leading-none text-amber tabular-nums">{last.playerTotal}</p> : null}
        </div>
        <div className={`grid place-items-center border ${last?.winner === "tie" ? "border-amber text-amber" : "border-line text-muted"}`}>
          <p className="text-center font-display text-4xl leading-none">{last?.winner === "tie" ? "TIE" : "8 TO 1"}</p>
        </div>
        <div className={`border p-3 text-right ${last?.winner === "banker" ? "border-amber" : "border-line"}`}>
          <p className="text-xs tracking-widest text-muted">BANKER</p>
          <div className="mt-2 flex justify-end">
            <RankRow ranks={last?.banker ?? []} />
          </div>
          {last ? <p className="mt-2 font-display text-4xl leading-none text-amber tabular-nums">{last.bankerTotal}</p> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {sides.map((side) => {
          const on = desk.side === side.id;
          return (
            <button
              key={side.id}
              type="button"
              data-desk=""
              onClick={() => send({ op: "pick-side", side: side.id })}
              className={`flex min-h-16 flex-col items-start justify-center px-3 text-left ${on ? "bg-amber text-bg" : "border border-line bg-bg text-fg"}`}
            >
              <span className="font-display text-3xl leading-none">{side.label}</span>
              <span className={`text-xs tracking-widest ${on ? "text-bg" : "text-muted"}`}>{side.note}</span>
            </button>
          );
        })}
      </div>
      {last ? (
        <p className="mt-3 font-display text-3xl leading-none text-fg">
          {last.log}
          {last.commission > 0 ? ` Commission ${money(last.commission)}.` : ""}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">Pick a side. Natural 8 or 9 stands. A tie pushes player and banker.</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Chips bets={desk.bets} bet={desk.bet} wallet={desk.wallet} send={send} />
        <DeskButton mark="play" tone="amber" onClick={() => send({ op: "play" })}>
          Deal {money(desk.bet)}
        </DeskButton>
      </div>
    </Shell>
  );
}

export function CageBoard({ desk }: { desk: Extract<Desk, { kind: "cage" }> }) {
  return (
    <Shell kicker="CAGE" title="Cashier" wallet={desk.wallet}>
      <p className="max-w-md text-sm text-fg">This window counts what you can bet. The tables take the action. The street bank is where a deposit sticks.</p>
      <p className="mt-4 font-display text-7xl leading-none text-amber tabular-nums sm:text-8xl">{money(desk.wallet)}</p>
    </Shell>
  );
}
