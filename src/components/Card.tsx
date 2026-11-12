"use client";
import { Card as CardType, Mode, squeak } from "@/game/engine";
import { SCALE_META, SPECIAL_META, noteName } from "@/game/display";
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <img
      className="asset-icon"
      src={`/assets/svg/icons/${name}.svg`}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  );
}
export default function Card({
  card,
  mode,
  small = false,
  selected = false,
  dim = false,
  danger = false,
  notation = "solfege",
  onClick,
}: {
  card: CardType;
  mode: Mode;
  small?: boolean;
  selected?: boolean;
  dim?: boolean;
  danger?: boolean;
  notation?: string;
  onClick?: () => void;
}) {
  const color =
    mode === "beginner"
      ? "neutral"
      : "color" in card
        ? SCALE_META[card.color].file
        : "neutral";
  const label =
    card.kind === "P"
      ? `${card.n}, ${noteName(card.n)}, ${mode === "basic" ? squeak(card.n) + "삑점" : ""}`
      : SPECIAL_META[card.kind].name;
  return (
    <button
      type="button"
      className={`music-card ${small ? "small" : ""} ${selected ? "selected" : ""} ${dim ? "dim" : ""} ${danger ? "danger" : ""}`}
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      style={{ backgroundImage: `url(/assets/svg/cards/front_${color}.svg)` }}
    >
      {card.kind === "P" ? (
        <>
          <strong>{card.n}</strong>
          <span className="card-note">{noteName(card.n, notation)}</span>
          {mode === "basic" && (
            <span className="pips">{"•".repeat(squeak(card.n))}</span>
          )}
        </>
      ) : (
        <>
          <span className="special-symbol">
            <Icon name={SPECIAL_META[card.kind].icon} size={small ? 22 : 30} />
          </span>
          <span className="special-name">{SPECIAL_META[card.kind].name}</span>
        </>
      )}
      {danger && <span className="danger-dot">!</span>}
    </button>
  );
}
