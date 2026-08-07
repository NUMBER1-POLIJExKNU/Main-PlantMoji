# PlantMoji · Master Integration Plan

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

Audience: the whole PlantMoji team — Engine owner (backend), Design owner (presentation/style), and the hardware teammate. This is the shared source of truth for what's left before the camera-ready demo.

Context: the backend game engine (quests / XP / badges / streak / story) is built and Supabase-verified — see `docs/SETUP-game-systems.md`. The Node-RED/Arduino side has its own detailed plan — see `docs/INTEGRATION-PLAN-node-red.md` (already trilingual; this document summarizes it under Track 2 instead of duplicating it). This document adds the piece that ties everything together **on screen** (Track 1), plus the final end-to-end rehearsal (Track 3).

**Team model** (full detail in `CONTRIBUTING.md`): two owners. **Engine** owns `src/game/`, `src/app/api/`, `src/lib/`, `supabase/`, `src/types/`. **Design** owns markup/style inside `src/components/`, JSX/classes under `src/app/**`, design tokens in `src/app/globals.css`, and everything in `public/` (including `public/farm/`). Branches are `engine/*` / `design/*`; every PR into `main` needs the *other* owner's review; nobody pushes directly to `main`. The presentational components (`BondPanel`, `HomeQuestCard`, `QuestProgress`, `LevelUpOverlay`, `Notice`, `BottomNav`) have fixed props contracts documented in `CONTRIBUTING.md` — Design can restyle freely inside them, but changing the props shape needs Engine's sign-off first.

---

### 0. Current state (snapshot)

- `/` is rewritten (`next.config.ts`) to serve the designer's pixel-farm page verbatim: `public/farm/index.html` + `public/farm/style.css` (Design-owned, per `CONTRIBUTING.md`).
- `public/farm/live.js` (read-only, publishable Supabase key + RLS) already binds real data onto that markup — no game logic runs in the browser, it only displays:
  - `plants` + `bond_state` rows via a `postgres_changes` Realtime subscription → mood, plant name, Bond Level, XP bar, streak badge update live, no refresh needed
  - the latest `sensor_readings` row (temperature, humidity, light) via 15-second polling (that table has no Realtime)
  - a `POST /api/game-tick` call every 60 seconds, so time-window quests (e.g. the 5-minute recovery verification) complete even while the page just sits open on camera
  - the per-mood speech-bubble text/icon is a **hardcoded** `MOODS` lookup inside `live.js` today — not yet driven by the AI/personality layer
- React pages for `/quests`, `/collection`, `/reports`, `/settings` exist and are reachable from the sidebar; `/design` is a Supabase-free sandbox for style work (`CONTRIBUTING.md` §4).
- **Not yet on the main screen:** a quest panel, a level-up celebration, and the AI speech-bubble endpoint. That is exactly Track 1 below — the current priority.

---

### 1. Track 1 — Frontend ↔ Backend (NOW, priority)

The demo lives or dies on the main screen. Nearly all of the game logic already exists server-side (see `docs/SETUP-game-systems.md`); it just isn't rendered on `public/farm/` yet.

| # | Task | Owner | Purpose |
|---|---|---|---|
| 1 | Quest panel on the main screen — a functional panel reusing the existing `.panel-glass` style (`public/farm/style.css`) to show the active quest | Backend — **in progress**; Designer restyles after | **Demo-critical**: quest appears → 5-minute verification countdown → +XP must all be visible on camera (spec §33's home mock shows a CURRENT QUEST card) |
| 2 | Level-up celebration on the main screen — backend wires `bond_state` Realtime level-boundary detection plus a basic pixel overlay | Backend; Designer can upgrade the visuals afterward | Demo finale — the "Bond Lv. up" moment everything else builds toward |
| 3 | AI speech-bubble endpoint `POST /api/mood-message` — personality-aware (5 personalities × 6 moods), with a deterministic template fallback | Backend | Replaces the hardcoded `MOODS` bubble text in `live.js` with the real personality layer described in `docs/SETUP-game-systems.md` §4 |
| 4 | Six mood-specific mascot faces in the SVG (`Happy` exists today; add `Overheating`, `DryAir`, `Sleepy`, `SoilAcidic`, `SoilAlkaline`) | **Designer** — inside `public/farm/index.html`, their file per `CONTRIBUTING.md` ownership | The mood must read on the mascot itself, not only via the icon/text next to it |
| 5 | Pixel-theme pass over the React pages (`/quests`, `/collection`, `/reports`, `/settings`) using the `/design` sandbox | **Designer** — optional for MVP | Visual consistency between the main screen and the sidebar pages |

**Acceptance criterion:** the full demo loop — mood change → quest appears → verification countdown → +XP → level-up — is visible **without ever leaving the main screen**.

---

### 2. Track 2 — Node-RED/Arduino ↔ Backend (parallel-safe)

Full step-by-step detail lives in **`docs/INTEGRATION-PLAN-node-red.md`** (already trilingual) — read that for the actual implementation steps. Summary here, in 5 bullets:

1. **Determine the case** with the hardware teammate: **Case A** — already using (or can adopt) the existing verified v5 flow, the fastest path; or **Case B** — a brand-new, self-built dashboard flow, which needs the extra engine in the next bullet.
2. **Case B only** — add a state-determination function (thresholds + hysteresis, §5.2) and a transition-detection function (only emit when the state actually changed) before building the event envelope.
3. **Smoke-test `POST /api/device-events`** — trigger one real state change and confirm the response is `{ok:true, duplicate:false, applied:true}`, and that the mood changes live on the main web screen with no page refresh.
4. **10-second telemetry into `sensor_readings`** — this is what feeds the main-screen temperature/humidity/light gauges; without it, the gauges stay stuck in a "waiting for sensors" state.
5. **Watchdog**: 45 seconds of silence → send `SENSOR_OFFLINE`; next reading received → send `SENSOR_ONLINE` (transition-only, sent once each way). Used by the weekly report to exclude offline time from "healthy time."

Then run **`scripts/test-device-events.ps1`** (automated verification of all 8 API contract cases) and **`scripts/demo-rehearsal.ps1`** (automated rehearsal of the filming scenario).

**Six mandatory data-processing items for the hardware teammate** (from `docs/INTEGRATION-PLAN-node-red.md` §3 — all required):

| # | Item | Rule |
|---|---|---|
| 1 | Normalized numeric fields | `temperature`, `humidity`, `light`, `soilPH` — all numeric, never strings; field-name spelling must be exact |
| 2 | Calibrated pH | `soilPH` must be a calibrated 0–14 value, **never** raw ADC/voltage — at least 2-point calibration |
| 3 | Light polarity | `light: 1 = bright`; if the LDR reads inverted, flip it in Node-RED (`light = 1 - raw`) |
| 4 | State determination + hysteresis | Decide one of the 6 moods using thresholds with hysteresis, so the state doesn't flicker at the boundary (§5.2) |
| 5 | Transition-only events | Remember the previous state; send exactly one event, only when it actually changes |
| 6 | Unique `eventId` + timezone-offset `occurredAt` | `eventId` must be unique every send (safe to resend — the server dedupes); `occurredAt` must carry a timezone offset (`+07:00` or `Z`) or the API rejects it with HTTP 400 |

---

### 3. Track 3 — Full rehearsal (after Track 1 + Track 2)

Real-pot, camera-ready Phase-20 scenario:

1. Start: Jamkachu is **Happy**
2. Temperature rises to **34°C** → `PLANT_STATE_CHANGED` (Overheating) → hardware reacts locally (servo/RGB/LCD) **and** the web app's **Cool Me Down** quest appears
3. Cool back down to **29°C** → an Overheating-exit event fires → the quest enters **VERIFYING**, with a 5-minute countdown visible on screen
4. Stable for 5 minutes → **+XP** is awarded, the Bond gauge rises
5. XP crosses a 100-point boundary → **level-up** — hardware (RGB/buzzer/LCD) and web (overlay) celebrate together

Failure tests (handoff document §Phase 19 philosophy):

- **Game server stopped** → hardware control keeps working locally (Node-RED's safety behavior never depends on the web backend)
- **Duplicate event resend** (same `eventId`) → XP is awarded exactly once (the repeat comes back as `duplicate:true`)
- **Restart** the dev server / browser → state is restored correctly from Supabase (nothing important lives only in memory)

Finally, a **Vercel deployment check** — confirm the production build deploys cleanly and the live URL shows the same working loop. Required env vars in Vercel match `README.md`'s Environment Variables section: Supabase URL + publishable key, `SUPABASE_SECRET_KEY` (server-only), and the optional `DEVICE_API_TOKEN` / `ANTHROPIC_API_KEY`.

---

### 4. Suggested timeline

| Track | Duration |
|---|---|
| Track 1 — Frontend ↔ Backend | ~1 day |
| Track 2 — Node-RED/Arduino ↔ Backend | ~0.5–1 day |
| Track 3 — Full rehearsal | ~0.5 day |

Tracks 1 and 2 can run in parallel — different owners, different files, no shared blocking dependency. Track 3 needs both finished first.

---

### 5. Supabase SQL migrations the operator must run

Run in the Supabase Dashboard → **SQL Editor**, **in order**. Every script here is additive-only and safe to re-run.

| # | File | Purpose | Requires | Status |
|---|---|---|---|---|
| 1 | `supabase/milestone1.sql` | Base schema (`plants` table, etc.) | — | Prerequisite, already required by `docs/SETUP-milestone1-2.md` — almost certainly already applied, since the main screen is already live-bound to real data |
| 2 | `supabase/milestone3.sql` | `bond_state` / `quests` / `plant_badges` / `bond_events` / `xp_rewards` tables + `award_xp()` RPC + Realtime publication | `milestone1.sql` | Prerequisite, already required by `docs/SETUP-game-systems.md` — almost certainly already applied |
| 3 | `supabase/milestone4-soil-quests.sql` | Widens the `quests.quest_key` check constraint to allow `BALANCE_SOIL_ACIDIC` / `BALANCE_SOIL_ALKALINE` | `milestone3.sql` | **New — must run** before soil-pH recovery quests will pass validation |
| 4 | `supabase/milestone5-growth-records.sql` | Creates the append-only `growth_records` table (manual Growth Stage log, intentionally separate from Bond Level) + RLS | `milestone1.sql` | **New — must run** before the Settings page's growth-record feature works |

---

<a id="indonesia"></a>

## 🇮🇩 Bahasa Indonesia

Target pembaca: seluruh tim PlantMoji — pemilik Engine (backend), pemilik Design (presentasi/style), dan rekan tim hardware. Dokumen ini adalah sumber kebenaran bersama untuk hal-hal yang masih perlu diselesaikan sebelum demo yang siap direkam.

Konteks: mesin game di backend (quest / XP / badge / streak / story) sudah dibangun dan sudah diverifikasi lewat Supabase — lihat `docs/SETUP-game-systems.md`. Sisi Node-RED/Arduino punya rencana detailnya sendiri — lihat `docs/INTEGRATION-PLAN-node-red.md` (sudah trilingual; dokumen ini hanya meringkasnya di Track 2, tidak menduplikasi isinya). Dokumen ini menambahkan bagian yang menyatukan semuanya **di layar** (Track 1), plus gladi bersih end-to-end terakhir (Track 3).

**Model tim** (detail lengkap di `CONTRIBUTING.md`): ada dua pemilik. **Engine** memiliki `src/game/`, `src/app/api/`, `src/lib/`, `supabase/`, `src/types/`. **Design** memiliki markup/style di dalam `src/components/`, JSX/class di bawah `src/app/**`, token desain di `src/app/globals.css`, dan semua isi `public/` (termasuk `public/farm/`). Branch memakai pola `engine/*` / `design/*`; setiap PR ke `main` butuh review dari pemilik yang *sebaliknya*; tidak ada yang push langsung ke `main`. Komponen presentasional (`BondPanel`, `HomeQuestCard`, `QuestProgress`, `LevelUpOverlay`, `Notice`, `BottomNav`) punya kontrak props tetap yang didokumentasikan di `CONTRIBUTING.md` — Design bebas mengubah tampilan di dalamnya, tapi kalau bentuk props ingin diubah, harus disetujui Engine dulu.

---

### 0. Kondisi saat ini (snapshot)

- `/` di-rewrite (`next.config.ts`) untuk menyajikan halaman pixel-farm buatan designer apa adanya: `public/farm/index.html` + `public/farm/style.css` (dimiliki Design, sesuai `CONTRIBUTING.md`).
- `public/farm/live.js` (read-only, memakai publishable key Supabase + RLS) sudah mengikat data asli ke markup tersebut — tidak ada logika game yang berjalan di browser, hanya menampilkan:
  - baris `plants` + `bond_state` lewat langganan Realtime `postgres_changes` → mood, nama tanaman, Bond Level, xp-bar, badge streak ter-update langsung tanpa refresh
  - baris `sensor_readings` terbaru (suhu, kelembapan, cahaya) lewat polling setiap 15 detik (tabel itu tidak punya Realtime)
  - pemanggilan `POST /api/game-tick` setiap 60 detik, agar quest berbasis jendela waktu (misalnya verifikasi pemulihan 5 menit) tetap selesai meski halaman hanya dibiarkan terbuka di depan kamera
  - teks/ikon speech-bubble per-mood saat ini masih **hardcoded** lewat lookup `MOODS` di dalam `live.js` — belum digerakkan oleh lapisan AI/personality
- Halaman React untuk `/quests`, `/collection`, `/reports`, `/settings` sudah ada dan bisa diakses dari sidebar; `/design` adalah sandbox tanpa Supabase untuk kerja style (`CONTRIBUTING.md` §4).
- **Belum ada di layar utama:** panel quest, perayaan level-up, dan endpoint AI speech-bubble. Itulah persis Track 1 di bawah — prioritas saat ini.

---

### 1. Track 1 — Frontend ↔ Backend (SEKARANG, prioritas)

Demo hidup-matinya ada di layar utama. Hampir semua logika game sudah ada di sisi server (lihat `docs/SETUP-game-systems.md`); tinggal belum dirender di `public/farm/`.

| # | Tugas | Pemilik | Tujuan |
|---|---|---|---|
| 1 | Panel quest di layar utama — panel fungsional yang memakai ulang style `.panel-glass` yang sudah ada (`public/farm/style.css`) untuk menampilkan quest aktif | Backend — **sedang dikerjakan**; Designer merestyle setelahnya | **Kritis untuk demo**: quest muncul → hitung mundur verifikasi 5 menit → +XP semuanya harus terlihat di kamera (mock home pada spec §33 punya kartu CURRENT QUEST) |
| 2 | Perayaan level-up di layar utama — backend menyambungkan deteksi batas level `bond_state` via Realtime plus overlay pixel dasar | Backend; Designer bisa mempercantik visualnya setelahnya | Klimaks demo — momen "Bond Lv. up" yang menjadi tujuan seluruh alur |
| 3 | Endpoint AI speech-bubble `POST /api/mood-message` — sadar kepribadian (5 kepribadian × 6 mood), dengan fallback template deterministik | Backend | Menggantikan teks bubble `MOODS` yang hardcoded di `live.js` dengan lapisan personality asli yang dijelaskan di `docs/SETUP-game-systems.md` §4 |
| 4 | Enam wajah maskot khusus per-mood di dalam SVG (`Happy` sudah ada; tambahkan `Overheating`, `DryAir`, `Sleepy`, `SoilAcidic`, `SoilAlkaline`) | **Designer** — di dalam `public/farm/index.html`, berkas milik mereka sesuai kepemilikan `CONTRIBUTING.md` | Mood harus terbaca dari maskotnya sendiri, tidak hanya lewat ikon/teks di sampingnya |
| 5 | Pass tema pixel pada halaman React (`/quests`, `/collection`, `/reports`, `/settings`) memakai sandbox `/design` | **Designer** — opsional untuk MVP | Konsistensi visual antara layar utama dan halaman-halaman sidebar |

**Kriteria penerimaan:** seluruh alur demo — perubahan mood → quest muncul → hitung mundur verifikasi → +XP → level-up — terlihat **tanpa pernah meninggalkan layar utama**.

---

### 2. Track 2 — Node-RED/Arduino ↔ Backend (aman dikerjakan paralel)

Detail langkah-demi-langkah lengkap ada di **`docs/INTEGRATION-PLAN-node-red.md`** (sudah trilingual) — baca dokumen itu untuk langkah implementasi sebenarnya. Ringkasan di sini, dalam 5 poin:

1. **Tentukan kasusnya** bersama rekan tim hardware: **Kasus A** — sudah memakai (atau bisa mengadopsi) flow v5 yang sudah tervalidasi, jalur paling cepat; atau **Kasus B** — flow dashboard baru buatan sendiri, yang butuh mesin tambahan di poin berikutnya.
2. **Khusus Kasus B** — tambahkan function penentuan state (ambang batas + histeresis, §5.2) dan function deteksi transisi (hanya kirim saat state benar-benar berubah) sebelum membangun amplop (envelope) event.
3. **Smoke test `POST /api/device-events`** — picu satu perubahan state nyata dan pastikan responsnya `{ok:true, duplicate:false, applied:true}`, serta mood berubah langsung di layar web utama tanpa refresh.
4. **Telemetri 10 detik ke `sensor_readings`** — inilah yang mengisi gauge suhu/kelembapan/cahaya di layar utama; tanpa ini, gauge akan tetap dalam status "waiting for sensors".
5. **Watchdog**: 45 detik tanpa data → kirim `SENSOR_OFFLINE`; saat data diterima lagi → kirim `SENSOR_ONLINE` (hanya saat transisi, masing-masing sekali). Dipakai laporan mingguan untuk mengecualikan waktu offline dari "waktu sehat".

Lalu jalankan **`scripts/test-device-events.ps1`** (verifikasi otomatis untuk 8 skenario kontrak API) dan **`scripts/demo-rehearsal.ps1`** (gladi bersih otomatis untuk skenario syuting).

**Enam item pemrosesan data wajib untuk rekan tim hardware** (dari `docs/INTEGRATION-PLAN-node-red.md` §3 — semuanya wajib):

| # | Item | Aturan |
|---|---|---|
| 1 | Normalisasi field numerik | `temperature`, `humidity`, `light`, `soilPH` — semua harus numerik, jangan string; ejaan nama field harus persis |
| 2 | pH terkalibrasi | `soilPH` harus nilai terkalibrasi 0–14, **bukan** raw ADC/tegangan — minimal kalibrasi 2 titik |
| 3 | Polaritas cahaya | `light: 1 = terang`; jika LDR terbaca terbalik, balik di Node-RED (`light = 1 - raw`) |
| 4 | Penentuan state + histeresis | Tentukan salah satu dari 6 mood memakai ambang batas dengan histeresis, agar state tidak berkedip-kedip di batas (§5.2) |
| 5 | Event hanya saat transisi | Ingat state sebelumnya; kirim tepat satu event, hanya saat benar-benar berubah |
| 6 | `eventId` unik + `occurredAt` dengan offset zona waktu | `eventId` harus unik setiap kali kirim (aman dikirim ulang — server menghilangkan duplikat); `occurredAt` harus membawa offset zona waktu (`+07:00` atau `Z`), atau API menolaknya dengan HTTP 400 |

---

### 3. Track 3 — Gladi bersih penuh (setelah Track 1 + Track 2)

Skenario Phase-20 dengan pot tanaman asli, siap direkam:

1. Awal: Jamkachu dalam kondisi **Happy**
2. Suhu naik ke **34°C** → `PLANT_STATE_CHANGED` (Overheating) → hardware bereaksi secara lokal (servo/RGB/LCD) **dan** quest **Cool Me Down** muncul di web app
3. Turun kembali ke **29°C** → event keluar dari Overheating terpicu → quest masuk status **VERIFYING**, dengan hitung mundur 5 menit terlihat di layar
4. Stabil selama 5 menit → **+XP** diberikan, gauge Bond naik
5. XP melewati batas kelipatan 100 → **level-up** — hardware (RGB/buzzer/LCD) dan web (overlay) merayakannya bersama-sama

Uji kegagalan (filosofi dokumen serah terima §Phase 19):

- **Game server dimatikan** → kontrol hardware tetap berjalan secara lokal (perilaku keamanan Node-RED tidak pernah bergantung pada backend web)
- **Event duplikat dikirim ulang** (`eventId` sama) → XP diberikan tepat satu kali (pengiriman ulang kembali sebagai `duplicate:true`)
- **Restart** dev server / browser → state pulih dengan benar dari Supabase (tidak ada hal penting yang hanya hidup di memori)

Terakhir, **pengecekan deployment Vercel** — pastikan build produksi ter-deploy dengan bersih dan URL live menampilkan alur kerja yang sama. Env var yang wajib ada di Vercel mengikuti bagian Environment Variables di `README.md`: URL + publishable key Supabase, `SUPABASE_SECRET_KEY` (hanya server), dan `DEVICE_API_TOKEN` / `ANTHROPIC_API_KEY` yang opsional.

---

### 4. Perkiraan linimasa

| Track | Durasi |
|---|---|
| Track 1 — Frontend ↔ Backend | ~1 hari |
| Track 2 — Node-RED/Arduino ↔ Backend | ~0.5–1 hari |
| Track 3 — Gladi bersih penuh | ~0.5 hari |

Track 1 dan Track 2 bisa dikerjakan paralel — pemilik berbeda, berkas berbeda, tidak ada ketergantungan yang saling memblokir. Track 3 baru bisa dimulai setelah keduanya selesai.

---

### 5. Migrasi SQL Supabase yang harus dijalankan operator

Jalankan di Supabase Dashboard → **SQL Editor**, **berurutan**. Semua skrip di sini bersifat additive-only dan aman dijalankan ulang.

| # | Berkas | Tujuan | Prasyarat | Status |
|---|---|---|---|---|
| 1 | `supabase/milestone1.sql` | Skema dasar (tabel `plants`, dll.) | — | Prasyarat, sudah diwajibkan oleh `docs/SETUP-milestone1-2.md` — hampir pasti sudah dijalankan, karena layar utama sudah live-bound ke data asli |
| 2 | `supabase/milestone3.sql` | Tabel `bond_state` / `quests` / `plant_badges` / `bond_events` / `xp_rewards` + RPC `award_xp()` + publikasi Realtime | `milestone1.sql` | Prasyarat, sudah diwajibkan oleh `docs/SETUP-game-systems.md` — hampir pasti sudah dijalankan |
| 3 | `supabase/milestone4-soil-quests.sql` | Melebarkan check constraint `quests.quest_key` agar menerima `BALANCE_SOIL_ACIDIC` / `BALANCE_SOIL_ALKALINE` | `milestone3.sql` | **Baru — wajib dijalankan** sebelum quest pemulihan pH tanah bisa lolos validasi |
| 4 | `supabase/milestone5-growth-records.sql` | Membuat tabel append-only `growth_records` (log Growth Stage manual, sengaja dipisah dari Bond Level) + RLS | `milestone1.sql` | **Baru — wajib dijalankan** sebelum fitur growth-record di halaman Settings berfungsi |

---

<a id="korean"></a>

## 🇰🇷 한국어

대상: PlantMoji 팀 전체 — Engine 오너(백엔드), Design 오너(프레젠테이션/스타일), 그리고 하드웨어 담당 팀원. 촬영 가능한 데모 전에 남은 일을 정리한 팀 공용 기준 문서입니다.

배경: 백엔드 게임 엔진(퀘스트/XP/배지/스트릭/스토리)은 이미 구현되어 Supabase로 검증됐습니다 — `docs/SETUP-game-systems.md` 참고. Node-RED/Arduino 쪽은 별도의 상세 계획이 있습니다 — `docs/INTEGRATION-PLAN-node-red.md`(이미 3개 언어로 작성됨; 이 문서는 Track 2에서 그 내용을 요약만 하고 중복하지 않습니다). 이 문서는 모든 것을 **화면에서** 하나로 잇는 부분(Track 1)과, 마지막 전체 리허설(Track 3)을 추가합니다.

**팀 운영 방식** (상세는 `CONTRIBUTING.md`): 오너가 둘입니다. **Engine**은 `src/game/`, `src/app/api/`, `src/lib/`, `supabase/`, `src/types/`를 소유합니다. **Design**은 `src/components/` 내부 마크업/스타일, `src/app/**`의 JSX/클래스, `src/app/globals.css`의 디자인 토큰, 그리고 `public/`(`public/farm/` 포함) 전체를 소유합니다. 브랜치는 `engine/*` / `design/*` 패턴을 쓰고, `main`으로 들어가는 모든 PR은 **반대쪽** 오너의 리뷰가 필요하며, `main`에 직접 push하지 않습니다. 프레젠테이셔널 컴포넌트(`BondPanel`, `HomeQuestCard`, `QuestProgress`, `LevelUpOverlay`, `Notice`, `BottomNav`)는 `CONTRIBUTING.md`에 문서화된 고정 props 계약을 가집니다 — Design은 내부를 자유롭게 재스타일링할 수 있지만, props 형태를 바꾸려면 먼저 Engine의 동의가 필요합니다.

---

### 0. 현재 상태 (스냅샷)

- `/`는 (`next.config.ts`) 리라이트를 통해 디자이너의 픽셀팜 페이지를 그대로 서빙합니다: `public/farm/index.html` + `public/farm/style.css` (`CONTRIBUTING.md`에 따라 Design 소유).
- `public/farm/live.js`(읽기 전용, publishable Supabase key + RLS)가 이미 그 마크업에 실제 데이터를 바인딩하고 있습니다 — 브라우저에는 게임 로직이 전혀 없고 표시만 합니다:
  - `postgres_changes` Realtime 구독을 통한 `plants` + `bond_state` 행 → 무드, 식물 이름, Bond Level, XP 바, 스트릭 배지가 새로고침 없이 실시간 갱신
  - 최신 `sensor_readings` 행(온도, 습도, 조도)을 15초 폴링으로 표시(그 테이블은 Realtime이 없음)
  - 60초마다 `POST /api/game-tick` 호출 — 시간 조건 퀘스트(예: 5분 회복 검증)가 카메라 앞에 페이지만 켜놔도 완료되도록 함
  - 무드별 말풍선 텍스트/아이콘은 현재 `live.js` 안의 `MOODS` 룩업으로 **하드코딩**되어 있음 — 아직 AI/성격 레이어가 반영되지 않음
- `/quests`, `/collection`, `/reports`, `/settings` React 페이지는 이미 존재하며 사이드바에서 접근 가능; `/design`은 Supabase 없이 스타일 작업을 할 수 있는 샌드박스(`CONTRIBUTING.md` §4).
- **메인 화면에 아직 없는 것:** 퀘스트 패널, 레벨업 축하 연출, AI 말풍선 엔드포인트. 이것이 바로 아래 Track 1이며 현재 최우선 순위입니다.

---

### 1. Track 1 — 프론트엔드 ↔ 백엔드 (지금, 최우선)

데모의 성패는 메인 화면에서 갈립니다. 게임 로직 대부분은 이미 서버 쪽에 존재하지만(`docs/SETUP-game-systems.md` 참고) 아직 `public/farm/`에 렌더링되지 않았습니다.

| # | 작업 | 담당 | 목적 |
|---|---|---|---|
| 1 | 메인 화면 퀘스트 패널 — 기존 `.panel-glass` 스타일(`public/farm/style.css`)을 재사용하는 기능형 패널로 활성 퀘스트를 표시 | 백엔드 — **진행 중**; 이후 디자이너가 리스타일링 | **데모에 필수적**: 퀘스트 등장 → 5분 검증 카운트다운 → +XP가 모두 카메라에 보여야 함 (spec §33의 홈 목업에 CURRENT QUEST 카드가 있음) |
| 2 | 메인 화면 레벨업 축하 연출 — 백엔드가 `bond_state` Realtime으로 레벨 경계 감지를 연결하고 기본 픽셀 오버레이를 구현 | 백엔드; 이후 디자이너가 비주얼을 업그레이드 가능 | 데모의 클라이맥스 — 다른 모든 흐름이 향하는 "Bond Lv. up" 순간 |
| 3 | AI 말풍선 엔드포인트 `POST /api/mood-message` — 성격 반영(5성격 × 6무드), 결정적 템플릿 폴백 포함 | 백엔드 | `live.js`의 하드코딩된 `MOODS` 말풍선 텍스트를, `docs/SETUP-game-systems.md` §4에 설명된 실제 personality 레이어로 대체 |
| 4 | SVG 안의 무드별 마스코트 얼굴 6종 (`Happy`는 이미 있음; `Overheating`, `DryAir`, `Sleepy`, `SoilAcidic`, `SoilAlkaline` 추가) | **디자이너** — `public/farm/index.html` 내부, `CONTRIBUTING.md` 소유권에 따른 그들의 파일 | 무드는 옆의 아이콘/텍스트뿐 아니라 마스코트 자체에서도 드러나야 함 |
| 5 | `/design` 샌드박스를 사용한 React 페이지(`/quests`, `/collection`, `/reports`, `/settings`) 픽셀 테마 작업 | **디자이너** — MVP에는 선택 사항 | 메인 화면과 사이드바 페이지 간의 시각적 일관성 |

**인수 기준:** 무드 변화 → 퀘스트 등장 → 검증 카운트다운 → +XP → 레벨업으로 이어지는 전체 데모 루프가 **메인 화면을 벗어나지 않고** 보여야 합니다.

---

### 2. Track 2 — Node-RED/Arduino ↔ 백엔드 (병렬 진행 안전)

전체 단계별 상세 내용은 **`docs/INTEGRATION-PLAN-node-red.md`**(이미 3개 언어)에 있습니다 — 실제 구현 단계는 그 문서를 읽으세요. 여기서는 5개 항목으로 요약합니다:

1. 하드웨어 담당 팀원과 함께 **케이스 결정**: **케이스 A** — 이미 검증된 v5 플로우를 쓰고 있거나 도입 가능(가장 빠른 길); 또는 **케이스 B** — 직접 만든 새 대시보드 플로우(다음 항목의 추가 엔진이 필요).
2. **케이스 B만 해당** — 이벤트 봉투(envelope)를 만들기 전에 상태 판정 function(임계값 + 히스테리시스, §5.2)과 전이 감지 function(상태가 실제로 바뀔 때만 전송)을 추가합니다.
3. **`POST /api/device-events` 스모크 테스트** — 실제 상태 변화 하나를 발생시켜 응답이 `{ok:true, duplicate:false, applied:true}`인지, 그리고 웹 메인 화면에서 새로고침 없이 무드가 바로 바뀌는지 확인합니다.
4. **`sensor_readings`로의 10초 텔레메트리** — 이것이 메인 화면의 온도/습도/조도 게이지를 채우는 데이터입니다; 이게 없으면 게이지는 계속 "waiting for sensors" 상태로 남습니다.
5. **워치독**: 45초 무수신 → `SENSOR_OFFLINE` 전송; 다음 데이터 수신 시 → `SENSOR_ONLINE` 전송(전이 시에만, 각각 한 번). 주간 리포트가 오프라인 시간을 "건강한 시간"에서 제외하는 데 사용됩니다.

이후 **`scripts/test-device-events.ps1`**(API 계약 8가지 케이스 자동 검증)과 **`scripts/demo-rehearsal.ps1`**(촬영 시나리오 자동 리허설)을 실행합니다.

**하드웨어 담당 팀원에게 요청할 6가지 필수 데이터 가공 항목** (`docs/INTEGRATION-PLAN-node-red.md` §3 기준 — 전부 필수):

| # | 항목 | 규칙 |
|---|---|---|
| 1 | 필드 숫자형 정규화 | `temperature`, `humidity`, `light`, `soilPH` — 전부 숫자형, 문자열 금지; 필드명 철자는 정확히 일치해야 함 |
| 2 | 보정된 pH | `soilPH`는 0–14로 보정된 값이어야 하며, raw ADC/전압은 **절대 금지** — 최소 2점 교정 필요 |
| 3 | 조도 극성 | `light: 1 = 밝음`; LDR이 반대로 읽히면 Node-RED에서 뒤집을 것(`light = 1 - raw`) |
| 4 | 상태 판정 + 히스테리시스 | 임계값 + 히스테리시스로 6개 무드 중 하나를 결정해, 경계에서 상태가 깜빡이지 않게 함(§5.2) |
| 5 | 전이 시에만 이벤트 | 이전 상태를 기억하고, 실제로 바뀔 때만 정확히 이벤트 1개를 전송 |
| 6 | 유니크 `eventId` + 타임존 오프셋 포함 `occurredAt` | `eventId`는 전송마다 유니크해야 함(재전송해도 안전 — 서버가 중복 제거); `occurredAt`은 타임존 오프셋(`+07:00` 또는 `Z`)을 반드시 포함해야 하며, 없으면 API가 HTTP 400으로 거부함 |

---

### 3. Track 3 — 전체 리허설 (Track 1 + Track 2 완료 후)

실제 화분으로 진행하는, 촬영 준비가 된 Phase-20 시나리오:

1. 시작: Jamkachu가 **Happy** 상태
2. 온도가 **34°C**로 상승 → `PLANT_STATE_CHANGED`(Overheating) → 하드웨어가 로컬에서 반응(서보/RGB/LCD) **그리고** 웹 앱의 **Cool Me Down** 퀘스트가 등장
3. 다시 **29°C**로 냉각 → Overheating 이탈 이벤트 발생 → 퀘스트가 **VERIFYING** 상태로 진입, 화면에 5분 카운트다운 표시
4. 5분간 안정 유지 → **+XP** 지급, Bond 게이지 상승
5. XP가 100 단위 경계를 넘음 → **레벨업** — 하드웨어(RGB/부저/LCD)와 웹(오버레이)이 함께 축하

실패 테스트 (인수인계 문서 §Phase 19 철학):

- **게임 서버 중단** → 하드웨어 제어는 로컬에서 계속 동작(Node-RED의 안전 동작은 웹 백엔드에 절대 의존하지 않음)
- **중복 이벤트 재전송**(동일 `eventId`) → XP는 정확히 한 번만 지급(재전송분은 `duplicate:true`로 돌아옴)
- **재시작**(dev 서버 / 브라우저) → Supabase로부터 상태가 올바르게 복원됨(메모리에만 존재하는 중요한 상태 없음)

마지막으로 **Vercel 배포 확인** — 프로덕션 빌드가 문제없이 배포되고, 라이브 URL에서 동일한 동작 루프가 보이는지 확인합니다. Vercel에 필요한 환경 변수는 `README.md`의 Environment Variables 섹션과 동일합니다: Supabase URL + publishable key, `SUPABASE_SECRET_KEY`(서버 전용), 그리고 선택 항목인 `DEVICE_API_TOKEN` / `ANTHROPIC_API_KEY`.

---

### 4. 권장 일정

| Track | 소요 시간 |
|---|---|
| Track 1 — 프론트엔드 ↔ 백엔드 | 약 1일 |
| Track 2 — Node-RED/Arduino ↔ 백엔드 | 약 0.5–1일 |
| Track 3 — 전체 리허설 | 약 0.5일 |

Track 1과 Track 2는 병렬로 진행할 수 있습니다 — 담당자도 다르고 파일도 달라서 서로를 막는 의존성이 없습니다. Track 3는 둘 다 끝난 뒤에만 시작할 수 있습니다.

---

### 5. 운영자가 Supabase에서 실행해야 할 SQL 마이그레이션

Supabase Dashboard → **SQL Editor**에서 **순서대로** 실행합니다. 여기 있는 모든 스크립트는 추가 전용(additive-only)이며 두 번 실행해도 안전합니다.

| # | 파일 | 목적 | 선행 조건 | 상태 |
|---|---|---|---|---|
| 1 | `supabase/milestone1.sql` | 기본 스키마(`plants` 테이블 등) | — | 선행 조건, `docs/SETUP-milestone1-2.md`에서 이미 요구됨 — 메인 화면이 이미 실제 데이터에 live-bound 되어 있으므로 거의 확실히 이미 실행됨 |
| 2 | `supabase/milestone3.sql` | `bond_state` / `quests` / `plant_badges` / `bond_events` / `xp_rewards` 테이블 + `award_xp()` RPC + Realtime 발행 | `milestone1.sql` | 선행 조건, `docs/SETUP-game-systems.md`에서 이미 요구됨 — 거의 확실히 이미 실행됨 |
| 3 | `supabase/milestone4-soil-quests.sql` | `quests.quest_key` check constraint를 넓혀 `BALANCE_SOIL_ACIDIC` / `BALANCE_SOIL_ALKALINE`을 허용 | `milestone3.sql` | **신규 — 실행 필수**, 토양 pH 회복 퀘스트가 검증을 통과하려면 필요 |
| 4 | `supabase/milestone5-growth-records.sql` | 추가 전용 `growth_records` 테이블(수동 Growth Stage 기록, Bond Level과 의도적으로 분리) + RLS 생성 | `milestone1.sql` | **신규 — 실행 필수**, Settings 페이지의 growth-record 기능이 동작하려면 필요 |
