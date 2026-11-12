"use client";

import { useRouter } from "next/navigation";
import "./rulebook.css";

const chapters = [
  {
    id: "overview",
    title: "게임의 목표",
    lead: "카드를 놓아 멜로디를 만들고, 삑점을 가장 적게 모아요.",
    points: [
      "사람 1명과 AI 1~3명이 함께해요. 기본은 3라운드이며 1·5라운드도 선택할 수 있어요.",
      "각 라운드에서 가져온 카드와 손에 남은 카드의 점수를 더해요. 누적 점수가 가장 낮은 사람이 승리해요.",
    ],
  },
  {
    id: "setup",
    title: "게임 준비",
    lead: "음높이 카드로 4개의 라인을 만들어요.",
    points: [
      "초급은 음높이 카드 60장과 손패 7장, 기본은 특수카드를 포함해 92장과 손패 10장으로 시작해요.",
      "라인의 시작 방향은 1·3번 상행, 2·4번 하행이에요. 시작 카드가 0이면 상행, 24면 하행으로 바뀌어요.",
      "기본 모드 시작 손패는 설정에서 7장으로 바꿀 수 있어요.",
    ],
  },
  {
    id: "pitch",
    title: "숫자는 음높이",
    lead: "숫자가 1 커질 때마다 음이 반음씩 높아져요.",
    points: [
      "0은 도, 12는 한 옥타브 높은 도, 24는 두 옥타브 높은 도예요. 두 숫자의 차이가 음높이 거리예요.",
      "카드를 누르면 음을 듣고, 화면에서 놓을 수 있는 위치를 안내받을 수 있어요.",
    ],
  },
  {
    id: "direction",
    title: "상행과 하행",
    lead: "화살표 방향에 맞춰 마지막 음과 비교해요.",
    points: [
      "↑ 상행: 마지막 숫자보다 더 큰 숫자를 놓아요. ↓ 하행: 마지막 숫자보다 더 작은 숫자를 놓아요.",
      "같은 숫자는 놓을 수 없어요. 초급에서는 방향만 확인하고, 기본에서는 스케일 조건도 확인해요.",
    ],
  },
  {
    id: "closest",
    title: "가장 가까운 라인",
    lead: "놓을 수 있는 곳 중 마지막 음과 숫자 차이가 가장 작은 라인으로 가요.",
    points: [
      "예를 들어 12를 낼 때 가능한 라인의 마지막 음이 9와 4라면, 차이가 3인 9 쪽에 놓아요.",
      "가장 가까운 라인이 5장으로 가득 찼어도 더 먼 라인으로 피할 수 없어요.",
    ],
  },
  {
    id: "tiebreak",
    title: "거리가 같다면?",
    lead: "동률이면 카드가 더 많이 놓인 라인을 먼저 골라요.",
    points: [
      "거리와 카드 수가 모두 같을 때만 그중에서 원하는 라인을 선택할 수 있어요.",
      "앱이 놓을 수 있는 후보와 이유를 표시해 줘요.",
    ],
  },
  {
    id: "explosion",
    title: "여섯 번째 카드와 폭발",
    lead: "라인에는 다섯 장까지 안전하게 놓을 수 있어요.",
    points: [
      "여섯 번째 카드를 내면 기존 카드 5장을 낸 사람이 벌점 더미로 가져가요. 새로 낸 카드는 새 라인의 첫 카드가 돼요.",
      "새 라인의 스케일은 낸 카드의 색이고 방향은 낸 사람이 정해요. 단, 0은 상행, 24는 하행이에요.",
    ],
  },
  {
    id: "bounce",
    title: "끝음 반사",
    lead: "가장 높은 음과 낮은 음에 닿으면 방향이 돌아서요.",
    points: [
      "24에 도착하면 하행, 0에 도착하면 상행이에요.",
      "준비할 때나 새 라인을 열 때, 반전 카드를 사용한 뒤에도 적용해요. 끝음이 0이나 24라면 반전을 써도 방향은 그대로예요.",
    ],
  },
  {
    id: "draw",
    title: "카드 내기와 뽑기",
    lead: "낼 수 있는 카드가 하나라도 있으면 반드시 내요.",
    points: [
      "음높이 카드가 폭발을 일으키더라도 놓을 수 있다면 낼 수 있는 카드예요. 특수카드도 사용 조건이 맞으면 낼 수 있어요.",
      "낼 카드가 전혀 없을 때 한 장 뽑아요. 뽑은 카드를 벌점 없이 낼 수 있으면 즉시 내고, 낼 수 없거나 폭발한다면 손에 두고 차례를 마쳐요.",
    ],
  },
  {
    id: "scales",
    title: "기본 모드: 네 가지 스케일",
    lead: "카드의 색보다 라인이 받아들이는 음을 살펴봐요.",
    points: [
      "빨강은 장음계, 파랑은 자연단음계, 초록은 도리안, 노랑은 믹솔리디안이에요.",
      "방향이 맞으면서 카드의 음이 그 라인의 스케일에 있거나, 마지막 음과 같은 음급(옥타브 관계)이면 연결할 수 있어요. 카드 색이 달라도 괜찮아요.",
      "도·레·파·솔은 네 스케일 모두에 있어요. 미·라·시 계열의 차이를 주의해 보세요.",
    ],
  },
  {
    id: "special-color",
    title: "색이 있는 특수카드",
    lead: "기본 모드에서만 등장하며, 같은 색의 라인이 있어야 낼 수 있어요.",
    points: [
      "반전: 같은 색 라인 하나의 방향을 바꿔요. 끝음 반사는 그대로 적용돼요.",
      "쉼표: 다음 사람이 한 차례 쉬어요. 불협 2: 다음 사람이 2장 뽑고 쉬어요.",
      "특수카드 효과는 받아넘기거나 겹칠 수 없어요. 뽑을 카드가 부족하면 남은 만큼만 뽑아요.",
    ],
  },
  {
    id: "special-wild",
    title: "전조와 폭풍 전조",
    lead: "라인을 골라 현재와 다른 스케일 색으로 바꿔요.",
    points: [
      "전조는 언제나 낼 수 있어요. 이미 놓인 카드는 그대로 두고 라인의 스케일만 바꿔요.",
      "폭풍 전조는 낼 수 있는 음높이 카드가 한 장도 없을 때만 낼 수 있어요. 스케일을 바꾸고 다음 사람은 4장 뽑은 뒤 쉬어요.",
      "폭발하는 라인에 놓을 수 있는 음높이 카드가 있어도 낼 수 있는 카드로 계산해요.",
    ],
  },
  {
    id: "solo",
    title: "손패가 한 장이면 솔로!",
    lead: "카드를 낸 뒤 손패가 정확히 한 장이 되면 선언해요.",
    points: [
      "사람은 화면에 나타나는 솔로 버튼을 제한 시간 안에 눌러요. 놓치면 카드 2장을 뽑아요.",
      "자동 선언을 켜면 자동으로 선언해요. AI도 자동 선언하며, 제한 시간은 설정에서 바꿀 수 있어요.",
    ],
  },
  {
    id: "scoring",
    title: "삑점 계산",
    lead: "벌점 더미와 손에 남은 카드의 점수를 모두 더해요.",
    points: [
      "초급: 음높이 카드 한 장당 1점이에요. 기본: 음높이 카드에 표시된 삑점 0~3점을 더해요.",
      "기본 특수카드가 손에 남으면 반전·쉼표·불협 2는 각 3점, 전조는 5점, 폭풍 전조는 8점이에요. 설정에서 특수카드 점수를 높일 수 있어요.",
    ],
  },
  {
    id: "ending",
    title: "라운드와 승리",
    lead: "누군가 손패를 모두 내거나 뽑기 더미가 바닥나면 라운드가 끝나요.",
    points: [
      "버린 더미는 다시 섞지 않아요. 같은 차례에 두 종료 조건이 동시에 발생하면 손패 소진으로 처리해요.",
      "정해진 라운드가 끝나면 누적 삑점이 가장 낮은 사람이 이겨요. 동점이면 벌점 더미로 가져간 카드 수가 적은 사람이 이기고, 그것도 같으면 공동 승리예요.",
      "수업 타이머가 끝나면 진행 중인 라운드를 마친 뒤 게임을 끝내요.",
    ],
  },
  {
    id: "listening",
    title: "멜로디 읽고 듣기",
    lead: "내가 만든 음의 움직임을 음악으로 살펴봐요.",
    points: [
      "결과 화면에서 가져온 멜로디를 다시 듣고, 음이 올라가는지 내려가는지 말해 보세요.",
      "한두 칸씩 이어지는 순차진행과 더 멀리 뛰어가는 도약을 찾아보세요. 설정에서 음정 이름과 음량도 조절할 수 있어요.",
    ],
  },
];

export default function Rulebook() {
  const router = useRouter();
  return (
    <main className="rulebook-shell">
      <header className="rulebook-top">
        <button
          onClick={() =>
            window.history.length > 1 ? router.back() : router.push("/")
          }
          aria-label="이전 화면으로 돌아가기"
        >
          ‹ 돌아가기
        </button>
        <span>UPDOWN MELODY</span>
        <button onClick={() => router.push("/")}>홈</button>
      </header>
      <div className="rulebook-content">
        <section className="rulebook-hero">
          <img
            className="rulebook-cover"
            src="/rulebook/cover-pastel.webp"
            alt="음표와 카드가 가득한 멜로디 정원"
          />
          <div className="rulebook-hero-copy">
            <span>ILLUSTRATED GUIDE</span>
            <h1>
              업다운 멜로디
              <br />
              그림 룰북
            </h1>
            <p>
              한 장씩 따라 읽으면
              <br />
              음악 카드게임이 쉬워져요!
            </p>
          </div>
        </section>
        <nav className="rulebook-toc" aria-label="룰북 목차">
          <h2>어떤 규칙이 궁금한가요?</h2>
          <div>
            {chapters.map((chapter, i) => (
              <a key={chapter.id} href={`#${chapter.id}`}>
                <span>{String(i + 1).padStart(2, "0")}</span> {chapter.title}
              </a>
            ))}
          </div>
        </nav>
        <div className="rulebook-chapters">
          {chapters.map((chapter, i) => (
            <section
              id={chapter.id}
              className="rulebook-chapter"
              key={chapter.id}
            >
              <div className="rulebook-chapter-head">
                <span>CHAPTER {String(i + 1).padStart(2, "0")}</span>
                <h2>{chapter.title}</h2>
                <p>{chapter.lead}</p>
              </div>
              <img
                src={`/rulebook/illustrations/${chapter.id}.svg`}
                alt={`${chapter.title} 규칙을 설명하는 그림`}
                loading="lazy"
              />
              <ul>
                {chapter.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <footer className="rulebook-end">
          <span>♪</span>
          <h2>이제 멜로디를 만들어 볼까요?</h2>
          <p>언제든 상단의 룰북 버튼을 눌러 다시 살펴보세요.</p>
          <button onClick={() => router.push("/")}>홈으로 가기 →</button>
          <a
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            맨 위로 ↑
          </a>
        </footer>
      </div>
    </main>
  );
}
