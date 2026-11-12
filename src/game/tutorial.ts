import {
  applyAction,
  cardFromString,
  type Action,
  type Line,
  type Mode,
  type RoundState,
} from "./engine";

export interface TutorialStep {
  title: string;
  subtitle: string;
  mode: Mode;
  lines: Array<[Line["dir"], string[]]>;
  hand: string[];
  deck?: string[];
  tasks: string[];
}
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "숫자가 올라가고 내려가요",
    subtitle: "상행은 더 높은 숫자, 하행은 더 낮은 숫자를 놓아요.",
    mode: "beginner",
    lines: [
      ["up", ["R5"]],
      ["down", ["B7"]],
      ["up", ["G22"]],
      ["down", ["Y2"]],
    ],
    hand: ["R9", "B3"],
    tasks: [
      "9를 고르고, 빛나는 1번 라인에 놓아 보세요.",
      "이제 3을 고르고, 2번 라인에 놓아 보세요.",
    ],
  },
  {
    title: "가장 가까운 라인을 찾아요",
    subtitle: "여러 곳에 놓을 수 있으면 숫자 차이가 가장 작은 라인으로 가요.",
    mode: "beginner",
    lines: [
      ["up", ["R5"]],
      ["up", ["G9"]],
      ["down", ["Y16"]],
      ["down", ["R21"]],
    ],
    hand: ["R12"],
    tasks: [
      "12를 골라 보세요. 네 곳 모두 가능하지만, 9와 3칸 차이인 2번 라인에 놓아요.",
    ],
  },
  {
    title: "끝에서는 반사! 여섯 번째는 폭발!",
    subtitle:
      "0은 상행, 24는 하행으로 바뀌어요. 6번째 카드를 놓으면 앞의 5장을 가져와요.",
    mode: "beginner",
    lines: [
      ["up", ["R0", "R2", "R4", "R5", "R7"]],
      ["down", ["B3"]],
      ["up", ["G22"]],
      ["down", ["Y2"]],
    ],
    hand: ["G9", "Y24"],
    tasks: [
      "9는 꽉 찬 1번 라인으로 가요. 먼저 24를 3번 라인에 놓아 방향이 바뀌는 모습을 보세요.",
      "이제 9를 놓아요. 하행 24에도 놓을 수 있지만 7이 더 가까워서 1번 라인이 터져요. 새 방향도 골라 주세요.",
    ],
  },
  {
    title: "놓을 카드가 없으면 한 장 뽑아요",
    subtitle: "뽑은 카드가 벌점 없이 놓이면 바로 내요.",
    mode: "beginner",
    lines: [
      ["up", ["R23"]],
      ["up", ["B22"]],
      ["down", ["G2"]],
      ["down", ["Y2"]],
    ],
    hand: ["R12"],
    deck: ["G0"],
    tasks: [
      "12는 놓을 곳이 없어요. 뽑기 버튼을 눌러 주세요.",
      "0이 나왔어요! 똑같이 가까운 3번 또는 4번 라인을 골라 주세요.",
    ],
  },
  {
    title: "카드 색보다 스케일을 살펴요",
    subtitle: "색이 달라도 라인의 스케일에 들어 있는 음이면 놓을 수 있어요.",
    mode: "basic",
    lines: [
      ["up", ["R14"]],
      ["up", ["B22"]],
      ["down", ["G2"]],
      ["down", ["Y2"]],
    ],
    hand: ["B19", "B15", "R16"],
    tasks: [
      "파랑 솔(19)을 빨강 장음계 라인에 놓아 보세요.",
      "이제 파랑 미♭(15)을 눌러, 왜 놓을 수 없는지 확인해요.",
      "같은 시작 판에서 다른 예를 봐요. 빨강 미(16)를 1번 라인에 놓아 보세요.",
    ],
  },
  {
    title: "전조로 스케일을 바꿔요",
    subtitle: "미♭이 들어 있는 파랑 또는 초록 스케일로 바꿔 볼까요?",
    mode: "basic",
    lines: [
      ["up", ["R14"]],
      ["up", ["B22"]],
      ["down", ["G2"]],
      ["down", ["Y2"]],
    ],
    hand: ["B15", "WILD"],
    tasks: [
      "전조 카드를 고르고 1번 라인을 누르세요. 파랑 또는 초록으로 바꿔 주세요.",
      "이제 미♭(15)을 바뀐 라인에 놓아 보세요.",
    ],
  },
  {
    title: "멜로디의 다섯 가지 변화",
    subtitle: "특수카드와 솔로, 점수까지 알면 준비 끝이에요!",
    mode: "basic",
    lines: [],
    hand: [],
    tasks: [],
  },
];

export function createTutorialState(index: number): RoundState {
  const step = TUTORIAL_STEPS[index];
  return {
    mode: step.mode,
    lines: step.lines.map(([dir, cards]) => {
      const parsed = cards.map(cardFromString);
      return {
        dir,
        scale: "color" in parsed[0] ? parsed[0].color : "R",
        cards: parsed as Line["cards"],
      };
    }),
    hands: [step.hand.map(cardFromString)],
    piles: [[]],
    deck: (step.deck ?? []).map(cardFromString),
    discard: [],
    current: 0,
    phase: "play",
    endReason: null,
  };
}

/** 연습 판은 정해진 장면만 이어갑니다. 카드 판정과 효과는 실제 엔진을 그대로 사용합니다. */
export function applyTutorialAction(state: RoundState, action: Action) {
  const applied = applyAction(state, action);
  return {
    state: {
      ...applied.state,
      current: 0,
      phase:
        applied.state.phase === "afterDraw"
          ? ("afterDraw" as const)
          : ("play" as const),
      endReason: null,
    },
    events: applied.events.filter((e) => e.type !== "roundOver"),
  };
}

export const SPECIAL_LESSONS = [
  {
    icon: "reverse",
    title: "반전",
    text: "같은 색 라인 하나의 상행과 하행을 뒤집어요. 끝음이 0이나 24면 방향은 그대로예요.",
  },
  {
    icon: "rest",
    title: "쉼표",
    text: "같은 색 라인이 있으면 낼 수 있어요. 다음 사람이 한 차례 쉬어요.",
  },
  {
    icon: "plus2",
    title: "불협 2",
    text: "같은 색 라인이 있으면 낼 수 있어요. 다음 사람이 2장을 뽑고 쉬어요. 받아넘기기는 없어요.",
  },
  {
    icon: "wild4",
    title: "폭풍 전조",
    text: "낼 수 있는 음높이 카드가 없을 때만 써요. 라인 하나의 스케일을 바꾸고 다음 사람이 4장을 뽑고 쉬어요.",
  },
  {
    icon: "solo",
    title: "솔로!",
    text: "카드를 내서 손패가 딱 1장이 되면 솔로를 눌러요. 시간을 놓치면 2장을 받아요. 초급은 자동 선언이 기본이에요.",
  },
  {
    icon: "sparkle",
    title: "삑점이 적으면 이겨요",
    text: "기본에서는 카드의 점 수를 더해요. 남은 반전·쉼표·불협 2는 3점, 전조는 5점, 폭풍 전조는 8점이에요. 초급은 카드 1장에 1점이에요.",
  },
];
