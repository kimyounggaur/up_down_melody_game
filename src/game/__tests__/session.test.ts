import { describe, expect, it } from "vitest";
import { Card, DEFAULT_CONFIG, RoundState, cardFromString } from "../engine";
import {
  DEFAULT_SETTINGS,
  GameSession,
  GameSettings,
  advanceRound,
  createSession,
  declareSolo,
  expireSolo,
  rankings,
  runAiTurn,
  sessionAction,
  tickTimer,
} from "../session";

function settings(overrides: Partial<GameSettings> = {}): GameSettings {
  return { ...DEFAULT_SETTINGS, config: DEFAULT_CONFIG, ...overrides };
}
function soloFixture(autoSolo = false): GameSession {
  const s = createSession(
    settings({ mode: "basic", opponents: 1, autoSolo }),
    42,
    0,
  );
  const cards = (names: string[]): Card[] => names.map(cardFromString);
  const round: RoundState = {
    mode: "basic",
    current: 0,
    phase: "play",
    endReason: null,
    lines: [
      { dir: "up", scale: "R", cards: [{ kind: "P", color: "R", n: 0 }] },
      { dir: "down", scale: "B", cards: [{ kind: "P", color: "B", n: 10 }] },
      { dir: "up", scale: "G", cards: [{ kind: "P", color: "G", n: 22 }] },
      { dir: "down", scale: "Y", cards: [{ kind: "P", color: "Y", n: 2 }] },
    ],
    hands: [cards(["R2", "R4"]), cards(["B3", "B5"])],
    piles: [[], []],
    deck: cards(["Y5", "G7", "R9"]),
    discard: [],
  };
  return { ...s, round, startPlayer: 0 };
}
function finishRound(initial: GameSession): GameSession {
  let s = initial;
  for (let actions = 0; actions < 1000 && s.status === "playing"; actions++) {
    if (s.soloPending) s = declareSolo(s);
    else s = runAiTurn(s, 0);
  }
  expect(s.status).toBe("roundResult");
  return s;
}

describe("game session", () => {
  it("finishes three rounds, rotates first seat, and sums scores exactly once", () => {
    let s = createSession(settings({ mode: "basic", opponents: 3 }), 137, 0);
    s = { ...s, seats: s.seats.map((seat) => ({ ...seat, isHuman: false })) };
    const first = s.startPlayer;
    for (let i = 0; i < 3; i++) {
      expect(s.startPlayer).toBe((first + i) % 4);
      expect(s.roundIndex).toBe(i);
      s = finishRound(s);
      expect(s.rounds).toHaveLength(i + 1);
      expect(tickTimer(s, 0).totals).toEqual(s.totals);
      s = advanceRound(s, 0);
    }
    expect(s.status).toBe("gameResult");
    expect(s.totals).toEqual(
      s.totals.map((_, p) => s.rounds.reduce((sum, r) => sum + r.scores[p], 0)),
    );
    expect(advanceRound(s)).toBe(s);
  });
  it("blocks actions until a human declares solo, then continues without penalty", () => {
    const before = soloFixture();
    const s = sessionAction(before, { type: "play", index: 0, line: 0 }, 100);
    expect(s.soloPending).toEqual({ player: 0, expiresAt: 3100 });
    expect(() => sessionAction(s, { type: "draw" }, 101)).toThrow();
    expect(runAiTurn(s, 102)).toBe(s);
    expect(declareSolo(s).soloPending).toBeNull();
    expect(declareSolo(s).round.hands[0]).toHaveLength(1);
    expect(before.round.hands[0]).toHaveLength(2);
  });
  it("draws two only at the deadline and auto-solo does not create a pending declaration", () => {
    const s = sessionAction(
      soloFixture(),
      { type: "play", index: 0, line: 0 },
      100,
    );
    expect(expireSolo(s, 3099).round.hands[0]).toHaveLength(1);
    const expired = expireSolo(s, 3100);
    expect(expired.round.hands[0]).toHaveLength(3);
    expect(expired.round.deck).toHaveLength(1);
    expect(expired.soloPending).toBeNull();
    const auto = sessionAction(
      soloFixture(true),
      { type: "play", index: 0, line: 0 },
      100,
    );
    expect(auto.soloPending).toBeNull();
    expect(expireSolo(auto, 5000).round.hands[0]).toHaveLength(1);
  });
  it("rejects a solo declaration at or after its deadline even before the UI timer fires", () => {
    const s = sessionAction(
      soloFixture(),
      { type: "play", index: 0, line: 0 },
      100,
    );
    expect(declareSolo(s, 3099).round.hands[0]).toHaveLength(1);
    expect(declareSolo(s, 3100).round.hands[0]).toHaveLength(3);
    expect(declareSolo(s, 9000).soloPending).toBeNull();
  });
  it("ends a round after solo penalty exhausts the deck", () => {
    const before = soloFixture();
    before.round.deck = [cardFromString("G7")];
    const s = sessionAction(before, { type: "play", index: 0, line: 0 }, 0);
    const expired = expireSolo(s, 3000);
    expect(expired.round.endReason).toBe("deckOut");
    expect(expired.status).toBe("roundResult");
    expect(expired.rounds).toHaveLength(1);
    expect(expired.totals).toEqual(expired.rounds[0].scores);
  });
  it("uses taken-card count as the tie-breaker and supports a shared victory", () => {
    const s = createSession(settings({ opponents: 3 }), 3, 0);
    s.totals = [7, 7, 7, 10];
    s.rounds = [
      {
        scores: [7, 7, 7, 10],
        pileScores: [0, 0, 0, 0],
        handScores: [7, 7, 7, 10],
        endReason: "wentOut",
        pileCounts: [5, 0, 0, 0],
      },
    ];
    const ranked = rankings(s);
    expect(ranked.map((r) => [r.player, r.rank])).toEqual([
      [1, 1],
      [2, 1],
      [0, 3],
      [3, 4],
    ]);
    expect(ranked.filter((r) => r.winner).map((r) => r.player)).toEqual([1, 2]);
  });
  it("round trips through JSON and continues with identical randomness", () => {
    let a = createSession(settings({ mode: "basic" }), 41, 20);
    a = runAiTurn(a, 25);
    const b = JSON.parse(JSON.stringify(a)) as GameSession;
    expect(b).toEqual(a);
    expect(runAiTurn(a, 26)).toEqual(runAiTurn(b, 26));
    const result = finishRound(a);
    expect(advanceRound(result, 0)).toEqual(
      advanceRound(JSON.parse(JSON.stringify(result)), 0),
    );
  });
  it("finishes the current round after the classroom timer and never opens another", () => {
    let s = createSession(
      settings({ timerMinutes: 10, classroom: true }),
      65,
      100,
    );
    expect(s.timerEndsAt).toBe(600100);
    s = tickTimer(s, 600100);
    expect(s.timerExpired).toBe(true);
    expect(s.status).toBe("playing");
    s = finishRound(s);
    s = advanceRound(s, 600101);
    expect(s.status).toBe("gameResult");
    expect(s.rounds).toHaveLength(1);
    expect(s.roundIndex).toBe(0);
  });
  it("honors configured special-card scoring and initial hand sizes", () => {
    const config = {
      handSize: { beginner: 7, basic: 7 },
      specialPoints: { REV: 5, REST: 5, PLUS2: 5, WILD: 8, WILD4: 12 },
    };
    const s = createSession(settings({ mode: "basic", config }), 77, 0);
    expect(s.round.hands.every((h) => h.length === 7)).toBe(true);
    expect(s.settings.config.specialPoints.WILD4).toBe(12);
  });
});
