import {
  Card,
  Scale,
  RoundState,
  cardInfo,
  cardToString,
  fits,
  playableIndices,
} from "./engine";
export const SCALE_META: Record<
  Scale,
  { name: string; file: string; icon: string; color: string }
> = {
  R: { name: "장음계", file: "red", icon: "sun", color: "#d64f50" },
  B: { name: "자연단음계", file: "blue", icon: "moon", color: "#4276c6" },
  G: { name: "도리안", file: "green", icon: "leaf", color: "#359066" },
  Y: {
    name: "믹솔리디안",
    file: "yellow",
    icon: "lightning",
    color: "#bb850c",
  },
};
export const SPECIAL_META = {
  REV: { name: "반전", icon: "reverse" },
  REST: { name: "쉼표", icon: "rest" },
  PLUS2: { name: "불협 2", icon: "plus2" },
  WILD: { name: "전조", icon: "wild" },
  WILD4: { name: "폭풍 전조", icon: "wild4" },
};
export function noteName(n: number, notation = "solfege") {
  if (notation === "number") return "";
  const notes =
    notation === "letters"
      ? ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"]
      : [
          "도",
          "레♭",
          "레",
          "미♭",
          "미",
          "파",
          "솔♭",
          "솔",
          "라♭",
          "라",
          "시♭",
          "시",
        ];
  return notes[n % 12];
}
export function intervalName(n: number) {
  return (
    [
      "같은 음",
      "반음",
      "온음",
      "단3도",
      "장3도",
      "완전4도",
      "증4도",
      "완전5도",
      "단6도",
      "장6도",
      "단7도",
      "장7도",
      "옥타브",
    ][n] || (n === 24 ? "두 옥타브" : "옥타브를 넘는 도약")
  );
}
export function explainCard(s: RoundState, index: number, intervals: boolean) {
  const c = s.hands[s.current][index],
    info = cardInfo(c, s.hands[s.current], s.lines, s.mode);
  if (!info.playable) {
    if (c.kind === "P") {
      const directional = s.lines.find((l) =>
        l.dir === "up" ? c.n > l.cards.at(-1)!.n : c.n < l.cards.at(-1)!.n,
      );
      return directional
        ? `${noteName(c.n)}은 ${SCALE_META[directional.scale].name}에 없는 음이에요.`
        : "상행은 더 높은 숫자, 하행은 더 낮은 숫자를 놓아요.";
    }
    if (c.kind === "WILD4")
      return "낼 수 있는 음높이 카드가 있으면 폭풍 전조를 낼 수 없어요.";
    return "같은 색 라인이 있을 때만 낼 수 있어요.";
  }
  if (c.kind !== "P")
    return `${SPECIAL_META[c.kind].name} 카드를 골랐어요. ${c.kind === "REV" ? "방향을 바꿀 라인을 고르세요." : c.kind === "WILD" || c.kind === "WILD4" ? "전조할 라인을 고르세요." : "한 번 더 누르면 내요."}`;
  const targets = info.targets!;
  if (info.explodes)
    return `${targets.map((n) => n + 1).join("·")}번 라인이 꽉 찼어요. 내면 5장을 가져와요.`;
  if (targets.length > 1)
    return "두 라인이 똑같이 가까워요. 라인을 골라 주세요.";
  const l = targets[0],
    from = s.lines[l].cards.at(-1)!.n,
    d = Math.abs(c.n - from);
  return `${noteName(from)}(${from}) → ${noteName(c.n)}(${c.n}), ${d}칸 ${c.n > from ? "위" : "아래"}${intervals ? " · " + intervalName(d) : ""}. 가장 가까운 ${l + 1}번 라인에 놓아요.`;
}
