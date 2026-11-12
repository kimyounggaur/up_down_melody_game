/**
 * 업다운 멜로디 — 규칙 엔진 참조 구현 (보정 규칙 v1.1)
 *
 * 기획서 5장(규칙)과 6장(데이터 모델)을 그대로 옮긴 순수 함수 모음입니다.
 * 화면·소리와 무관하며, 검증 자료(updown_golden_v1.json)를 전부 통과합니다.
 * 이 파일을 출발점으로 써도 되고 구조를 바꿔도 되지만, 규칙의 뜻은 바꾸지 마세요.
 */

// ───────────────────────── 타입 ─────────────────────────
export type Scale = "R" | "B" | "G" | "Y"; // 빨강 장음계, 파랑 자연단음계, 초록 도리안, 노랑 믹솔리디안
export type Dir = "up" | "down";
export type Mode = "beginner" | "basic";
export type Phase = "play" | "afterDraw" | "over";
export type SpecialKind = "REV" | "REST" | "PLUS2" | "WILD" | "WILD4";
export type EndReason = "wentOut" | "deckOut";

export interface PitchCard {
  kind: "P";
  color: Scale;
  n: number;
}
export interface ColorSpecialCard {
  kind: "REV" | "REST" | "PLUS2";
  color: Scale;
}
export interface WildCard {
  kind: "WILD" | "WILD4";
}
export type Card = PitchCard | ColorSpecialCard | WildCard;

export interface Line {
  cards: PitchCard[];
  dir: Dir;
  scale: Scale;
}

export interface RoundState {
  mode: Mode;
  lines: Line[]; // 항상 4개
  hands: Card[][]; // 플레이어별 손패
  piles: PitchCard[][]; // 플레이어별 벌점 더미
  deck: Card[]; // deck[0]이 다음에 뽑힐 카드
  discard: Card[]; // 사용한 특수카드 (다시 쓰지 않음)
  current: number; // 현재 차례 플레이어 (0부터)
  phase: Phase;
  endReason: EndReason | null;
}

export type Action =
  | { type: "draw" }
  | { type: "play"; index: number; line?: number; dir?: Dir; scale?: Scale };

export interface CardInfo {
  playable: boolean;
  legalLines?: number[]; // 음높이 카드: 놓을 수 있는 라인 전체
  targets?: number[]; // 음높이 카드: 실제로 놓아야 하는 라인 후보(가장 가까운 라인 규칙 적용 후)
  explodes?: boolean; // 음높이 카드: 놓으면 6번째 카드가 되는가
}

export type GameEvent =
  | {
      type: "placed";
      player: number;
      card: PitchCard;
      line: number;
      from: number;
      distance: number;
    }
  | {
      type: "exploded";
      player: number;
      line: number;
      taken: PitchCard[];
      penalty: number;
      card: PitchCard;
    }
  | { type: "bounced"; line: number; dir: Dir }
  | {
      type: "special";
      player: number;
      card: Card;
      line?: number;
      scale?: Scale;
    }
  | { type: "drew"; player: number; count: number; forced: boolean }
  | { type: "skipped"; player: number }
  | { type: "roundOver"; reason: EndReason };

export interface RuleConfig {
  handSize: Record<Mode, number>;
  specialPoints: Record<SpecialKind, number>;
}

export class IllegalActionError extends Error {}

// ───────────────────────── 상수 ─────────────────────────
export const SCALES: Scale[] = ["R", "B", "G", "Y"];
export const SCALE_NOTES: Record<Scale, number[]> = {
  R: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24],
  B: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24],
  G: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21, 22, 24],
  Y: [0, 2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21, 22, 24],
};
export const LINE_CAPACITY = 5;
export const LINE_COUNT = 4;
export const DEFAULT_CONFIG: RuleConfig = {
  handSize: { beginner: 7, basic: 10 },
  specialPoints: { REV: 3, REST: 3, PLUS2: 3, WILD: 5, WILD4: 8 },
};

const SCALE_PITCH_CLASSES: Record<Scale, Set<number>> = {
  R: new Set(SCALE_NOTES.R.map((n) => n % 12)),
  B: new Set(SCALE_NOTES.B.map((n) => n % 12)),
  G: new Set(SCALE_NOTES.G.map((n) => n % 12)),
  Y: new Set(SCALE_NOTES.Y.map((n) => n % 12)),
};

// ───────────────────────── 카드 ─────────────────────────
/** 음높이 카드의 삑점. 숫자를 12로 나눈 나머지: 0→0, 3·4·7→1, 2·5·9→2, 8·10·11→3 */
export function squeak(n: number): number {
  const pc = n % 12;
  if (pc === 0) return 0;
  if (pc === 3 || pc === 4 || pc === 7) return 1;
  if (pc === 2 || pc === 5 || pc === 9) return 2;
  return 3;
}

export function cardPoints(
  card: Card,
  mode: Mode,
  config: RuleConfig = DEFAULT_CONFIG,
): number {
  if (card.kind === "P") return mode === "beginner" ? 1 : squeak(card.n);
  return config.specialPoints[card.kind];
}

/** 검증 자료와 같은 표기: 'R7', 'REV:R', 'REST:R', 'PLUS2:R', 'WILD', 'WILD4' */
export function cardToString(card: Card): string {
  if (card.kind === "P") return `${card.color}${card.n}`;
  return "color" in card ? `${card.kind}:${card.color}` : card.kind;
}

export function cardFromString(s: string): Card {
  if (s === "WILD" || s === "WILD4") return { kind: s };
  if (s.includes(":")) {
    const [kind, color] = s.split(":");
    return { kind: kind as "REV" | "REST" | "PLUS2", color: color as Scale };
  }
  return { kind: "P", color: s[0] as Scale, n: Number(s.slice(1)) };
}

export function buildDeck(mode: Mode): Card[] {
  const deck: Card[] = [];
  for (const color of SCALES)
    for (const n of SCALE_NOTES[color]) deck.push({ kind: "P", color, n });
  if (mode === "basic") {
    for (const color of SCALES) {
      for (let i = 0; i < 2; i++) {
        deck.push(
          { kind: "REV", color },
          { kind: "REST", color },
          { kind: "PLUS2", color },
        );
      }
    }
    for (let i = 0; i < 4; i++) deck.push({ kind: "WILD" });
    for (let i = 0; i < 4; i++) deck.push({ kind: "WILD4" });
  }
  return deck;
}

// ───────────────────────── 배치 판정 ─────────────────────────
function lastNote(line: Line): number {
  return line.cards[line.cards.length - 1].n;
}

/** 끝음 반사: 마지막 음이 24면 항상 하행, 0이면 항상 상행. 방향이 바뀌었으면 true */
function applyBounce(line: Line): boolean {
  const last = lastNote(line);
  const want: Dir | null = last === 24 ? "down" : last === 0 ? "up" : null;
  if (want && line.dir !== want) {
    line.dir = want;
    return true;
  }
  if (want) line.dir = want;
  return false;
}

/** 이 음높이 카드를 이 라인에 놓을 수 있는가 (라인이 꽉 찼는지는 따지지 않음) */
export function fits(card: PitchCard, line: Line, mode: Mode): boolean {
  const last = lastNote(line);
  if (line.dir === "up" ? card.n <= last : card.n >= last) return false;
  if (mode === "beginner") return true;
  const pc = card.n % 12;
  return SCALE_PITCH_CLASSES[line.scale].has(pc) || pc === last % 12;
}

export function legalLines(
  card: PitchCard,
  lines: Line[],
  mode: Mode,
): number[] {
  const out: number[] = [];
  lines.forEach((line, i) => {
    if (fits(card, line, mode)) out.push(i);
  });
  return out;
}

/** 가장 가까운 라인 규칙: 숫자 차이가 가장 작은 라인 → 동률이면 카드가 더 많은 라인 → 그래도 같으면 모두 후보 */
export function targetLines(
  card: PitchCard,
  lines: Line[],
  mode: Mode,
): { targets: number[]; legal: number[] } {
  const legal = legalLines(card, lines, mode);
  if (legal.length === 0) return { targets: [], legal };
  const dist = (i: number) => Math.abs(card.n - lastNote(lines[i]));
  const minDist = Math.min(...legal.map(dist));
  const nearest = legal.filter((i) => dist(i) === minDist);
  const maxCount = Math.max(...nearest.map((i) => lines[i].cards.length));
  return {
    targets: nearest.filter((i) => lines[i].cards.length === maxCount),
    legal,
  };
}

export function hasLegalPitch(
  hand: Card[],
  lines: Line[],
  mode: Mode,
): boolean {
  return hand.some(
    (c) => c.kind === "P" && legalLines(c, lines, mode).length > 0,
  );
}

export function cardInfo(
  card: Card,
  hand: Card[],
  lines: Line[],
  mode: Mode,
): CardInfo {
  if (card.kind === "P") {
    const { targets, legal } = targetLines(card, lines, mode);
    return {
      playable: targets.length > 0,
      legalLines: legal,
      targets,
      explodes:
        targets.length > 0 && lines[targets[0]].cards.length >= LINE_CAPACITY,
    };
  }
  if ("color" in card)
    return { playable: lines.some((l) => l.scale === card.color) }; // 반전·쉼표·불협 2: 같은 색 라인이 있어야 함
  if (card.kind === "WILD") return { playable: true }; // 전조: 언제나
  return { playable: !hasLegalPitch(hand, lines, mode) }; // 폭풍 전조: 낼 수 있는 음높이 카드가 없을 때만
}

/** 벌점 없이 낼 수 있는가 — 뽑은 카드를 바로 내는 조건 */
export function isFreePlayable(
  card: Card,
  hand: Card[],
  lines: Line[],
  mode: Mode,
): boolean {
  const info = cardInfo(card, hand, lines, mode);
  return info.playable && !info.explodes;
}

/** 현재 차례에 낼 수 있는 카드의 손패 위치. 비어 있으면 뽑아야 한다. */
export function playableIndices(state: RoundState): number[] {
  const hand = state.hands[state.current];
  if (state.phase === "over") return [];
  if (state.phase === "afterDraw") return [hand.length - 1];
  const out: number[] = [];
  hand.forEach((card, i) => {
    if (cardInfo(card, hand, state.lines, state.mode).playable) out.push(i);
  });
  return out;
}

// ───────────────────────── 라운드 진행 ─────────────────────────
export type Rng = () => number; // 0 이상 1 미만

/** 씨앗으로 같은 결과를 재현할 수 있는 난수 (mulberry32) */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newRound(
  mode: Mode,
  players: number,
  rng: Rng,
  startPlayer: number,
  config: RuleConfig = DEFAULT_CONFIG,
): RoundState {
  const deck = shuffle(buildDeck(mode), rng);
  const hands: Card[][] = Array.from({ length: players }, () => []);
  for (let k = 0; k < config.handSize[mode]; k++) {
    for (let p = 0; p < players; p++) hands[p].push(deck.shift() as Card);
  }
  const lines: Line[] = [];
  const discard: Card[] = [];
  while (lines.length < LINE_COUNT) {
    const card = deck.shift() as Card;
    if (card.kind === "P") {
      const line: Line = {
        cards: [card],
        dir: lines.length % 2 === 0 ? "up" : "down",
        scale: card.color,
      };
      applyBounce(line);
      lines.push(line);
    } else {
      discard.push(card); // 세팅 중 나온 특수카드는 이번 라운드에서 빠진다
    }
  }
  return {
    mode,
    lines,
    hands,
    piles: Array.from({ length: players }, () => []),
    deck,
    discard,
    current: startPlayer,
    phase: "play",
    endReason: null,
  };
}

function cloneState(s: RoundState): RoundState {
  return {
    mode: s.mode,
    lines: s.lines.map((l) => ({
      cards: l.cards.slice(),
      dir: l.dir,
      scale: l.scale,
    })),
    hands: s.hands.map((h) => h.slice()),
    piles: s.piles.map((p) => p.slice()),
    deck: s.deck.slice(),
    discard: s.discard.slice(),
    current: s.current,
    phase: s.phase,
    endReason: s.endReason,
  };
}

function giveCards(s: RoundState, player: number, count: number): number {
  let given = 0;
  while (given < count && s.deck.length > 0) {
    s.hands[player].push(s.deck.shift() as Card);
    given++;
  }
  return given;
}

function finishTurn(
  s: RoundState,
  player: number,
  effect: "REST" | "PLUS2" | "WILD4" | null,
  events: GameEvent[],
): void {
  const players = s.hands.length;
  const next = (player + 1) % players;
  let skip = false;
  if (effect === "REST") skip = true;
  if (effect === "PLUS2" || effect === "WILD4") {
    const count = giveCards(s, next, effect === "PLUS2" ? 2 : 4);
    events.push({ type: "drew", player: next, count, forced: true });
    skip = true;
  }
  if (s.hands[player].length === 0) {
    s.phase = "over";
    s.endReason = "wentOut";
    events.push({ type: "roundOver", reason: "wentOut" });
  } else if (s.deck.length === 0) {
    s.phase = "over";
    s.endReason = "deckOut";
    events.push({ type: "roundOver", reason: "deckOut" });
  } else {
    if (skip) events.push({ type: "skipped", player: next });
    s.current = skip ? (player + 2) % players : next;
    s.phase = "play";
  }
}

/** 행동을 적용한 새 상태와 그동안 일어난 일(연출·소리용)을 돌려준다. 규칙에 어긋나면 IllegalActionError */
export function applyAction(
  state: RoundState,
  action: Action,
): { state: RoundState; events: GameEvent[] } {
  if (state.phase === "over")
    throw new IllegalActionError("라운드가 끝났습니다");
  const s = cloneState(state);
  const events: GameEvent[] = [];
  const player = s.current;
  const hand = s.hands[player];

  if (action.type === "draw") {
    if (s.phase !== "play")
      throw new IllegalActionError("지금은 뽑을 수 없습니다");
    if (playableIndices(s).length > 0)
      throw new IllegalActionError("낼 수 있는 카드가 있으면 뽑을 수 없습니다");
    if (s.deck.length === 0)
      throw new IllegalActionError("뽑기 더미가 비었습니다");
    const card = s.deck.shift() as Card;
    hand.push(card);
    events.push({ type: "drew", player, count: 1, forced: false });
    if (isFreePlayable(card, hand, s.lines, s.mode)) {
      s.phase = "afterDraw"; // 방금 뽑은 카드를 바로 내야 한다
    } else {
      finishTurn(s, player, null, events);
    }
    return { state: s, events };
  }

  const index = action.index;
  if (!Number.isInteger(index) || index < 0 || index >= hand.length)
    throw new IllegalActionError("없는 카드입니다");
  if (s.phase === "afterDraw" && index !== hand.length - 1) {
    throw new IllegalActionError("방금 뽑은 카드만 낼 수 있습니다");
  }
  const card = hand[index];
  const info = cardInfo(card, hand, s.lines, s.mode);
  if (!info.playable) throw new IllegalActionError("낼 수 없는 카드입니다");

  let effect: "REST" | "PLUS2" | "WILD4" | null = null;
  if (card.kind === "P") {
    const li = action.line;
    if (li === undefined || !(info.targets as number[]).includes(li)) {
      throw new IllegalActionError("가장 가까운 라인에 놓아야 합니다");
    }
    const line = s.lines[li];
    if (line.cards.length >= LINE_CAPACITY) {
      // 6번째 카드: 기존 5장을 가져가고, 낸 카드가 새 라인의 첫 카드가 된다
      let dir = action.dir;
      if (card.n === 24) dir = "down";
      else if (card.n === 0) dir = "up";
      if (dir !== "up" && dir !== "down")
        throw new IllegalActionError("새 라인의 방향을 정해야 합니다");
      hand.splice(index, 1);
      const taken = line.cards;
      s.piles[player].push(...taken);
      const penalty = taken.reduce((sum, c) => sum + cardPoints(c, s.mode), 0);
      line.cards = [card];
      line.scale = card.color;
      line.dir = dir;
      events.push({ type: "exploded", player, line: li, taken, penalty, card });
    } else {
      hand.splice(index, 1);
      const from = lastNote(line);
      line.cards.push(card);
      events.push({
        type: "placed",
        player,
        card,
        line: li,
        from,
        distance: Math.abs(card.n - from),
      });
      if (applyBounce(line))
        events.push({ type: "bounced", line: li, dir: line.dir });
    }
  } else {
    if (card.kind === "REV") {
      const li = action.line;
      if (
        li === undefined ||
        !s.lines[li] ||
        s.lines[li].scale !== card.color
      ) {
        throw new IllegalActionError("같은 색 라인을 골라야 합니다");
      }
      const line = s.lines[li];
      line.dir = line.dir === "up" ? "down" : "up";
      applyBounce(line); // 마지막 음이 24·0이면 방향이 그대로 남는다
      events.push({ type: "special", player, card, line: li });
    } else if (card.kind === "WILD" || card.kind === "WILD4") {
      const li = action.line;
      const scale = action.scale;
      if (
        li === undefined ||
        !s.lines[li] ||
        scale === undefined ||
        !SCALES.includes(scale) ||
        scale === s.lines[li].scale
      ) {
        throw new IllegalActionError(
          "라인 하나와 지금과 다른 색을 골라야 합니다",
        );
      }
      s.lines[li].scale = scale;
      events.push({ type: "special", player, card, line: li, scale });
      if (card.kind === "WILD4") effect = "WILD4";
    } else {
      events.push({ type: "special", player, card });
      effect = card.kind; // REST | PLUS2
    }
    hand.splice(index, 1);
    s.discard.push(card);
  }
  finishTurn(s, player, effect, events);
  return { state: s, events };
}

/** 솔로 선언 실패: 2장 뽑는다. 더미가 바닥나면 라운드가 끝난다. */
export function applySoloPenalty(
  state: RoundState,
  player: number,
): { state: RoundState; events: GameEvent[] } {
  if (state.phase === "over") return { state, events: [] };
  const s = cloneState(state);
  const events: GameEvent[] = [];
  const count = giveCards(s, player, 2);
  events.push({ type: "drew", player, count, forced: true });
  if (s.deck.length === 0) {
    s.phase = "over";
    s.endReason = "deckOut";
    events.push({ type: "roundOver", reason: "deckOut" });
  }
  return { state: s, events };
}

/** 라운드 점수 = 벌점 더미의 점수 + 손에 남은 카드의 점수 */
export function roundScores(
  state: RoundState,
  config: RuleConfig = DEFAULT_CONFIG,
): number[] {
  return state.hands.map((hand, p) => {
    const pile = state.piles[p].reduce(
      (sum, c) => sum + cardPoints(c, state.mode, config),
      0,
    );
    const left = hand.reduce(
      (sum, c) => sum + cardPoints(c, state.mode, config),
      0,
    );
    return pile + left;
  });
}

// ───────────────────────── 검증용 AI ─────────────────────────
export type VerifyAi = "A" | "B";

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * 검증용 AI (기획서 8.4).
 * A: 낼 수 있는 카드 중 무작위. B: 벌점 없는 카드 중 무작위, 없으면 벌점이 가장 적은 폭발.
 * 라인·방향·색을 골라야 할 때는 A, B 모두 무작위.
 */
export function chooseVerifyAction(
  state: RoundState,
  rng: Rng,
  ai: VerifyAi,
): Action {
  const hand = state.hands[state.current];
  const idxs = playableIndices(state);
  if (idxs.length === 0) return { type: "draw" };
  const infos = new Map<number, CardInfo>();
  for (const i of idxs)
    infos.set(i, cardInfo(hand[i], hand, state.lines, state.mode));

  let index: number;
  let forcedLine: number | undefined;
  if (ai === "A" || state.phase === "afterDraw") {
    index = pick(idxs, rng);
  } else {
    const free = idxs.filter((i) => !(infos.get(i) as CardInfo).explodes);
    if (free.length > 0) {
      index = pick(free, rng);
    } else {
      let best = Infinity;
      let pool: Array<[number, number]> = [];
      for (const i of idxs) {
        for (const li of (infos.get(i) as CardInfo).targets as number[]) {
          const cost = state.lines[li].cards.reduce(
            (sum, c) => sum + cardPoints(c, state.mode),
            0,
          );
          if (cost < best) {
            best = cost;
            pool = [[i, li]];
          } else if (cost === best) {
            pool.push([i, li]);
          }
        }
      }
      [index, forcedLine] = pick(pool, rng);
    }
  }

  const card = hand[index];
  const action: Action = { type: "play", index };
  if (card.kind === "P") {
    const info = infos.get(index) as CardInfo;
    action.line =
      forcedLine !== undefined
        ? forcedLine
        : pick(info.targets as number[], rng);
    if (info.explodes)
      action.dir =
        card.n === 24
          ? "down"
          : card.n === 0
            ? "up"
            : pick<Dir>(["up", "down"], rng);
  } else if (card.kind === "REV") {
    const same: number[] = [];
    state.lines.forEach((l, i) => {
      if (l.scale === card.color) same.push(i);
    });
    action.line = pick(same, rng);
  } else if (card.kind === "WILD" || card.kind === "WILD4") {
    const li = Math.floor(rng() * LINE_COUNT);
    action.line = li;
    action.scale = pick(
      SCALES.filter((c) => c !== state.lines[li].scale),
      rng,
    );
  }
  return action;
}

export interface SimResult {
  rounds: number;
  turns: number; // 라운드당 평균 턴 수
  explosions: number; // 라운드당 평균 폭발 횟수
  stuckPct: number; // 낼 카드가 없어 뽑은 턴의 비율(%)
  nearestPct: number; // 놓을 수 있는 라인이 2개 이상이던 음높이 배치의 비율(%)
  deckOutPct: number; // 뽑기 더미가 바닥나서 끝난 라운드의 비율(%)
  score: number; // 플레이어 1인당 라운드 평균 점수
}

/** 검증용 AI끼리 자동 대전 (기획서 8.5의 기준 수치와 비교하는 용도) */
export function simulate(
  mode: Mode,
  players: number,
  ai: VerifyAi,
  rounds: number,
  seed: number,
): SimResult {
  const rng = makeRng(seed);
  let turns = 0;
  let stuck = 0;
  let pitchPlays = 0;
  let nearest = 0;
  let explosions = 0;
  let deckOut = 0;
  let score = 0;
  for (let r = 0; r < rounds; r++) {
    let state = newRound(mode, players, rng, Math.floor(rng() * players));
    while (state.phase !== "over") {
      if (state.phase === "play") {
        turns++;
        if (playableIndices(state).length === 0) stuck++;
      }
      const action = chooseVerifyAction(state, rng, ai);
      if (action.type === "play") {
        const hand = state.hands[state.current];
        const card = hand[action.index];
        if (card.kind === "P") {
          pitchPlays++;
          if (
            (
              cardInfo(card, hand, state.lines, state.mode)
                .legalLines as number[]
            ).length >= 2
          )
            nearest++;
        }
      }
      const result = applyAction(state, action);
      if (result.events.some((e) => e.type === "exploded")) explosions++;
      state = result.state;
    }
    if (state.endReason === "deckOut") deckOut++;
    score += roundScores(state).reduce((a, b) => a + b, 0) / players;
  }
  return {
    rounds,
    turns: turns / rounds,
    explosions: explosions / rounds,
    stuckPct: (100 * stuck) / turns,
    nearestPct: (100 * nearest) / Math.max(1, pitchPlays),
    deckOutPct: (100 * deckOut) / rounds,
    score: score / rounds,
  };
}
