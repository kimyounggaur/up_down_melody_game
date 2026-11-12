import { describe, expect, it } from "vitest";
import { applyAction, buildDeck, makeRng, newRound } from "../engine";
import { asAiView, chooseAiAction, type AiLevel } from "../ai";

describe("게임용 AI", () => {
  it.each(["easy", "normal", "hard"] as AiLevel[])(
    "%s: 2000라운드에서 모든 행동이 합법적이다",
    (level) => {
      const rng = makeRng(412001);
      for (let round = 0; round < 2000; round++) {
        let state = newRound(
          round % 2 === 0 ? "basic" : "beginner",
          4,
          rng,
          round % 4,
        );
        let count = 0;
        while (state.phase !== "over") {
          state = applyAction(
            state,
            chooseAiAction(asAiView(state), level, rng),
          ).state;
          if (++count > 500) throw new Error("라운드가 종료되지 않았습니다.");
        }
        expect(state.endReason).not.toBeNull();
      }
    },
    120000,
  );
  it("공개 정보가 같으면 상대 손패와 더미가 달라도 같은 행동을 고른다", () => {
    const state = newRound("basic", 4, makeRng(9842), 0);
    const changed = {
      ...state,
      hands: state.hands.map((hand, i) =>
        i === 0
          ? hand
          : hand.map((_, index) => buildDeck("basic")[(index + 20) % 92]),
      ),
      deck: state.deck.slice().reverse(),
    };
    expect(asAiView(changed)).toEqual(asAiView(state));
    expect(chooseAiAction(asAiView(changed), "hard", makeRng(77))).toEqual(
      chooseAiAction(asAiView(state), "hard", makeRng(77)),
    );
  });
  it("초급 어려움은 보통과 같다", () => {
    const view = asAiView(newRound("beginner", 4, makeRng(351), 0));
    expect(chooseAiAction(view, "hard", makeRng(9))).toEqual(
      chooseAiAction(view, "normal", makeRng(9)),
    );
  });
});
