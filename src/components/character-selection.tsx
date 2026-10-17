import { ArrowLeft, ArrowRight, RotateCw, Footprints } from "lucide-react";
import { PLAYABLES, playableById } from "@/game/roster";

type Props = {
  selected: string;
  ready: boolean;
  error: string;
  onSelect: (id: string) => void;
  onStart: () => void;
  onPreview: (action: "turn" | "pose") => void;
};

export function CharacterSelection({
  selected,
  ready,
  error,
  onSelect,
  onStart,
  onPreview,
}: Props) {
  const hero = playableById(selected);
  const index = PLAYABLES.indexOf(hero);
  const next = (dir: number) =>
    onSelect(PLAYABLES[(index + dir + PLAYABLES.length) % PLAYABLES.length]!.id);
  return (
    <section className="character-select" aria-label="Choose your character">
      <header className="character-masthead">
        <span className="font-display text-3xl tracking-wide">BROOKRIVER</span>
        <span className="text-xs tracking-widest text-muted">YOUR CITY. YOUR NAME.</span>
      </header>
      <div className="character-stage-label" aria-hidden="true">
        <span className="font-display text-7xl leading-none tracking-wide">{hero.brand}</span>
        <span className="mt-1 text-xs tracking-widest text-muted">
          {String(index + 1).padStart(2, "0")} / {String(PLAYABLES.length).padStart(2, "0")} · IN-GAME MODEL
        </span>
      </div>
      <div className="character-preview-tools">
        <button type="button" onClick={() => onPreview("turn")} aria-label="Turn character">
          <RotateCw size={16} /> Turn
        </button>
        <button type="button" onClick={() => onPreview("pose")} aria-label="Toggle walking preview">
          <Footprints size={16} /> Walk / idle
        </button>
      </div>
      <div className="character-sheet">
        <p className="text-xs tracking-widest text-amber">CHOOSE WHO YOU BECOME</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h1 className="font-display text-6xl leading-none sm:text-7xl">{hero.name}</h1>
          <div className="flex gap-1">
            <button
              className="character-arrow"
              aria-label="Previous character"
              onClick={() => next(-1)}
            >
              <ArrowLeft size={18} />
            </button>
            <button className="character-arrow" aria-label="Next character" onClick={() => next(1)}>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
        <p className="mt-1 text-lg text-amber">{hero.tagline}</p>
        <p className="mt-2 text-xs tracking-wide text-muted">
          {hero.age} · {hero.body}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg">{hero.fashion}</p>
        <div className="character-biography" key={hero.id}>
          <p className="mt-3 text-sm leading-relaxed text-muted">{hero.story}</p>
          <p className="mt-3 text-sm leading-relaxed text-fg">{hero.personality}</p>
          <p className="mt-3 border-l-2 border-amber pl-3 text-sm italic text-fg">“{hero.quote}”</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            <span className="text-amber">VOICE DIRECTION</span> · {hero.voice}
          </p>
        </div>
        <details className="character-bio-mobile">
          <summary>Their story, personality & voice</summary>
          <p className="mt-2 text-sm leading-relaxed text-muted">{hero.story}</p>
          <p className="mt-2 text-sm leading-relaxed">{hero.personality}</p>
          <p className="mt-2 text-sm italic">“{hero.quote}”</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">Voice direction: {hero.voice}</p>
        </details>
        <div
          className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted"
          aria-label="Personality traits"
        >
          {hero.traits.map((trait) => (
            <span key={trait}>{trait}</span>
          ))}
        </div>
        <div className="character-roster" role="group" aria-label="Playable characters">
          {PLAYABLES.map((p, i) => (
            <button
              type="button"
              key={p.id}
              onClick={() => onSelect(p.id)}
              aria-pressed={p.id === hero.id}
              aria-label={`Choose ${p.name}`}
            >
              <span className="text-xs text-muted">
                0{i + 1} / {p.brand}
              </span>
              <span className="font-display text-2xl leading-none">{p.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
        <div className="character-start mt-4 flex items-center gap-4">
          <button
            id="start-game"
            type="button"
            onClick={onStart}
            disabled={!ready || !!error}
            className="min-h-12 bg-amber px-10 font-display text-3xl tracking-wide text-bg disabled:opacity-50"
          >
            Start
          </button>
          <p role="status" className="text-xs leading-relaxed text-muted">
            {ready
              ? `Play as ${hero.name.split(" ")[0]}. Choice saved on this device.`
              : "Preparing the cast…"}
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Same abilities. Your identity, your story. Change characters here between sessions.
          <span className="hidden sm:inline"> Controller: LB / RB choose · A starts.</span>
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-blood">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
