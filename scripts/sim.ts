import {
  simulate,
  type Mode,
  type SimResult,
  type VerifyAi,
} from "../src/game/engine";
// docs/spec.md 8.5. 기준 수치 및 허용 오차를 변경하지 않습니다.
const rows: [Mode, number, VerifyAi, number[]][] = [
  ["beginner", 2, "A", [24.69, 2.11, 33, 52.4, 13.4, 6.82]],
  ["beginner", 2, "B", [24.62, 2.08, 32.9, 52.3, 13, 6.72]],
  ["beginner", 3, "A", [28.79, 3.07, 25.5, 54, 12.1, 6.71]],
  ["beginner", 3, "B", [28.89, 3.12, 25.6, 54.2, 12.3, 6.79]],
  ["beginner", 4, "A", [32.69, 3.96, 20.1, 55, 11.7, 6.6]],
  ["beginner", 4, "B", [32.47, 3.96, 19.8, 55.8, 11, 6.6]],
  ["basic", 2, "A", [44.45, 3.35, 27.3, 42.5, 15.2, 19.77]],
  ["basic", 2, "B", [44.33, 3.23, 26.7, 42.8, 14.8, 19.13]],
  ["basic", 3, "A", [43.27, 3.53, 16.1, 46, 8.5, 16.61]],
  ["basic", 3, "B", [43.05, 3.33, 15.6, 46.9, 8.3, 15.95]],
  ["basic", 4, "A", [46.27, 4.1, 10.2, 48.3, 7.6, 16.22]],
  ["basic", 4, "B", [46.16, 3.81, 9.7, 49.1, 7.4, 15.51]],
];
const metrics: (keyof SimResult)[] = [
  "turns",
  "explosions",
  "stuckPct",
  "nearestPct",
  "deckOutPct",
  "score",
];
const labels = [
  "턴",
  "폭발",
  "뽑는 턴(%)",
  "가까운 라인(%)",
  "더미 소진(%)",
  "점수",
];
const failures: string[] = [];
for (const [i, [mode, players, ai, expected]] of rows.entries()) {
  const actual = simulate(mode, players, ai, 5000, 20261111 + i * 500);
  const tolerance = [
    players === 2 ? 2 : 1.5,
    0.2,
    2,
    2,
    3,
    players === 2 ? 0.8 : 0.5,
  ];
  console.log(
    `\n${mode === "basic" ? "기본" : "초급"} ${players}인 AI ${ai} · 5000라운드`,
  );
  console.table(
    metrics.map((metric, j) => {
      const value = actual[metric];
      const delta = value - expected[j];
      const pass = Math.abs(delta) <= tolerance[j];
      if (!pass) failures.push(`${mode}/${players}/${ai}/${metric}`);
      return {
        지표: labels[j],
        결과: +value.toFixed(3),
        기준: expected[j],
        차이: +delta.toFixed(3),
        허용: tolerance[j],
        합격: pass ? "합격" : "실패",
      };
    }),
  );
}
console.log(
  failures.length
    ? `허용 오차를 벗어난 항목: ${failures.join(", ")}`
    : "12개 조건 모두 합격",
);
if (failures.length) process.exitCode = 1;
