# CONTRIBUTING

저장소: `NUMBER1-POLIJExKNU/Main-PlantMoji`

2인 협업 체계 — **엔진 오너**(게임/백엔드)와 **디자인 오너**(프레젠테이션/스타일)로 역할을 나눕니다.

## 1. 오너십

| 영역 | 경로 | 오너 |
|---|---|---|
| 게임 엔진, 퀘스트/XP/배지/스토리 로직 | `src/game/` | 엔진 |
| API 라우트 | `src/app/api/` | 엔진 |
| 서버 유틸, Supabase 클라이언트, AI 연동 | `src/lib/` | 엔진 |
| DB 스키마 | `supabase/` | 엔진 |
| 타입 계약 | `src/types/` | 엔진 |
| 프레젠테이셔널 컴포넌트 내부 (마크업/스타일) | `src/components/` | 디자인 |
| 페이지 스타일링 (`src/app/**`의 JSX/클래스) | `src/app/` | 디자인 |
| 디자인 토큰 | `src/app/globals.css` | 디자인 |
| 에셋 | `public/` | 디자인 |

> `src/components/`는 디자인 오너가 마크업·클래스·마크업 구조를 소유하되, **props 계약(아래 2번)은 엔진과 합의 없이 바꾸지 않습니다.** 데이터 페칭, Supabase 구독, 라우팅 로직이 들어간 `plant-home.tsx` 같은 컨테이너 컴포넌트는 엔진 오너가 함께 봅니다.

## 2. 브랜치 · PR 규칙

- 브랜치: `engine/*` (엔진 오너), `design/*` (디자인 오너)
- 모든 변경은 PR로 `main`에 병합하며, **반대쪽 담당자의 리뷰 승인**이 필요합니다.
- `main`에 직접 push하지 않습니다.

## 3. 규칙 — 프레젠테이셔널 컴포넌트는 props 계약을 유지한다

디자인 오너는 아래 컴포넌트의 내부 마크업/스타일을 자유롭게 바꿀 수 있지만, **export되는 props 인터페이스는 유지**해야 합니다 (이름·타입·필수 여부 변경 시 엔진 오너와 사전 합의). 아래는 각 컴포넌트의 props 요약입니다.

### `BondPanel` (`src/components/bond-panel.tsx`)
```ts
interface BondPanelProps {
  bondLevel: number;
  totalXp: number;
  xpInLevel: number;   // 현재 레벨 안에서 획득한 XP (0..xpRequired)
  xpRequired: number;  // 레벨업까지 필요한 XP (XP_PER_LEVEL = 100)
  streakDays: number;  // 0이면 스트릭 줄 숨김
}
```

### `HomeQuestCard` (`src/components/home-quest-card.tsx`)
```ts
interface HomeQuestInfo {
  emoji: string;
  title: string;
  statusLabel: string;    // 예: "Active", "Verifying"
  progressLabel: string;  // 예: "23 / 30 min"
}
interface HomeQuestCardProps {
  quest: HomeQuestInfo | null; // null이면 "활성 퀘스트 없음" 카드
}
```

### `QuestProgress` (`src/components/quest-progress.tsx`, client component)
```ts
interface QuestProgressProps {
  mode: "maintain" | "verifying"; // maintain: 카운트업, verifying: 카운트다운
  sinceIso: string;    // started_at / verifying_since (ISO 문자열, RSC 경계를 건너와서 string)
  requiredSeconds: number;
  plantId: string;     // 완료 시 /api/game-tick 스윕 호출에 필요
}
```

### `LevelUpOverlay` (`src/components/level-up-overlay.tsx`, client component)
```ts
interface LevelUpOverlayProps {
  level: number;
  show: boolean;
  onDone: () => void; // 자동/수동 dismiss 시 호출 — show 상태는 부모가 소유
}
```

### `Notice` (`src/components/notice.tsx`)
```ts
interface NoticeProps {
  title: string;
  lines: string[];
}
```

### `BottomNav` (`src/components/bottom-nav.tsx`, client component)
props 없음 — `usePathname()`으로 활성 탭을 직접 판별하는 고정 5탭(Home/Quests/Collection/Report/Settings) 내비게이션입니다.

## 4. 실행 방법

```powershell
npm install
npm run dev
```

`http://localhost:3000`은 Supabase 환경 변수가 필요합니다 (`docs/SETUP-milestone1-2.md` 참고). **디자이너는 Supabase 없이도** `http://localhost:3000/design` 샌드박스에서 위 프레젠테이셔널 컴포넌트를 목(mock) props로 렌더링해 스타일 작업을 할 수 있습니다 — env 변수 0개로 동작합니다.

## 5. 디자인 소스

목업 플레이그라운드는 별도 저장소 **`Web-PlantEmoji`**에 그대로 유지합니다. 그쪽에서 검증된 디자인만 이 저장소(`src/components/`, `globals.css`)로 포팅합니다.

## 6. 추가 문서

- `docs/SETUP-milestone1-2.md` — Supabase 연동 첫 수직 슬라이스 (환경 변수, `POST /api/device-events`)
- `docs/SETUP-game-systems.md` — 게임 엔진(퀘스트/XP/스트릭/배지/스토리) 설정 및 운영
