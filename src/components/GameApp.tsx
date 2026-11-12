"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card, { Icon } from "./Card";
import Tutorial from "./Tutorial";
import {
  Action,
  Scale,
  Dir,
  Card as GameCard,
  cardInfo,
  playableIndices,
  cardPoints,
  SCALE_NOTES,
  DEFAULT_CONFIG,
  cardToString,
} from "@/game/engine";
import {
  GameSettings,
  GameSession,
  DEFAULT_SETTINGS,
  rankings,
} from "@/game/session";
import {
  SCALE_META,
  SPECIAL_META,
  noteName,
  explainCard,
  intervalName,
} from "@/game/display";
import { useGameStore } from "@/store/game";
import { synth } from "@/audio/synth";
type View =
  | "home"
  | "play"
  | "setup"
  | "settings"
  | "learn"
  | "classroom"
  | "teacher"
  | "history";
const paths: Record<View, string> = {
  home: "/",
  play: "/play/",
  setup: "/setup/",
  settings: "/settings/",
  learn: "/learn/",
  classroom: "/classroom/",
  teacher: "/teacher/",
  history: "/history/",
};
const questions = [
  "가장 크게 뛴 곳은 어디인가요? 몇 칸이었나요?",
  "이 멜로디는 올라가나요, 내려가나요?",
  "순차진행으로 이어진 부분을 불러 볼까요?",
  "같은 이름의 음이 나온 곳이 있나요?",
  "멜로디가 끝난 느낌인가요, 이어질 느낌인가요?",
  "장음계에 놓을 수 없었던 음은 무엇이었나요?",
];
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    ref.current?.focus();
    return () => old?.focus();
  }, []);
  return (
    <div className="modal-shade" onClick={onClose}>
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const a = ref.current?.querySelectorAll<HTMLElement>(
              'button,input,select,[tabindex="0"]',
            );
            if (a?.length) {
              const first = a[0],
                last = a[a.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function Melody({
  notes,
  notation,
  intervals,
}: {
  notes: number[];
  notation: string;
  intervals: boolean;
}) {
  return (
    <div className="melody-card">
      <div className="melody-notes">
        {notes.map((n, i) => (
          <span className="melody-step" key={i}>
            {i > 0 && (
              <small
                className={
                  Math.abs(n - notes[i - 1]) <= 2 ? "stepwise" : "leap"
                }
              >
                {n > notes[i - 1] ? "↗" : "↘"} {Math.abs(n - notes[i - 1])}칸
                {intervals && (
                  <em>{intervalName(Math.abs(n - notes[i - 1]))}</em>
                )}
              </small>
            )}
            <b>
              {noteName(n, notation) || n}
              <sup>{n}</sup>
            </b>
          </span>
        ))}
      </div>
      <button
        className="listen-button"
        onClick={() => {
          synth.unlock();
          synth.melody(notes);
        }}
      >
        <Icon name="speaker" size={18} /> 멜로디 듣기
      </button>
    </div>
  );
}
function Result({
  session: s,
  onNext,
  onHome,
  onReplay,
}: {
  session: GameSession;
  onNext: () => void;
  onHome: () => void;
  onReplay: () => void;
}) {
  const prefs = useGameStore((x) => x.prefs),
    final = s.status === "gameResult";
  const summary = s.rounds[s.roundIndex];
  const ranks = rankings(s);
  let melodies = s.explosions.filter(
    (e) => e.player === 0 && (final || e.round === s.roundIndex),
  );
  const own = melodies.length > 0;
  if (!own)
    melodies = s.explosions
      .filter((e) => final || e.round === s.roundIndex)
      .slice(0, 1);
  if (final && s.settings.classroom) melodies = melodies.slice(0, 2);
  return (
    <div className={`result-view ${final ? "final" : ""}`}>
      <div className="result-heading">
        <span className="eyebrow">
          {final ? "MELODY COMPLETE" : "ROUND COMPLETE"}
        </span>
        <h1>
          {final
            ? s.settings.classroom
              ? "오늘의 기록"
              : "멋진 연주였어요!"
            : `${s.roundIndex + 1}라운드 완료`}
        </h1>
        <p>
          {final
            ? `${ranks
                .filter((r) => r.winner)
                .map((r) => s.seats[r.player].name)
                .join(" · ")} 승리! 낮은 점수가 이겨요.`
            : summary?.endReason === "deckOut"
              ? "뽑기 더미를 모두 썼어요."
              : "손패를 모두 낸 친구가 있어요."}
        </p>
      </div>
      <div className="paper-panel">
        <table className="score-table">
          <thead>
            <tr>
              <th>이름</th>
              {!final && (
                <>
                  <th>가져온 카드</th>
                  <th>남은 카드</th>
                  <th>이번</th>
                </>
              )}
              <th>누적</th>
            </tr>
          </thead>
          <tbody>
            {ranks.map((r) => (
              <tr key={r.player} className={r.player === 0 ? "me" : ""}>
                <th>
                  {final ? `${r.rank}위 ` : ""}
                  {s.seats[r.player].name}
                  {final && r.winner ? " ★" : ""}
                </th>
                {!final && (
                  <>
                    <td>{summary?.pileScores[r.player]}</td>
                    <td>{summary?.handScores[r.player]}</td>
                    <td>{summary?.scores[r.player]}</td>
                  </>
                )}
                <td>
                  <b>{r.score}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {final && (
        <div className="stat-grid">
          <div>
            <b>{s.explosions.filter((e) => e.player === 0).length}</b>
            <span>내 폭발 횟수</span>
          </div>
          <div>
            <b>{s.explosions.length}</b>
            <span>본 폭발 수</span>
          </div>
          <div>
            <b>{s.stats.maxLeap[0]}칸</b>
            <span>가장 큰 도약</span>
          </div>
          <div>
            <b>
              {s.stats.placed[0]
                ? Math.round((s.stats.sequential[0] / s.stats.placed[0]) * 100)
                : 0}
              %
            </b>
            <span>순차진행 비율</span>
          </div>
        </div>
      )}
      <section className="result-melodies">
        <h2>멜로디를 읽어 볼까요?</h2>
        {!own && (
          <p>
            이번 라운드는 한 번도 터뜨리지 않았어요.
            {melodies.length ? " 다른 친구의 멜로디를 들어요." : ""}
          </p>
        )}
        {melodies.map((e, i) => (
          <Melody
            key={i}
            notes={e.notes}
            notation={prefs.notation}
            intervals={prefs.intervals}
          />
        ))}
        {!melodies.length && (
          <p>가져온 멜로디가 없어요. 다음 연주를 기대해요!</p>
        )}
      </section>
      {final && s.settings.classroom && (
        <div className="question">
          <span>오늘의 질문</span>
          <p>
            {questions[(s.seed >>> 0) % (s.settings.mode === "basic" ? 6 : 5)]}
          </p>
        </div>
      )}
      <div className="action-stack">
        {!final ? (
          <button className="primary" onClick={onNext}>
            {s.roundIndex + 1 >= s.settings.rounds || s.timerExpired
              ? "결과 보기"
              : "다음 라운드"}{" "}
            →
          </button>
        ) : (
          <>
            <button className="primary" onClick={onReplay}>
              한 번 더 연주하기
            </button>
            <button className="secondary" onClick={onHome}>
              홈으로
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export default function GameApp({
  initialView = "home",
}: {
  initialView?: View;
}) {
  const router = useRouter(),
    store = useGameStore(),
    { session: s, prefs, history, hydrated } = store;
  const [view, setView] = useState<View>(initialView),
    [selected, setSelected] = useState<number | null>(null),
    [message, setMessage] = useState("카드를 골라 멜로디를 이어 보세요."),
    [modal, setModal] = useState<
      "menu" | "rules" | "quit" | "scale" | "dir" | "color" | "clear" | null
    >(null),
    [lineChoice, setLineChoice] = useState<number>(0),
    [scaleView, setScaleView] = useState<Scale>("R"),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(0),
    [effect, setEffect] = useState(""),
    [shake, setShake] = useState<number | null>(null),
    [classMode, setClassMode] = useState<"beginner" | "basic">("beginner"),
    [minutes, setMinutes] = useState<0 | 10 | 15 | 20>(15),
    [setup, setSetup] = useState<GameSettings>(DEFAULT_SETTINGS);
  const seen = useRef("");
  const go = (v: View) => {
    setView(v);
    setSelected(null);
    setModal(null);
    setBusy(false);
    setEffect("");
    router.push(paths[v]);
  };
  useEffect(() => {
    Promise.resolve(useGameStore.persist.rehydrate()).finally(() =>
      useGameStore.getState().setHydrated(),
    );
  }, []);
  useEffect(() => {
    if (hydrated)
      setSetup(s?.settings || store.lastSettings || DEFAULT_SETTINGS);
  }, [hydrated]);
  useEffect(() => {
    synth.configure(prefs.sound, prefs.volume);
  }, [prefs.sound, prefs.volume]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    setNow(Date.now());
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => synth.stop();
  }, []);
  useEffect(() => {
    if (!s || view !== "play") return;
    if (s.soloPending && now >= s.soloPending.expiresAt) store.expireSolo(now);
    if (s.timerEndsAt && !s.timerExpired && now >= s.timerEndsAt)
      store.tick(now);
  }, [now, view, s?.id, s?.soloPending, s?.timerExpired]);
  useEffect(() => {
    if (!s || view !== "play") return;
    const key = s.id + ":" + s.eventId;
    if (seen.current === key) return;
    seen.current = key;
    setSelected(null);
    setBusy(false);
    setEffect("");
    if (!s.events.length) return;
    synth.events(s.events);
    let text = "";
    s.events.forEach((e) => {
      if (e.type === "placed")
        text = `${s.seats[e.player].name}${e.player ? "가" : "의 카드가"} ${noteName(e.card.n)}(${e.card.n})을 ${e.line + 1}번 라인에 놓았어요.`;
      if (e.type === "exploded")
        text = `멜로디가 터졌어요! ${s.seats[e.player].name}에게 ${e.penalty}삑점.`;
      if (e.type === "bounced") text = "끝음에 닿아 방향이 바뀌었어요!";
      if (e.type === "special")
        text = `${s.seats[e.player].name} · ${e.card.kind !== "P" ? SPECIAL_META[e.card.kind].name : ""}`;
      if (e.type === "drew")
        text = `${s.seats[e.player].name} ${e.count}장 뽑기${e.forced ? " · 이번 차례는 쉬어요." : ""}`;
    });
    setMessage(text);
    const explosion = s.events.some((e) => e.type === "exploded"),
      special = s.events.some((e) => e.type === "special");
    setEffect(explosion ? "explosion" : special ? "special" : "placed");
    setBusy(true);
    const t = setTimeout(
      () => {
        setBusy(false);
        setEffect("");
      },
      (explosion ? 2000 : special ? 800 : 300) *
        (prefs.speed === "fast" ? 0.5 : 1),
    );
    return () => clearTimeout(t);
  }, [s?.eventId, s?.id, view]);
  useEffect(() => {
    if (
      !s ||
      view !== "play" ||
      busy ||
      modal ||
      s.status !== "playing" ||
      s.soloPending ||
      s.round.current === 0
    )
      return;
    const t = setTimeout(
      () => store.aiTurn(),
      prefs.speed === "fast" ? 300 : 600,
    );
    return () => clearTimeout(t);
  }, [s, busy, modal, view, prefs.speed]);
  useEffect(() => {
    if (
      !s ||
      view !== "play" ||
      busy ||
      s.soloPending ||
      s.status !== "playing" ||
      s.round.current !== 0 ||
      s.round.phase !== "afterDraw" ||
      modal
    )
      return;
    const index = s.round.hands[0].length - 1;
    setSelected(index);
    setMessage("뽑은 카드를 바로 내요.");
    const c = s.round.hands[0][index],
      info = cardInfo(c, s.round.hands[0], s.round.lines, s.round.mode);
    if (c.kind === "P" && info.targets?.length === 1) {
      store.act({ type: "play", index, line: info.targets[0] });
    } else if (c.kind === "REST" || c.kind === "PLUS2")
      store.act({ type: "play", index });
    else if (c.kind === "REV") {
      const lines = s.round.lines
        .map((l, i) => (l.scale === c.color ? i : -1))
        .filter((i) => i >= 0);
      if (lines.length === 1)
        store.act({ type: "play", index, line: lines[0] });
    }
  }, [s, busy, view, modal]);
  useEffect(() => {
    if (s?.status === "gameResult" && view === "play") synth.victory();
  }, [s?.status, view]);
  const start = (settings: GameSettings) => {
    synth.unlock();
    const high = prefs.highSpecialPoints;
    store.start({
      ...settings,
      autoSolo: settings.classroom
        ? settings.autoSolo
        : (store.prefOverrides.autoSolo ?? settings.autoSolo),
      soloSeconds: prefs.soloSeconds,
      config: {
        handSize: { beginner: 7, basic: prefs.handSize },
        specialPoints: high
          ? { REV: 5, REST: 5, PLUS2: 5, WILD: 8, WILD4: 12 }
          : { ...DEFAULT_CONFIG.specialPoints },
      },
    });
    setBusy(false);
    setEffect("");
    go("play");
  };
  const error = (e: unknown) => {
    setMessage(e instanceof Error ? e.message : "선택을 다시 확인해 주세요.");
    setModal(null);
  };
  const submit = (index: number, line?: number, dir?: Dir, scale?: Scale) => {
    try {
      store.act({
        type: "play",
        index,
        ...(line !== undefined ? { line } : {}),
        ...(dir ? { dir } : {}),
        ...(scale ? { scale } : {}),
      });
      setModal(null);
      setSelected(null);
    } catch (e) {
      error(e);
    }
  };
  const chooseLine = (index: number, line: number) => {
    if (!s) return;
    const c = s.round.hands[0][index];
    if (c.kind === "P") {
      const info = cardInfo(c, s.round.hands[0], s.round.lines, s.round.mode);
      if (!info.targets?.includes(line)) return;
      if (info.explodes && c.n !== 0 && c.n !== 24) {
        setLineChoice(line);
        setModal("dir");
        return;
      }
      submit(index, line, c.n === 24 ? "down" : "up");
    } else if (c.kind === "REV") submit(index, line);
    else if (c.kind === "WILD" || c.kind === "WILD4") {
      setLineChoice(line);
      setModal("color");
    }
  };
  const clickCard = (index: number) => {
    if (
      !s ||
      busy ||
      s.soloPending ||
      s.round.current !== 0 ||
      s.status !== "playing"
    )
      return;
    const c = s.round.hands[0][index],
      info = cardInfo(c, s.round.hands[0], s.round.lines, s.round.mode);
    if (!playableIndices(s.round).includes(index)) {
      setMessage(explainCard(s.round, index, prefs.intervals));
      setShake(index);
      setTimeout(() => setShake(null), 350);
      return;
    }
    if (c.kind === "P") synth.note(c.n);
    setMessage(explainCard(s.round, index, prefs.intervals));
    if (selected === index) {
      if (c.kind === "P" && info.targets?.length === 1)
        chooseLine(index, info.targets[0]);
      else if (c.kind === "REST" || c.kind === "PLUS2") submit(index);
      else if (c.kind === "REV") {
        const ls = s.round.lines
          .map((l, i) => (l.scale === c.color ? i : -1))
          .filter((i) => i >= 0);
        if (ls.length === 1) submit(index, ls[0]);
      }
    } else setSelected(index);
  };
  if (!hydrated)
    return (
      <main className="loading">
        <span>♫</span>
        <p>멜로디를 준비해요…</p>
      </main>
    );
  const active =
    s?.round.current === 0 &&
    !busy &&
    !s?.soloPending &&
    s?.status === "playing";
  const chosen = s && selected !== null ? s.round.hands[0][selected] : null;
  const targetList =
    s && chosen
      ? chosen.kind === "P"
        ? cardInfo(chosen, s.round.hands[0], s.round.lines, s.round.mode)
            .targets || []
        : chosen.kind === "REV"
          ? s.round.lines
              .map((l, i) => (l.scale === chosen.color ? i : -1))
              .filter((i) => i >= 0)
          : chosen.kind === "WILD" || chosen.kind === "WILD4"
            ? [0, 1, 2, 3]
            : []
      : [];
  return (
    <main
      className={`app-shell view-${view} ${prefs.colorAssist ? "color-assist" : ""}`}
    >
      {view !== "home" && view !== "play" && view !== "learn" && (
        <header className="page-top">
          <button className="back-button" onClick={() => go("home")}>
            ‹ 홈
          </button>
          <span>UPDOWN MELODY</span>
        </header>
      )}
      {view === "home" && (
        <>
          <div className="home-art">
            <div className="home-top">
              <span className="brand-mark">♫</span>
              <span>음악이 놀이가 되는 순간</span>
              <button
                className="icon-button"
                aria-label="설정"
                onClick={() => go("settings")}
              >
                ⚙
              </button>
            </div>
            <div className="home-title">
              <span className="eyebrow">LET'S MAKE A LITTLE MELODY</span>
              <h1>
                업다운
                <br />
                <em>멜로디</em>
                <span className="title-star">✦</span>
              </h1>
              <p>
                오르락, 내리락!
                <br />
                카드 한 장으로 시작하는 음악 여행
              </p>
            </div>
            <div className="scale-medals">
              {(["R", "B", "G", "Y"] as Scale[]).map((c) => (
                <span key={c} style={{ color: SCALE_META[c].color }}>
                  <Icon name={SCALE_META[c].icon} />
                  {SCALE_META[c].name}
                </span>
              ))}
            </div>
          </div>
          <div className="home-controls paper-panel">
            {s && (
              <button
                className="continue"
                onClick={() => {
                  synth.unlock();
                  go("play");
                }}
              >
                ↪ 이어하기{" "}
                <small>
                  {s.roundIndex + 1}라운드 ·{" "}
                  {s.settings.mode === "beginner" ? "초급" : "기본"}
                </small>
              </button>
            )}
            <button
              className="primary play-start"
              onClick={() => start(s?.settings || store.lastSettings || setup)}
            >
              <span>바로 시작</span>
              <span>▶</span>
            </button>
            <div className="home-grid">
              <button onClick={() => go("setup")}>
                <Icon name="sparkle" />
                게임 설정
              </button>
              <button onClick={() => go("classroom")}>
                <Icon name="sun" />
                수업 모드
              </button>
              <button onClick={() => go("learn")}>
                <Icon name="play" />
                배우기
              </button>
              <button onClick={() => go("teacher")}>
                <Icon name="leaf" />
                선생님 안내
              </button>
            </div>
            {store.tutorialStep < 7 && (
              <button className="learning-nudge" onClick={() => go("learn")}>
                처음이라면? <b>3분 만에 배우기 →</b>
              </button>
            )}
          </div>
          <footer className="home-footer">
            <button onClick={() => go("history")}>
              나의 최근 연주 <span>전체 보기 →</span>
            </button>
            {history.slice(0, 3).map((h, i) => (
              <div className="history-mini" key={i}>
                {new Date(h.date).toLocaleDateString("ko-KR")} ·{" "}
                {h.mode === "beginner" ? "초급" : "기본"}
                <b>{h.rank}위</b>
              </div>
            ))}
            {!history.length && <p>첫 번째 멜로디를 만들어 보세요.</p>}
          </footer>
        </>
      )}
      {view === "play" &&
        (!s ? (
          <div className="empty">
            <h1>연주를 시작해요</h1>
            <button className="primary" onClick={() => start(DEFAULT_SETTINGS)}>
              바로 시작
            </button>
            <button className="secondary" onClick={() => go("home")}>
              홈으로
            </button>
          </div>
        ) : s.status !== "playing" && !busy ? (
          <Result
            session={s}
            onNext={() => {
              store.nextRound();
              setSelected(null);
            }}
            onHome={() => go("home")}
            onReplay={() => start(s.settings)}
          />
        ) : (
          <div
            className="board"
            onClick={() => {
              if (selected !== null && !modal) setSelected(null);
            }}
          >
            <header className="game-top">
              <div>
                <b>{s.settings.mode === "beginner" ? "초급" : "기본"}</b>
                <span>
                  {s.roundIndex + 1} / {s.settings.rounds} 라운드
                </span>
              </div>
              <span className="deck-count">▤ {s.round.deck.length}</span>
              {s.timerEndsAt && (
                <span className="timer">
                  {s.timerExpired
                    ? "이번 라운드까지"
                    : `${Math.floor(Math.max(0, s.timerEndsAt - now) / 60000)}:${String(Math.floor(Math.max(0, s.timerEndsAt - now) / 1000) % 60).padStart(2, "0")}`}
                </span>
              )}
              <button
                className="icon-button"
                aria-label="게임 메뉴"
                onClick={(e) => {
                  e.stopPropagation();
                  setModal("menu");
                }}
              >
                ☰
              </button>
            </header>
            <div className="opponents">
              {s.seats.slice(1).map((seat, j) => {
                const p = j + 1;
                return (
                  <div
                    className={`opponent ${s.round.current === p ? "turn" : ""}`}
                    key={p}
                  >
                    <span className={`avatar avatar-${p}`}>
                      {["♪", "♫", "♬"][j]}
                    </span>
                    <div>
                      <b>{seat.name}</b>
                      <small>
                        {s.round.current === p
                          ? "생각 중…"
                          : s.round.hands[p].length === 1
                            ? "솔로!"
                            : "AI 연주자"}
                      </small>
                    </div>
                    <span className="opponent-count">
                      {s.round.hands[p].length}
                      <small>장</small>
                    </span>
                    <span className="opponent-score">
                      {s.totals[p] +
                        s.round.piles[p].reduce(
                          (v, c) =>
                            v +
                            cardPoints(c, s.settings.mode, s.settings.config),
                          0,
                        )}
                      점
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              className={`lanes ${effect}`}
              onClick={(e) => e.stopPropagation()}
            >
              {s.round.lines.map((line, i) => (
                <div
                  key={i}
                  className={`lane ${targetList.includes(i) ? "target" : ""} ${line.cards.length === 5 ? "full" : ""}`}
                  style={
                    {
                      "--lane-color":
                        s.settings.mode === "basic"
                          ? SCALE_META[line.scale].color
                          : "#66778b",
                    } as React.CSSProperties
                  }
                >
                  <button
                    className="lane-label"
                    onClick={() => {
                      if (
                        active &&
                        selected !== null &&
                        targetList.includes(i)
                      ) {
                        chooseLine(selected, i);
                        return;
                      }
                      setScaleView(line.scale);
                      setModal("scale");
                    }}
                    aria-label={`${i + 1}번 라인 ${line.dir === "up" ? "상행" : "하행"} ${s.settings.mode === "basic" ? SCALE_META[line.scale].name : ""}`}
                  >
                    <span className="lane-number">{i + 1}</span>
                    <span className="direction">
                      {line.dir === "up" ? "↑" : "↓"}
                    </span>
                    {s.settings.mode === "basic" && (
                      <>
                        <Icon name={SCALE_META[line.scale].icon} size={17} />
                        <small>{SCALE_META[line.scale].name}</small>
                      </>
                    )}
                  </button>
                  <div
                    className="lane-cards"
                    onClick={() => {
                      if (active && selected !== null && targetList.includes(i))
                        chooseLine(selected, i);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${i + 1}번 라인에 놓기`}
                    onKeyDown={(e) => {
                      if (
                        (e.key === "Enter" || e.key === " ") &&
                        active &&
                        selected !== null &&
                        targetList.includes(i)
                      )
                        chooseLine(selected, i);
                    }}
                  >
                    {Array.from({ length: 5 }, (_, k) => (
                      <div
                        className={`lane-slot ${k === line.cards.length - 1 ? "last" : ""}`}
                        key={k}
                      >
                        {line.cards[k] ? (
                          <Card
                            card={line.cards[k]}
                            mode={s.settings.mode}
                            small
                            notation={prefs.notation}
                          />
                        ) : (
                          <span>·</span>
                        )}
                      </div>
                    ))}
                    <div
                      className={`overflow-slot ${line.cards.length === 5 && prefs.explosionWarning ? "warning" : ""}`}
                    >
                      {line.cards.length === 5 && prefs.explosionWarning
                        ? "!"
                        : "+"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div
              className="notice"
              aria-live="polite"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="notice-icon">
                {s.soloPending ? "!" : busy ? "♫" : active ? "♪" : "…"}
              </span>
              <p>
                {s.soloPending
                  ? "한 장 남았어요! 솔로를 눌러 주세요."
                  : !active && !busy
                    ? `${s.seats[s.round.current].name}의 차례예요.`
                    : message}
              </p>
            </div>
            <section className="hand-area" onClick={(e) => e.stopPropagation()}>
              <div className="hand-heading">
                <h2>
                  내 손패 <span>{s.round.hands[0].length}장</span>
                </h2>
                <span>
                  내 삑점{" "}
                  <b>
                    {s.totals[0] +
                      s.round.piles[0].reduce(
                        (v, c) =>
                          v + cardPoints(c, s.settings.mode, s.settings.config),
                        0,
                      )}
                  </b>
                </span>
              </div>
              <div className="hand-scroll">
                {s.round.hands[0]
                  .map((c, index) => ({ c, index }))
                  .sort(
                    (a, b) =>
                      (a.c.kind === "P" ? a.c.n : 100) -
                      (b.c.kind === "P" ? b.c.n : 100),
                  )
                  .map(({ c, index }) => (
                    <div key={index} className={shake === index ? "shake" : ""}>
                      <Card
                        card={c}
                        mode={s.settings.mode}
                        selected={selected === index}
                        dim={
                          s.round.current === 0 &&
                          !playableIndices(s.round).includes(index)
                        }
                        danger={
                          prefs.explosionWarning &&
                          cardInfo(
                            c,
                            s.round.hands[0],
                            s.round.lines,
                            s.settings.mode,
                          ).explodes
                        }
                        notation={prefs.notation}
                        onClick={() => clickCard(index)}
                      />
                    </div>
                  ))}
              </div>
              <div className="hand-actions">
                <span className="turn-label">
                  <i className={active ? "active-dot" : ""} />
                  {active ? "내 차례예요" : "멜로디를 들어요"}
                </span>
                {s.soloPending ? (
                  <button
                    className="solo-button"
                    onClick={() => {
                      store.solo();
                      synth.melody([12, 16, 19], 0.1);
                    }}
                  >
                    솔로!{" "}
                    <span>
                      {Math.max(
                        0,
                        Math.ceil((s.soloPending.expiresAt - now) / 1000),
                      )}
                      초
                    </span>
                  </button>
                ) : (
                  <button
                    className={`draw-button ${!active || playableIndices(s.round).length ? "inactive" : ""}`}
                    aria-disabled={
                      !active || playableIndices(s.round).length > 0
                    }
                    onClick={() => {
                      if (!active) return;
                      if (playableIndices(s.round).length) {
                        setMessage("낼 수 있는 카드가 있어요.");
                        return;
                      }
                      try {
                        store.act({ type: "draw" });
                      } catch (e) {
                        error(e);
                      }
                    }}
                  >
                    ▤ 카드 뽑기
                  </button>
                )}
              </div>
            </section>
            {effect === "explosion" && (
              <div className="event-burst" aria-hidden="true">
                <Icon name="explosion" size={70} />
                <b>멜로디 폭발!</b>
                <span>가져온 멜로디는 결과에서 다시 들어요.</span>
              </div>
            )}
            {effect === "special" && (
              <div className="event-special" aria-hidden="true">
                {s.events
                  .filter((e) => e.type === "special")
                  .map((e, i) =>
                    e.type === "special" && e.card.kind !== "P" ? (
                      <div key={i}>
                        <Icon name={SPECIAL_META[e.card.kind].icon} size={48} />
                        <b>{SPECIAL_META[e.card.kind].name}</b>
                      </div>
                    ) : null,
                  )}
              </div>
            )}
          </div>
        ))}
      {view === "learn" && (
        <Tutorial
          initialStep={Math.min(store.tutorialStep, 6)}
          onExit={() => go("home")}
          onProgress={(n) => store.setTutorialStep(n)}
        />
      )}
      {(view === "setup" || view === "classroom") && (
        <div className="content-page">
          <span className="eyebrow">
            {view === "setup"
              ? "YOUR LITTLE ORCHESTRA"
              : "PLAY & LEARN TOGETHER"}
          </span>
          <h1>
            {view === "setup" ? "어떻게 연주할까요?" : "우리 반 멜로디 수업"}
          </h1>
          <p>
            {view === "setup"
              ? "나에게 맞는 연주를 골라 보세요."
              : "선생님이 알려 주신 설정으로 시작해요."}
          </p>
          {view === "setup" ? (
            <>
              <label className="field">
                모드
                <select
                  value={setup.mode}
                  onChange={(e) => {
                    const mode = e.target.value as "basic" | "beginner";
                    setSetup({
                      ...setup,
                      mode,
                      aiLevel:
                        mode === "beginner" && setup.aiLevel === "hard"
                          ? "normal"
                          : setup.aiLevel,
                      autoSolo: mode === "beginner",
                    });
                  }}
                >
                  <option value="beginner">초급 · 방향과 숫자</option>
                  <option value="basic">기본 · 스케일과 특수카드</option>
                </select>
              </label>
              <label className="field">
                AI 상대
                <select
                  value={setup.opponents}
                  onChange={(e) =>
                    setSetup({
                      ...setup,
                      opponents: +e.target.value as 1 | 2 | 3,
                    })
                  }
                >
                  {[1, 2, 3].map((n) => (
                    <option value={n} key={n}>
                      {n}명
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                난이도
                <select
                  value={setup.aiLevel}
                  onChange={(e) =>
                    setSetup({
                      ...setup,
                      aiLevel: e.target.value as GameSettings["aiLevel"],
                    })
                  }
                >
                  <option value="easy">쉬움</option>
                  <option value="normal">보통</option>
                  {setup.mode === "basic" && (
                    <option value="hard">어려움</option>
                  )}
                </select>
              </label>
              <label className="field">
                라운드
                <select
                  value={setup.rounds}
                  onChange={(e) =>
                    setSetup({ ...setup, rounds: +e.target.value as 1 | 3 | 5 })
                  }
                >
                  {[1, 3, 5].map((n) => (
                    <option value={n} key={n}>
                      {n}라운드
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <div className="preset-grid">
                {(["beginner", "basic"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={classMode === mode ? "chosen" : ""}
                    onClick={() => setClassMode(mode)}
                  >
                    <Icon
                      name={mode === "beginner" ? "leaf" : "sun"}
                      size={36}
                    />
                    <b>{mode === "beginner" ? "초급 수업" : "기본 수업"}</b>
                    <small>
                      {mode === "beginner"
                        ? "방향과 가장 가까운 라인"
                        : "스케일과 전조"}
                      <br />
                      AI {mode === "beginner" ? 2 : 3}명 · 3라운드
                    </small>
                  </button>
                ))}
              </div>
              <label className="field">
                수업 타이머
                <select
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(+e.target.value as typeof minutes)
                  }
                >
                  {[0, 10, 15, 20].map((n) => (
                    <option value={n} key={n}>
                      {n ? n + "분" : "없음"}
                    </option>
                  ))}
                </select>
              </label>
              <p className="help-text">
                시간이 끝나도 하던 라운드를 마친 뒤 오늘의 기록을 보여드려요.
              </p>
            </>
          )}
          <button
            className="primary"
            onClick={() =>
              start(
                view === "setup"
                  ? { ...setup, timerMinutes: 0, classroom: false }
                  : {
                      ...DEFAULT_SETTINGS,
                      mode: classMode,
                      opponents: classMode === "beginner" ? 2 : 3,
                      autoSolo: classMode === "beginner",
                      timerMinutes: minutes,
                      classroom: true,
                    },
              )
            }
          >
            연주 시작 →
          </button>
        </div>
      )}
      {view === "settings" && (
        <div className="content-page">
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>편하게 맞춰요</h1>
          <div className="settings-list">
            <label className="switch-row">
              소리
              <input
                type="checkbox"
                checked={prefs.sound}
                onChange={(e) => {
                  synth.unlock();
                  store.updatePrefs({ sound: e.target.checked });
                }}
              />
            </label>
            <label className="field">
              음량
              <input
                type="range"
                min="0"
                max="1"
                step=".05"
                value={prefs.volume}
                onChange={(e) => store.updatePrefs({ volume: +e.target.value })}
              />
            </label>
            <label className="field">
              계이름 표기
              <select
                value={prefs.notation}
                onChange={(e) =>
                  store.updatePrefs({
                    notation: e.target.value as typeof prefs.notation,
                  })
                }
              >
                <option value="solfege">도레미</option>
                <option value="letters">CDE</option>
                <option value="number">숫자만</option>
              </select>
            </label>
            {(
              [
                ["intervals", "음정 이름 표시"],
                ["explosionWarning", "폭발 경고"],
                ["autoSolo", "솔로 자동 선언"],
                ["colorAssist", "색 구분 보조"],
              ] as const
            ).map(([key, label]) => (
              <label className="switch-row" key={key}>
                {label}
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) =>
                    store.updatePrefs({ [key]: e.target.checked })
                  }
                />
              </label>
            ))}
            <label className="field">
              솔로 제한 시간
              <select
                value={prefs.soloSeconds}
                onChange={(e) =>
                  store.updatePrefs({ soloSeconds: +e.target.value as 3 | 5 })
                }
              >
                <option value="3">3초</option>
                <option value="5">5초</option>
              </select>
            </label>
            <label className="field">
              AI 속도
              <select
                value={prefs.speed}
                onChange={(e) =>
                  store.updatePrefs({
                    speed: e.target.value as "normal" | "fast",
                  })
                }
              >
                <option value="normal">보통</option>
                <option value="fast">빠르게</option>
              </select>
            </label>
            <label className="field">
              기본 모드 시작 손패
              <select
                value={prefs.handSize}
                onChange={(e) =>
                  store.updatePrefs({ handSize: +e.target.value as 7 | 10 })
                }
              >
                <option value="10">10장</option>
                <option value="7">7장</option>
              </select>
            </label>
            <label className="field">
              남은 특수카드 점수
              <select
                value={String(prefs.highSpecialPoints)}
                onChange={(e) =>
                  store.updatePrefs({
                    highSpecialPoints: e.target.value === "true",
                  })
                }
              >
                <option value="false">3 · 5 · 8점</option>
                <option value="true">5 · 8 · 12점</option>
              </select>
            </label>
            <button className="text-danger" onClick={() => setModal("clear")}>
              최근 기록 지우기
            </button>
          </div>
          <p className="help-text">설정과 기록은 이 기기에만 저장돼요.</p>
        </div>
      )}
      {view === "history" && (
        <div className="content-page">
          <span className="eyebrow">MY MELODY JOURNAL</span>
          <h1>나의 연주 기록</h1>
          <p>최근 20게임을 기억해요.</p>
          {history.map((h, i) => (
            <div className="history-row" key={i}>
              <Icon name="sparkle" />
              <div>
                <b>
                  {h.mode === "beginner" ? "초급" : "기본"} · {h.players}명 연주
                </b>
                <small>{new Date(h.date).toLocaleString("ko-KR")}</small>
              </div>
              <strong>{h.rank}위</strong>
              <span>{h.scores[0]}점</span>
            </div>
          ))}
          {!history.length && (
            <div className="empty">
              <Icon name="play" size={48} />
              <p>연주를 마치면 여기에 기록돼요.</p>
            </div>
          )}
        </div>
      )}
      {view === "teacher" && (
        <div className="content-page teacher">
          <span className="eyebrow">A CLASS FULL OF MUSIC</span>
          <h1>함께 배우는 멜로디</h1>
          <p>상행·하행에서 시작해 순차진행, 도약과 스케일을 소리로 경험해요.</p>
          <h2>40분 수업 흐름</h2>
          {[
            [
              "0–5분",
              "숫자 0~24를 계단처럼 읽고, 상행·하행을 손동작과 목소리로 표현해요.",
            ],
            ["5–12분", "초급 튜토리얼을 함께 따라 해요."],
            ["12–27분", "수업 모드에서 타이머 15분으로 연주해요."],
            [
              "27–34분",
              "오늘의 기록에서 멜로디를 읽고 순차진행과 도약을 찾아요.",
            ],
            ["34–40분", "멜로디 하나를 악기나 목소리로 연주해요."],
          ].map(([time, text]) => (
            <div className="lesson-row" key={time}>
              <b>{time}</b>
              <p>{text}</p>
            </div>
          ))}
          <h2>차시별로 확장해요</h2>
          <p>
            1차시 초급 → 2차시 순차진행과 도약 → 3차시 스케일 → 4차시 특수카드와
            전조
          </p>
          <h2>이렇게 시작해 주세요</h2>
          <blockquote>
            “홈에서 수업 모드 → 초급 수업 또는 기본 수업 → 타이머 15분 → 시작.”
          </blockquote>
          <h2>함께 나눌 질문</h2>
          <ul>
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <button className="primary" onClick={() => go("classroom")}>
            수업 시작하기 →
          </button>
          <h2>홈 화면에 추가하기</h2>
          <p>
            안드로이드 크롬 메뉴의 ‘홈 화면에 추가’, 아이폰 사파리 공유 메뉴의
            ‘홈 화면에 추가’를 선택하세요. 처음 열린 화면과 파일은 다음 접속을
            위해 저장돼요.
          </p>
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal === "menu"
              ? "잠깐 쉬어 가요"
              : modal === "rules"
                ? "멜로디 약속"
                : modal === "quit"
                  ? "연주를 그만할까요?"
                  : modal === "scale"
                    ? s?.settings.mode === "beginner"
                      ? "상행과 하행"
                      : SCALE_META[scaleView].name
                    : modal === "dir"
                      ? "새 라인의 방향"
                      : modal === "clear"
                        ? "최근 기록을 지울까요?"
                        : "어떤 스케일로 바꿀까요?"
          }
          onClose={() => setModal(null)}
        >
          {modal === "menu" && (
            <div className="action-stack">
              <button className="primary" onClick={() => setModal(null)}>
                계속하기
              </button>
              <button className="secondary" onClick={() => setModal("rules")}>
                규칙 보기
              </button>
              <button
                className="secondary"
                onClick={() => store.updatePrefs({ sound: !prefs.sound })}
              >
                소리 {prefs.sound ? "끄기" : "켜기"}
              </button>
              <button className="secondary" onClick={() => go("settings")}>
                설정
              </button>
              <button className="text-danger" onClick={() => setModal("quit")}>
                그만두기
              </button>
            </div>
          )}
          {modal === "rules" && (
            <ol className="rules">
              <li>상행에는 더 큰 숫자, 하행에는 더 작은 숫자를 놓아요.</li>
              <li>
                기본 모드는 라인의 스케일에 있는 음이나 같은 음급을 놓아요.
              </li>
              <li>
                놓을 수 있는 라인 중 가장 가까운 곳으로 가요. 거리가 같으면
                카드가 많은 곳, 그것도 같으면 골라요.
              </li>
              <li>5장까지 안전해요. 6번째 카드를 내면 5장을 가져와요.</li>
              <li>24는 하행, 0은 상행으로 바뀌어요.</li>
              <li>
                낼 카드가 없을 때만 뽑아요. 바로 낼 수 있고 터지지 않으면 바로
                내요.
              </li>
              <li>한 장 남으면 솔로! 점수가 낮을수록 좋아요.</li>
              <li>더미가 소진되거나 손패를 모두 내면 라운드가 끝나요.</li>
            </ol>
          )}
          {modal === "quit" && (
            <>
              <p>하던 연주는 이어하기에 남겨 두고 홈으로 가요.</p>
              <button className="primary" onClick={() => go("home")}>
                홈으로
              </button>
            </>
          )}
          {modal === "clear" && (
            <>
              <p>최근 20게임 기록을 지워요.</p>
              <button
                className="primary"
                onClick={() => {
                  store.clearHistory();
                  setModal(null);
                }}
              >
                기록 지우기
              </button>
            </>
          )}
          {modal === "scale" && (
            <>
              <p>
                {s?.settings.mode === "beginner"
                  ? "↑ 상행은 더 큰 숫자, ↓ 하행은 더 작은 숫자예요."
                  : "이 스케일에는 다음 음이 있어요. 카드 색이 달라도 놓을 수 있어요."}
              </p>
              {s?.settings.mode === "basic" && (
                <div className="scale-notes">
                  {SCALE_NOTES[scaleView].slice(0, 7).map((n) => (
                    <span key={n}>{noteName(n)}</span>
                  ))}
                </div>
              )}
            </>
          )}
          {modal === "dir" && (
            <div className="choice-row">
              <button
                className="primary"
                onClick={() =>
                  selected !== null && submit(selected, lineChoice, "up")
                }
              >
                ↑ 상행
              </button>
              <button
                className="secondary"
                onClick={() =>
                  selected !== null && submit(selected, lineChoice, "down")
                }
              >
                ↓ 하행
              </button>
            </div>
          )}
          {modal === "color" && s && (
            <div className="color-choices">
              {(["R", "B", "G", "Y"] as Scale[])
                .filter((c) => c !== s.round.lines[lineChoice].scale)
                .map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      selected !== null &&
                      submit(selected, lineChoice, undefined, c)
                    }
                  >
                    <Icon name={SCALE_META[c].icon} />
                    {SCALE_META[c].name}
                  </button>
                ))}
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}
