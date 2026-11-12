import {
  type Action,
  type Card,
  type CardInfo,
  type Dir,
  type Line,
  type Mode,
  type Phase,
  type Rng,
  type RoundState,
  type RuleConfig,
  DEFAULT_CONFIG,
  SCALES,
  cardInfo,
  cardPoints,
  fits,
  squeak,
} from "./engine";

export type AiLevel = "easy" | "normal" | "hard";
/** The complete AI input deliberately excludes opponents' cards and deck contents. */
export interface PublicView {
  mode: Mode;
  lines: Line[];
  hand: Card[];
  handCounts: number[];
  pileScores: number[];
  current: number;
  phase: Phase;
}

export function asAiView(
  state: RoundState,
  config: RuleConfig = DEFAULT_CONFIG,
): PublicView {
  return {
    mode: state.mode,
    lines: state.lines.map((line) => ({
      ...line,
      cards: line.cards.map((card) => ({ ...card })),
    })),
    hand: state.hands[state.current].map((card) => ({ ...card })),
    handCounts: state.hands.map((hand) => hand.length),
    pileScores: state.piles.map((pile) =>
      pile.reduce(
        (total, card) => total + cardPoints(card, state.mode, config),
        0,
      ),
    ),
    current: state.current,
    phase: state.phase,
  };
}

function pick<T>(items: T[], rng: Rng): T {
  if (items.length === 0) throw new Error("AI 선택 후보가 없습니다.");
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}
function maxPool<T>(items: T[], score: (item: T) => number): T[] {
  const best = Math.max(...items.map(score));
  return items.filter((item) => score(item) === best);
}
function effectiveDirection(line: Line, direction: Dir): Dir {
  const last = line.cards[line.cards.length - 1].n;
  return last === 0 ? "up" : last === 24 ? "down" : direction;
}

/** All choices use this AI's hand and the public board only (spec 8.1–8.3). */
export function chooseAiAction(
  view: PublicView,
  requestedLevel: AiLevel,
  rng: Rng,
  config: RuleConfig = DEFAULT_CONFIG,
): Action {
  if (view.phase === "over")
    throw new Error("끝난 라운드에서는 AI가 행동할 수 없습니다.");
  const level =
    view.mode === "beginner" && requestedLevel === "hard"
      ? "normal"
      : requestedLevel;
  const { hand, lines, mode } = view;
  const infos = hand.map((card) => cardInfo(card, hand, lines, mode));
  const playable =
    view.phase === "afterDraw"
      ? [hand.length - 1]
      : hand.map((_, index) => index).filter((index) => infos[index].playable);
  if (playable.length === 0) return { type: "draw" };
  let index: number;
  let forcedLine: number | undefined;
  if (level === "easy" || view.phase === "afterDraw") {
    index = pick(playable, rng);
  } else {
    const free = playable.filter((i) => !infos[i].explodes);
    if (free.length === 0) {
      const pairs = playable.flatMap((i) =>
        (infos[i].targets ?? []).map((line) => ({ index: i, line })),
      );
      const cheapest = maxPool(
        pairs,
        (pair) =>
          -lines[pair.line].cards.reduce(
            (sum, card) => sum + cardPoints(card, mode, config),
            0,
          ),
      );
      const selected = pick(cheapest, rng);
      index = selected.index;
      forcedLine = selected.line;
    } else if (level === "normal") {
      index = pick(free, rng);
    } else {
      const next = (view.current + 1) % view.handCounts.length;
      const nextNearOut = view.handCounts[next] <= 2;
      const opponentNearOut = view.handCounts.some(
        (count, player) => player !== view.current && count <= 2,
      );
      const attacks = ["WILD4", "PLUS2", "REST"] as const;
      const attackKind = nextNearOut
        ? attacks.find((kind) => free.some((i) => hand[i].kind === kind))
        : undefined;
      const special = free.filter((i) => hand[i].kind !== "P");
      const pitch = free.filter((i) => hand[i].kind === "P");
      if (attackKind) {
        index = pick(
          free.filter((i) => hand[i].kind === attackKind),
          rng,
        );
      } else if (opponentNearOut && special.length > 0) {
        index = pick(
          maxPool(special, (i) => cardPoints(hand[i], mode, config)),
          rng,
        );
      } else if (pitch.length > 0) {
        index = pick(
          maxPool(pitch, (i) =>
            squeak((hand[i] as Extract<Card, { kind: "P" }>).n),
          ),
          rng,
        );
      } else {
        const priority = { REST: 0, PLUS2: 0, REV: 1, WILD4: 2, WILD: 3, P: 4 };
        index = pick(
          maxPool(special, (i) => -priority[hand[i].kind]),
          rng,
        );
      }
    }
  }
  const card = hand[index];
  const info: CardInfo = infos[index];
  const action: Extract<Action, { type: "play" }> = { type: "play", index };
  if (card.kind === "P") {
    action.line = forcedLine ?? pick(info.targets ?? [], rng);
    if (info.explodes) {
      if (card.n === 0 || card.n === 24) {
        action.dir = card.n === 0 ? "up" : "down";
      } else if (level === "easy") {
        action.dir = pick<Dir>(["up", "down"], rng);
      } else {
        const remaining = hand.filter(
          (candidate, i) => i !== index && candidate.kind === "P",
        );
        const counts = (["up", "down"] as Dir[]).map(
          (dir) =>
            remaining.filter(
              (candidate) =>
                candidate.kind === "P" &&
                fits(
                  candidate,
                  { cards: [card], scale: card.color, dir },
                  mode,
                ),
            ).length,
        );
        action.dir =
          counts[0] === counts[1]
            ? card.n <= 12
              ? "up"
              : "down"
            : counts[0] > counts[1]
              ? "up"
              : "down";
      }
    }
  } else if (card.kind === "REV") {
    const candidates = lines
      .map((_, i) => i)
      .filter((i) => lines[i].scale === card.color);
    action.line =
      level === "easy"
        ? pick(candidates, rng)
        : pick(
            maxPool(candidates, (i) => {
              const line = lines[i];
              const reversed: Line = {
                ...line,
                dir: effectiveDirection(
                  line,
                  line.dir === "up" ? "down" : "up",
                ),
              };
              const pitches = hand.filter(
                (candidate) => candidate.kind === "P",
              );
              return (
                pitches.filter(
                  (candidate) =>
                    candidate.kind === "P" && fits(candidate, reversed, mode),
                ).length -
                pitches.filter(
                  (candidate) =>
                    candidate.kind === "P" && fits(candidate, line, mode),
                ).length
              );
            }),
            rng,
          );
  } else if (card.kind === "WILD" || card.kind === "WILD4") {
    if (level === "easy") {
      action.line = Math.floor(rng() * lines.length);
      action.scale = pick(
        SCALES.filter((color) => color !== lines[action.line!].scale),
        rng,
      );
    } else {
      const combinations = lines.flatMap((line, i) =>
        SCALES.filter((scale) => scale !== line.scale).map((scale) => ({
          line: i,
          scale,
        })),
      );
      const chosen = pick(
        maxPool(combinations, (pair) => {
          const line: Line = { ...lines[pair.line], scale: pair.scale };
          return (
            hand.filter(
              (candidate) =>
                candidate.kind === "P" && fits(candidate, line, mode),
            ).length * (line.cards.length >= 5 ? 0.3 : 1)
          );
        }),
        rng,
      );
      action.line = chosen.line;
      action.scale = chosen.scale;
    }
  }
  return action;
}
