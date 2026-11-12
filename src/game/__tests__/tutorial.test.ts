import { describe, it, expect } from "vitest";
import { cardInfo } from "../engine";
import { createTutorialState, applyTutorialAction } from "../tutorial";
const info = (step: number, index: number) => {
  const s = createTutorialState(step);
  return cardInfo(s.hands[0][index], s.hands[0], s.lines, s.mode);
};
describe("기획서 부록 C 연습 판", () => {
  it("방향과 가장 가까운 라인", () => {
    let s = createTutorialState(0);
    expect(info(0, 0).targets).toEqual([0]);
    s = applyTutorialAction(s, { type: "play", index: 0, line: 0 }).state;
    expect(
      cardInfo(s.hands[0][0], s.hands[0], s.lines, s.mode).targets,
    ).toEqual([1]);
    expect(info(1, 0).legalLines).toEqual([0, 1, 2, 3]);
    expect(info(1, 0).targets).toEqual([1]);
  });
  it("끝음 반사와 폭발", () => {
    let s = createTutorialState(2);
    expect(info(2, 0).explodes).toBe(true);
    s = applyTutorialAction(s, { type: "play", index: 1, line: 2 }).state;
    expect(s.lines[2].dir).toBe("down");
    expect(
      cardInfo(s.hands[0][0], s.hands[0], s.lines, s.mode).targets,
    ).toEqual([0]);
    s = applyTutorialAction(s, {
      type: "play",
      index: 0,
      line: 0,
      dir: "up",
    }).state;
    expect(s.piles[0]).toHaveLength(5);
  });
  it("뽑기와 후보 라인", () => {
    let s = createTutorialState(3);
    expect(info(3, 0).playable).toBe(false);
    s = applyTutorialAction(s, { type: "draw" }).state;
    expect(s.phase).toBe("afterDraw");
    expect(
      cardInfo(s.hands[0][1], s.hands[0], s.lines, s.mode).targets,
    ).toEqual([2, 3]);
    s = applyTutorialAction(s, { type: "play", index: 1, line: 2 }).state;
    expect(s.lines[2].dir).toBe("up");
  });
  it("스케일은 카드 색과 다를 수 있음", () => {
    expect(info(4, 0).targets).toEqual([0]);
    expect(info(4, 1).playable).toBe(false);
    expect(info(4, 2).targets).toEqual([0]);
  });
  it("전조의 스케일 선택", () => {
    expect(info(5, 0).playable).toBe(false);
    expect(info(5, 1).playable).toBe(true);
    for (const scale of ["B", "G", "Y"] as const) {
      const s = applyTutorialAction(createTutorialState(5), {
        type: "play",
        index: 1,
        line: 0,
        scale,
      }).state;
      expect(
        cardInfo(s.hands[0][0], s.hands[0], s.lines, s.mode).playable,
      ).toBe(scale !== "Y");
    }
  });
});
