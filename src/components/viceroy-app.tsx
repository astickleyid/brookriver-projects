import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import type { GameHandle, HudSnapshot, TouchInput } from "@/game/create-game";
import { ledgerLines } from "@/game/economy";

const LEDGER = ledgerLines();

const EMPTY: HudSnapshot = {
  phase: "menu",
  health: 100,
  armor: 30,
  wanted: 0,
  cash: 0,
  bank: 0,
  loot: 0,
  best: 0,
  speedMph: 0,
  driving: true,
  toast: "",
  cooling: false,
  looking: false,
  pad: false,
  lostCash: 0,
  error: "",
  gun: "PISTOL",
  ammo: "12/72",
  job: "",
  radio: "NIGHTLINE",
  shop: "",
  nearShop: false,
  drifting: false,
  cover: false,
  hustle: "",
  hustlePct: 0,
  nearWork: false,
  nearTeller: false,
  assets: "",
  pauseSel: 0,
};

function makeTouch(): TouchInput {
  return { x: 0, y: 0, lookX: 0, lookY: 0, fire: false, sprint: false, useQueued: false, reloadQueued: false, cycleGunQueued: false, radioQueued: false, hustleQueued: false, bankQueued: false, buy: "" };
}

export function ViceroyApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const touchRef = useRef<TouchInput>(makeTouch());
  const pendingStart = useRef(false);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY);
  const [touchUi, setTouchUi] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const mini = miniRef.current;
    if (!canvas || !mini) return;
    let handle: GameHandle | null = null;
    let dead = false;
    void import("@/game/create-game").then(({ createGame }) => {
      if (dead) return;
      handle = createGame(canvas, mini, touchRef.current, setHud);
      gameRef.current = handle;
      setBooted(true);
      if (pendingStart.current) handle.start();
    });
    return () => {
      dead = true;
      handle?.dispose();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const query = () => {
      setTouchUi(window.matchMedia("(pointer: coarse)").matches);
    };
    query();
    window.addEventListener("resize", query);
    return () => window.removeEventListener("resize", query);
  }, []);

  const start = () => {
    if (gameRef.current) gameRef.current.start();
    else pendingStart.current = true;
    if (!window.matchMedia("(pointer: coarse)").matches) canvasRef.current?.requestPointerLock?.();
  };

  const phase = hud.phase;

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg font-sans text-fg">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label="Viceroy city" />
      <canvas
        ref={miniRef}
        width={256}
        height={256}
        className={`pointer-events-none absolute z-10 bg-bg mini-frame ${
          phase === "play" ? "" : "hidden"
        } ${touchUi ? "top-36 right-3 h-20 w-20" : "right-4 bottom-4 h-40 w-40"}`}
      />

      {phase === "play" ? (
        <div className={`pointer-events-none absolute inset-0 z-10 night-grade ${hud.wanted > 0 ? "heat-vignette" : ""}`}>
          <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
            <div className="hud-chip w-28 px-2 py-1.5 sm:w-52">
              <Bar label="Health" value={hud.health} tone="blood" />
              <Bar label="Armor" value={hud.armor} tone="paper" />
              <p className="mt-1 font-display text-2xl leading-none tracking-wide text-fg">{hud.gun}</p>
              <p className="text-xs tracking-widest text-muted">{hud.ammo}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 sm:h-5 sm:w-5 ${i < hud.wanted ? "fill-amber text-amber" : "text-line"}`}
                    strokeWidth={1.75}
                  />
                ))}
              </div>
              {touchUi && hud.driving ? (
                <p className={`font-display text-2xl leading-none ${hud.drifting ? "text-amber" : "text-fg"}`}>{hud.speedMph} MPH</p>
              ) : null}
              <p className="font-display text-lg leading-none tracking-widest text-muted">
                {hud.cover ? "OFF THE LIGHT" : hud.cooling ? "LOSING THEM" : hud.wanted > 0 ? "WANTED" : "QUIET"}
              </p>
              {hud.job ? <p className="max-w-48 text-center text-xs text-amber">{hud.job}</p> : null}
              {hud.hustle ? (
                <div className="max-w-48 sm:max-w-xs">
                  <p className="text-center text-xs text-fg">{hud.hustle}</p>
                  {hud.hustlePct > 0 ? (
                    <div className="mt-1 h-1 bg-line">
                      <div className="h-full bg-amber" style={{ width: `${Math.round(hud.hustlePct * 100)}%` }} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="hud-chip w-24 px-2 py-1.5 text-right sm:w-44">
              <p className="font-display text-3xl leading-none text-amber sm:text-4xl">${hud.cash.toLocaleString("en-US")}</p>
              <p className="text-xs tracking-widest text-muted">Wallet</p>
              <p className="text-sm leading-tight text-fg">Bank ${hud.bank.toLocaleString("en-US")}</p>
              {hud.loot > 0 ? <p className="text-xs text-amber">Goods ${hud.loot.toLocaleString("en-US")}</p> : null}
              {hud.assets ? <p className="text-xs leading-tight text-muted">{hud.assets}</p> : null}
            </div>
          </div>

          <div className="absolute top-1/2 left-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
            <span className="absolute top-1/2 left-0 h-px w-1.5 bg-fg/90" />
            <span className="absolute top-1/2 right-0 h-px w-1.5 bg-fg/90" />
            <span className="absolute top-0 left-1/2 h-1.5 w-px bg-fg/90" />
            <span className="absolute bottom-0 left-1/2 h-1.5 w-px bg-fg/90" />
          </div>

          {hud.toast ? (
            <p className="hud-chip absolute bottom-28 left-1/2 max-w-sm -translate-x-1/2 px-3 py-1 text-center text-sm text-fg">
              {hud.toast}
            </p>
          ) : null}

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
            {!touchUi && hud.driving ? (
              <p className={`font-display text-4xl leading-none ${hud.drifting ? "text-amber" : "text-fg"}`}>
                {hud.speedMph}
                <span className="ml-1 text-lg text-muted">MPH</span>
              </p>
            ) : null}
            {hud.shop ? <p className="max-w-md text-center text-xs text-amber">{hud.shop}</p> : null}
            {hud.pad && !hud.looking ? (
              <p className="text-center text-xs tracking-wide text-muted">
                {hud.driving
                  ? "RT gas · LT brake · LS steer · RS look · RB shoot · A exit · Start pauses"
                  : "LS move · RS look · RT or RB shoot · A jack · B sprint · Start pauses"}
              </p>
            ) : null}
            {!touchUi && !hud.pad && !hud.looking ? (
              <p className="text-center text-xs text-muted">
                {hud.driving ? "Mouse looks · WASD drives · Shift drifts · Esc pauses" : "Click to look · WASD moves · Shift sprints · Esc pauses"}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === "menu" ? (
        <div className="scrim-bottom absolute inset-0 z-20 flex flex-col justify-end p-4 safe-b sm:p-8">
          <div className="max-w-xl border-l-2 border-amber pl-4">
            <p className="text-xs tracking-widest text-amber">WARD 04 · NIGHT OPEN</p>
            <h1 className="font-display text-6xl leading-none text-fg sm:text-8xl">VICEROY</h1>
            <p className="mt-2 max-w-md text-sm text-muted sm:text-lg">
              The wallet is what the street can take. The bank keeps the rest. The plaza fixer sells the city off the same scale.
            </p>
            <ul className="mt-3 hidden max-w-md grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted sm:grid">
              {LEDGER.map((row) => (
                <li key={row.id} className="flex items-baseline justify-between gap-2">
                  <span>
                    {row.name} <span className="text-fg">{row.risk}</span>
                  </span>
                  <span className="text-amber">{row.pay}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 max-w-sm text-xs text-muted sm:hidden">
              {LEDGER.map((row) => `${row.name} ${row.pay}`).join(" · ")}. Plaza fixer takes the big checks.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={start}
                className="min-h-12 bg-amber px-8 font-display text-3xl leading-none tracking-wide text-bg"
              >
                Start
              </button>
              <p className="text-sm text-muted">{booted ? "Night is live." : "Wiring the blocks…"}</p>
            </div>
            <p className="mt-4 text-sm text-muted">
              {hud.pad
                ? "Controller connected. Press A to start. Right stick looks. Right bumper shoots."
                : touchUi
                  ? "Left stick drives. Work shows up on a mark, a door, the bank, or the plaza fixer."
                  : "You start with $40. Click to look. White post is the bank. Plaza fixer sells rides, guns, and the house."}
            </p>
            {hud.bank > 0 ? <p className="mt-2 text-sm text-fg">Bank ${hud.bank.toLocaleString("en-US")}</p> : null}
            {hud.best > 0 ? <p className="mt-2 text-sm text-amber">Best net ${hud.best.toLocaleString("en-US")}</p> : null}
            {hud.error ? <p className="mt-2 text-sm text-blood">{hud.error}</p> : null}
          </div>
        </div>
      ) : null}

      {phase === "pause" ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/75 p-4">
          <div className="w-full max-w-md border-l-2 border-amber pl-4">
            <p className="text-xs tracking-widest text-amber">WARD 04</p>
            <h2 className="font-display text-6xl leading-none text-fg sm:text-7xl">PAUSED</h2>
            <div className="mt-4 flex flex-col items-start gap-2">
              {["Resume", "Quit to title"].map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onMouseEnter={() => gameRef.current?.focusPause(i)}
                  onClick={() => (i === 0 ? gameRef.current?.resume() : gameRef.current?.quit())}
                  className={`min-h-12 px-5 font-display text-3xl leading-none ${hud.pauseSel === i ? "bg-amber text-bg" : "text-fg"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-3 text-xs text-muted sm:grid-cols-2">
              <p>
                <span className="tracking-widest text-fg">KEYBOARD</span>
                <br />
                Esc pauses. Arrows choose. Enter confirms. WASD moves. Mouse looks. Click shoots. Shift sprints or drifts. F uses a car. 1 2 3 guns.
              </p>
              <p>
                <span className="tracking-widest text-fg">GAMEPAD</span>
                <br />
                Start pauses. Stick or D-pad chooses. A confirms. B resumes. Left stick moves. Right stick looks. RT gas or shoot. LT brakes. RB shoots.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "dead" ? (
        <div className="absolute inset-0 z-20 flex flex-col items-start justify-end bg-bg/80 p-4 safe-b sm:p-8">
          <div className="border-l-2 border-blood pl-4">
          <p className="text-xs tracking-widest text-blood">FLATLINED</p>
          <h2 className="font-display text-7xl leading-none text-fg sm:text-8xl">WASTED</h2>
          <p className="mt-2 text-muted">
            Hospital took ${hud.lostCash.toLocaleString("en-US")} off the wallet.
            {hud.bank > 0 ? ` The bank still holds $${hud.bank.toLocaleString("en-US")}.` : " Nothing was in the bank."}
          </p>
          <button
            type="button"
            onClick={() => gameRef.current?.respawn()}
            className="mt-4 min-h-12 bg-fg px-6 font-display text-3xl leading-none text-bg"
          >
            Get up
          </button>
          </div>
        </div>
      ) : null}

      {phase === "play" && touchUi && hud.nearShop ? (
        <div className="absolute top-40 left-3 z-20 flex flex-col gap-2">
          <TouchButton label="Bail" onDown={() => { touchRef.current.buy = "bail"; }} onUp={() => {}} />
          <TouchButton label="Vest" onDown={() => { touchRef.current.buy = "vest"; }} onUp={() => {}} />
          <TouchButton label="Shot" onDown={() => { touchRef.current.buy = "shotgun"; }} onUp={() => {}} />
          <TouchButton label="Sport" onDown={() => { touchRef.current.buy = "sport"; }} onUp={() => {}} />
        </div>
      ) : null}

      {phase === "play" && touchUi ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-3 safe-b">
          <Stick
            label="Move"
            onChange={(x, y) => {
              touchRef.current.x = x;
              touchRef.current.y = y;
            }}
          />
          <div className="mb-2 flex flex-col gap-2">
            <TouchButton
              label="Fire"
              onDown={() => {
                touchRef.current.fire = true;
              }}
              onUp={() => {
                touchRef.current.fire = false;
              }}
            />
            <TouchButton
              label="Jack"
              onDown={() => {
                touchRef.current.useQueued = true;
              }}
              onUp={() => {}}
            />
            <TouchButton
              label={hud.driving ? "Drift" : "Sprint"}
              onDown={() => {
                touchRef.current.sprint = true;
              }}
              onUp={() => {
                touchRef.current.sprint = false;
              }}
            />
            <TouchButton
              label="Gun"
              onDown={() => {
                touchRef.current.cycleGunQueued = true;
              }}
              onUp={() => {}}
            />
            <TouchButton
              label="Tune"
              onDown={() => {
                touchRef.current.radioQueued = true;
              }}
              onUp={() => {}}
            />
            {hud.nearWork ? (
              <TouchButton
                label={hud.nearTeller ? "Deposit" : "Work"}
                onDown={() => {
                  touchRef.current.hustleQueued = true;
                }}
                onUp={() => {}}
              />
            ) : null}
            {hud.nearTeller || (hud.nearWork && hud.hustle.includes("swap")) ? (
              <TouchButton
                label={hud.nearTeller ? "Draw" : "Swap"}
                onDown={() => {
                  touchRef.current.bankQueued = true;
                }}
                onUp={() => {}}
              />
            ) : null}
          </div>
          <LookPad
            onDelta={(dx, dy) => {
              touchRef.current.lookX += dx;
              touchRef.current.lookY += dy;
            }}
          />
        </div>
      ) : null}
    </main>
  );
}

function Bar({ label, value, tone }: { label: string; value: number; tone: "blood" | "paper" }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-1.5 bg-line">
        <div className={`h-full ${tone === "blood" ? "bg-blood" : "bg-fg"}`} style={{ width: `${clampPct(value)}%` }} />
      </div>
    </div>
  );
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

function Stick({ label, onChange }: { label: string; onChange: (x: number, y: number) => void }) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const end = () => {
    origin.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };
  return (
    <div
      role="application"
      aria-label={label}
      className="relative h-28 w-28 touch-none rounded-full border border-line bg-surface/80"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        const dx = e.clientX - origin.current.x;
        const dy = e.clientY - origin.current.y;
        const max = 44;
        const mag = Math.hypot(dx, dy) || 1;
        const k = Math.min(max, mag) / mag;
        const x = (dx * k) / max;
        const y = -(dy * k) / max;
        setKnob({ x: x * max, y: -y * max });
        onChange(x, y);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span
        className="absolute top-1/2 left-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

function LookPad({ onDelta }: { onDelta: (dx: number, dy: number) => void }) {
  const last = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      role="application"
      aria-label="Look"
      className="h-28 w-28 touch-none border border-line bg-surface/50"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!last.current) return;
        onDelta(e.clientX - last.current.x, e.clientY - last.current.y);
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => {
        last.current = null;
      }}
      onPointerCancel={() => {
        last.current = null;
      }}
    >
      <span className="flex h-full items-center justify-center text-xs tracking-wide text-muted">LOOK</span>
    </div>
  );
}

function TouchButton({ label, onDown, onUp }: { label: string; onDown: () => void; onUp: () => void }) {
  return (
    <button
      type="button"
      className="min-h-12 min-w-20 border border-line bg-surface/90 px-3 font-display text-2xl leading-none text-fg"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {label}
    </button>
  );
}
