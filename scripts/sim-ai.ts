import {
  applyAction,
  makeRng,
  newRound,
  roundScores,
  type Mode,
} from "../src/game/engine";
import { asAiView, chooseAiAction, type AiLevel } from "../src/game/ai";

const rounds = Math.max(3000, Number(process.env.AI_ROUNDS ?? 3000));
const cases: {
  mode: Mode;
  level: AiLevel;
  threshold: number;
  comparison: "max" | "min";
}[] = [
  { mode: "basic", level: "easy", threshold: 18, comparison: "max" },
  { mode: "basic", level: "hard", threshold: 32, comparison: "min" },
  { mode: "beginner", level: "easy", threshold: 17, comparison: "max" },
];
let failed = false;
for (const [caseIndex, item] of cases.entries()) {
  const rng = makeRng(20261111 + caseIndex * 2971);
  let wins = 0;
  for (let r = 0; r < rounds; r++) {
    let state = newRound(item.mode, 4, rng, Math.floor(rng() * 4));
    let steps = 0;
    while (state.phase !== "over") {
      state = applyAction(
        state,
        chooseAiAction(
          asAiView(state),
          state.current === 0 ? item.level : "normal",
          rng,
        ),
      ).state;
      if (++steps > 500)
        throw new Error("AI 대전이 500행동 안에 끝나지 않았습니다.");
    }
    const scores = roundScores(state);
    const minimum = Math.min(...scores);
    if (scores[0] === minimum)
      wins += 1 / scores.filter((score) => score === minimum).length;
  }
  const rate = (wins * 100) / rounds;
  const pass =
    item.comparison === "max" ? rate <= item.threshold : rate >= item.threshold;
  failed ||= !pass;
  console.log(
    `${item.mode} / ${item.level}: ${rounds}라운드, 승률 ${rate.toFixed(2)}%, 기준 ${item.comparison === "max" ? "≤" : "≥"}${item.threshold}% ${pass ? "합격" : "실패"}`,
  );
}
console.log(failed ? "AI 승률 기준 미달" : "AI 승률 3개 기준 모두 합격");
if (failed) process.exitCode = 1;
