import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyAction,
  buildDeck,
  cardFromString,
  cardInfo,
  cardToString,
  roundScores,
  squeak,
  SCALE_NOTES,
  type Action,
  type Card,
  type Dir,
  type Mode,
  type Phase,
  type RoundState,
  type Scale,
} from "../engine";

interface SerializedState {
  mode?: Mode;
  current: number;
  phase: Phase;
  endReason: "wentOut" | "deckOut" | null;
  lines: { dir: Dir; scale: Scale; cards: string[] }[];
  hands: string[][];
  piles: string[][];
  discard: string[];
  deck?: string[];
  deckCount?: number;
  scores?: number[];
}
interface RecordedAction {
  type: "draw" | "play";
  card?: string;
  index?: number;
  line?: number;
  dir?: Dir;
  scale?: Scale;
}
interface RecordedStep {
  action: RecordedAction;
  illegal?: boolean;
  post?: SerializedState;
}
interface Sequence {
  id: string;
  title?: string;
  initial: SerializedState;
  steps: RecordedStep[];
  endReason?: string;
  scores?: number[];
}
interface Placement {
  id: string;
  mode: Mode;
  lines: SerializedState["lines"];
  hand: string[];
  expect: ReturnType<typeof cardInfo>[];
  mustDraw: boolean;
}
const golden = JSON.parse(
  readFileSync(
    new URL("../../../docs/updown_golden_v1.json", import.meta.url),
    "utf8",
  ),
) as { scenarios: Sequence[]; placement: Placement[]; replays: Sequence[] };
function decode(s: SerializedState): RoundState {
  return {
    mode: s.mode!,
    current: s.current,
    phase: s.phase,
    endReason: s.endReason,
    lines: s.lines.map((l) => ({
      ...l,
      cards: l.cards.map(
        (c) => cardFromString(c) as Extract<Card, { kind: "P" }>,
      ),
    })),
    hands: s.hands.map((h) => h.map(cardFromString)),
    piles: s.piles.map((h) =>
      h.map((c) => cardFromString(c) as Extract<Card, { kind: "P" }>),
    ),
    deck: (s.deck ?? []).map(cardFromString),
    discard: s.discard.map(cardFromString),
  };
}
function sorted(cards: Card[]) {
  return cards.map(cardToString).sort();
}
function compare(actual: RoundState, expected: SerializedState) {
  expect(actual.current).toBe(expected.current);
  expect(actual.phase).toBe(expected.phase);
  expect(actual.endReason).toBe(expected.endReason);
  if (expected.mode) expect(actual.mode).toBe(expected.mode);
  expect(
    actual.lines.map((l) => ({ ...l, cards: l.cards.map(cardToString) })),
  ).toEqual(expected.lines);
  expect(actual.hands.map(sorted)).toEqual(
    expected.hands.map((h) => h.slice().sort()),
  );
  expect(actual.piles.map(sorted)).toEqual(
    expected.piles.map((h) => h.slice().sort()),
  );
  expect(sorted(actual.discard)).toEqual(expected.discard.slice().sort());
  if (expected.deck)
    expect(actual.deck.map(cardToString)).toEqual(expected.deck);
  if (expected.deckCount !== undefined)
    expect(actual.deck.length).toBe(expected.deckCount);
  if (expected.scores) expect(roundScores(actual)).toEqual(expected.scores);
}
function resolve(state: RoundState, input: RecordedAction): Action {
  if (input.type === "draw") return { type: "draw" };
  const index = state.hands[state.current].findIndex(
    (c) => cardToString(c) === input.card,
  );
  expect(
    index,
    `행동 카드 ${input.card}가 손패에 있어야 합니다`,
  ).toBeGreaterThanOrEqual(0);
  return { ...input, type: "play", index };
}
function replay(sequence: Sequence) {
  let state = decode(sequence.initial);
  for (const [i, step] of sequence.steps.entries()) {
    const before = JSON.stringify(state);
    const action = resolve(state, step.action);
    if (step.illegal) {
      expect(
        () => applyAction(state, action),
        `${sequence.id} 단계 ${i + 1}`,
      ).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    } else {
      state = applyAction(state, action).state;
      compare(state, step.post!);
    }
  }
  if (sequence.endReason) expect(state.endReason).toBe(sequence.endReason);
  if (sequence.scores) expect(roundScores(state)).toEqual(sequence.scores);
}
describe("기준 카드 구성", () => {
  it("기본 92장, 초급 60장, 삑점 합 90과 색별 숫자", () => {
    expect(buildDeck("basic")).toHaveLength(92);
    const deck = buildDeck("beginner");
    expect(deck).toHaveLength(60);
    expect(
      deck.reduce((n, c) => n + (c.kind === "P" ? squeak(c.n) : 0), 0),
    ).toBe(90);
    const numbers: Record<Scale, number[]> = {
      R: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24],
      B: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24],
      G: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21, 22, 24],
      Y: [0, 2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21, 22, 24],
    };
    expect(SCALE_NOTES).toEqual(numbers);
  });
  it("정답 자료 세 묶음의 전체 수량", () => {
    expect(golden.scenarios).toHaveLength(15);
    expect(golden.scenarios.reduce((n, x) => n + x.steps.length, 0)).toBe(39);
    expect(golden.placement).toHaveLength(374);
    expect(golden.replays).toHaveLength(14);
    expect(golden.replays.reduce((n, x) => n + x.steps.length, 0)).toBe(562);
  });
});
describe("시나리오 15개 / 39단계", () => {
  for (const row of golden.scenarios)
    it(`${row.id} ${row.title}`, () => replay(row));
});
describe("배치 374건 / 카드별 2253판정", () => {
  for (const row of golden.placement)
    it(row.id, () => {
      const lines = decode({
        mode: row.mode,
        current: 0,
        phase: "play",
        endReason: null,
        lines: row.lines,
        hands: [row.hand],
        piles: [[]],
        deck: [],
        discard: [],
      }).lines;
      const hand = row.hand.map(cardFromString);
      const result = hand.map((c) => cardInfo(c, hand, lines, row.mode));
      expect(result).toEqual(row.expect);
      expect(result.every((x) => !x.playable)).toBe(row.mustDraw);
    });
});
describe("전체 재생 14판 / 562단계", () => {
  for (const row of golden.replays) it(row.id, () => replay(row));
});
