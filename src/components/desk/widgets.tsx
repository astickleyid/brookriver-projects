import type { ReactNode } from "react";
import { roomById, roomProps, type RoomId } from "@/game/room-layout";
import { money, type UiCmd } from "@/game/desk";

export function DeskButton({
  children,
  onClick,
  disabled,
  tone = "ghost",
  mark = "",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "ghost" | "amber" | "blood" | "fg";
  mark?: string;
}) {
  const face =
    tone === "amber"
      ? "bg-amber text-bg"
      : tone === "blood"
        ? "bg-blood text-fg"
        : tone === "fg"
          ? "bg-fg text-bg"
          : "border border-line bg-surface text-fg";
  return (
    <button
      type="button"
      data-desk={mark}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 px-4 font-display text-2xl leading-none tracking-wide disabled:cursor-default disabled:opacity-40 ${face}`}
    >
      {children}
    </button>
  );
}

export function Shell({
  kicker,
  title,
  wallet,
  onBack,
  children,
  felt,
}: {
  kicker: string;
  title: string;
  wallet: number | null;
  onBack?: () => void;
  children: ReactNode;
  felt?: boolean;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-end justify-center bg-bg/85 p-3 sm:items-center sm:p-6">
      <section
        className={`desk-in flex max-h-[92vh] w-full max-w-5xl flex-col border border-line ${
          felt ? "border-t-4 border-t-amber bg-felt" : "border-l-4 border-l-amber bg-bg"
        }`}
      >
        <header className="flex items-end justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs tracking-widest text-amber">{kicker}</p>
            <h2 className="truncate font-display text-5xl leading-none text-fg sm:text-6xl">{title}</h2>
          </div>
          {wallet === null ? null : (
            <div className="shrink-0 text-right">
              <p className="text-xs tracking-widest text-muted">WALLET</p>
              <p className="font-display text-4xl leading-none text-amber tabular-nums">{money(wallet)}</p>
            </div>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          {onBack ? <DeskButton onClick={onBack}>Back</DeskButton> : <span />}
          <p className="text-xs text-muted">{onBack ? "Back returns to the desk. J confirms. K moves." : "Walk off to close. J confirms. K moves."}</p>
        </footer>
      </section>
    </div>
  );
}

export function Pips({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${count} stars`}>
      {Array.from({ length: max }, (_, index) => (
        <span key={index} className={`h-2 w-2 ${index < count ? "bg-amber" : "bg-line"}`} />
      ))}
    </span>
  );
}

export function Chips({
  bets,
  bet,
  wallet,
  send,
}: {
  bets: number[];
  bet: number;
  wallet: number;
  send: (cmd: UiCmd) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {bets.map((amount) => {
        const on = amount === bet;
        const short = amount > wallet;
        return (
          <button
            key={amount}
            type="button"
            data-desk=""
            disabled={short}
            onClick={() => send({ op: "bet", amount })}
            className={`grid h-11 w-11 place-items-center rounded-full border font-display text-lg leading-none tabular-nums disabled:opacity-35 ${
              on ? "border-amber bg-amber text-bg" : "border-line bg-bg text-fg"
            }`}
          >
            {amount}
          </button>
        );
      })}
    </div>
  );
}

const PLAN_FILL: Record<string, string> = {
  safe: "var(--color-amber)",
  bed: "var(--color-surface)",
  bay: "var(--color-line)",
  counter: "var(--color-amber)",
  shelf: "var(--color-surface)",
  vault: "var(--color-amber)",
  desk: "var(--color-amber)",
  bar: "var(--color-surface)",
  table: "var(--color-line)",
};

const PLAN_LABEL: Record<string, string> = {
  safe: "SAFE",
  bed: "BED",
  bay: "BAY",
  counter: "TILL",
  shelf: "SHELF",
  vault: "VAULT",
  desk: "DESK",
  bar: "BAR",
  table: "TABLE",
};

export function FloorPlan({ id, className }: { id: RoomId; className?: string }) {
  const spec = roomById(id);
  if (!spec) return null;
  const props = roomProps(spec);
  const half = spec.width / 2;
  const pad = 0.7;
  const sx = (x: number) => x + half;
  const sy = (z: number) => spec.depth - z;
  return (
    <svg viewBox={`${-pad} ${-pad} ${spec.width + pad * 2} ${spec.depth + pad * 2}`} className={className} role="img" aria-label={`${spec.title} plan`}>
      <rect x="0" y="0" width={spec.width} height={spec.depth} fill="var(--color-bg)" stroke="var(--color-line)" strokeWidth="0.08" />
      <rect x={half - 1.7} y={spec.depth - 0.12} width={3.4} height="0.18" fill="var(--color-amber)" />
      <text x={half} y={spec.depth + 0.42} textAnchor="middle" dominantBaseline="middle" fill="var(--color-amber)" fontSize="0.34" fontFamily="Outfit, sans-serif">
        STREET
      </text>
      {props.map((box) => {
        const w = Math.max(0.05, box.maxX - box.minX);
        const h = Math.max(0.05, box.maxZ - box.minZ);
        const label = PLAN_LABEL[box.kind];
        return (
          <g key={box.id}>
            <rect x={sx(box.minX)} y={sy(box.maxZ)} width={w} height={h} fill={PLAN_FILL[box.kind] ?? "var(--color-surface)"} opacity={box.kind === "bay" ? 1 : 0.85} />
            {label && w > 1.05 && h > 0.55 ? (
              <text
                x={sx(box.minX) + w / 2}
                y={sy(box.maxZ) + h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--color-fg)"
                fontSize={Math.min(0.42, w / (label.length + 1))}
                fontFamily="Outfit, sans-serif"
              >
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
