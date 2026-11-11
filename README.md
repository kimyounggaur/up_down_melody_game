# 업다운 멜로디

0~24 반음 숫자 카드를 4개의 멜로디 라인에 놓으며 상행·하행·순차진행·도약·스케일을 배우는 세로형 음악 카드게임입니다. 초급/기본 모드와 AI 1~3명, 여러 라운드, 솔로, 라인 읽기, 7단계 튜토리얼과 수업 모드를 제공합니다.

## 실행

Node.js 22 이상에서 `npm ci`, `npm run dev`를 실행합니다. `npm run build`는 서버 없는 정적 웹앱을 `out/`에 만들며 오프라인 캐시를 함께 구성합니다. Vercel에서는 Next.js 프로젝트로 가져오고 build command `npm run build`, output directory `out`를 사용합니다.

- `npm test`: golden/AI/세션/저장/튜토리얼 시험
- `npm run typecheck`: strict TypeScript 검사
- `npm run format:check`: 형식 검사
- `npm run sim`: 12조건 각 5,000라운드 규칙 검증
- `npm run sim:ai`: 각 3,000라운드 AI 승률 검증

`docs/spec.md`가 규칙 기준입니다. `docs/engine.reference.ts`와 `docs/updown_golden_v1.json` 원본은 변경하지 않습니다. 게임 데이터는 이 기기의 브라우저 저장소에만 기록됩니다.

## 디자인

직접 제작한 배경 3종 및 SVG 카드·아이콘·UI 에셋을 `public/assets/`에서 사용합니다. 글자·숫자·점수는 화면에서 표시합니다. 음원 파일 없이 Web Audio로 C4~C6 소리를 합성합니다.

## 설치와 업데이트

사파리 공유 메뉴 또는 크롬 메뉴에서 홈 화면에 추가합니다. 첫 접속의 오프라인 준비가 끝난 뒤 인터넷 없이 사용합니다. 새 버전은 백그라운드에서 준비되며 열려 있는 앱 탭을 모두 닫고 다시 열면 적용됩니다. 브라우저 저장소를 지우면 기록과 이어하기도 지워집니다.
