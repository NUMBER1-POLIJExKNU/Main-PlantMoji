# PlantMoji — Character-First UX Reframe + Dopamine Reward Layer

**Date:** 2026-08-07 · **Deadline:** 3 days (team returns to Korea) · **Status:** Approved by product owner

> **North star:** *"The experience should feel like Tamagotchi + real plant care, not an IoT management dashboard."*
> The project's technical core is sensors; the product's UX core is **Jamkachu, the character**.

## 한국어 요약 (KO summary)

승인된 범위: (1) 캐릭터 중심 UX 리프레임 — Jamkachu가 주인공, 센서는 7순위, 네비 라벨 탈기술화, Demo Max 숨김, 픽셀 폰트는 제목/게임 요소만, 색 대비 강화, 로고 PLANT MOJI 통일. (2) 도파민 레이어 전체(Full Cozy Arcade 20개 + 보강 3개) — 8비트 사운드(기본 ON), 럭키 ×2 실제 XP(서버 결정론), 탭 인터랙션(씨앗 팟 수확, 쓰다듬기, 리추얼 버튼), 기대감(검증 반짝임), 오브 캐스케이드, 리즌 칩, 스트릭 키퍼, 실루엣 컬렉션, 챕터 게이트 피크, 햅틱, /reports 리캡, 데모 스크립트. 윤리 가드레일: 탭은 절대 XP 없음, 보너스만 존재, 압박 없음. 일정이 밀리면 해돋이 → 바이탈 코멘트 → 챕터 게이트 순으로 희생.

---

## 1. Locked decisions

| # | Decision |
|---|---|
| D1 | 8-bit SFX, WebAudio-synthesized (zero external files), **default ON** after first gesture, persistent mute toggle (`localStorage: pm_sound`), synced across pages |
| D2 | **Lucky Sprout ×2**: real XP bonus on quest completion, ~1/8 odds, **server-side deterministic hash** (bonus-only, idempotent) |
| D3 | Scope: **full sweep** — farm home (live.js) + `/quests` + `/collection` + `/reports` (+ `/settings` UX diet) |
| D4 | **More tappable feedback** everywhere; taps NEVER grant XP (§17) |
| D5 | **3-day deadline** — sacrificial tail order: sunrise welcome → vital-row commentary → Chapter Gate simplification. Pillars never slip |
| D6 | **Character-first hierarchy**; keep the existing pixel-art style and cozy-green color direction, with stronger contrast |
| D7 | All UI copy 100% English, centralized in a string table for later Bahasa Indonesia localization |

## 2. UX Reframe (Day 1)

### 2.1 Home information hierarchy (farm page)

Order, top to bottom — sensors are LAST:

1. **Jamkachu** — the character, large, center stage (name shown big: "JAMKACHU")
2. **Mood** — word + face: Happy 😊 · Overheating 🥵 · Dry Air 😵 · Sleepy 😴 · Acidic 🤢 · Alkaline 😖
3. **Character dialogue** — speech bubble ("Today feels perfect!")
4. **Current Quest** — name + live progress ("Stay Happy — 23/30 min"); NEW on home, fed by the existing quests query
5. **Bond** — Lv.3 · 72/100 XP (goal-gradient label "28 to Lv.4")
6. **Streak** — 🔥 3 Days
7. — divider — **Environment**: compact one-line strip `27°C · 61% · Bright · pH 6.5` (the current 5-row vitals panel shrinks to this; detail lives in Plant Status page)

Note: **HP moves up next to Bond/mood** — it is character state (mood-derived), not environment. The environment strip carries only Temperature · Humidity · Light · pH.

### 2.2 Jamkachu character IP

- The mascot SVG becomes **one character with six mood faces**: swap face groups (eyes/mouth/cheeks/tint) per mood state in `renderPlant()`. Same body, same pot — identity persists, expression changes.
- Idle life: gentle blink + sway loop (CSS, steps() easing) so the character is never frozen when no event fires (also the camera-idle shot).
- Name "JAMKACHU" rendered prominently under the mascot in Press Start 2P; mood word beneath it.
- Existing HP-from-mood logic unchanged.

### 2.3 Navigation & chrome

- Nav becomes: **Home · Quests · Growth Diary · Plant Status · Collection · Settings**. (`Monitoring` → Plant Status; the old `History` item actually linked to `/quests`, so quests keep a game-first "Quests" label and **Growth Diary** gets its own item pointing at the growth-record diary in `/settings`.)
- Hide dead links (`Camera AI`, `Shop`) until they exist.
- Sidebar slims ~360px → ~240px; brand fixed to **PLANT MOJI** (logo text), matching the product name PlantMoji everywhere.
- **Demo Max Mode card renders only when `?demo=1`** (server-side code check unchanged). Same gate as presenter hotkeys.

### 2.4 Typography (two tiers)

- **Press Start 2P**: logo, page titles, level/quest names, XP numbers, celebration text.
- **Body sans**: descriptions, forms, sensor data, long copy — React pages via `next/font` Inter (self-hosted at build, offline-safe); the static farm page uses a system sans stack. VT323 retires from body copy.

### 2.5 Contrast & depth (same color direction, stronger)

Design tokens (farm `style.css` vars + React classes):

| Token | Value |
|---|---|
| Primary | `#5FAE45` |
| Dark text | `#243421` |
| Background | `#F4FAF1` |
| Surface | `#FFFFFF` |
| Border | `#BCD3B4` |

Cards: white surface on tinted background with a visible border + pixel shadow — no more light-on-light. Disabled/locked items get an explicit darker treatment, not gray-on-gray (moot for hidden dead links).

### 2.6 Layout diet

- Settings cards (Growth Record etc.): `max-width` 560–640px, inputs sized to content, buttons content-width. No full-bleed forms.
- `/settings` keeps Growth Diary framing ("write a diary line", not "add record to database").

## 3. Dopamine mechanics (approved: full set + 3 reinforcements)

Tier system (celebration hierarchy): T1 micro (button press) < T2 chip (XP gain) < T3 banner (quest) < T4 overlay (level-up) < T5 peak (chapter).

### Infrastructure first
| Mechanic | Spec (condensed) | Seam |
|---|---|---|
| **Celebration queue + budget** | Serializes stacked FX (quest+lucky+level-up) into ordered sequence; per-tier duration caps; total-cap ~6s so FX never block info | new `fxQueue` in live.js; all `fx*` route through it |
| **8-bit SFX engine** | `public/farm/sfx.js`: square/triangle oscillators, ~10 cues (blip, coin, cascade, pod-pop, jackpot arpeggio, level fanfare, chapter theme, pet boing, splash, whoosh); unlock on first pointerdown; sound only on data *diffs* (never on poll refresh); 1.5s per-category rate limit; mute short-circuits before node creation; loaded by farm page AND React layout | new file + one `sfx.play()` per existing/new fx hook |
| **Haptics** | `navigator.vibrate(10–30ms)` on pod claim, lucky stamp, level-up, button press; follows the mute preference | same hooks as SFX |

### Server (the only backend change)
| Mechanic | Spec | Seam |
|---|---|---|
| **Lucky Sprout ×2** | After base quest award: `lucky = fnv1a32("lucky:"+quest.id) % 8 === 0`; if lucky, second `awardXp` with key `lucky:<questId>`, amount = base amount (net ×2), reason `lucky-bonus:<questKey>`. Replay-stable, idempotent, precomputable for demo. Odds disclosed honestly in Collection help ("1 in 8 quests sprouts a lucky bonus!"). Never near-miss copy, never a loss | `event-router.ts` settle block (~:245), reusing `hashDailyKey`; SQL migration adds `bond_events` to realtime publication (milestone8) |

### Tap layer (D4)
| Mechanic | Spec | Seam |
|---|---|---|
| **Tap-to-Claim Reward Pod** | Quest completes → pixel seed-pod drops by Jamkachu, wiggles; tap (≥64px target) → pop sound + burst + releases orb cascade + banner. Auto-bursts after 8s (and on page-hide) so nothing stalls. Only element with `pointer-events:auto` in FX layer. Presentation-only: XP already in ledger | `celebrateQuest()` start |
| **Water/Fertilize Rituals** | Dead buttons live: chunky 3px press + splash/sparkle particles + Jamkachu reaction + why-card ending "Real care = real XP. The sensors will notice." Shared cooldown; zero XP | handlers in live.js `main()`; copy from why-cards |
| **Jamkachu petting** | Tap mascot: squash-stretch bounce + heart pixel + rotating personality line; escalating responses on repeat taps; satiation yawn cooldown (in-fiction); NO counters, NO achievements, zero XP | mascot wrapper listener |
| **Universal button micro-juice** | Every button: sub-100ms press-down + blip; React pages via shared `JuiceButton` styles | style.css + React components |
| **Pressable vital rows** | Tap an Environment/Plant Status row → Jamkachu comments using the mood engine's own thresholds (never contradicts state) | vitals strip + monitoring page |
| **Streak flame press** | Tap streak flame → "3 days in a row! Care today makes 4." Flame sprite grows at 7/14/30 milestones | streak badge |

### Reward loop (Day 2)
| Mechanic | Spec | Seam |
|---|---|---|
| **Causal Echo** | Sensor diff (e.g. humidity +8pts between readings) → chip anchored to the gauge: "Soil drank it up! +18%" + brief perk-up frame; if a matching quest is VERIFYING, chip says "Sensor saw your care — verifying…" | `renderSensors()` diff |
| **Verifying Shimmer** | VERIFYING quests render as amber card (magnifier sprite, blinking dots, "Sensor is checking…"); on flip to COMPLETED: 600ms hold (dim 10%, rising 3-note arpeggio) → then celebration. Skip hold if quest arrives already-completed | `trackQuest()` |
| **XP Orb Cascade** | Award splits into ceil(amount/10) orbs (cap 8; 16 gold when lucky), staggered 400ms arcs to XP bar; each arrival ticks bar+counter with rising pentatonic blip. Reduced-motion: existing single count-up | `fxXpGain()` |
| **Reason Chips** | Subscribe `bond_events` (realtime, after migration): chip shows "+30 XP · Quest Complete" / "· Lucky ×2!" / "· 7-day streak!" via enum→label dictionary; fallback to unlabeled chip if channel down | live.js realtime + string table |
| **Streak keeper chip** | Once/day, 07:00–20:00 only, only when today uncared: "🔥 3 days going — Jamkachu would love a visit today." Broken streak: kind restart copy. No countdowns, no guilt | `renderBond()` + localStorage once-flag |
| **Silhouette Collection** | `/collection` client island: locked badges as dark silhouettes with honest hints, "1 more to go!" pull on near-complete, realtime badge flip celebration (CSS-only, 4s budget) | collection-tabs.tsx |

### Peaks & polish (Day 3)
| Mechanic | Spec | Seam |
|---|---|---|
| **Chapter Gate (T5 peak)** | Chapter unlock = biggest moment: chapter theme jingle, full-screen pixel vignette, tap-through dialogue with auto-advance fallback | live.js overlay + story defs |
| **/reports weekly recap** | Animated count-ups: XP earned, streak arc, best care day — the week's peak-end | reports page client island |
| **Sunrise welcome** | One-time-per-day honest ambiance on load (sun rises over farm, no reward iconography) — first-30-seconds motion for the camera | env-background |
| **Demo script** | `?demo=1`: presenter hotkeys force-play lucky/level-up/chapter FX (presentation triggers only — no data writes), QA self-test overlay; producers told real path is seeded DB | new `public/farm/demo.js` |
| **Offline fallback** | All new FX degrade silently when Supabase unconfigured; static demo mode shows honest "DEMO" tag | existing guard pattern |

## 4. Ethics guardrails (non-negotiable, handoff §17/§23/§45)

1. XP only ever from sensor-verified care. Taps/petting/buttons: zero XP, zero hidden counters.
2. Lucky bonus is strictly additive; odds honestly disclosed; no near-miss theatrics, no daily-cap grind loops.
3. No countdown pressure, no guilt copy, no fake scarcity. Streak messaging is warm and daytime-only.
4. Celebration total-duration caps; `prefers-reduced-motion` honored by every new effect; mute always one tap away.
5. Demo hotkeys are presentation-only and disclosed to producers; seeded-DB real-sensor path preferred for filming.

## 5. Testing & verification

- Vitest: lucky-hash determinism + idempotent double-settle; celebration queue ordering; streak-chip window logic; string-table completeness (every referenced key exists).
- `node --check` on all public/farm JS; ESLint + `next build`; 195+ tests stay green.
- Manual QA checklist (pre-filming): sound unlock on target devices, mute persistence, pod auto-burst, offline reload, reduced-motion pass, contrast check on projector.

## 6. Out of scope

- Bahasa Indonesia UI toggle (string table prepares it; not in the 3 days)
- Node-RED / hardware changes; crop-profile DB plan (separate doc)
- Shop / Camera AI features (links hidden instead)
- React PlantHome revival (home stays the static farm page this sprint)
