# PlantMoji · Gameplay & Usability Plan

*A trilingual document for the PlantMoji team — English (team working language) · Bahasa Indonesia · 한국어. All three sections below contain exactly the same information; read only the section in your language.*

*Dokumen tiga bahasa untuk tim PlantMoji — Inggris (bahasa kerja tim) · Bahasa Indonesia · 한국어. Ketiga bagian di bawah berisi informasi yang sama persis; silakan baca bagian sesuai bahasa Anda saja.*

*PlantMoji 팀을 위한 3개 언어 문서 — 영어(팀 공용어) · Bahasa Indonesia · 한국어. 아래 세 섹션은 완전히 동일한 내용을 담고 있습니다. 본인 언어의 섹션만 읽으면 됩니다.*

## Table of Contents / Daftar Isi / 목차

- [🇬🇧 English](#english)
- [🇮🇩 Bahasa Indonesia](#indonesia)
- [🇰🇷 한국어](#korean)

---

<a id="english"></a>

## 🇬🇧 English

**Audience:** the whole PlantMoji team — Engine owner, Design owner, and anyone rehearsing the KBS filming demo. This document is about **playability**, not features: the backend game systems are built and verified (`docs/SETUP-game-systems.md`), the frontend↔backend wiring is tracked in `docs/INTEGRATION-PLAN-master.md`. This plan asks a different question — **can a 15-year-old in Jember, with no technical background and no instructions, actually enjoy and understand this thing?**

Target user: a non-technical middle/high-school student (13–18), first time seeing the app, in a classroom or demo setting, on a shared/old Android phone, reading English as a second language.

Grounding principles (handoff document §46, quoted directly): *"The user should feel attachment, not guilt." "Traditional knowledge should be respected, not framed as primitive." "Web UI should feel like a companion/game first, dashboard second." "Local control must work offline." "Demo reliability matters more than feature count."* And §33: the web app must be **mobile-first and Tamagotchi-like** — "Do not make the home page look like an industrial smart-farm dashboard."

---

### 0. Before you start — one seam every workstream below depends on

Current code has a split-brain home screen, and it changes what "the app" even means for a first-time student:

- `next.config.ts` rewrites `/` straight to the static file `public/farm/index.html` (Design-owned mockup markup, bound to live data by `public/farm/live.js`). Because this is a rewrite to a static public file, it **bypasses `src/app/layout.tsx` and `RenoAppShell` entirely** — no sidebar nav component, no shared shell, nothing from the rest of the React app.
- Separately, `src/app/page.tsx` renders a fully-wired React `PlantHome` component (`src/components/plant-home.tsx`) — real Supabase Realtime subscription, `BondPanel`, `HomeQuestCard`, `LevelUpOverlay`, `EmotionBadge`, animated mascot faces. **This is currently unreachable by browser navigation to `/`** because the rewrite above always wins first.
- The other routes (`/quests`, `/collection`, `/reports`, `/settings`) *do* go through `RenoAppShell`, so a student navigating away from Home and back gets a visually different frame than Home itself.

**Task (Engine + Design, together, before anything else in this document):**
- [ ] Decide which home is canonical — the static `public/farm/` page, or the React `PlantHome` at `src/app/page.tsx` — and either delete/park the other or make the rewrite conditional. Onboarding (Workstream 1), the always-visible quest card (Workstream 3), and celebration overlays (Workstream 4) all need to be built on top of *one* real home screen, not two.

Also relevant to Workstream 8 (Classroom Ergonomics): the web app itself is **not** designed to work offline — it needs Supabase connectivity. Handoff §46's "local control must work offline" is about Arduino/Node-RED continuing to run the physical safety loop without the web backend, **not** about the phone working without WiFi. Confirm classroom WiFi/data is available as a separate checklist item — don't conflate the two kinds of "offline."

---

### 1. First-Contact Onboarding

**Goal:** a student who has never seen PlantMoji before understands the core loop — *plant feels something → I help → sensors confirm → I grow* — inside 3 minutes, with nobody explaining anything out loud.

**Tasks:**
- [ ] Resolve the Workstream 0 seam first — onboarding must attach to one real home screen.
- [ ] Build a first-launch "name your plant" moment that ties to Story Chapter 1 ("First Meeting," handoff §19). Reuse the existing name field already in `src/app/settings/page.tsx` / `updatePlantSettings` action rather than inventing a second name-storage path — surface it as a first-run step instead of a buried settings field.
- [ ] Build a 3-step "how it works" walkthrough shown once on first visit: (1) *your plant feels things* — mood emoji + one-line meaning, (2) *you help* — a quest appears, (3) *sensors confirm, you grow* — XP/Bond Level rises. Reuse the existing `Notice` card visual pattern (`src/components/notice.tsx`) rather than introducing a new modal system.
- [ ] Add one short first-visit tooltip/callout per page (Home, Quests, Collection, Report, Settings), each dismissible and shown only once. Gate with a simple `localStorage` flag per page — there is no login system, so this must not depend on a user/account table.
- [ ] Pull the walkthrough's step-1 emotional hook from the existing Chapter 1 dialogue (`src/game/story/story-dialogue.ts`, handoff §19) instead of writing new copy from scratch — the story system already has an onboarding-shaped beat.

**Owner:** Both — Engine wires the once-only flag and hooks Chapter 1 in; Design builds the walkthrough visuals and tooltip placement.

**Acceptance test:** *A first-time student, given only the URL, can explain out loud within 3 minutes what their plant needs right now and what will happen if they help it — without a teacher or teammate saying a single word.*

---

### 2. Plain-Language Layer

**Goal:** no screen ever shows a technical term a 13–18-year-old hasn't already been given a plain-language translation for, right next to it.

**Tasks:**
- [ ] Build a per-screen jargon audit checklist and walk it screen by screen: Home (mood label + any raw sensor numbers shown), Quests (`src/game/education/why-cards.ts` — `QUEST_WHY` / `WHY_CARDS` are already written in plain language; verify none regressed), Collection's "Wisdom" tab (already translates proverbs into metrics — check the reverse direction holds too, i.e. metrics are glossed in plain words), Reports (healthy time / overheating events / Bond Level), Settings (personality, growth stage).
- [ ] Add a one-line plain-language gloss next to every raw metric that is shown: **pH → "how sour or bitter the soil is,"** **air humidity → "how much water is in the air around the plant — not the soil,"** and keep that humidity-vs-soil-moisture distinction explicit anywhere both could be confused (README.md already states "DHT11 humidity is treated as air humidity, not soil moisture" for the team — the UI needs the student-facing version of that same sentence).
- [ ] Confirm VPD (vapor-pressure deficit) never appears in any UI copy anywhere — it is an engine/threshold concept only. Treat a repo-wide search for "VPD" outside `src/game/` and hardware docs as the pass/fail check.
- [ ] Mood labels already ship with emoji (`MOOD_LABELS`, `src/types/events.ts`) — extend the same one-line-gloss pattern to badge names/descriptions and story chapter titles, which currently read like generic game text ("First Rescue," "Trust") without a plain explanation of what happened in-world.
- [ ] Turn the audit into a literal table (screen → term → current copy → plain gloss → done?) so Design can tick items off before filming, rather than re-discovering gaps live on camera.

**Owner:** Design leads the copy pass; Engine reviews the education-layer files (`why-cards.ts`, personality templates) for factual accuracy so plain language doesn't drift from what the sensors actually mean.

**Acceptance test:** *A 15-year-old with no science background can point at any word on any screen and, without asking anyone, read the line right next to it and correctly explain what it means in their own words.*

---

### 3. Always-Visible Progress & Next Action

**Goal:** at any moment, the screen answers two questions without the student searching: *"what should I do now?"* and *"what do I get for it?"*

**Tasks:**
- [ ] Confirm `HomeQuestCard` (fixed props: `emoji` / `title` / `statusLabel` / `progressLabel`, `src/components/home-quest-card.tsx`) renders prominently above the fold on whichever home screen wins the Workstream 0 decision — today it only exists inside `PlantHome`, not in `public/farm/index.html`.
- [ ] The "no active quest" empty state in `src/app/quests/page.tsx` already frames it well ("No active quest right now — I'm just vibing" / "A new quest appears when my mood changes") — apply the same next-action framing to `HomeQuestCard`'s `quest: null` case on the Home screen itself, since that's the screen students see first and most often.
- [ ] `QuestProgress` (`src/components/quest-progress.tsx`) already renders a live mm:ss countdown for `VERIFYING` quests and an elapsed/total count for `maintain` quests — confirm this is visible on Home, not only after navigating into `/quests`.
- [ ] Make `BondPanel`'s XP bar fill animate (CSS transition) on change rather than snapping instantly, so XP gain registers even in a quick 30-second glance at the screen.
- [ ] `BondPanel.streakDays` already hides the streak row entirely at 0 (correct — nothing to punish-display) — confirm the streak is visible on Home whenever it's non-zero, not something a student only discovers by opening Reports.
- [ ] Sweep every other idle/empty state for a missing next action: Collection tabs before anything is unlocked, Settings' growth-record list when empty.

**Owner:** Both — Engine's data plumbing for quest/XP/streak already exists per `docs/SETUP-game-systems.md`; Design owns visual prominence, placement, and the fill animation.

**Acceptance test:** *At any random moment a teacher points at the screen, a student can say — within 5 seconds, without scrolling or tapping anything — "right now I need to do ___ to get ___."*

---

### 4. Celebration & Feedback

**Goal:** level-up, badge-unlock, and chapter-unlock moments feel like a big deal to the student, not like a quiet database write.

**Tasks:**
- [ ] `LevelUpOverlay` (`src/components/level-up-overlay.tsx`, fixed props: `level` / `show` / `onDone`) already exists — confirm it is wired into whichever home screen wins the Workstream 0 decision (today it only lives inside `PlantHome`, not `public/farm/`).
- [ ] `EmotionBadge` (Proud / Excited / Curious / Recovering, handoff §12) already implements a nice ephemeral pop-and-fade pattern for in-game emotions — extend that same event-driven pattern to badge unlocks and story-chapter unlocks, which today only appear passively inside the Collection tabs with no in-the-moment celebration at all.
- [ ] Six mood-specific mascot faces are planned (handoff/`docs/INTEGRATION-PLAN-master.md` Track 1 item 4): `Happy` and `Overheating` exist in `src/components/mascot.tsx` today — finish `DryAir`, `Sleepy`, `SoilAcidic`, `SoilAlkaline` so the mascot itself visibly reacts, not just a badge or text next to it.
- [ ] Sound: keep default **off** for classroom use. No audio system exists in the codebase today — if one is ever added, default-mute must be a launch requirement, not a later toggle, since a room of 30 phones all chiming is a real classroom-disruption risk.
- [ ] Haptics: not applicable on web — explicitly out of scope, don't spend time on it.

**Owner:** Design leads visual/animation polish; Engine owns wiring the trigger events (level-up wiring already partly exists; badge/chapter triggers are new plumbing).

**Acceptance test:** *When a student's plant levels up during class, at least one other student two seats away notices something happened on their screen without being told to look.*

---

### 5. Session Rhythm

**Goal:** the same app works for three genuinely different real-world usage patterns without a redesign for each.

**Tasks:**
- [ ] Map existing systems explicitly to the three cadences:
  - **In-class glance (~30s):** Home mood + quest card + XP bar (Workstream 3).
  - **Daily care (~5 min):** `/quests` detail view + "Why this matters" education cards (`why-cards.ts`) + a Collection check-in.
  - **Weekly review (~10–15 min):** `/reports` stat tiles (healthy time / quests completed / overheating events / Bond Level) + the AI-or-template weekly narration (`getWeeklyReportNarration`).
- [ ] Identify the gap: "daily random events" don't exist yet as a lightweight system — `src/game/seasonal/seasonal-events.ts` currently only has two long-running, season-scale multipliers (`HOT_WEATHER`, `WEEKEND_GROWTH`), not a short daily nudge. Scope what a minimal daily micro-event would need before committing to it — this is new work, not a polish pass.
- [ ] `streak-engine.ts` already anchors "did I check in today" — make sure the streak is legible in the 30-second glance view (ties to Workstream 3), not something that only shows up in the weekly report.
- [ ] Confirm the existing 60-second `POST /api/game-tick` client poll (already running from `plant-home.tsx` per `docs/SETUP-game-systems.md` §5) keeps the 30-second glance view accurate even when a student does nothing but look at the screen.

**Owner:** Both — Engine scopes the daily-events gap and confirms tick timing; Design makes each cadence visually distinct (Home = glance, Quests = daily, Reports = weekly) so students learn where to look for what.

**Acceptance test:** *A student who only ever opens the app for 30 seconds at the start of class, every school day for a week, still sees their streak and Bond Level go up — without ever opening the Quests or Reports tab.*

---

### 6. Fail-Soft & Tone

**Goal:** nothing the app ever shows reads to a student as punishment, blame, or "something is broken and it's my fault."

**Tasks:**
- [ ] Spot-check the no-punishment rule (handoff §21, §45 — losing XP/levels for missing a day is explicitly forbidden) actually holds in `src/game/progression/streak-engine.ts`: streak resets to 1 on a missed day, XP and Bond Level never decrease.
- [ ] Every current `Notice` component instance (`src/components/notice.tsx`, used across `src/app/**/page.tsx`) shows developer-facing copy — *"Supabase environment variables are not set yet," "Check that supabase/milestone3.sql has been run."* That's correct for the team but the wrong register for a student watching a real outage. Add a student-facing friendly tier ("nothing broke — the sensors are napping, try again in a minute") that shows instead of the debug detail when the audience is a classroom, not an operator.
- [ ] The `SENSOR_OFFLINE` / `SENSOR_ONLINE` watchdog (Node-RED plan, 45s silence threshold) needs a friendly on-screen state — confirm the web app shows something warm rather than a frozen-looking, silently-stale screen when this fires.
- [ ] Audit existing tone as a positive example to copy from: `src/app/quests/page.tsx`'s empty state ("No active quest right now — I'm just vibing") is exactly the right voice — extend it consistently everywhere a student might otherwise see a technical error string.

**Owner:** Design leads tone/copy; Engine flags which current error states are dev-only strings needing a student-facing variant.

**Acceptance test:** *Shown a deliberately broken/offline state, a student describes what they see as "the plant/sensors are resting" or similar — never "it's broken" or "I did something wrong."*

---

### 7. Language Access

**Goal:** produce a real, scoped plan for an Indonesian UI toggle — not necessarily ship it this week — since the target students are Indonesian and the current UI is English-only.

**Tasks:**
- [ ] Inventory the current string surface: mostly hardcoded JSX strings spread across `src/app/**/page.tsx` and `src/components/*.tsx`, plus content-bearing modules — `MOOD_LABELS` (`src/types/events.ts`), quest/badge/story definitions (`src/game/**/*-definitions.ts`), personality templates (`src/game/personality/templates.ts`), education cards (`why-cards.ts`). There is no i18n library or dictionary module in the codebase today.
- [ ] Propose the approach: extract UI-facing strings into a dictionary module (e.g. `src/lib/i18n/strings.ts`) keyed by string ID with English + Indonesian values, plus a small `t(key)` helper. A full i18n framework is not justified for one extra language and no per-user account system — `localStorage` can hold the chosen language the same way onboarding flags will (Workstream 1).
- [ ] Scope estimate: this touches nearly every page, every presentational component, and every game-content definition file — realistically **Large** effort, and not a this-week task. Sequence it after the demo, since it's the one workstream here that crosses both Engine's and Design's owned files simultaneously (per `CONTRIBUTING.md`'s ownership split) and needs coordinated review either way.
- [ ] Note explicitly: the trilingual pattern already used in `README.md`, `CONTRIBUTING.md`, and `docs/INTEGRATION-PLAN-master.md` is for **internal team docs**, not runtime UI — it's not reusable code, just a precedent that the team already thinks in three languages.
- [ ] Decide a realistic v1 scope: translating the Workstream 2 plain-language glosses and the quest/mood copy first (what a student reads most, every single session) is a far smaller slice than translating Settings/Reports admin-style copy, and should be prioritized that way if this work starts before a full toggle exists.

**Owner:** Both — Engine builds the dictionary module and `t()` plumbing; Design writes/reviews the Indonesian copy, ideally with a native-speaking teammate checking it.

**Acceptance test:** *This is a planning workstream, not a this-week deliverable — the acceptance test is that a new contributor can read this section alone and start the `src/lib/i18n/strings.ts` work without asking anyone what "the i18n approach" means. (Once shipped, the real test becomes: a student who reads Indonesian more comfortably than English can complete a full quest loop reading only Indonesian text.)*

---

### 8. Classroom Ergonomics

**Goal:** a teacher with zero coding background can put this in front of a room of students on old Android phones with minimal setup friction.

**Tasks:**
- [ ] Generate a QR code pointing at the deployed Vercel URL, sized for a printable half-sheet handout. No code change required — just an asset (e.g. dropped in `public/`) and a printed sheet for the classroom.
- [ ] Bundle-size check on old Android phones: `recharts` is a dependency (`package.json`) but does not appear to be imported by the current Reports page (`src/app/reports/page.tsx` renders plain stat tiles, no chart). Confirm with `npm run build`'s output/analysis whether it's tree-shaken away or shipping dead weight to every page load — don't assume either way without checking.
- [ ] No login required is already true by design — every page hardcodes `PLANT_ID = "plant-01"`, and there is no auth system anywhere in the codebase. Document this explicitly as *intentional* so nobody "fixes" it into a login flow right before filming.
- [ ] Teacher/demo mode already has a real endpoint: `POST /api/demo-reset` (token-gated, `scripts/demo-reset.ps1`, documented in `docs/SETUP-game-systems.md` §6.1). Write a one-page rehearsal script for a non-engineer demo operator to run between class periods or filming retakes — including the caveat that a reset drops the plant back to Lv.1 / 0 XP, so if a demo scenario assumes a specific starting point (e.g. the Lv.2 / 70 XP baseline in `docs/SETUP-game-systems.md` §6), that baseline has to be re-created manually afterward.
- [ ] Projector-friendly contrast check: current mood-scene tints and badge/status pill colors were designed for a phone screen at arm's length — audit them for a bright classroom or a projector viewed from the back of a room (larger text where possible, flag any low-contrast pastel-on-white combinations already in use, e.g. some badge/mood chip colors).
- [ ] Confirm classroom WiFi/mobile data is available and budgeted for as a separate checklist item — per the Workstream 0 note, the web app needs live Supabase connectivity and is not designed to run offline (that guarantee applies only to the Arduino/Node-RED hardware safety loop, not the phone screens).

**Owner:** Both — Engine owns the demo-reset rehearsal script and the bundle-size check; Design owns the QR asset and the contrast audit.

**Acceptance test:** *A teacher who has never seen the code can scan a printed QR code with an old Android phone, load the app in under 10 seconds, and reset it to a clean demo state between two student groups using only a one-page instruction sheet.*

---

### 9. Playtest Protocol

**Goal:** catch real usability problems with 3–5 actual local students, using a fixed 30-minute script, before the KBS filming date.

**Tasks:**
- [ ] Recruit 3–5 students matching the target audience (13–18, non-technical, ideally Indonesian-speaking, ideally connected to the WFK program's partner school network if one is available).
- [ ] Write the 30-minute script:
  - **~3 min — silent first look.** No instructions given. Just watch what they tap first. This directly tests Workstream 1's acceptance criterion.
  - **~10 min — task list.** Name the plant; find the current quest; explain in their own words what the current mood means; find their streak; observe a level-up if timing allows.
  - **~10 min — think-aloud** on 2–3 screens (Home, Quests, and one more — Collection or Reports).
  - **~5–7 min — debrief questions.** "What confused you?" "What would you tap first, and why?" "What does pH mean to you now?"
- [ ] Build a simple observation log template: what they tapped first, where they hesitated more than ~5 seconds, what they misread as a technical term, whether they found the next action unaided.
- [ ] Run the script once as early as possible against the "This week" items below, then a lighter ~10-minute re-check after the "Before filming" fixes land, ahead of the actual KBS filming date.
- [ ] Feed findings directly back into the acceptance tests in Workstreams 1–6 above — a failed acceptance test in the playtest becomes a "before filming" fix-backlog item, not a footnote.

**Owner:** Both — Design leads the script and facilitation; Engine logs any technical failures observed during the session (e.g. a sensor-offline moment, a slow load) alongside the usability notes.

**Acceptance test:** *After running the script once, the team has a written list of at least 3 concrete confusion points from real students, each one traceable to a specific workstream (1–6) above.*

---

### 10. Phased priority & effort estimates

Effort key: **S** = under a day · **M** = 1–3 days · **L** = multi-day, crosses many files/owners.

**This week**

| Workstream | Item | Owner | Effort |
|---|---|---|---|
| 0 | Resolve the home-screen seam (static `/farm/` vs React `PlantHome`) | Both | S |
| 3 | Wire `HomeQuestCard` + XP bar animation onto the canonical home | Both | M |
| 6 | Spot-check no-punishment rule holds in `streak-engine.ts` | Engine | S |
| 2 | Build the per-screen jargon audit checklist (audit only, not fixes yet) | Design | S |
| 9 | Write the 30-minute playtest script | Design | S |

**Before filming**

| Workstream | Item | Owner | Effort |
|---|---|---|---|
| 1 | Full first-contact onboarding flow (name moment + 3-step walkthrough + tooltips) | Both | M |
| 2 | Complete the plain-language gloss pass across all screens | Design | M |
| 3 | Sweep and fix remaining empty/idle states missing a next action | Both | S |
| 4 | Wire badge/chapter celebration events + finish 4 remaining mascot faces | Both | M |
| 5 | Streak visible on Home glance view; confirm 60s tick keeps glance accurate | Both | S |
| 6 | Student-facing friendly error/offline tier for `Notice` states | Design | M |
| 8 | QR code, demo-reset rehearsal script, bundle-size check, contrast audit | Both | M |
| 9 | Run the playtest with 3–5 students; fix the top findings | Both | M |

**Nice to have (post-filming / stretch)**

| Workstream | Item | Owner | Effort |
|---|---|---|---|
| 7 | Build `src/lib/i18n/strings.ts` dictionary module + full Indonesian UI toggle | Both | L |
| 5 | Design and build an actual lightweight daily-events system | Engine | L |
| 4 | Optional sound design (default-off, opt-in) | Design | S/M |
| 9 | Second, lighter playtest round after nice-to-have fixes | Both | S |

---

<a id="indonesia"></a>

## 🇮🇩 Bahasa Indonesia

**Target pembaca:** seluruh tim PlantMoji — pemilik Engine, pemilik Design, dan siapa pun yang menggladi-bersihkan demo syuting KBS. Dokumen ini membahas **keterpakaian (playability)**, bukan fitur: sistem game backend sudah dibangun dan diverifikasi (`docs/SETUP-game-systems.md`), penyambungan frontend↔backend dilacak di `docs/INTEGRATION-PLAN-master.md`. Rencana ini mengajukan pertanyaan berbeda — **bisakah seorang remaja 15 tahun di Jember, tanpa latar belakang teknis dan tanpa instruksi apa pun, benar-benar menikmati dan memahami aplikasi ini?**

Pengguna target: siswa SMP/SMA non-teknis (13–18 tahun), pertama kali melihat aplikasi ini, di ruang kelas atau situasi demo, memakai ponsel Android bersama/lama, membaca bahasa Inggris sebagai bahasa kedua.

Prinsip dasar (dokumen serah terima §46, dikutip langsung): *"Pengguna harus merasakan keterikatan (attachment), bukan rasa bersalah (guilt)." "Pengetahuan tradisional harus dihormati, tidak dibingkai sebagai sesuatu yang primitif." "UI web harus terasa seperti companion/game lebih dulu, dashboard kedua." "Kontrol lokal harus tetap bekerja secara offline." "Keandalan demo lebih penting daripada jumlah fitur."* Dan §33: aplikasi web harus **mobile-first dan bergaya Tamagotchi** — "Jangan buat halaman utama terlihat seperti dashboard smart-farm industrial."

---

### 0. Sebelum mulai — satu celah yang menjadi dasar semua workstream di bawah

Kode saat ini memiliki layar utama "split-brain" (dua kepribadian), dan ini mengubah arti "aplikasi" itu sendiri bagi siswa yang baru pertama kali memakainya:

- `next.config.ts` me-rewrite `/` langsung ke berkas statis `public/farm/index.html` (markup mockup milik Design, diikat ke data live oleh `public/farm/live.js`). Karena ini adalah rewrite ke berkas publik statis, ini **melewati `src/app/layout.tsx` dan `RenoAppShell` sepenuhnya** — tidak ada komponen nav sidebar, tidak ada shell bersama, tidak ada apa pun dari sisa aplikasi React.
- Secara terpisah, `src/app/page.tsx` me-render komponen React `PlantHome` yang lengkap tersambung (`src/components/plant-home.tsx`) — subscription Supabase Realtime asli, `BondPanel`, `HomeQuestCard`, `LevelUpOverlay`, `EmotionBadge`, wajah maskot beranimasi. **Ini saat ini tidak bisa diakses lewat navigasi browser ke `/`** karena rewrite di atas selalu menang lebih dulu.
- Rute lain (`/quests`, `/collection`, `/reports`, `/settings`) *memang* melalui `RenoAppShell`, sehingga siswa yang berpindah dari Home lalu kembali akan melihat bingkai visual yang berbeda dari Home itu sendiri.

**Tugas (Engine + Design, bersama-sama, sebelum hal lain di dokumen ini):**
- [ ] Putuskan mana yang menjadi home resmi — halaman statis `public/farm/`, atau `PlantHome` React di `src/app/page.tsx` — lalu hapus/parkir yang lain atau buat rewrite-nya bersyarat. Onboarding (Workstream 1), kartu quest yang selalu terlihat (Workstream 3), dan overlay perayaan (Workstream 4) semuanya perlu dibangun di atas *satu* layar home yang nyata, bukan dua.

Juga relevan untuk Workstream 8 (Ergonomi Ruang Kelas): aplikasi web itu sendiri **tidak** dirancang untuk bekerja offline — ia butuh konektivitas ke Supabase. "Kontrol lokal harus tetap bekerja offline" di §46 dokumen serah terima adalah tentang Arduino/Node-RED yang tetap menjalankan loop keamanan fisik tanpa backend web, **bukan** tentang ponsel yang bekerja tanpa WiFi. Pastikan ketersediaan WiFi/data ruang kelas sebagai item checklist terpisah — jangan mencampur dua jenis "offline" ini.

---

### 1. Onboarding Kontak Pertama

**Tujuan:** siswa yang belum pernah melihat PlantMoji memahami loop inti — *tanaman merasakan sesuatu → saya membantu → sensor mengonfirmasi → saya tumbuh* — dalam 3 menit, tanpa ada yang menjelaskan apa pun secara lisan.

**Tugas:**
- [ ] Selesaikan celah Workstream 0 terlebih dahulu — onboarding harus menempel pada satu layar home yang nyata.
- [ ] Bangun momen "beri nama tanamanmu" saat peluncuran pertama yang terhubung ke Story Chapter 1 ("First Meeting," handoff §19). Gunakan ulang field nama yang sudah ada di `src/app/settings/page.tsx` / action `updatePlantSettings` alih-alih membuat jalur penyimpanan nama kedua — tampilkan sebagai langkah first-run, bukan field settings yang terkubur.
- [ ] Bangun walkthrough 3 langkah "cara kerjanya" yang ditampilkan sekali saat kunjungan pertama: (1) *tanamanmu merasakan sesuatu* — emoji mood + arti satu baris, (2) *kamu membantu* — quest muncul, (3) *sensor mengonfirmasi, kamu tumbuh* — XP/Bond Level naik. Gunakan ulang pola visual kartu `Notice` yang sudah ada (`src/components/notice.tsx`) alih-alih membuat sistem modal baru.
- [ ] Tambahkan satu tooltip/callout singkat kunjungan-pertama per halaman (Home, Quests, Collection, Report, Settings), masing-masing bisa ditutup dan hanya muncul sekali. Gunakan flag `localStorage` sederhana per halaman — tidak ada sistem login, jadi ini tidak boleh bergantung pada tabel user/akun.
- [ ] Ambil hook emosional langkah-1 walkthrough dari dialog Chapter 1 yang sudah ada (`src/game/story/story-dialogue.ts`, handoff §19) alih-alih menulis copy baru dari nol — sistem story sudah punya beat yang berbentuk onboarding.

**Owner:** Both — Engine memasang flag sekali-saja dan menghubungkan Chapter 1; Design membangun visual walkthrough dan penempatan tooltip.

**Uji penerimaan:** *Siswa yang baru pertama kali, hanya diberi URL, bisa menjelaskan secara lisan dalam 3 menit apa yang dibutuhkan tanamannya sekarang dan apa yang akan terjadi jika mereka membantunya — tanpa guru atau teman satu tim mengucapkan sepatah kata pun.*

---

### 2. Lapisan Bahasa Sederhana

**Tujuan:** tidak ada layar yang pernah menampilkan istilah teknis yang belum diberi terjemahan bahasa sederhana tepat di sebelahnya, untuk remaja 13–18 tahun.

**Tugas:**
- [ ] Buat checklist audit jargon per layar dan telusuri satu per satu: Home (label mood + angka sensor mentah apa pun yang ditampilkan), Quests (`src/game/education/why-cards.ts` — `QUEST_WHY` / `WHY_CARDS` sudah ditulis dalam bahasa sederhana; verifikasi tidak ada yang mundur), tab "Wisdom" di Collection (sudah menerjemahkan pepatah menjadi metrik — cek juga arah sebaliknya, yaitu metrik dijelaskan dengan kata sederhana), Reports (healthy time / overheating events / Bond Level), Settings (personality, growth stage).
- [ ] Tambahkan penjelasan bahasa sederhana satu baris di sebelah setiap metrik mentah yang ditampilkan: **pH → "seberapa asam atau basa tanahnya,"** **kelembapan udara → "seberapa banyak air di udara sekitar tanaman — bukan di tanahnya,"** dan jaga agar perbedaan kelembapan-udara-vs-kelembapan-tanah ini eksplisit di mana pun keduanya bisa tertukar (README.md sudah menyatakan "DHT11 humidity is treated as air humidity, not soil moisture" untuk tim — UI membutuhkan versi kalimat yang sama namun untuk siswa).
- [ ] Pastikan VPD (vapor-pressure deficit) tidak pernah muncul di copy UI mana pun — itu murni konsep engine/ambang batas. Perlakukan pencarian repo-wide untuk "VPD" di luar `src/game/` dan dokumen hardware sebagai pengecekan lolos/gagal.
- [ ] Label mood sudah dilengkapi emoji (`MOOD_LABELS`, `src/types/events.ts`) — perluas pola penjelasan satu-baris yang sama ke nama/deskripsi badge dan judul chapter story, yang saat ini terbaca seperti teks game generik ("First Rescue," "Trust") tanpa penjelasan sederhana tentang apa yang terjadi di dalam cerita.
- [ ] Ubah audit menjadi tabel literal (layar → istilah → copy saat ini → penjelasan sederhana → selesai?) agar Design bisa mencentangnya sebelum syuting, alih-alih menemukan celah secara live di depan kamera.

**Owner:** Design memimpin pass copy; Engine meninjau berkas lapisan edukasi (`why-cards.ts`, template personality) untuk akurasi faktual agar bahasa sederhana tidak menyimpang dari arti sesungguhnya dari sensor.

**Uji penerimaan:** *Remaja 15 tahun tanpa latar belakang sains bisa menunjuk kata apa pun di layar mana pun dan, tanpa bertanya pada siapa pun, membaca baris di sebelahnya lalu menjelaskan artinya dengan kata-katanya sendiri dengan benar.*

---

### 3. Progres & Aksi Berikutnya yang Selalu Terlihat

**Tujuan:** di momen mana pun, layar menjawab dua pertanyaan tanpa siswa perlu mencari: *"apa yang harus saya lakukan sekarang?"* dan *"apa yang saya dapatkan darinya?"*

**Tugas:**
- [ ] Pastikan `HomeQuestCard` (props tetap: `emoji` / `title` / `statusLabel` / `progressLabel`, `src/components/home-quest-card.tsx`) tampil menonjol di bagian atas layar (above the fold) pada layar home mana pun yang menang dari keputusan Workstream 0 — saat ini komponen ini hanya ada di dalam `PlantHome`, tidak di `public/farm/index.html`.
- [ ] Empty state "no active quest" di `src/app/quests/page.tsx` sudah membingkainya dengan baik ("No active quest right now — I'm just vibing" / "A new quest appears when my mood changes") — terapkan pembingkaian aksi-berikutnya yang sama pada kasus `quest: null` milik `HomeQuestCard` di layar Home itu sendiri, karena itulah layar yang paling sering dan pertama dilihat siswa.
- [ ] `QuestProgress` (`src/components/quest-progress.tsx`) sudah me-render hitung mundur mm:ss langsung untuk quest `VERIFYING` dan hitungan elapsed/total untuk quest `maintain` — pastikan ini terlihat di Home, tidak hanya setelah masuk ke `/quests`.
- [ ] Buat isian XP bar milik `BondPanel` beranimasi (transisi CSS) saat berubah, bukan langsung "snap" instan, agar kenaikan XP terasa bahkan dalam sekilas pandang 30 detik ke layar.
- [ ] `BondPanel.streakDays` sudah menyembunyikan baris streak sepenuhnya saat 0 (benar — tidak ada yang perlu ditampilkan sebagai hukuman) — pastikan streak terlihat di Home kapan pun nilainya bukan nol, bukan sesuatu yang hanya ditemukan siswa dengan membuka Reports.
- [ ] Telusuri setiap idle/empty state lain untuk aksi-berikutnya yang hilang: tab Collection sebelum ada yang terbuka, daftar growth-record di Settings saat kosong.

**Owner:** Both — plumbing data Engine untuk quest/XP/streak sudah ada sesuai `docs/SETUP-game-systems.md`; Design memiliki keunggulan visual, penempatan, dan animasi pengisian.

**Uji penerimaan:** *Kapan pun seorang guru menunjuk ke layar secara acak, siswa bisa mengatakan — dalam 5 detik, tanpa scroll atau mengetuk apa pun — "sekarang saya perlu melakukan ___ untuk mendapatkan ___."*

---

### 4. Perayaan & Umpan Balik

**Tujuan:** momen level-up, badge terbuka, dan chapter terbuka terasa besar bagi siswa, bukan seperti penulisan database yang senyap.

**Tugas:**
- [ ] `LevelUpOverlay` (`src/components/level-up-overlay.tsx`, props tetap: `level` / `show` / `onDone`) sudah ada — pastikan ini tersambung ke layar home mana pun yang menang dari keputusan Workstream 0 (saat ini hanya hidup di dalam `PlantHome`, bukan `public/farm/`).
- [ ] `EmotionBadge` (Proud / Excited / Curious / Recovering, handoff §12) sudah mengimplementasikan pola pop-and-fade sementara yang bagus untuk emosi dalam game — perluas pola berbasis-event yang sama ke pembukaan badge dan pembukaan chapter story, yang saat ini hanya muncul pasif di dalam tab Collection tanpa perayaan sesaat sama sekali.
- [ ] Enam wajah maskot per-mood sudah direncanakan (handoff/`docs/INTEGRATION-PLAN-master.md` Track 1 item 4): `Happy` dan `Overheating` sudah ada di `src/components/mascot.tsx` hari ini — selesaikan `DryAir`, `Sleepy`, `SoilAcidic`, `SoilAlkaline` agar maskot sendiri terlihat bereaksi, bukan hanya badge atau teks di sebelahnya.
- [ ] Suara: default **mati** untuk pemakaian di kelas. Belum ada sistem audio di codebase hari ini — jika suatu saat ditambahkan, default-mute harus menjadi syarat peluncuran, bukan toggle belakangan, karena 30 ponsel berbunyi bersamaan di satu ruangan adalah risiko gangguan kelas yang nyata.
- [ ] Haptik: tidak berlaku di web — secara eksplisit di luar cakupan, jangan habiskan waktu untuk ini.

**Owner:** Design memimpin polish visual/animasi; Engine memiliki penyambungan event pemicu (penyambungan level-up sudah sebagian ada; pemicu badge/chapter adalah plumbing baru).

**Uji penerimaan:** *Ketika tanaman seorang siswa naik level di kelas, setidaknya satu siswa lain dua bangku sebelahnya menyadari ada sesuatu yang terjadi di layarnya tanpa disuruh melihat.*

---

### 5. Ritme Sesi

**Tujuan:** aplikasi yang sama bekerja untuk tiga pola pemakaian dunia nyata yang benar-benar berbeda tanpa perlu desain ulang untuk masing-masing.

**Tugas:**
- [ ] Petakan sistem yang sudah ada secara eksplisit ke tiga ritme:
  - **Sekilas di kelas (~30 detik):** mood di Home + kartu quest + XP bar (Workstream 3).
  - **Perawatan harian (~5 menit):** tampilan detail `/quests` + kartu edukasi "Why this matters" (`why-cards.ts`) + check-in Collection.
  - **Tinjauan mingguan (~10–15 menit):** stat tile `/reports` (healthy time / quests completed / overheating events / Bond Level) + narasi mingguan AI-atau-template (`getWeeklyReportNarration`).
- [ ] Identifikasi celahnya: "daily random events" belum ada sebagai sistem ringan — `src/game/seasonal/seasonal-events.ts` saat ini hanya punya dua pengali skala-musim yang berjalan lama (`HOT_WEATHER`, `WEEKEND_GROWTH`), bukan dorongan (nudge) harian yang singkat. Tentukan cakupan apa yang dibutuhkan micro-event harian minimal sebelum berkomitmen membangunnya — ini pekerjaan baru, bukan pass polish.
- [ ] `streak-engine.ts` sudah menjadi jangkar "apakah saya check-in hari ini" — pastikan streak terbaca di tampilan sekilas 30 detik (terhubung ke Workstream 3), bukan sesuatu yang hanya muncul di laporan mingguan.
- [ ] Pastikan polling client 60 detik `POST /api/game-tick` yang sudah berjalan (dari `plant-home.tsx` sesuai `docs/SETUP-game-systems.md` §5) menjaga tampilan sekilas 30 detik tetap akurat bahkan ketika siswa tidak melakukan apa-apa selain melihat layar.

**Owner:** Both — Engine menentukan cakupan celah daily-events dan memastikan timing tick; Design membuat setiap ritme terlihat berbeda secara visual (Home = sekilas, Quests = harian, Reports = mingguan) agar siswa belajar ke mana harus melihat untuk apa.

**Uji penerimaan:** *Siswa yang hanya membuka aplikasi selama 30 detik di awal kelas, setiap hari sekolah selama seminggu, tetap melihat streak dan Bond Level-nya naik — tanpa pernah membuka tab Quests atau Reports.*

---

### 6. Gagal-dengan-Lembut & Nada Bicara

**Tujuan:** tidak ada tampilan aplikasi yang pernah terbaca oleh siswa sebagai hukuman, kesalahan, atau "ada yang rusak dan itu salah saya."

**Tugas:**
- [ ] Periksa sekilas bahwa aturan tanpa-hukuman (handoff §21, §45 — kehilangan XP/level karena melewatkan satu hari secara eksplisit dilarang) benar-benar berlaku di `src/game/progression/streak-engine.ts`: streak reset ke 1 pada hari yang terlewat, XP dan Bond Level tidak pernah berkurang.
- [ ] Setiap instance komponen `Notice` saat ini (`src/components/notice.tsx`, dipakai di seluruh `src/app/**/page.tsx`) menampilkan copy yang ditujukan untuk developer — *"Supabase environment variables are not set yet," "Check that supabase/milestone3.sql has been run."* Itu benar untuk tim, tapi register yang salah untuk siswa yang menyaksikan gangguan sungguhan. Tambahkan tingkat ramah yang ditujukan untuk siswa ("nothing broke — the sensors are napping, try again in a minute") yang tampil menggantikan detail debug ketika audiensnya adalah kelas, bukan operator.
- [ ] Watchdog `SENSOR_OFFLINE` / `SENSOR_ONLINE` (rencana Node-RED, ambang batas 45 detik hening) butuh keadaan layar yang ramah — pastikan aplikasi web menampilkan sesuatu yang hangat, bukan layar yang terlihat beku dan diam-diam basi, saat ini terpicu.
- [ ] Audit nada bicara yang sudah ada sebagai contoh positif untuk ditiru: empty state di `src/app/quests/page.tsx` ("No active quest right now — I'm just vibing") adalah suara yang tepat — perluas secara konsisten di mana pun siswa bisa saja melihat string error teknis sebagai gantinya.

**Owner:** Design memimpin nada/copy; Engine menandai state error mana yang saat ini berupa string khusus-developer yang butuh varian untuk siswa.

**Uji penerimaan:** *Ditunjukkan state rusak/offline yang sengaja dipicu, siswa mendeskripsikan yang mereka lihat sebagai "tanaman/sensornya sedang istirahat" atau serupa — tidak pernah "ini rusak" atau "saya melakukan sesuatu yang salah."*

---

### 7. Akses Bahasa

**Tujuan:** menghasilkan rencana nyata dan terukur untuk toggle UI Bahasa Indonesia — tidak harus dirilis minggu ini — karena siswa target adalah orang Indonesia dan UI saat ini hanya berbahasa Inggris.

**Tugas:**
- [ ] Inventarisasi permukaan string saat ini: sebagian besar string JSX hardcoded tersebar di `src/app/**/page.tsx` dan `src/components/*.tsx`, ditambah modul pembawa-konten — `MOOD_LABELS` (`src/types/events.ts`), definisi quest/badge/story (`src/game/**/*-definitions.ts`), template personality (`src/game/personality/templates.ts`), kartu edukasi (`why-cards.ts`). Belum ada library i18n atau modul kamus di codebase hari ini.
- [ ] Usulkan pendekatannya: ekstrak string yang menghadap UI ke modul kamus (mis. `src/lib/i18n/strings.ts`) dengan kunci ID string, nilai Bahasa Inggris + Indonesia, plus helper kecil `t(key)`. Framework i18n penuh tidak dijustifikasi untuk satu bahasa tambahan dan tanpa sistem akun per-pengguna — `localStorage` bisa menyimpan bahasa yang dipilih dengan cara yang sama seperti flag onboarding (Workstream 1).
- [ ] Perkiraan cakupan: ini menyentuh hampir setiap halaman, setiap komponen presentasional, dan setiap berkas definisi konten game — secara realistis usaha **L (Large)**, dan bukan tugas minggu ini. Urutkan setelah demo, karena ini adalah satu-satunya workstream di sini yang menyeberangi berkas milik Engine dan Design secara bersamaan (sesuai pembagian kepemilikan `CONTRIBUTING.md`) dan tetap membutuhkan review terkoordinasi.
- [ ] Catat secara eksplisit: pola trilingual yang sudah dipakai di `README.md`, `CONTRIBUTING.md`, dan `docs/INTEGRATION-PLAN-master.md` adalah untuk **dokumen internal tim**, bukan UI runtime — bukan kode yang bisa dipakai ulang, hanya preseden bahwa tim sudah terbiasa berpikir dalam tiga bahasa.
- [ ] Tentukan cakupan v1 yang realistis: menerjemahkan penjelasan bahasa-sederhana Workstream 2 dan copy quest/mood lebih dulu (yang paling sering dibaca siswa, di setiap sesi) adalah potongan yang jauh lebih kecil dibanding menerjemahkan copy bergaya-admin Settings/Reports, dan sebaiknya diprioritaskan begitu jika pekerjaan ini dimulai sebelum toggle penuh ada.

**Owner:** Both — Engine membangun modul kamus dan plumbing `t()`; Design menulis/meninjau copy Bahasa Indonesia, idealnya dicek oleh rekan tim penutur asli.

**Uji penerimaan:** *Ini adalah workstream perencanaan, bukan deliverable minggu ini — uji penerimaannya adalah kontributor baru bisa membaca bagian ini saja dan mulai mengerjakan `src/lib/i18n/strings.ts` tanpa bertanya pada siapa pun apa arti "pendekatan i18n." (Setelah dirilis, uji sesungguhnya menjadi: siswa yang lebih nyaman membaca Bahasa Indonesia daripada Inggris bisa menyelesaikan satu loop quest penuh hanya dengan membaca teks Bahasa Indonesia.)*

---

### 8. Ergonomi Ruang Kelas

**Tujuan:** guru tanpa latar belakang coding sama sekali bisa menyajikan ini di depan satu ruangan siswa dengan ponsel Android lama, dengan gesekan setup minimal.

**Tugas:**
- [ ] Buat kode QR yang mengarah ke URL Vercel yang sudah di-deploy, berukuran untuk selebaran setengah-lembar yang bisa dicetak. Tidak perlu perubahan kode — cukup satu aset (mis. diletakkan di `public/`) dan selembar cetakan untuk kelas.
- [ ] Cek ukuran bundle di ponsel Android lama: `recharts` adalah dependency (`package.json`) tapi tampaknya tidak diimpor oleh halaman Reports saat ini (`src/app/reports/page.tsx` me-render stat tile polos, tanpa chart). Konfirmasi dengan output/analisis `npm run build` apakah ia sudah di-tree-shake atau justru terkirim sebagai beban mati di setiap load halaman — jangan berasumsi ke arah mana pun tanpa mengecek.
- [ ] Tanpa login memang sudah benar by design — setiap halaman meng-hardcode `PLANT_ID = "plant-01"`, dan tidak ada sistem auth di mana pun di codebase. Dokumentasikan ini secara eksplisit sebagai *disengaja* agar tidak ada yang "memperbaikinya" menjadi flow login tepat sebelum syuting.
- [ ] Mode guru/demo sudah punya endpoint nyata: `POST /api/demo-reset` (dijaga token, `scripts/demo-reset.ps1`, didokumentasikan di `docs/SETUP-game-systems.md` §6.1). Tulis naskah gladi bersih satu halaman untuk operator demo non-engineer yang menjalankannya di antara sesi kelas atau pengambilan ulang syuting — termasuk catatan bahwa reset mengembalikan tanaman ke Lv.1 / 0 XP, jadi jika skenario demo mengasumsikan titik awal tertentu (mis. baseline Lv.2 / 70 XP di `docs/SETUP-game-systems.md` §6), baseline itu harus dibuat ulang secara manual sesudahnya.
- [ ] Cek kontras ramah-proyektor: tint scene-mood dan warna pill badge/status saat ini dirancang untuk layar ponsel pada jarak lengan — audit untuk kelas terang atau proyektor yang dilihat dari belakang ruangan (teks lebih besar di mana memungkinkan, tandai kombinasi pastel-di-atas-putih berkontras rendah yang sudah dipakai, mis. beberapa warna chip badge/mood).
- [ ] Pastikan WiFi/data seluler kelas tersedia dan dianggarkan sebagai item checklist terpisah — sesuai catatan Workstream 0, aplikasi web butuh konektivitas Supabase live dan tidak dirancang untuk berjalan offline (jaminan itu hanya berlaku untuk loop keamanan hardware Arduino/Node-RED, bukan layar ponsel).

**Owner:** Both — Engine memiliki naskah gladi bersih demo-reset dan cek ukuran bundle; Design memiliki aset QR dan audit kontras.

**Uji penerimaan:** *Guru yang belum pernah melihat kode bisa memindai kode QR cetak dengan ponsel Android lama, memuat aplikasi dalam kurang dari 10 detik, dan mengembalikannya ke state demo bersih di antara dua kelompok siswa hanya dengan selembar instruksi.*

---

### 9. Protokol Playtest

**Tujuan:** menangkap masalah keterpakaian nyata bersama 3–5 siswa lokal sungguhan, memakai naskah 30 menit yang tetap, sebelum tanggal syuting KBS.

**Tugas:**
- [ ] Rekrut 3–5 siswa yang cocok dengan audiens target (13–18 tahun, non-teknis, idealnya berbahasa Indonesia, idealnya terhubung ke jaringan sekolah mitra program WFK jika tersedia).
- [ ] Tulis naskah 30 menit:
  - **~3 menit — pandangan pertama diam.** Tidak ada instruksi diberikan. Cukup amati apa yang mereka ketuk pertama kali. Ini langsung menguji kriteria penerimaan Workstream 1.
  - **~10 menit — daftar tugas.** Beri nama tanaman; temukan quest saat ini; jelaskan dengan kata-kata sendiri apa arti mood saat ini; temukan streak mereka; amati level-up jika waktunya memungkinkan.
  - **~10 menit — think-aloud** pada 2–3 layar (Home, Quests, dan satu lagi — Collection atau Reports).
  - **~5–7 menit — pertanyaan debrief.** "Apa yang membingungkan kamu?" "Apa yang akan kamu ketuk pertama, dan kenapa?" "Apa arti pH bagi kamu sekarang?"
- [ ] Buat template log observasi sederhana: apa yang mereka ketuk pertama, di mana mereka ragu lebih dari ~5 detik, apa yang mereka salah baca sebagai istilah teknis, apakah mereka menemukan aksi berikutnya tanpa bantuan.
- [ ] Jalankan naskah sekali sedini mungkin terhadap item "Minggu ini" di bawah, lalu pengecekan ulang yang lebih ringan ~10 menit setelah perbaikan "Sebelum syuting" selesai, sebelum tanggal syuting KBS sesungguhnya.
- [ ] Umpan-balikkan temuan langsung ke uji penerimaan di Workstream 1–6 di atas — uji penerimaan yang gagal dalam playtest menjadi item backlog perbaikan "sebelum syuting," bukan catatan kaki.

**Owner:** Both — Design memimpin naskah dan fasilitasi; Engine mencatat kegagalan teknis apa pun yang teramati selama sesi (mis. momen sensor offline, loading lambat) berdampingan dengan catatan keterpakaian.

**Uji penerimaan:** *Setelah menjalankan naskah sekali, tim memiliki daftar tertulis setidaknya 3 titik kebingungan konkret dari siswa sungguhan, masing-masing bisa dilacak ke workstream spesifik (1–6) di atas.*

---

### 10. Prioritas bertahap & perkiraan usaha

Kunci usaha: **S** = kurang dari sehari · **M** = 1–3 hari · **L** = multi-hari, menyeberangi banyak berkas/owner.

**Minggu ini**

| Workstream | Item | Owner | Usaha |
|---|---|---|---|
| 0 | Selesaikan celah layar home (`/farm/` statis vs `PlantHome` React) | Both | S |
| 3 | Sambungkan `HomeQuestCard` + animasi XP bar ke home resmi | Both | M |
| 6 | Periksa sekilas aturan tanpa-hukuman berlaku di `streak-engine.ts` | Engine | S |
| 2 | Buat checklist audit jargon per layar (audit saja, belum perbaikan) | Design | S |
| 9 | Tulis naskah playtest 30 menit | Design | S |

**Sebelum syuting**

| Workstream | Item | Owner | Usaha |
|---|---|---|---|
| 1 | Flow onboarding kontak-pertama lengkap (momen nama + walkthrough 3-langkah + tooltip) | Both | M |
| 2 | Selesaikan pass penjelasan bahasa-sederhana di semua layar | Design | M |
| 3 | Telusuri dan perbaiki sisa empty/idle state yang kehilangan aksi berikutnya | Both | S |
| 4 | Sambungkan event perayaan badge/chapter + selesaikan 4 wajah maskot yang tersisa | Both | M |
| 5 | Streak terlihat di tampilan sekilas Home; pastikan tick 60 detik menjaga sekilas tetap akurat | Both | S |
| 6 | Tingkat error/offline ramah untuk siswa pada state `Notice` | Design | M |
| 8 | Kode QR, naskah gladi bersih demo-reset, cek ukuran bundle, audit kontras | Both | M |
| 9 | Jalankan playtest bersama 3–5 siswa; perbaiki temuan teratas | Both | M |

**Bagus untuk dimiliki (pasca-syuting / stretch)**

| Workstream | Item | Owner | Usaha |
|---|---|---|---|
| 7 | Bangun modul kamus `src/lib/i18n/strings.ts` + toggle UI Bahasa Indonesia penuh | Both | L |
| 5 | Rancang dan bangun sistem daily-events ringan yang sesungguhnya | Engine | L |
| 4 | Desain suara opsional (default-mati, opt-in) | Design | S/M |
| 9 | Ronde playtest kedua yang lebih ringan setelah perbaikan nice-to-have | Both | S |

---

<a id="korean"></a>

## 🇰🇷 한국어

**대상:** PlantMoji 팀 전체 — Engine 오너, Design 오너, 그리고 KBS 촬영 데모를 리허설하는 모든 사람. 이 문서는 **기능이 아니라 "실제로 놀 수 있는가(playability)"**를 다룹니다: 백엔드 게임 시스템은 이미 구현되고 검증되었고(`docs/SETUP-game-systems.md`), 프론트엔드↔백엔드 연결은 `docs/INTEGRATION-PLAN-master.md`에서 추적됩니다. 이 계획은 다른 질문을 던집니다 — **젬버의 15세 학생이 기술 배경도 안내도 없이 이것을 정말로 즐기고 이해할 수 있는가?**

대상 사용자: 비기술적인 중·고등학생(13–18세), 이 앱을 처음 보는 사람, 교실이나 데모 상황, 공용/오래된 안드로이드 폰, 영어를 제2언어로 읽는 사람.

기반 원칙(인수인계 문서 §46, 직접 인용): *"사용자는 죄책감이 아니라 애착을 느껴야 한다." "전통 지식은 원시적인 것으로 취급되지 않고 존중받아야 한다." "웹 UI는 대시보드이기 전에 먼저 컴패니언/게임처럼 느껴져야 한다." "로컬 제어는 오프라인에서도 동작해야 한다." "데모 안정성은 기능 개수보다 중요하다."* 그리고 §33: 웹 앱은 **모바일 우선이며 다마고치 같아야** 합니다 — "홈 화면을 산업용 스마트팜 대시보드처럼 만들지 말 것."

---

### 0. 시작 전에 — 아래 모든 워크스트림이 걸려 있는 하나의 틈

현재 코드는 홈 화면이 "두 개의 인격"을 가지고 있으며, 이는 처음 앱을 쓰는 학생에게 "이 앱"이 무엇을 의미하는지 자체를 바꿔 놓습니다:

- `next.config.ts`가 `/`를 정적 파일 `public/farm/index.html`(Design 소유 목업 마크업, `public/farm/live.js`가 실데이터를 바인딩)로 곧바로 리라이트합니다. 정적 public 파일로의 리라이트이기 때문에 **`src/app/layout.tsx`와 `RenoAppShell`을 완전히 우회**합니다 — 사이드바 내비게이션 컴포넌트도, 공유 셸도, 나머지 React 앱의 그 무엇도 거치지 않습니다.
- 별도로 `src/app/page.tsx`는 완전히 연결된 React `PlantHome` 컴포넌트(`src/components/plant-home.tsx`)를 렌더링합니다 — 실제 Supabase Realtime 구독, `BondPanel`, `HomeQuestCard`, `LevelUpOverlay`, `EmotionBadge`, 애니메이션 마스코트 얼굴까지. **위 리라이트가 항상 먼저 이기기 때문에 브라우저에서 `/`로 이동해서는 현재 접근할 수 없습니다.**
- 다른 라우트들(`/quests`, `/collection`, `/reports`, `/settings`)은 실제로 `RenoAppShell`을 거치므로, 학생이 Home에서 다른 곳으로 갔다가 돌아오면 Home 자체와는 시각적으로 다른 프레임을 보게 됩니다.

**작업 (Engine + Design, 함께, 이 문서의 다른 무엇보다 먼저):**
- [ ] 어느 쪽이 정식 홈인지 — 정적 `public/farm/` 페이지인지, `src/app/page.tsx`의 React `PlantHome`인지 — 결정하고, 나머지 하나는 제거하거나 보류하거나 리라이트를 조건부로 만듭니다. 온보딩(워크스트림 1), 항상 보이는 퀘스트 카드(워크스트림 3), 축하 오버레이(워크스트림 4) 모두 두 개가 아니라 *하나*의 실제 홈 화면 위에 지어져야 합니다.

워크스트림 8(교실 인체공학)과도 관련이 있습니다: 웹 앱 자체는 오프라인 동작을 위해 설계되지 **않았습니다** — Supabase 연결이 필요합니다. 인수인계 §46의 "로컬 제어는 오프라인에서도 동작해야 한다"는 Arduino/Node-RED가 웹 백엔드 없이도 물리적 안전 루프를 계속 실행하는 것에 관한 것이지, **폰이 WiFi 없이 동작하는 것에 관한 것이 아닙니다.** 교실 WiFi/데이터가 확보되어 있는지 별도 체크리스트 항목으로 확인하세요 — 이 두 가지 "오프라인"을 혼동하지 마세요.

---

### 1. 첫 접촉 온보딩

**목표:** PlantMoji를 한 번도 본 적 없는 학생이 핵심 루프 — *식물이 무언가를 느낀다 → 내가 돕는다 → 센서가 확인한다 → 내가 성장한다* — 를 3분 안에, 아무도 말로 설명해 주지 않아도 이해합니다.

**작업:**
- [ ] 워크스트림 0의 틈을 먼저 해결합니다 — 온보딩은 실제 홈 화면 하나에 붙어야 합니다.
- [ ] Story Chapter 1("First Meeting," 인수인계 §19)과 연결되는 첫 실행 "네 식물 이름 짓기" 순간을 만듭니다. `src/app/settings/page.tsx` / `updatePlantSettings` 액션에 이미 있는 이름 필드를 재사용하고 두 번째 이름 저장 경로를 새로 만들지 않습니다 — 파묻힌 설정 필드가 아니라 첫 실행 단계로 노출합니다.
- [ ] 첫 방문 시 한 번만 보이는 3단계 "작동 방식" 워크스루를 만듭니다: (1) *네 식물이 뭔가를 느낀다* — 무드 이모지 + 한 줄 의미, (2) *네가 돕는다* — 퀘스트가 등장, (3) *센서가 확인하고, 네가 성장한다* — XP/Bond Level 상승. 새 모달 시스템을 도입하는 대신 이미 있는 `Notice` 카드 비주얼 패턴(`src/components/notice.tsx`)을 재사용합니다.
- [ ] 페이지마다(Home, Quests, Collection, Report, Settings) 짧은 첫 방문 툴팁/콜아웃을 하나씩 추가하고, 각각 닫을 수 있게 하고 한 번만 보이게 합니다. 페이지별로 간단한 `localStorage` 플래그로 게이트합니다 — 로그인 시스템이 없으므로 user/account 테이블에 의존해서는 안 됩니다.
- [ ] 워크스루 1단계의 감정적 훅은 새로 카피를 쓰는 대신 이미 있는 Chapter 1 대사(`src/game/story/story-dialogue.ts`, 인수인계 §19)에서 가져옵니다 — 스토리 시스템에는 이미 온보딩 형태의 비트가 있습니다.

**Owner:** Both — Engine이 한 번뿐인 플래그를 배선하고 Chapter 1을 연결; Design이 워크스루 비주얼과 툴팁 배치를 만듭니다.

**인수 테스트:** *URL만 받은 첫 방문 학생이, 교사나 팀원이 한마디도 하지 않아도, 3분 안에 자기 식물이 지금 무엇을 필요로 하는지, 도와주면 무슨 일이 일어나는지 소리 내어 설명할 수 있다.*

---

### 2. 쉬운 언어 레이어

**목표:** 13–18세 학생에게 바로 옆에 쉬운 말 번역이 이미 주어지지 않은 전문 용어를 보여주는 화면은 하나도 없습니다.

**작업:**
- [ ] 화면별 전문용어 감사 체크리스트를 만들고 화면별로 살펴봅니다: Home(무드 라벨 + 표시되는 원시 센서 수치), Quests(`src/game/education/why-cards.ts` — `QUEST_WHY` / `WHY_CARDS`는 이미 쉬운 말로 작성됨; 퇴보한 곳이 없는지 검증), Collection의 "Wisdom" 탭(이미 속담을 지표로 번역함 — 반대 방향도 유지되는지, 즉 지표가 쉬운 말로 풀이되는지 확인), Reports(healthy time / overheating events / Bond Level), Settings(personality, growth stage).
- [ ] 표시되는 모든 원시 지표 옆에 한 줄짜리 쉬운 말 풀이를 추가합니다: **pH → "흙이 얼마나 시거나 쓴지,"** **공기 습도 → "식물 주변 공기에 물이 얼마나 있는지 — 흙이 아니라,"** 그리고 둘이 헷갈릴 수 있는 어디에서든 습도-대-토양수분 구분을 명시적으로 유지합니다(README.md는 이미 팀을 위해 "DHT11 humidity is treated as air humidity, not soil moisture"라고 명시함 — UI에는 이 문장의 학생 대상 버전이 필요합니다).
- [ ] VPD(수증기압차)가 어떤 UI 카피에도 절대 등장하지 않는지 확인합니다 — 이건 순전히 엔진/임계값 개념입니다. `src/game/`와 하드웨어 문서 밖에서 저장소 전체 "VPD" 검색을 합격/불합격 체크로 삼습니다.
- [ ] 무드 라벨은 이미 이모지가 있습니다(`MOOD_LABELS`, `src/types/events.ts`) — 같은 한 줄 풀이 패턴을 배지 이름/설명과 스토리 챕터 제목으로 확장합니다. 이들은 현재 게임 안에서 무슨 일이 일어났는지에 대한 쉬운 설명 없이 일반적인 게임 텍스트("First Rescue," "Trust")처럼 읽힙니다.
- [ ] 감사 결과를 실제 표(화면 → 용어 → 현재 카피 → 쉬운 풀이 → 완료?)로 만들어 Design이 카메라 앞에서 실시간으로 빈틈을 발견하는 대신 촬영 전에 체크할 수 있게 합니다.

**Owner:** Design이 카피 작업을 주도; Engine이 교육 레이어 파일(`why-cards.ts`, personality 템플릿)의 사실 정확성을 검토해 쉬운 말이 센서의 실제 의미에서 벗어나지 않도록 합니다.

**인수 테스트:** *과학 배경이 없는 15세 학생이 어떤 화면의 어떤 단어를 가리켜도, 누구에게도 묻지 않고, 바로 옆 줄을 읽고 자기 말로 정확히 설명할 수 있다.*

---

### 3. 항상 보이는 진행 상황 & 다음 행동

**목표:** 어느 순간이든 화면은 학생이 찾아 헤매지 않고도 두 질문에 답합니다: *"지금 뭘 해야 하지?"* 그리고 *"뭘 얻지?"*

**작업:**
- [ ] `HomeQuestCard`(고정 props: `emoji` / `title` / `statusLabel` / `progressLabel`, `src/components/home-quest-card.tsx`)가 워크스트림 0 결정에서 승리한 홈 화면 위에서 화면 상단(above the fold)에 눈에 띄게 렌더링되는지 확인합니다 — 오늘은 `PlantHome` 안에만 존재하고 `public/farm/index.html`에는 없습니다.
- [ ] `src/app/quests/page.tsx`의 "no active quest" 빈 상태는 이미 잘 프레이밍되어 있습니다("No active quest right now — I'm just vibing" / "A new quest appears when my mood changes") — 같은 다음-행동 프레이밍을 Home 화면 자체의 `HomeQuestCard`의 `quest: null` 케이스에도 적용합니다. 그 화면이 학생이 가장 먼저, 가장 자주 보는 화면이기 때문입니다.
- [ ] `QuestProgress`(`src/components/quest-progress.tsx`)는 이미 `VERIFYING` 퀘스트에 대해 실시간 mm:ss 카운트다운을, `maintain` 퀘스트에 대해 경과/전체 카운트를 렌더링합니다 — `/quests`로 들어간 뒤가 아니라 Home에서도 보이는지 확인합니다.
- [ ] `BondPanel`의 XP 바 채움이 즉시 "스냅"되는 대신 변화 시 애니메이션(CSS 전환)되게 만들어, 화면을 30초만 흘끗 봐도 XP 획득이 눈에 들어오게 합니다.
- [ ] `BondPanel.streakDays`는 0일 때 이미 스트릭 줄 전체를 숨깁니다(맞습니다 — 벌주듯 보여줄 게 없음) — 0이 아닐 때는 항상 Home에서 스트릭이 보이는지 확인합니다. Reports를 열어야만 발견하는 것이어서는 안 됩니다.
- [ ] 다음 행동이 빠진 다른 모든 idle/empty 상태를 훑습니다: 아무것도 해금되지 않았을 때의 Collection 탭, 비어 있을 때의 Settings growth-record 목록.

**Owner:** Both — quest/XP/streak을 위한 Engine의 데이터 배선은 `docs/SETUP-game-systems.md`대로 이미 존재; Design이 시각적 두드러짐, 배치, 채움 애니메이션을 담당.

**인수 테스트:** *교사가 무작위 순간에 화면을 가리켜도, 학생은 스크롤이나 탭 없이 5초 안에 "지금 ___를 해야 ___를 얻어요"라고 말할 수 있다.*

---

### 4. 축하 & 피드백

**목표:** 레벨업, 배지 해금, 챕터 해금 순간이 학생에게 조용한 데이터베이스 기록이 아니라 큰 사건처럼 느껴집니다.

**작업:**
- [ ] `LevelUpOverlay`(`src/components/level-up-overlay.tsx`, 고정 props: `level` / `show` / `onDone`)는 이미 존재 — 워크스트림 0 결정에서 승리한 홈 화면에 배선되어 있는지 확인합니다(오늘은 `PlantHome` 안에만 있고 `public/farm/`에는 없음).
- [ ] `EmotionBadge`(Proud / Excited / Curious / Recovering, 인수인계 §12)는 이미 게임 내 감정을 위한 멋진 일시적 팝-앤-페이드 패턴을 구현하고 있습니다 — 같은 이벤트 기반 패턴을 배지 해금과 스토리 챕터 해금으로 확장합니다. 이들은 오늘 Collection 탭 안에서 수동적으로만 나타날 뿐 순간적인 축하가 전혀 없습니다.
- [ ] 무드별 마스코트 얼굴 6종이 계획되어 있습니다(인수인계/`docs/INTEGRATION-PLAN-master.md` Track 1 항목 4): `Happy`와 `Overheating`은 오늘 `src/components/mascot.tsx`에 존재 — `DryAir`, `Sleepy`, `SoilAcidic`, `SoilAlkaline`를 완성해 마스코트 자신이 눈에 띄게 반응하게 하고, 옆의 배지나 텍스트에만 의존하지 않게 합니다.
- [ ] 소리: 교실 사용을 위해 기본값 **끔**을 유지합니다. 코드베이스에 오늘 오디오 시스템이 존재하지 않습니다 — 언젠가 추가된다면 기본-음소거는 나중에 넣는 토글이 아니라 출시 요구사항이어야 합니다. 30개 폰이 한 방에서 동시에 울리는 것은 실제 교실 방해 위험입니다.
- [ ] 햅틱: 웹에서는 해당 없음 — 명시적으로 범위 밖이며 이것에 시간을 쓰지 않습니다.

**Owner:** Design이 비주얼/애니메이션 다듬기를 주도; Engine이 트리거 이벤트 배선을 담당(레벨업 배선은 일부 이미 있음; 배지/챕터 트리거는 새로운 배선).

**인수 테스트:** *교실에서 한 학생의 식물이 레벨업할 때, 두 자리 옆의 다른 학생이 보라는 말을 듣지 않고도 그 학생 화면에서 뭔가 일어났음을 알아챈다.*

---

### 5. 세션 리듬

**목표:** 진짜로 다른 세 가지 실사용 패턴 각각에 대해 재설계 없이 같은 앱이 동작합니다.

**작업:**
- [ ] 기존 시스템을 세 리듬에 명시적으로 매핑합니다:
  - **수업 중 흘끗 보기(~30초):** Home의 무드 + 퀘스트 카드 + XP 바(워크스트림 3).
  - **일일 돌봄(~5분):** `/quests` 상세 화면 + "Why this matters" 교육 카드(`why-cards.ts`) + Collection 체크인.
  - **주간 리뷰(~10–15분):** `/reports` 스탯 타일(healthy time / quests completed / overheating events / Bond Level) + AI-또는-템플릿 주간 내레이션(`getWeeklyReportNarration`).
- [ ] 빈틈을 식별합니다: "일일 랜덤 이벤트"는 아직 가벼운 시스템으로 존재하지 않습니다 — `src/game/seasonal/seasonal-events.ts`는 현재 짧은 일일 넛지가 아니라 오래 지속되는 시즌 규모 배율 두 개(`HOT_WEATHER`, `WEEKEND_GROWTH`)만 가지고 있습니다. 이걸 만들기로 확정하기 전에 최소한의 일일 마이크로 이벤트에 무엇이 필요한지 범위를 정합니다 — 이건 다듬기가 아니라 새 작업입니다.
- [ ] `streak-engine.ts`는 이미 "오늘 체크인했는가"의 닻 역할을 합니다 — 스트릭이 30초 흘끗 보기 화면에서(워크스트림 3과 연결) 읽히는지 확인하고, 주간 리포트에만 나타나는 것이 되지 않게 합니다.
- [ ] 이미 실행 중인 60초 클라이언트 폴링 `POST /api/game-tick`(`docs/SETUP-game-systems.md` §5에 따라 `plant-home.tsx`에서 이미 동작)이 학생이 화면을 보기만 해도 30초 흘끗 보기 화면을 정확하게 유지하는지 확인합니다.

**Owner:** Both — Engine이 daily-events 빈틈의 범위를 정하고 tick 타이밍을 확인; Design이 각 리듬을 시각적으로 구분되게 만들어(Home = 흘끗, Quests = 일일, Reports = 주간) 학생이 무엇을 어디서 봐야 하는지 배우게 합니다.

**인수 테스트:** *매 등교일 수업 시작 시 30초만 앱을 여는 학생이 일주일 내내, Quests나 Reports 탭을 한 번도 열지 않고도 스트릭과 Bond Level이 오르는 것을 본다.*

---

### 6. 실패해도 부드럽게 & 톤

**목표:** 앱이 보여주는 그 무엇도 학생에게 처벌, 비난, 또는 "뭔가 고장났고 그건 내 잘못이다"로 읽히지 않습니다.

**작업:**
- [ ] 처벌-없음 규칙(인수인계 §21, §45 — 하루를 놓쳤다고 XP/레벨을 잃는 것은 명시적으로 금지됨)이 `src/game/progression/streak-engine.ts`에서 실제로 지켜지는지 간단히 점검합니다: 놓친 날엔 스트릭이 1로 리셋되고, XP와 Bond Level은 절대 줄지 않습니다.
- [ ] 현재 모든 `Notice` 컴포넌트 인스턴스(`src/components/notice.tsx`, `src/app/**/page.tsx` 전체에서 사용)는 개발자 대상 카피를 보여줍니다 — *"Supabase environment variables are not set yet," "Check that supabase/milestone3.sql has been run."* 팀에게는 맞지만 실제 장애를 지켜보는 학생에게는 잘못된 톤입니다. 관객이 운영자가 아니라 교실일 때 디버그 상세 정보 대신 표시할, 학생 대상의 친근한 티어("nothing broke — the sensors are napping, try again in a minute")를 추가합니다.
- [ ] `SENSOR_OFFLINE` / `SENSOR_ONLINE` 워치독(Node-RED 계획, 45초 무응답 임계값)은 화면에 친근한 상태가 필요합니다 — 이것이 발동될 때 웹 앱이 멈춘 것처럼 보이며 조용히 낡아가는 화면 대신 따뜻한 무언가를 보여주는지 확인합니다.
- [ ] 따라할 긍정적 예시로 기존 톤을 감사합니다: `src/app/quests/page.tsx`의 빈 상태("No active quest right now — I'm just vibing")는 정확히 맞는 목소리입니다 — 학생이 기술적 오류 문자열을 볼 수도 있는 모든 곳에 이를 일관되게 확장합니다.

**Owner:** Design이 톤/카피를 주도; Engine이 학생 대상 변형이 필요한 현재의 개발자 전용 오류 상태들을 표시합니다.

**인수 테스트:** *일부러 고장/오프라인 상태를 보여줬을 때, 학생은 눈에 보이는 것을 "식물/센서가 쉬고 있어요" 같은 식으로 묘사한다 — "이거 고장났어요"나 "내가 뭔가 잘못했어요"라고 절대 말하지 않는다.*

---

### 7. 언어 접근성

**목표:** 인도네시아어 UI 토글을 위한 실제적이고 범위가 정해진 계획을 만듭니다 — 반드시 이번 주에 출시할 필요는 없습니다 — 대상 학생이 인도네시아인이고 현재 UI가 영어 전용이기 때문입니다.

**작업:**
- [ ] 현재 문자열 표면을 조사합니다: 대부분 `src/app/**/page.tsx`와 `src/components/*.tsx`에 흩어진 하드코딩된 JSX 문자열, 그리고 콘텐츠를 담고 있는 모듈들 — `MOOD_LABELS`(`src/types/events.ts`), 퀘스트/배지/스토리 정의(`src/game/**/*-definitions.ts`), personality 템플릿(`src/game/personality/templates.ts`), 교육 카드(`why-cards.ts`). 코드베이스에 오늘 i18n 라이브러리나 사전 모듈이 없습니다.
- [ ] 접근 방식을 제안합니다: UI에 보이는 문자열을 문자열 ID로 키가 매겨진 사전 모듈(예: `src/lib/i18n/strings.ts`)로 추출하고 영어 + 인도네시아어 값과 작은 `t(key)` 헬퍼를 둡니다. 언어 하나가 추가되고 사용자별 계정 시스템이 없는 상황에서 완전한 i18n 프레임워크는 정당화되지 않습니다 — 온보딩 플래그(워크스트림 1)와 같은 방식으로 `localStorage`가 선택된 언어를 보관할 수 있습니다.
- [ ] 범위 추정: 거의 모든 페이지, 모든 프레젠테이셔널 컴포넌트, 모든 게임 콘텐츠 정의 파일에 손을 대야 합니다 — 현실적으로 **L(Large)** 규모의 작업이며 이번 주 과제가 아닙니다. 데모 이후로 순서를 미룹니다. 이것은 (`CONTRIBUTING.md`의 오너십 분할에 따라) Engine과 Design이 소유한 파일을 동시에 넘나드는 이 문서의 유일한 워크스트림이고, 어느 쪽이든 조율된 리뷰가 필요합니다.
- [ ] 명시적으로 기록합니다: `README.md`, `CONTRIBUTING.md`, `docs/INTEGRATION-PLAN-master.md`에서 이미 쓰이는 3개 언어 패턴은 **팀 내부 문서용**이지 런타임 UI가 아닙니다 — 재사용 가능한 코드가 아니라, 팀이 이미 세 언어로 사고하는 데 익숙하다는 선례일 뿐입니다.
- [ ] 현실적인 v1 범위를 정합니다: 워크스트림 2의 쉬운 말 풀이와 퀘스트/무드 카피를 먼저 번역하는 것(학생이 매 세션 가장 많이 읽는 것)은 Settings/Reports의 관리자용 카피를 번역하는 것보다 훨씬 작은 조각이며, 완전한 토글이 있기 전에 이 작업을 시작한다면 그렇게 우선순위를 매겨야 합니다.

**Owner:** Both — Engine이 사전 모듈과 `t()` 배선을 구축; Design이 인도네시아어 카피를 작성/검토하며, 이상적으로는 원어민 팀원이 확인.

**인수 테스트:** *이것은 이번 주 산출물이 아니라 계획 워크스트림입니다 — 인수 테스트는 새 기여자가 이 섹션만 읽고 아무에게도 "i18n 접근 방식"이 무슨 뜻인지 묻지 않고 `src/lib/i18n/strings.ts` 작업을 시작할 수 있다는 것입니다. (출시된 뒤 실제 테스트는: 영어보다 인도네시아어를 더 편하게 읽는 학생이 인도네시아어 텍스트만 읽고 퀘스트 루프 전체를 완료할 수 있는가가 됩니다.)*

---

### 8. 교실 인체공학

**목표:** 코딩 배경이 전혀 없는 교사가 오래된 안드로이드 폰을 든 학생들이 가득한 교실 앞에서 최소한의 설정 마찰로 이것을 보여줄 수 있습니다.

**작업:**
- [ ] 배포된 Vercel URL을 가리키는 QR 코드를 인쇄 가능한 반쪽 시트 크기로 생성합니다. 코드 변경은 필요 없습니다 — 자산 하나(예: `public/`에 배치)와 교실용 인쇄물 한 장이면 됩니다.
- [ ] 오래된 안드로이드 폰에서 번들 크기를 확인합니다: `recharts`는 의존성(`package.json`)이지만 현재 Reports 페이지(`src/app/reports/page.tsx`는 차트 없이 평범한 스탯 타일을 렌더링)에서 임포트되는 것으로 보이지 않습니다. `npm run build`의 출력/분석으로 이것이 tree-shake되어 사라지는지 아니면 모든 페이지 로드에 죽은 무게로 실려가는지 확인합니다 — 어느 쪽이든 확인 없이 가정하지 않습니다.
- [ ] 로그인 불필요는 이미 설계상 사실입니다 — 모든 페이지가 `PLANT_ID = "plant-01"`을 하드코딩하고 있고, 코드베이스 어디에도 인증 시스템이 없습니다. 촬영 직전에 아무도 이것을 로그인 플로우로 "고치지" 않도록 이것이 *의도된 것*이라고 명시적으로 문서화합니다.
- [ ] 교사/데모 모드는 이미 실제 엔드포인트가 있습니다: `POST /api/demo-reset`(토큰으로 보호, `scripts/demo-reset.ps1`, `docs/SETUP-game-systems.md` §6.1에 문서화됨). 엔지니어가 아닌 데모 운영자가 수업 시간 사이나 촬영 재시도 사이에 실행할 수 있는 한 페이지짜리 리허설 스크립트를 작성합니다 — 리셋이 식물을 Lv.1 / 0 XP로 되돌린다는 주의사항을 포함해서. 만약 데모 시나리오가 특정 시작점을 가정한다면(예: `docs/SETUP-game-systems.md` §6의 Lv.2 / 70 XP 기준선), 그 기준선은 이후 수동으로 다시 만들어야 합니다.
- [ ] 프로젝터 친화적 대비 확인: 현재 무드-씬 색조와 배지/상태 필 색상은 팔 길이 거리의 폰 화면을 위해 설계되었습니다 — 밝은 교실이나 뒷줄에서 보는 프로젝터를 위해 감사합니다(가능한 곳에서 더 큰 텍스트, 이미 쓰이고 있는 저대비 파스텔-온-화이트 조합, 예: 일부 배지/무드 칩 색상을 표시).
- [ ] 교실 WiFi/모바일 데이터가 확보되고 예산에 반영되어 있는지 별도 체크리스트 항목으로 확인합니다 — 워크스트림 0의 메모에 따라, 웹 앱은 실시간 Supabase 연결이 필요하며 오프라인 동작을 위해 설계되지 않았습니다(그 보장은 폰 화면이 아니라 Arduino/Node-RED 하드웨어 안전 루프에만 적용됩니다).

**Owner:** Both — Engine이 demo-reset 리허설 스크립트와 번들 크기 확인을 담당; Design이 QR 자산과 대비 감사를 담당.

**인수 테스트:** *코드를 한 번도 본 적 없는 교사가 인쇄된 QR 코드를 오래된 안드로이드 폰으로 스캔해서 10초 안에 앱을 로드하고, 한 페이지짜리 안내문만으로 두 학생 그룹 사이에 깨끗한 데모 상태로 리셋할 수 있다.*

---

### 9. 플레이테스트 프로토콜

**목표:** KBS 촬영일 전에, 고정된 30분 스크립트를 사용해 실제 지역 학생 3–5명과 함께 실제 사용성 문제를 잡아냅니다.

**작업:**
- [ ] 대상 사용자와 일치하는 학생 3–5명을 모집합니다(13–18세, 비기술적, 이상적으로는 인도네시아어 사용자, 가능하다면 WFK 프로그램의 파트너 학교 네트워크와 연결된 학생).
- [ ] 30분 스크립트를 작성합니다:
  - **~3분 — 조용한 첫인상.** 안내를 전혀 주지 않습니다. 그들이 무엇을 먼저 탭하는지만 관찰합니다. 이것은 워크스트림 1의 인수 기준을 직접 테스트합니다.
  - **~10분 — 과제 목록.** 식물 이름 짓기; 현재 퀘스트 찾기; 현재 무드가 무슨 뜻인지 자기 말로 설명하기; 자신의 스트릭 찾기; 시간이 허락하면 레벨업 관찰하기.
  - **~10분 — 소리 내어 생각하기(think-aloud)** 2–3개 화면에서(Home, Quests, 그리고 하나 더 — Collection 또는 Reports).
  - **~5–7분 — 디브리핑 질문.** "뭐가 헷갈렸어요?" "제일 먼저 뭘 탭하겠어요, 왜요?" "pH가 지금 당신에게 어떤 의미예요?"
- [ ] 간단한 관찰 로그 템플릿을 만듭니다: 처음 무엇을 탭했는지, 어디서 5초 이상 머뭇거렸는지, 무엇을 전문 용어로 잘못 읽었는지, 도움 없이 다음 행동을 찾았는지.
- [ ] 아래 "이번 주" 항목들에 대해 가능한 한 빨리 스크립트를 한 번 실행하고, "촬영 전" 수정 사항이 반영된 뒤 실제 KBS 촬영일 전에 더 가벼운 ~10분 재확인을 진행합니다.
- [ ] 발견 사항을 위 워크스트림 1–6의 인수 테스트에 직접 반영합니다 — 플레이테스트에서 실패한 인수 테스트는 각주가 아니라 "촬영 전" 수정 백로그 항목이 됩니다.

**Owner:** Both — Design이 스크립트와 진행을 주도; Engine이 사용성 메모와 나란히 세션 중 관찰된 기술적 실패(예: 센서 오프라인 순간, 느린 로딩)를 기록합니다.

**인수 테스트:** *스크립트를 한 번 실행한 뒤, 팀은 실제 학생들로부터 나온 구체적인 혼란 지점을 최소 3개 이상 문서로 갖게 되며, 각각은 위 워크스트림(1–6) 중 하나로 추적 가능하다.*

---

### 10. 단계별 우선순위 & 작업량 추정

작업량 기준: **S** = 하루 미만 · **M** = 1–3일 · **L** = 여러 날, 다수의 파일/담당자를 넘나듦.

**이번 주**

| 워크스트림 | 항목 | 담당 | 작업량 |
|---|---|---|---|
| 0 | 홈 화면의 틈 해결(정적 `/farm/` vs React `PlantHome`) | Both | S |
| 3 | 정식 홈에 `HomeQuestCard` + XP 바 애니메이션 배선 | Both | M |
| 6 | `streak-engine.ts`에서 처벌-없음 규칙이 지켜지는지 간단히 점검 | Engine | S |
| 2 | 화면별 전문용어 감사 체크리스트 작성(감사만, 수정은 아직) | Design | S |
| 9 | 30분 플레이테스트 스크립트 작성 | Design | S |

**촬영 전**

| 워크스트림 | 항목 | 담당 | 작업량 |
|---|---|---|---|
| 1 | 완전한 첫 접촉 온보딩 플로우(이름 짓기 순간 + 3단계 워크스루 + 툴팁) | Both | M |
| 2 | 모든 화면에 걸친 쉬운 말 풀이 작업 완료 | Design | M |
| 3 | 다음 행동이 빠진 나머지 empty/idle 상태를 훑고 수정 | Both | S |
| 4 | 배지/챕터 축하 이벤트 배선 + 남은 마스코트 얼굴 4개 완성 | Both | M |
| 5 | Home 흘끗 보기 화면에서 스트릭이 보이도록; 60초 tick이 흘끗 보기를 정확하게 유지하는지 확인 | Both | S |
| 6 | `Notice` 상태에 학생 대상의 친근한 오류/오프라인 티어 | Design | M |
| 8 | QR 코드, demo-reset 리허설 스크립트, 번들 크기 확인, 대비 감사 | Both | M |
| 9 | 학생 3–5명과 플레이테스트 실행; 상위 발견 사항 수정 | Both | M |

**있으면 좋음(촬영 이후 / 스트레치)**

| 워크스트림 | 항목 | 담당 | 작업량 |
|---|---|---|---|
| 7 | `src/lib/i18n/strings.ts` 사전 모듈 + 완전한 인도네시아어 UI 토글 구축 | Both | L |
| 5 | 실제로 동작하는 가벼운 일일 이벤트 시스템 설계 및 구축 | Engine | L |
| 4 | 선택적 사운드 디자인(기본-꺼짐, opt-in) | Design | S/M |
| 9 | nice-to-have 수정 이후 더 가벼운 2차 플레이테스트 라운드 | Both | S |
