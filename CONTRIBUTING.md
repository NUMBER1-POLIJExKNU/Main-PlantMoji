# CONTRIBUTING — English · Bahasa Indonesia · 한국어

This document exists in three languages — jump to the section you need using the table of contents below.
Dokumen ini tersedia dalam tiga bahasa — gunakan daftar isi di bawah untuk langsung menuju bagian yang Anda butuhkan.
이 문서는 세 가지 언어로 제공됩니다 — 아래 목차에서 필요한 섹션으로 바로 이동하세요.

## Contents

- [🇬🇧 English](#english)
- [🇮🇩 Bahasa Indonesia](#bahasa-indonesia)
- [🇰🇷 한국어](#korean)

---

<a id="english"></a>
## 🇬🇧 English

Repository: `NUMBER1-POLIJExKNU/Main-PlantMoji`

A two-person collaboration setup — roles are split between the **Engine Owner** (game/backend) and the **Design Owner** (presentation/styling).

### 1. Ownership

| Area | Path | Owner |
|---|---|---|
| Game engine, quest/XP/badge/story logic | `src/game/` | Engine |
| API routes | `src/app/api/` | Engine |
| Server utilities, Supabase client, AI integration | `src/lib/` | Engine |
| DB schema | `supabase/` | Engine |
| Type contracts | `src/types/` | Engine |
| Inside presentational components (markup/styling) | `src/components/` | Design |
| Page styling (JSX/classes under `src/app/**`) | `src/app/` | Design |
| Design tokens | `src/app/globals.css` | Design |
| Assets | `public/` | Design |

> The Design Owner owns the markup/classes/markup structure of `src/components/`, but **must not change the props contract (see §2 below) without agreement from the Engine Owner.** Container components like `plant-home.tsx` that include data fetching, Supabase subscriptions, or routing logic are jointly owned with the Engine Owner.

### 2. Branch · PR Rules

- Branches: `engine/*` (Engine Owner), `design/*` (Design Owner)
- All changes merge into `main` via PR, and require **review approval from the counterpart owner**.
- Never push directly to `main`.

### 3. Rule — Presentational Components Must Keep Their Props Contract

The Design Owner is free to change the internal markup/styling of the components below, but **must keep the exported props interface unchanged** (any change to name, type, or required-ness needs prior agreement with the Engine Owner). Below is a props summary for each component.

#### `BondPanel` (`src/components/bond-panel.tsx`)
```ts
interface BondPanelProps {
  bondLevel: number;
  totalXp: number;
  xpInLevel: number;   // XP earned within the current level (0..xpRequired)
  xpRequired: number;  // XP required to level up (XP_PER_LEVEL = 100)
  streakDays: number;  // 0 hides the streak row
}
```

#### `HomeQuestCard` (`src/components/home-quest-card.tsx`)
```ts
interface HomeQuestInfo {
  emoji: string;
  title: string;
  statusLabel: string;    // e.g. "Active", "Verifying"
  progressLabel: string;  // e.g. "23 / 30 min"
}
interface HomeQuestCardProps {
  quest: HomeQuestInfo | null; // null renders the "No active quest" card
}
```

#### `QuestProgress` (`src/components/quest-progress.tsx`, client component)
```ts
interface QuestProgressProps {
  mode: "maintain" | "verifying"; // maintain: counts up, verifying: counts down
  sinceIso: string;    // started_at / verifying_since (ISO string — a string because it crosses the RSC boundary)
  requiredSeconds: number;
  plantId: string;     // needed to call the /api/game-tick sweep on completion
}
```

#### `LevelUpOverlay` (`src/components/level-up-overlay.tsx`, client component)
```ts
interface LevelUpOverlayProps {
  level: number;
  show: boolean;
  onDone: () => void; // called on auto/manual dismiss — the parent owns the show state
}
```

#### `Notice` (`src/components/notice.tsx`)
```ts
interface NoticeProps {
  title: string;
  lines: string[];
}
```

#### `BottomNav` (`src/components/bottom-nav.tsx`, client component)
No props — a fixed 5-tab (Home/Quests/Collection/Report/Settings) navigation that determines the active tab directly via `usePathname()`.

### 4. Running the Project

```powershell
npm install
npm run dev
```

`http://localhost:3000` requires Supabase environment variables (see `docs/SETUP-milestone1-2.md`). **Designers can work without Supabase** — the `http://localhost:3000/design` sandbox renders the presentational components above with mock props for styling work, and runs with zero env variables.

### 5. Design Source

The mockup playground remains in its own separate repository, **`Web-PlantEmoji`**. Only designs validated there get ported into this repository (`src/components/`, `globals.css`).

### 6. Additional Docs

- `docs/SETUP-milestone1-2.md` — the first vertical slice of Supabase integration (environment variables, `POST /api/device-events`)
- `docs/SETUP-game-systems.md` — setup and operation of the game engine (quests/XP/streaks/badges/story)

---

<a id="bahasa-indonesia"></a>
## 🇮🇩 Bahasa Indonesia

Repositori: `NUMBER1-POLIJExKNU/Main-PlantMoji`

Sistem kolaborasi dua orang — peran dibagi antara **Engine Owner** (game/backend) dan **Design Owner** (presentasi/styling).

### 1. Kepemilikan

| Area | Path | Owner |
|---|---|---|
| Game engine, logika quest/XP/badge/story | `src/game/` | Engine |
| API routes | `src/app/api/` | Engine |
| Utilitas server, Supabase client, integrasi AI | `src/lib/` | Engine |
| Skema DB | `supabase/` | Engine |
| Kontrak tipe | `src/types/` | Engine |
| Bagian dalam komponen presentasional (markup/style) | `src/components/` | Design |
| Styling halaman (JSX/class di `src/app/**`) | `src/app/` | Design |
| Design token | `src/app/globals.css` | Design |
| Aset | `public/` | Design |

> Design Owner memiliki markup/class/struktur markup di `src/components/`, tetapi **tidak boleh mengubah kontrak props (lihat §2 di bawah) tanpa kesepakatan dengan Engine Owner.** Komponen container seperti `plant-home.tsx` yang berisi data fetching, subscription Supabase, atau logika routing dipegang bersama oleh Engine Owner.

### 2. Aturan Branch · PR

- Branch: `engine/*` (Engine Owner), `design/*` (Design Owner)
- Semua perubahan digabungkan ke `main` lewat PR, dan memerlukan **persetujuan review dari pemilik di sisi sebaliknya**.
- Tidak boleh push langsung ke `main`.

### 3. Aturan — Komponen Presentasional Harus Mempertahankan Kontrak Props

Design Owner bebas mengubah markup/styling internal komponen di bawah ini, tetapi **interface props yang di-export harus tetap sama** (perubahan nama, tipe, atau status wajib/opsional memerlukan kesepakatan lebih dulu dengan Engine Owner). Berikut ringkasan props masing-masing komponen.

#### `BondPanel` (`src/components/bond-panel.tsx`)
```ts
interface BondPanelProps {
  bondLevel: number;
  totalXp: number;
  xpInLevel: number;   // XP yang diperoleh di dalam level saat ini (0..xpRequired)
  xpRequired: number;  // XP yang dibutuhkan untuk naik level (XP_PER_LEVEL = 100)
  streakDays: number;  // 0 berarti baris streak disembunyikan
}
```

#### `HomeQuestCard` (`src/components/home-quest-card.tsx`)
```ts
interface HomeQuestInfo {
  emoji: string;
  title: string;
  statusLabel: string;    // contoh: "Active", "Verifying"
  progressLabel: string;  // contoh: "23 / 30 min"
}
interface HomeQuestCardProps {
  quest: HomeQuestInfo | null; // null menampilkan kartu "Tidak ada quest aktif"
}
```

#### `QuestProgress` (`src/components/quest-progress.tsx`, client component)
```ts
interface QuestProgressProps {
  mode: "maintain" | "verifying"; // maintain: hitung naik, verifying: hitung mundur
  sinceIso: string;    // started_at / verifying_since (string ISO — berupa string karena melewati batas RSC)
  requiredSeconds: number;
  plantId: string;     // diperlukan untuk memanggil sweep /api/game-tick saat selesai
}
```

#### `LevelUpOverlay` (`src/components/level-up-overlay.tsx`, client component)
```ts
interface LevelUpOverlayProps {
  level: number;
  show: boolean;
  onDone: () => void; // dipanggil saat dismiss otomatis/manual — status show dimiliki oleh parent
}
```

#### `Notice` (`src/components/notice.tsx`)
```ts
interface NoticeProps {
  title: string;
  lines: string[];
}
```

#### `BottomNav` (`src/components/bottom-nav.tsx`, client component)
Tidak ada props — navigasi 5 tab tetap (Home/Quests/Collection/Report/Settings) yang menentukan tab aktif langsung lewat `usePathname()`.

### 4. Cara Menjalankan

```powershell
npm install
npm run dev
```

`http://localhost:3000` memerlukan environment variable Supabase (lihat `docs/SETUP-milestone1-2.md`). **Desainer bisa bekerja tanpa Supabase** — sandbox `http://localhost:3000/design` me-render komponen presentasional di atas dengan mock props untuk pekerjaan styling, dan berjalan dengan 0 environment variable.

### 5. Sumber Desain

Playground mockup tetap berada di repositori terpisah, **`Web-PlantEmoji`**. Hanya desain yang sudah tervalidasi di sana yang di-port ke repositori ini (`src/components/`, `globals.css`).

### 6. Dokumen Tambahan

- `docs/SETUP-milestone1-2.md` — vertical slice pertama integrasi Supabase (environment variable, `POST /api/device-events`)
- `docs/SETUP-game-systems.md` — setup dan operasional game engine (quest/XP/streak/badge/story)

---

<a id="korean"></a>
## 🇰🇷 한국어

저장소: `NUMBER1-POLIJExKNU/Main-PlantMoji`

2인 협업 체계 — **엔진 오너**(게임/백엔드)와 **디자인 오너**(프레젠테이션/스타일)로 역할을 나눕니다.

### 1. 오너십

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

### 2. 브랜치 · PR 규칙

- 브랜치: `engine/*` (엔진 오너), `design/*` (디자인 오너)
- 모든 변경은 PR로 `main`에 병합하며, **반대쪽 담당자의 리뷰 승인**이 필요합니다.
- `main`에 직접 push하지 않습니다.

### 3. 규칙 — 프레젠테이셔널 컴포넌트는 props 계약을 유지한다

디자인 오너는 아래 컴포넌트의 내부 마크업/스타일을 자유롭게 바꿀 수 있지만, **export되는 props 인터페이스는 유지**해야 합니다 (이름·타입·필수 여부 변경 시 엔진 오너와 사전 합의). 아래는 각 컴포넌트의 props 요약입니다.

#### `BondPanel` (`src/components/bond-panel.tsx`)
```ts
interface BondPanelProps {
  bondLevel: number;
  totalXp: number;
  xpInLevel: number;   // 현재 레벨 안에서 획득한 XP (0..xpRequired)
  xpRequired: number;  // 레벨업까지 필요한 XP (XP_PER_LEVEL = 100)
  streakDays: number;  // 0이면 스트릭 줄 숨김
}
```

#### `HomeQuestCard` (`src/components/home-quest-card.tsx`)
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

#### `QuestProgress` (`src/components/quest-progress.tsx`, client component)
```ts
interface QuestProgressProps {
  mode: "maintain" | "verifying"; // maintain: 카운트업, verifying: 카운트다운
  sinceIso: string;    // started_at / verifying_since (ISO 문자열, RSC 경계를 건너와서 string)
  requiredSeconds: number;
  plantId: string;     // 완료 시 /api/game-tick 스윕 호출에 필요
}
```

#### `LevelUpOverlay` (`src/components/level-up-overlay.tsx`, client component)
```ts
interface LevelUpOverlayProps {
  level: number;
  show: boolean;
  onDone: () => void; // 자동/수동 dismiss 시 호출 — show 상태는 부모가 소유
}
```

#### `Notice` (`src/components/notice.tsx`)
```ts
interface NoticeProps {
  title: string;
  lines: string[];
}
```

#### `BottomNav` (`src/components/bottom-nav.tsx`, client component)
props 없음 — `usePathname()`으로 활성 탭을 직접 판별하는 고정 5탭(Home/Quests/Collection/Report/Settings) 내비게이션입니다.

### 4. 실행 방법

```powershell
npm install
npm run dev
```

`http://localhost:3000`은 Supabase 환경 변수가 필요합니다 (`docs/SETUP-milestone1-2.md` 참고). **디자이너는 Supabase 없이도** `http://localhost:3000/design` 샌드박스에서 위 프레젠테이셔널 컴포넌트를 목(mock) props로 렌더링해 스타일 작업을 할 수 있습니다 — env 변수 0개로 동작합니다.

### 5. 디자인 소스

목업 플레이그라운드는 별도 저장소 **`Web-PlantEmoji`**에 그대로 유지합니다. 그쪽에서 검증된 디자인만 이 저장소(`src/components/`, `globals.css`)로 포팅합니다.

### 6. 추가 문서

- `docs/SETUP-milestone1-2.md` — Supabase 연동 첫 수직 슬라이스 (환경 변수, `POST /api/device-events`)
- `docs/SETUP-game-systems.md` — 게임 엔진(퀘스트/XP/스트릭/배지/스토리) 설정 및 운영
