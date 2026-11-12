"use client";
import { useState } from "react";
import {
  cardInfo,
  cardToString,
  playableIndices,
  type Action,
  type Card,
  type Dir,
  type Scale,
} from "../game/engine";
import {
  applyTutorialAction,
  createTutorialState,
  SPECIAL_LESSONS,
  TUTORIAL_STEPS,
} from "../game/tutorial";
import "./tutorial.css";
import { synth } from "../audio/synth";
const scaleNames: Record<Scale, string> = {
  R: "장음계",
  B: "자연단음계",
  G: "도리안",
  Y: "믹솔리디안",
};
const scaleFiles: Record<Scale, string> = {
  R: "red",
  B: "blue",
  G: "green",
  Y: "yellow",
};
const icons: Record<Scale, string> = {
  R: "sun",
  B: "moon",
  G: "leaf",
  Y: "lightning",
};
const notes: Record<number, string> = {
  0: "도",
  2: "레",
  3: "미♭",
  4: "미",
  5: "파",
  7: "솔",
  8: "라♭",
  9: "라",
  10: "시♭",
  11: "시",
};
export default function Tutorial({
  onExit,
  onProgress,
  initialStep = 0,
}: {
  onExit: () => void;
  onProgress: (n: number) => void;
  initialStep?: number;
}) {
  const [step, setStep] = useState(Math.min(6, Math.max(0, initialStep)));
  const [stage, setStage] = useState(0);
  const [state, setState] = useState(() =>
    createTutorialState(Math.min(6, Math.max(0, initialStep))),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<{
    index: number;
    line: number;
    kind: "direction" | "scale";
  } | null>(null);
  const [done, setDone] = useState(false);
  const [slide, setSlide] = useState(0);
  const data = TUTORIAL_STEPS[step];
  const chooseStep = (n: number) => {
    setStep(n);
    setStage(0);
    setState(createTutorialState(n));
    setSelected(null);
    setMessage("");
    setPending(null);
    setDone(false);
    setSlide(0);
    onProgress(n);
  };
  const expected = () =>
    step === 0
      ? stage === 0
        ? "R9"
        : "B3"
      : step === 1
        ? "R12"
        : step === 2
          ? stage === 0
            ? "Y24"
            : "G9"
          : step === 3
            ? "G0"
            : step === 4
              ? stage === 0
                ? "B19"
                : stage === 1
                  ? "B15"
                  : "R16"
              : step === 5
                ? stage === 0
                  ? "WILD"
                  : "B15"
                : "";
  const apply = (action: Action) => {
    try {
      const result = applyTutorialAction(state, action);
      synth.events(result.events);
      setState(result.state);
      setSelected(null);
      setPending(null);
      if (action.type === "draw") {
        setStage(1);
        setSelected(result.state.hands[0].length - 1);
        setMessage(
          "0이 나왔어요. 똑같이 가까운 두 라인 중 하나를 골라 주세요.",
        );
        return;
      }
      const nextStage = stage + 1;
      if (nextStage >= data.tasks.length) {
        setDone(true);
        setMessage(
          step === 2
            ? "5장을 가져왔어요! 숫자 차이가 작은 라인이 먼저라는 점을 기억해요."
            : step === 3
              ? "0을 놓아서 방향이 상행으로 바뀌었어요!"
              : "잘했어요! 다음 배움을 이어 가요.",
        );
        onProgress(Math.min(6, step + 1));
      } else {
        setStage(nextStage);
        if (step === 4) {
          setState(createTutorialState(4));
          setMessage(
            "파랑 카드여도 솔은 장음계에 있어요. 다른 음과 비교하려고 같은 시작 판을 다시 보여 드려요.",
          );
        } else
          setMessage(
            result.events.some((e) => e.type === "bounced")
              ? "24에 닿아서 하행으로 바뀌었어요."
              : "",
          );
      }
    } catch {
      setMessage("빛나는 라인과 안내를 다시 살펴 주세요.");
    }
  };
  const select = (index: number) => {
    if (done || pending) return;
    void synth.unlock();
    const card = state.hands[0][index];
    const key = cardToString(card);
    if (card.kind === "P") synth.note(card.n);
    if (step === 4 && stage === 1 && key === "B15") {
      setStage(2);
      setState(createTutorialState(4));
      setSelected(null);
      setMessage(
        "미♭은 장음계에 없는 음이에요. 같은 시작 판으로 돌아가 미(16)를 놓아 볼게요.",
      );
      return;
    }
    if (key !== expected()) {
      setMessage(data.tasks[stage]);
      return;
    }
    const info = cardInfo(card, state.hands[0], state.lines, state.mode);
    if (!info.playable) {
      setMessage("지금은 놓을 수 없어요. 안내에 있는 버튼을 눌러 주세요.");
      return;
    }
    if (selected === index && card.kind === "P" && info.targets?.length === 1) {
      place(info.targets[0], index);
      return;
    }
    setSelected(index);
    setMessage(
      card.kind === "WILD"
        ? "스케일을 바꿀 1번 라인을 눌러 주세요."
        : info.explodes
          ? "가장 가까운 라인이 꽉 찼어요. 5장을 가져오게 돼요."
          : `빛나는 ${info.targets?.map((i) => i + 1).join("번, ")}번 라인을 눌러 주세요.`,
    );
  };
  const place = (line: number, explicitIndex?: number) => {
    const index = explicitIndex ?? selected;
    if (index === null || index === undefined || done) return;
    const card = state.hands[0][index];
    if (card.kind === "WILD") {
      if (line !== 0) {
        setMessage("이번에는 1번 라인을 바꿔 봐요.");
        return;
      }
      setPending({ index, line, kind: "scale" });
      return;
    }
    const info = cardInfo(card, state.hands[0], state.lines, state.mode);
    if (!info.targets?.includes(line)) {
      setMessage("가장 가까운 빛나는 라인에 놓아 주세요.");
      return;
    }
    if (info.explodes && card.kind === "P" && card.n !== 0 && card.n !== 24) {
      setPending({ index, line, kind: "direction" });
      return;
    }
    apply({ type: "play", index, line });
  };
  const draw = () => {
    void synth.unlock();
    if (step !== 3 || stage !== 0 || playableIndices(state).length) {
      setMessage("낼 수 있는 카드가 있으면 먼저 내요.");
      return;
    }
    apply({ type: "draw" });
  };
  const CardView = ({
    card,
    small = false,
  }: {
    card: Card;
    small?: boolean;
  }) => (
    <span
      className={`tut-card ${small ? "tut-card-small" : ""}`}
      style={{
        backgroundImage: `url('/assets/svg/cards/front_${data.mode === "beginner" ? "neutral" : "color" in card ? scaleFiles[card.color] : "neutral"}.svg')`,
      }}
    >
      {card.kind === "P" ? (
        <>
          <strong>{card.n}</strong>
          <span>{notes[card.n % 12]}</span>
        </>
      ) : (
        <>
          <img src="/assets/svg/icons/wild.svg" alt="" />
          <span>전조</span>
        </>
      )}
    </span>
  );
  const selectedCard = selected === null ? null : state.hands[0][selected];
  const targets = selectedCard
    ? selectedCard.kind === "P"
      ? (cardInfo(selectedCard, state.hands[0], state.lines, state.mode)
          .targets ?? [])
      : [0]
    : [];
  return (
    <main className="tutorial-page">
      <header className="tut-top">
        <button onClick={onExit} aria-label="배우기 나가기">
          ← 홈
        </button>
        <span>직접 배우기 · {step + 1}/7</span>
        <button onClick={onExit}>건너뛰기</button>
      </header>
      <nav className="tut-nav">
        <button
          className={step < 4 ? "active" : ""}
          onClick={() => chooseStep(0)}
        >
          초급 배우기
        </button>
        <button
          className={step >= 4 ? "active" : ""}
          onClick={() => chooseStep(4)}
        >
          기본 배우기
        </button>
      </nav>
      <div className="tut-heading">
        <span className="tut-kicker">
          {data.mode === "beginner" ? "첫 멜로디" : "한 단계 더"}
        </span>
        <h1>{data.title}</h1>
        <p>{data.subtitle}</p>
      </div>
      {step === 6 ? (
        <section className="tut-slide">
          <img
            src={`/assets/svg/icons/${SPECIAL_LESSONS[slide].icon}.svg`}
            alt=""
          />
          <h2>{SPECIAL_LESSONS[slide].title}</h2>
          <p>{SPECIAL_LESSONS[slide].text}</p>
          <div
            className="tut-dots"
            aria-label={`${slide + 1} / ${SPECIAL_LESSONS.length}`}
          >
            {SPECIAL_LESSONS.map((_, i) => (
              <span className={i === slide ? "on" : ""} key={i} />
            ))}
          </div>
          {slide < SPECIAL_LESSONS.length - 1 ? (
            <button className="tut-primary" onClick={() => setSlide(slide + 1)}>
              다음 이야기 →
            </button>
          ) : (
            <button
              className="tut-primary"
              onClick={() => {
                onProgress(7);
                onExit();
              }}
            >
              배우기 완료! 게임하러 가요
            </button>
          )}
        </section>
      ) : (
        <>
          <p className="tut-task" role="status">
            {done ? "배움 완료!" : data.tasks[stage]}
          </p>
          <div className="tut-board">
            {state.lines.map((line, i) => (
              <button
                key={i}
                className={`tut-lane ${targets.includes(i) ? "tut-target" : ""}`}
                onClick={() => place(i)}
                aria-label={`${i + 1}번 라인, ${line.dir === "up" ? "상행" : "하행"}, 끝 숫자 ${line.cards.at(-1)?.n}`}
              >
                <span className="tut-lane-label">
                  <b>
                    {i + 1} {line.dir === "up" ? "↑" : "↓"}
                  </b>
                  {data.mode === "basic" && (
                    <>
                      <img
                        src={`/assets/svg/icons/${icons[line.scale]}.svg`}
                        alt=""
                      />
                      <small>{scaleNames[line.scale]}</small>
                    </>
                  )}
                </span>
                <span className="tut-slots">
                  {Array.from({ length: 5 }, (_, j) => (
                    <span
                      className={`tut-slot ${j === line.cards.length - 1 ? "tut-last" : ""}`}
                      key={j}
                    >
                      {line.cards[j] && <CardView small card={line.cards[j]} />}
                    </span>
                  ))}
                  <span
                    className={`tut-danger ${line.cards.length === 5 ? "full" : ""}`}
                  >
                    !
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="tut-message" aria-live="polite">
            {message || "카드를 한 번 고르고, 빛나는 라인을 눌러 보세요."}
          </p>
          <div className="tut-hand" aria-label="연습 손패">
            {state.hands[0].map((card, index) => (
              <button
                key={`${cardToString(card)}-${index}`}
                className={selected === index ? "tut-selected" : ""}
                onClick={() => select(index)}
                aria-label={
                  card.kind === "P" ? `${card.n} ${notes[card.n % 12]}` : "전조"
                }
              >
                <CardView card={card} />
              </button>
            ))}
          </div>
          <div className="tut-actions">
            {step === 3 && !done && (
              <button
                className="tut-primary"
                onClick={draw}
                disabled={stage !== 0}
              >
                한 장 뽑기
              </button>
            )}
            {done ? (
              <button
                className="tut-primary"
                onClick={() => chooseStep(step + 1)}
              >
                다음 배움 →
              </button>
            ) : (
              <button className="tut-subtle" onClick={() => chooseStep(step)}>
                처음부터 해 보기
              </button>
            )}
          </div>
        </>
      )}
      {pending && (
        <div className="tut-modal-backdrop">
          <section
            className="tut-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              pending.kind === "direction" ? "새 라인 방향" : "새 스케일"
            }
          >
            <h2>
              {pending.kind === "direction"
                ? "새 라인은 어느 방향일까요?"
                : "어떤 스케일로 바꿀까요?"}
            </h2>
            <p>
              {pending.kind === "direction"
                ? "상행과 하행 중 하나를 골라요."
                : "미♭이 들어 있는 스케일을 골라 주세요."}
            </p>
            <div>
              {pending.kind === "direction"
                ? (["up", "down"] as Dir[]).map((dir) => (
                    <button
                      key={dir}
                      onClick={() =>
                        apply({
                          type: "play",
                          index: pending.index,
                          line: pending.line,
                          dir,
                        })
                      }
                    >
                      {dir === "up" ? "↑ 상행" : "↓ 하행"}
                    </button>
                  ))
                : (["B", "G", "Y"] as Scale[]).map((scale) => (
                    <button
                      key={scale}
                      onClick={() => {
                        if (scale === "Y") {
                          setMessage(
                            "믹솔리디안에도 미♭이 없어요. 파랑이나 초록을 골라 주세요.",
                          );
                          return;
                        }
                        apply({
                          type: "play",
                          index: pending.index,
                          line: pending.line,
                          scale,
                        });
                      }}
                    >
                      <img
                        src={`/assets/svg/icons/${icons[scale]}.svg`}
                        alt=""
                      />
                      {scaleNames[scale]}
                    </button>
                  ))}
            </div>
            {pending.kind === "scale" && message.includes("믹솔리디안") && (
              <p role="alert">{message}</p>
            )}
            <button className="tut-subtle" onClick={() => setPending(null)}>
              돌아가기
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
