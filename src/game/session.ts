import {
  Action,
  DEFAULT_CONFIG,
  GameEvent,
  IllegalActionError,
  Mode,
  Rng,
  RoundState,
  RuleConfig,
  Scale,
  applyAction,
  applySoloPenalty,
  cardPoints,
  makeRng,
  newRound,
  roundScores,
} from "./engine";
import { asAiView, chooseAiAction } from "./ai";

export type AiLevel = "easy" | "normal" | "hard";
export interface Seat {
  name: string;
  isHuman: boolean;
  ai?: AiLevel;
}
export interface GameSettings {
  mode: Mode;
  opponents: 1 | 2 | 3;
  aiLevel: AiLevel;
  rounds: 1 | 3 | 5;
  autoSolo: boolean;
  soloSeconds: number;
  timerMinutes: 0 | 10 | 15 | 20;
  config: RuleConfig;
  classroom?: boolean;
}
export interface ExplosionRecord {
  /** Zero-based round number. */
  round: number;
  player: number;
  notes: number[];
  scale: Scale;
  penalty: number;
}
export interface RoundSummary {
  scores: number[];
  pileScores: number[];
  handScores: number[];
  endReason: "wentOut" | "deckOut";
  pileCounts: number[];
}
export interface SessionStats {
  placed: number[];
  sequential: number[];
  maxLeap: number[];
}
export interface GameSession {
  id: string;
  seed: number;
  rngStep: number;
  settings: GameSettings;
  seats: Seat[];
  roundIndex: number;
  startPlayer: number;
  round: RoundState;
  totals: number[];
  rounds: RoundSummary[];
  explosions: ExplosionRecord[];
  status: "playing" | "roundResult" | "gameResult";
  timerEndsAt: number | null;
  timerExpired: boolean;
  soloPending: { player: number; expiresAt: number } | null;
  events: GameEvent[];
  eventId: number;
  stats: SessionStats;
}
export const DEFAULT_SETTINGS: GameSettings = {
  mode: "beginner",
  opponents: 2,
  aiLevel: "normal",
  rounds: 3,
  autoSolo: true,
  soloSeconds: 3,
  timerMinutes: 0,
  config: structuredConfig(DEFAULT_CONFIG),
};

function structuredConfig(config: RuleConfig): RuleConfig {
  return {
    handSize: { ...config.handSize },
    specialPoints: { ...config.specialPoints },
  };
}
function withRng(seed: number, step = 0): { rng: Rng; count: () => number } {
  const base = makeRng(seed);
  for (let i = 0; i < step; i++) base();
  let calls = step;
  return {
    rng: () => {
      calls++;
      return base();
    },
    count: () => calls,
  };
}
function settingsCopy(settings: GameSettings): GameSettings {
  return {
    ...settings,
    aiLevel:
      settings.mode === "beginner" && settings.aiLevel === "hard"
        ? "normal"
        : settings.aiLevel,
    config: structuredConfig(settings.config),
  };
}

/** Build a replayable, fully serializable session. Time is always supplied externally. */
export function createSession(
  settings: GameSettings = DEFAULT_SETTINGS,
  seed = 1,
  now = 0,
): GameSession {
  const copied = settingsCopy(settings);
  const players = copied.opponents + 1;
  const random = withRng(seed);
  const startPlayer = Math.floor(random.rng() * players);
  const seats: Seat[] = [{ name: "나", isHuman: true }];
  ["도레", "미파", "솔라"]
    .slice(0, copied.opponents)
    .forEach((name) =>
      seats.push({ name, isHuman: false, ai: copied.aiLevel }),
    );
  const round = newRound(
    copied.mode,
    players,
    random.rng,
    startPlayer,
    copied.config,
  );
  return {
    id: `${now}-${seed >>> 0}`,
    seed: seed >>> 0,
    rngStep: random.count(),
    settings: copied,
    seats,
    roundIndex: 0,
    startPlayer,
    round,
    totals: Array(players).fill(0),
    rounds: [],
    explosions: [],
    status: "playing",
    timerEndsAt: copied.timerMinutes
      ? now + copied.timerMinutes * 60_000
      : null,
    timerExpired: false,
    soloPending: null,
    events: [],
    eventId: 0,
    stats: {
      placed: Array(players).fill(0),
      sequential: Array(players).fill(0),
      maxLeap: Array(players).fill(0),
    },
  };
}

function summarize(s: GameSession): GameSession {
  if (s.round.phase !== "over" || s.rounds.length > s.roundIndex) return s;
  const { round, settings } = s;
  const pileScores = round.piles.map((pile) =>
    pile.reduce(
      (sum, card) => sum + cardPoints(card, round.mode, settings.config),
      0,
    ),
  );
  const handScores = round.hands.map((hand) =>
    hand.reduce(
      (sum, card) => sum + cardPoints(card, round.mode, settings.config),
      0,
    ),
  );
  const scores = roundScores(round, settings.config);
  const summary: RoundSummary = {
    scores,
    pileScores,
    handScores,
    endReason: round.endReason ?? "deckOut",
    pileCounts: round.piles.map((pile) => pile.length),
  };
  return {
    ...s,
    status: "roundResult",
    soloPending: null,
    rounds: [...s.rounds, summary],
    totals: s.totals.map((score, p) => score + scores[p]),
  };
}

/** Update the timer flag; the active round is never interrupted. */
export function tickTimer(s: GameSession, now: number): GameSession {
  if (s.timerExpired || s.timerEndsAt === null || now < s.timerEndsAt) return s;
  return { ...s, timerExpired: true };
}

/** Apply exactly one engine action, retaining its event stream for audiovisual output. */
export function sessionAction(
  session: GameSession,
  action: Action,
  now = 0,
): GameSession {
  const s = tickTimer(session, now);
  if (s.status !== "playing")
    throw new IllegalActionError("라운드 결과를 먼저 확인해 주세요");
  if (s.soloPending) throw new IllegalActionError("솔로 선언을 먼저 해 주세요");
  const player = s.round.current;
  const oldCard =
    action.type === "play" ? s.round.hands[player][action.index] : undefined;
  const result = applyAction(s.round, action);
  const newExplosions: ExplosionRecord[] = result.events.flatMap((event) =>
    event.type === "exploded"
      ? [
          {
            round: s.roundIndex,
            player: event.player,
            notes: event.taken.map((card) => card.n),
            scale: s.round.lines[event.line].scale,
            penalty: event.penalty,
          },
        ]
      : [],
  );
  const stats: SessionStats = {
    placed: s.stats.placed.slice(),
    sequential: s.stats.sequential.slice(),
    maxLeap: s.stats.maxLeap.slice(),
  };
  if (
    oldCard?.kind === "P" &&
    action.type === "play" &&
    action.line !== undefined
  ) {
    const notes = s.round.lines[action.line].cards;
    const distance = Math.abs(oldCard.n - notes[notes.length - 1].n);
    stats.placed[player]++;
    if (distance <= 2) stats.sequential[player]++;
    stats.maxLeap[player] = Math.max(stats.maxLeap[player], distance);
  }
  let next: GameSession = {
    ...s,
    round: result.state,
    events: result.events,
    eventId: s.eventId + 1,
    explosions: [...s.explosions, ...newExplosions],
    stats,
  };
  if (
    action.type === "play" &&
    result.state.phase !== "over" &&
    result.state.hands[player].length === 1 &&
    s.seats[player].isHuman &&
    !s.settings.autoSolo
  ) {
    next = {
      ...next,
      soloPending: { player, expiresAt: now + s.settings.soloSeconds * 1000 },
    };
  }
  return summarize(next);
}

export function declareSolo(s: GameSession, now = 0): GameSession {
  if (!s.soloPending) return s;
  // A delayed UI timer must not allow a declaration after its deadline.
  if (now >= s.soloPending.expiresAt) return expireSolo(s, now);
  return { ...s, soloPending: null, events: [], eventId: s.eventId + 1 };
}

/** Penalize only after the stored deadline, including after a page reload. */
export function expireSolo(session: GameSession, now: number): GameSession {
  const s = tickTimer(session, now);
  if (!s.soloPending || now < s.soloPending.expiresAt || s.status !== "playing")
    return s;
  const result = applySoloPenalty(s.round, s.soloPending.player);
  return summarize({
    ...s,
    round: result.state,
    soloPending: null,
    events: result.events,
    eventId: s.eventId + 1,
  });
}

/** The result button either begins the next round or opens final standings. */
export function advanceRound(session: GameSession, now = 0): GameSession {
  const s = tickTimer(session, now);
  if (s.status !== "roundResult") return s;
  if (s.roundIndex + 1 >= s.settings.rounds || s.timerExpired) {
    return { ...s, status: "gameResult", events: [], eventId: s.eventId + 1 };
  }
  const random = withRng(s.seed, s.rngStep);
  const startPlayer = (s.startPlayer + 1) % s.seats.length;
  const round = newRound(
    s.settings.mode,
    s.seats.length,
    random.rng,
    startPlayer,
    s.settings.config,
  );
  return {
    ...s,
    round,
    roundIndex: s.roundIndex + 1,
    startPlayer,
    rngStep: random.count(),
    status: "playing",
    soloPending: null,
    events: [],
    eventId: s.eventId + 1,
  };
}

/** Execute one AI action. An afterDraw phase deliberately remains a separate action. */
export function runAiTurn(session: GameSession, now = 0): GameSession {
  if (session.status !== "playing" || session.soloPending) return session;
  const random = withRng(session.seed, session.rngStep);
  const level =
    session.seats[session.round.current].ai ?? session.settings.aiLevel;
  const action = chooseAiAction(
    asAiView(session.round, session.settings.config),
    level,
    random.rng,
    session.settings.config,
  );
  const next = sessionAction(session, action, now);
  return { ...next, rngStep: random.count() };
}

export interface Ranking {
  player: number;
  score: number;
  pileCount: number;
  rank: number;
  winner: boolean;
}
export function rankings(s: GameSession): Ranking[] {
  const result = s.totals
    .map((score, player) => ({
      player,
      score,
      pileCount: s.rounds.reduce(
        (sum, round) => sum + round.pileCounts[player],
        0,
      ),
      rank: 0,
      winner: false,
    }))
    .sort((a, b) => a.score - b.score || a.pileCount - b.pileCount);
  result.forEach((entry, index) => {
    const prior = result[index - 1];
    entry.rank =
      prior &&
      prior.score === entry.score &&
      prior.pileCount === entry.pileCount
        ? prior.rank
        : index + 1;
    entry.winner = entry.rank === 1;
  });
  return result;
}
