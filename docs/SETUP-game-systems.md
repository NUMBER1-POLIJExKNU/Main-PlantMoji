# LeafTalk · 게임 시스템(Milestone 3+) 설정 & 운영 가이드

> **Device event → Event Router → Quest Engine → award_xp RPC(멱등) → Streak → Badges → Story.**
> 모든 시간 판정은 타임스탬프 기반이며, 서버 `setTimeout()`은 어디에도 없습니다 (인수인계 Correction 4).

이 문서는 Milestone 1–2(`docs/SETUP-milestone1-2.md`)가 끝난 상태를 전제로,
그 위에 올라가는 **백엔드 게임 엔진**(인수인계 §11–§23, §26–§29)의 설정과 운영 방법입니다.

---

## 1. 개요 — 게임 시스템 아키텍처

디바이스 이벤트 하나가 게임 진행으로 바뀌는 전체 경로:

```text
Node-RED → POST /api/device-events        (검증·저장, Milestone 1–2)
         → processDeviceEvent()            src/game/events/event-router.ts
             → Quest Engine                src/game/quests/quest-engine.ts
               (handleStateChange / evaluateQuests — 타임스탬프로 완료 판정)
             → 완료 퀘스트마다:
                 시즌 배율 적용             src/game/seasonal/seasonal-events.ts
                 award_xp RPC (멱등)       src/game/progression/xp-engine.ts
                 스트릭 기록                src/game/progression/streak-engine.ts
             → 배지 평가                   src/game/badges/badge-engine.ts
             → 스토리 챕터 평가            src/game/story/story-engine.ts
```

핵심 설계 원칙 (모두 실제 코드에 반영됨):

- **단일 오케스트레이션 지점** — `src/game/events/event-router.ts`의
  `processDeviceEvent()`가 유일한 진입점입니다. `POST /api/device-events`가
  이벤트를 저장한 뒤 이 함수를 호출하며, 게임 처리 실패 시 500을 돌려
  Node-RED가 재시도하게 합니다.
- **모든 단계가 멱등** — XP는 `xp_rewards` 원장(`reward_key` PK)으로,
  이벤트 발행은 `bond_events.event_id` PK로, 배지는 `(plant_id, badge_key)` PK로,
  챕터는 단조 증가(`current_chapter`는 절대 감소하지 않음)로 보호됩니다.
  같은 이벤트가 몇 번 재전송돼도 보상은 정확히 한 번입니다 (§28).
- **타임스탬프 기반, 타이머 없음** — 퀘스트 진행은 `started_at` /
  `verifying_since` 같은 저장된 시각으로부터 경과 시간을 계산합니다.
  서버 `setTimeout()`으로 긴 퀘스트를 재는 코드는 없습니다 (Correction 4).
- **타입 계약은 한 곳** — 테이블 행 모양, 퀘스트/배지/이벤트 키,
  `levelForXp()` 레벨 공식은 전부 `src/types/game.ts`에 있습니다.

## 2. Supabase 설정 — `supabase/milestone3.sql`

1. Supabase 대시보드 → **SQL Editor** → `supabase/milestone3.sql` 내용 붙여넣기 → **Run**
   - `supabase/milestone1.sql`이 먼저 실행되어 있어야 합니다 (`plants` 참조).
   - **추가 전용**이며 **두 번 실행해도 안전**합니다 (`create table if not exists`, `create or replace function`).
2. 생성되는 것:

| 객체 | 용도 |
|---|---|
| `bond_state` | 식물 1개당 1행: `total_xp`, `bond_level`, `current_streak`, `longest_streak`, `last_qualified_date`, `current_chapter` (plant-01 시드 포함) |
| `quests` | 퀘스트 상태 머신 행 (`AVAILABLE / ACTIVE / VERIFYING / COMPLETED / EXPIRED / FAILED`) — 키당 라이브 퀘스트 1개를 강제하는 부분 유니크 인덱스 `quests_one_live_per_key` 포함 |
| `plant_badges` | 배지 해금 기록, PK `(plant_id, badge_key)` |
| `bond_events` | 백엔드가 발행하는 게임 이벤트 (`QUEST_*`, `XP_AWARDED`, `LEVEL_UP`, `STREAK_UPDATED`, `BADGE_UNLOCKED`, `CHAPTER_UNLOCKED`), PK `event_id`로 멱등 |
| `xp_rewards` | XP 멱등 원장 — `reward_key` PK 덕에 같은 완료가 두 번 XP를 줄 수 없음 (§28–§29) |
| `award_xp()` RPC | 한 트랜잭션 안에서: `reward_key` 중복 검사 → XP 증가 → 레벨 도출(`floor(xp/100)+1`) → `XP_AWARDED` / `LEVEL_UP` 이벤트 기록 (§29) |
| RLS | `bond_state` / `quests` / `plant_badges` / `bond_events`는 공개 읽기 정책, 쓰기는 서버 Secret key로만. `xp_rewards`는 내부 원장이라 **일부러 읽기 정책 없음** |
| Realtime | `bond_state`, `quests`, `plant_badges`를 `supabase_realtime` 발행에 추가 → UI가 새로고침 없이 갱신 |

### v5 레거시 테이블은 그대로 둡니다 (Correction 1)

Node-RED v5가 쓰던 `game_state` / `game_events`(그리고 `sensor_readings`,
`plant_state_events`)는 **건드리지 않습니다.** 이유:

- XP의 소스는 결국 하나여야 하지만, 검증된 Node-RED 플로우를 새 엔진이
  증명되기도 전에 지우면 되돌릴 수 없습니다.
- 그래서 지금은: Node-RED는 레거시 테이블에 계속 쓰고, 게임 백엔드는
  **새 테이블만** 소유합니다. 퀘스트 기반 Bond XP는 이쪽이 유일한 진실입니다.
- Node-RED의 healthy-time XP 분기는 **이 엔진이 검증된 후에** 비활성화합니다 (§15).

## 3. 시스템 요약

### 3.1 퀘스트 3종 (`src/game/quests/quest-definitions.ts`, §16)

| 키 | 종류 | 트리거 | 완료 조건 | 보상 |
|---|---|---|---|---|
| `KEEP_ME_HAPPY` 🌱 | maintain | `Happy` 진입 | Happy를 **30분(1800초)** 연속 유지 | **+20 XP** |
| `COOL_ME_DOWN` ❄️ | recovery | `Overheating` 진입 | Overheating에서 벗어난 뒤 **5분(300초)** 재발 없이 안정 (VERIFYING) | **+30 XP** |
| `GIVE_ME_MORE_LIGHT` ☀️ | recovery | `Sleepy` 진입 | Sleepy에서 벗어난 뒤 **5분(300초)** 재발 없이 안정 (VERIFYING) | **+20 XP** |

- recovery 퀘스트는 §17 철학 그대로: 버튼 누름이 아니라 **센서로 검증된
  회복 + 안정 유지**에만 보상합니다. 안정 유지 시간(예: 5분)이 **다 차기 전에**
  트리거 무드로 재진입하면 VERIFYING이 풀리고 ACTIVE로 되돌아갑니다. 반대로
  창이 **이미 다 지난 뒤**에 재진입한 경우에는 회복이 이미 증명된 것이므로
  되돌리지 않고 그대로 COMPLETED 처리합니다 (재진입 자체는 같은 트리거로
  새 퀘스트를 하나 더 만듭니다). 지연된 이벤트가 늦게 도착해도 마찬가지입니다:
  이미 적용된 최신 상태를 덮어쓰지 못한(`applied:false`) 오래된/순서가 뒤바뀐
  이벤트는 퀘스트 상태 머신을 직접 움직이지 않고, 저장된 타임스탬프 기반의
  lazy sweep(`evaluateQuests`)만 다시 돌립니다.
- 보상 키는 `quest:<퀘스트 id>:completion` (§28) — 재전송돼도 XP는 한 번.

### 3.2 XP / Bond Level (§14–§15)

- 레벨 공식: `levelForXp(totalXp) = floor(totalXp / 100) + 1`
  (0–99 → Lv.1, 100–199 → Lv.2, …). `src/types/game.ts`의 `XP_PER_LEVEL = 100`이며
  SQL의 `award_xp()`와 반드시 같은 공식을 씁니다.
- XP 증가는 **오직** `award_xp` RPC를 통해서만 (read-modify-write 금지, §29).

### 3.3 배지 3종 (`src/game/badges/badge-definitions.ts`, §18)

| 키 | 이름 | 해금 조건 |
|---|---|---|
| `FIRST_RESCUE` 🚑 | First Rescue | 회복(recovery) 퀘스트 첫 완료 (`COOL_ME_DOWN` 또는 `GIVE_ME_MORE_LIGHT`) |
| `LIGHT_MASTER` ☀️ | Light Master | `GIVE_ME_MORE_LIGHT` 완료 **5회** |
| `LEVEL_5_BOND` 💚 | Level 5 Bond | Bond Level **5** 도달 |

### 3.4 스토리 챕터 4개 (`src/game/story/story-definitions.ts`, §19)

| 챕터 | 제목 | 해금 조건 |
|---|---|---|
| 1 | First Meeting | 등록 / 최초 실행 (기본값) |
| 2 | Learning to Grow | 첫 퀘스트 완료 |
| 3 | Trust | Bond Lv.3 **그리고** 3일 스트릭 (엔진은 `longest_streak` 기준 — 이미 얻은 챕터가 스트릭 끊김으로 막히지 않도록) |
| 4 | Stronger Together | Bond Lv.5 **그리고** 퀘스트 10회 완료 **그리고** 회복 퀘스트 1회 이상 |

챕터는 순서대로만 열리고, `bond_state.current_chapter`는 **절대 감소하지 않습니다.**

### 3.5 스트릭 규칙 (`src/game/progression/streak-engine.ts`, §21)

- **하루에 자격 퀘스트 1개 이상 완료하면 그날이 스트릭에 인정**됩니다.
  달력 날짜는 `STREAK_TIMEZONE = Asia/Jakarta`(WIB, 젬버 현지) 기준.
- 어제가 인정된 날이면 +1 연장, 아니면 1부터 재시작. `longest_streak`은 최댓값 유지.
- **놓친 날에 대한 처벌 없음**: XP도 Bond Level도 절대 감소하지 않고,
  스트릭 숫자만 리셋됩니다. 같은 날 두 번째 완료는 no-op (재전송에도 멱등).

### 3.6 주간 리포트 (`src/lib/weekly-report.ts`, §22)

`weekly_reports` 테이블은 **없습니다** — 페이지를 열 때마다 이력에서 계산합니다 (읽기 전용).

| 항목 | 정의 |
|---|---|
| Healthy time | `Happy` 상태 **이면서** 센서 연결 중인 구간의 합 — `SENSOR_OFFLINE` 구간은 마지막 상태가 Happy여도 제외 |
| Quests completed | 해당 WIB 주(월요일 시작) 안에 `completed_at`이 찍힌 `COMPLETED` 퀘스트 수 |
| Overheating events | Overheating **진입 횟수** (센서 샘플 개수가 아님) |
| Level / XP / Streak | `bond_state` 현재 값 |

### 3.7 시즌 이벤트 (`src/game/seasonal/seasonal-events.ts`, §23)

TypeScript 설정만으로 동작 — 스케줄러 서비스도, DB 테이블도 없습니다.

| id | 기간 (WIB) | 배율 |
|---|---|---|
| `HOT_WEATHER` (Hot Weather Challenge) | 2026-08-01 ~ 2026-08-31 | **×1.2** |
| `WEEKEND_GROWTH` (Weekend Growth Bonus) | 2026-08-01 ~ 2026-12-31, 토·일만 | ×1.1 |

- 겹치면 **가장 높은 배율 하나만** 적용 (중첩 없음 — 8월의 주말은 ×1.32가 아니라 ×1.2).
- 결과는 정수 XP로 반올림. 배율은 퀘스트 완료 정산 시점(`event-router.ts`의
  `settleCompletions`)에 적용됩니다.
- Rainy Day 이벤트는 **의도적으로 없음** — 실제 강우 데이터/센서 없이
  비가 온다고 주장하지 않습니다 (§23 주의사항).

## 4. 성격 시스템 — 템플릿이 기본, AI는 선택

- 성격 5종: `cute / calm / funny / energetic / shy` (`src/types/game.ts`).
  성격은 **말투만** 바꿉니다 — 물리적 진단(온도·습도·조도·pH 판정)은 절대 바꾸지 않습니다 (§13).
- 기본 레이어는 `src/game/personality/templates.ts`의 **결정적 템플릿**
  (5성격 × 6무드 전체 매트릭스, Overheating 문구는 §13 원문 그대로).
- AI 레이어(`src/lib/ai.ts`)는 **선택 사항**입니다:

```text
.env.local 에 추가 (서버 전용 — 브라우저 노출 금지):
ANTHROPIC_API_KEY=sk-ant-...
```

  - 키가 없으면 → 즉시 `null` 반환 → 템플릿 사용. 게임은 AI 없이 완전히 동작합니다.
  - 키가 있어도: 네트워크 오류, 타임아웃(4초), 비정상 응답, 300자 초과 응답
    → 전부 `null` → **항상 템플릿으로 폴백**. AI가 게임을 깨뜨릴 방법이 없습니다.
  - 모델은 `claude-haiku-4-5`(짧은 한두 문장용), 의미 있는 이벤트에서만 호출
    (센서 샘플마다 호출 금지, §24).
  - AI는 서보 각도, 펌프, pH 투여, 퀘스트 판정, XP를 **절대 결정하지 않습니다** —
    그런 입력 자체를 받지 않습니다.

## 5. 게임 틱 — `POST /api/game-tick`

홈 화면(`src/components/plant-home.tsx`)이 **60초마다** `POST /api/game-tick`을
호출하고, 서버 페이지 로드(`src/app/page.tsx`)에서도 한 번 실행합니다.

**왜 필요한가:** 퀘스트 완료는 타이머가 아니라 타임스탬프로 판정하므로
(Correction 4), "5분 안정 유지" 같은 시간 조건은 **다음 평가 시점**에야
완료 처리됩니다. 새 디바이스 이벤트가 안 들어오면 평가 계기가 없으니,
이 틱이 lazy 재평가를 걸어 시간 조건 퀘스트가 1분 안에 완료되게 합니다.

- 요청: `{ "plantId": "plant-01" }` (본문 생략 시 plant-01), 응답 `{ ok: true }`.
- 저장된 타임스탬프가 증명하는 것 이상은 아무것도 주지 않는 순수 재평가라
  멱등이며, 인증 없이 호출해도 안전합니다. 완료 결과는 Realtime으로 UI에 반영됩니다.

수동 확인 (PowerShell):

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/game-tick -Method Post `
  -ContentType "application/json" -Body '{"plantId":"plant-01"}'
```

## 6. 데모 시나리오 (인수인계 Phase 20)

리허설은 `scripts/demo-rehearsal.ps1`로 이벤트 시퀀스를 자동 전송하거나,
`docs/SETUP-milestone1-2.md` 5장의 수동 명령으로 한 단계씩 진행합니다.

| 순서 | 이벤트 | 하드웨어(Node-RED 로컬 제어) | 웹 |
|---|---|---|---|
| 0 | 시작 상태 | — | Jamkachu · Happy, Bond Lv.2 · 70/100 XP |
| 1 | 온도 34°C → `PLANT_STATE_CHANGED` (Overheating) | RGB 빨강, 서보 열림, LCD "Too Hot" | Jamkachu가 🔥 Overheating으로 전환 + **NEW QUEST: Cool Me Down (+30 XP)** 카드 |
| 2 | 29°C로 회복 → Overheating 이탈 이벤트 | RGB/LCD 정상 복귀 | 퀘스트가 VERIFYING — "Verifying… 5:00 left" 카운트다운 |
| 3 | 5분 안정 유지 (게임 틱이 완료 판정) | — | **Quest Complete + XP 획득**, Bond 게이지 상승 |
| 4 | XP가 100 경계를 넘음 | RGB·부저·LCD 축하 (Node-RED) | **LEVEL UP → Bond Lv.3** 오버레이 |

주의 — **8월 데모에서는 XP가 36입니다**: 완료 정산 시 시즌 배율이 적용되므로
Hot Weather Challenge(×1.2) 기간에는 `COOL_ME_DOWN`이 30이 아니라
`round(30 × 1.2) = 36 XP`를 줍니다. Lv.2 · 70 XP에서 시작하면
100 경계를 넘는 것은 동일하므로 레벨업 연출은 그대로 나옵니다.

같은 이벤트를 실수로 두 번 보내도(`eventId` 동일) `duplicate: true`로
무시되고 XP는 한 번만 지급됩니다 — 카메라 앞에서 재전송해도 안전합니다.

### 6.1 데모 리셋 — `POST /api/demo-reset` (촬영 재시도용)

KBS 다큐 촬영에서 같은 장면을 다시 찍을 때, DB를 손으로 고치지 않고
게임 진행 상태를 처음으로 되돌리는 **파괴적** 엔드포인트입니다.

- **토큰 필수** — `/api/device-events`의 선택적 인증과 달리, 서버에
  `DEVICE_API_TOKEN`이 설정되어 있지 않으면 **403으로 거부**합니다
  (`demo-reset disabled: set DEVICE_API_TOKEN`). 요청에는 항상
  `Authorization: Bearer <토큰>` 헤더가 필요합니다.
- **지워지는 것** (해당 plant의 행만): `quests` / `xp_rewards` / `bond_events` /
  `plant_badges` / `device_events`. 이어서 `bond_state`를 초기값
  (Lv.1 · 0 XP · 스트릭 0 · 챕터 1)으로 되돌리고,
  `plants.current_state = 'Happy'` + `state_changed_at = epoch`로 설정해
  다음 실제 이벤트가 항상 적용되게 합니다.
- **지워지지 않는 것**: `growth_records`(실제 성장 기록)와
  `sensor_readings`(Node-RED 소유 테이블)는 절대 건드리지 않습니다.
- 리셋 후에는 Lv.1 · 0 XP에서 시작하므로, 6장 시나리오의 베이스라인
  (Lv.2 · 70 XP)이 필요하면 촬영 전에 별도로 다시 맞춰야 합니다.

스크립트 사용 (확인 프롬프트가 뜨며, `-Force`로 생략):

```powershell
pwsh -File scripts/demo-reset.ps1 -Token <DEVICE_API_TOKEN 값> `
  [-PlantId plant-01] [-BaseUrl http://localhost:3000] [-Force]
```

성공 시 `{ ok: true, cleared: { quests: n, ... } }` 형태로 지운 행 수를 보여줍니다.

## 7. 인수 기준 체크리스트 (§40 Core Game)

```text
□ supabase/milestone3.sql 실행됨 (bond_state / quests / plant_badges /
  bond_events / xp_rewards + award_xp RPC 존재)
□ Quest Engine — Overheating 진입 시 COOL_ME_DOWN이 ACTIVE로 생성됨
□ Quest 검증 — 회복 후 5분 안정 유지 시에만 COMPLETED (창이 끝나기 전에
  VERIFYING 중 재발하면 ACTIVE로 원복 / 창이 끝난 뒤 재진입하면 COMPLETED 유지)
□ XP 엔진 — 완료 시 award_xp RPC로 XP 지급, 같은 완료 재전송 시 duplicate
□ Bond Level — 100 XP마다 레벨 상승 (levelForXp와 SQL 공식 일치)
□ Level-up — 경계 통과 시 LEVEL_UP 이벤트 + 웹 오버레이

──── Core Game complete ────

□ 성격 템플릿 — 5성격 × 6무드 메시지 (AI 없이 동작)
□ 배지 — FIRST_RESCUE가 첫 회복 퀘스트 완료 시 해금
□ 스토리 — 첫 퀘스트 완료 시 Chapter 2 해금, current_chapter 감소 없음
□ 스트릭 — 하루 1개 퀘스트 완료로 인정, 놓쳐도 XP/레벨 미감소
□ 주간 리포트 — 페이지 열 때 이력에서 계산 (테이블 없음)
□ POST /api/game-tick — 60초 틱으로 시간 조건 퀘스트가 lazy 완료됨
```

## 8. 다음 단계

Core Game이 안정되면: AI 대화 레이어 활성화(`ANTHROPIC_API_KEY`) → UI 폴리시 →
실제 Arduino 플로우 연결(Phase 18) → 실패 테스트(Phase 19) → 데모 리허설(Phase 20).
그 후에야 Node-RED의 레거시 XP 분기를 비활성화합니다 (Correction 1).
