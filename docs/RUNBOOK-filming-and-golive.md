# PlantMoji — Filming & Go-Live Runbook

Same content three times: **English → Bahasa Indonesia → 한국어**. Print it, check the boxes.
Sources of truth: `.env.local.example`, `supabase/*.sql`, `docs/API-raw-sensor-ingest.md`, `public/farm/demo.js`, `public/farm/quiz.js`, `src/components/collection-tabs.tsx`, `src/components/reno-app-shell.tsx`, spec `docs/superpowers/specs/2026-08-07-dopamine-ux-reframe-design.md` (§4.5, §6).

---

## English

### 1. One-time setup (project owner)

#### 1.1 Vercel environment variables

Vercel → Project → **Settings → Environment Variables**. Set for **Production** (add to Preview too if you rehearse on preview URLs). Names must match `.env.local.example` exactly:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — `https://YOUR_PROJECT_REF.supabase.co` (Supabase Dashboard → Project Settings → API)
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — `sb_publishable_...` (browser-safe, read-only via RLS; legacy `anon` key also works)
- [ ] `SUPABASE_SECRET_KEY` — `sb_secret_...` (**server only, never in browser code**; legacy `service_role` key also works)
- [ ] `DEVICE_API_TOKEN` — shared token for the device endpoints. When set, Node-RED must send `Authorization: Bearer <value>`. Keep it set for go-live: when unset the endpoint accepts unauthenticated posts (local prototype mode only).
- [ ] `DEMO_CHEAT_CODE` — **8+ characters**. Powers Settings → Demo Control Center ("Unlock everything" = replay-safe Lv.10 showcase; "Reset to start" = back to Lv.1 / 0 XP). Checked server-side, never exposed to the browser.
- [ ] `GEMINI_API_KEY` *(optional)* — Gemini explanation layer, server-side only. When unset or when a call fails, deterministic templates take over automatically.
- [ ] *(optional)* `BMKG_ADM4_CODE` — village forecast code; defaults to Tegalgede, Sumbersari, Jember (`35.09.21.1005`), so usually leave it alone.
- [ ] **Redeploy** after saving. Environment variable changes only apply to a new deployment.

#### 1.2 Supabase migrations (SQL Editor, in this order)

There is **no `milestone2.sql`** — `milestone1.sql` covers that ground. Exact filenames in `supabase/`:

| # | File | Adds |
|---|---|---|
| 1 | `milestone1.sql` | plants, device_events, RLS, realtime |
| 2 | `milestone3.sql` | bond_state, quests, badges, XP ledger, `award_xp` RPC |
| 3 | `milestone4-soil-quests.sql` | soil quest keys |
| 4 | `milestone5-growth-records.sql` | growth diary records |
| 5 | `milestone6-crop-profiles.sql` | crop-profile (strawberry) key on plants |
| 6 | `milestone6-monitoring.sql` | soil_moisture / light_lux columns |
| 7 | `milestone7-more-quests.sql` | Humidify My Air + Stay Comfy quest keys |
| 8 | `milestone8-dopamine.sql` | story/badge/demo progression + `bond_events` realtime |
| 9 | `milestone9-raw-sensor-ingest.sql` | `sensor_readings` table — **required before Node-RED switches to `/api/sensor-readings`** |
| 10 | `milestone10-jember-crop-catalog.sql` | 10 Jember crops with versioned evidence/sources |
| 11 | `milestone11-tamagotchi.sql` | companion (Tamagotchi) state + evolution-stage columns, realtime |
| 12 | `milestone12-selectable-crops.sql` | activates soybean + cayenne pepper profiles for automatic quests |
| 13 | `milestone13-daily-quiz.sql` | `daily_quiz_attempts` table + `answer_daily_quiz` RPC — **required before the Farm Case Quiz can award XP** |
| 14 | `milestone14-fast-levels.sql` | flat 30-XP Bond Level progression |
| 15 | `milestone15-light-percentage.sql` | `sensor_readings.light` stored as calibrated 0–100% (not lux/PPFD/DLI) |
| 16 | *(reserved — no file yet)* | companion evolution ladder (Seed → Sprout → Bud → Bloom → Guardian) — in flight, skip until it ships |
| 17 | `milestone17-quiz-kind-scoring.sql` | quiz never deducts XP — kind scoring: a wrong/timed-out Daily Quiz answer now awards 0 XP instead of −1, so a miss can never demote Bond Level |
| 18 | `milestone18-seed-shop.sql` | Seed Shop economy — `bond_state.seeds` + `seed_rewards` ledger + `shop_purchases` + `award_seeds`/`purchase_item`/`equip_item` RPCs, realtime on `shop_purchases`. Seeds MAY decrease (spendable currency); XP/Bond Level still never decrease |
| 19 | `milestone19-photo-diary.sql` | `plant-photos` Storage bucket + `growth_records.photo_url`/`ai_comment` — **required before the Camera photo diary can save photos**; without it `/camera` shows an operator "coming soon" note and the diary renders without thumbnails |

- [ ] On the team's existing Supabase project, **milestone1–milestone8 are typically already applied** (the running game depends on them). **milestone9–milestone18 are newer** — verify all nine before go-live (milestone9, 10, 11, 12, 13, 14, 15, 17, 18 — milestone16 has no file yet, see below).
- [ ] Re-running is safe: every file is guarded (`create ... if not exists`, `add column if not exists`, drop-and-recreate policies). When in doubt, run all sixteen again in order (skip milestone16 — reserved, no file yet).
- [ ] Milestone 10 seeds Jember profiles as `draft` / `reference_only` with strawberry pre-approved; **milestone12 then adds soybean + cayenne pepper to the approved set for automatic mood/quest decisions** (tobacco and under-sensored crops stay unavailable). Read `docs/CROP-PROFILE-CATALOG-jember.md` before activating any other crop.
- [ ] Milestone 13 is required for the Farm Case Quiz chip to award XP. Without it the quiz still renders and can be answered, but the app returns `quiz_migration_required` instead of granting XP.
- [ ] Milestone 16 has no file yet — reserved for the in-flight companion evolution ladder plan. Skip it in the migration order until it ships.
- [ ] Milestone 17 replaces Milestone 13's `answer_daily_quiz` RPC in place (`create or replace`, same signature/return shape): a wrong or timed-out Daily Quiz answer now awards exactly 0 XP instead of −1, so Bond Level can never be demoted right after a "LEVEL UP!". Correct-answer XP is unchanged.
- [ ] Milestone 18 is required for the Seed Shop. Without it the /shop route shows a friendly "coming soon" state, the farm HUD hides the Seeds chip, and every seed grant is a silent no-op — nothing breaks.
- [ ] Milestone 19 is required for the Camera photo diary. Without it `/camera` renders a "coming soon" operator note with the camera input disabled — nothing crashes. The +1 Seed first-photo-of-the-day grant additionally needs milestone18; without milestone18 the photo still saves and the grant is skipped silently. AI comments need `GEMINI_API_KEY` in Vercel — without it every photo gets the deterministic sensor-template comment (fully functional).

#### 1.3 Hardware teammate — where to point them

- [ ] Raw-sensor endpoint: **`POST /api/sensor-readings`** — payload shape, idempotent `readingId`, and Bearer auth are documented in **`docs/API-raw-sensor-ingest.md`**. Legacy `POST /api/device-events` still accepts the same flat payload.
- [ ] Node-RED integration: **`docs/INTEGRATION-PLAN-node-red.md`**, the trilingual **`node-red/README.md`**, and the flow file `node-red/phase18-bridge-flow.json`.
- [ ] Order matters: apply `milestone9-raw-sensor-ingest.sql` first, set the same `DEVICE_API_TOKEN` in Vercel and in Node-RED, then switch the flow.

### 2. Pre-filming QA checklist (~40 min, on the ACTUAL demo device + venue network)

**Sound (5 min)**
- [ ] First tap anywhere unlocks audio (sound is default ON after the first gesture). Press any button and confirm a blip.
- [ ] Toggle mute → reload → open `/quests`: the preference (`localStorage` `pm_sound`) persists and stays in sync across pages. Toggle back ON.

**Presenter hotkeys — open the farm home with `?demo=1` (5 min)**
- [ ] `1` lucky ×2 stamp FX plays
- [ ] `2` level-up overlay plays
- [ ] `3` chapter-gate peak plays
- [ ] `4` reward-pod drop plays
- [ ] `5` cycles all six mascot moods (Happy → Overheating → DryAir → Sleepy → SoilAcidic → SoilAlkaline)
- [ ] `E` plays the full evolution ceremony (~7s): dialog beat → accelerating silhouette strobe → a single full-screen flash (WCAG 2.3.1-safe, fires exactly once) → cry + fanfare reveal; auto-dismisses after 6s if the player never taps. Tapping anywhere mid-sequence fast-forwards straight to the reveal — it never reverts. On a reduced-motion device it plays a 900ms crossfade instead of the strobe/flash/shake.
- [ ] `0` opens the QA self-test overlay: PMSfx "loaded", sound pref, PM_STRINGS key count, all four PMFx hooks "yes", reduced-motion state, Supabase "configured". Run "RUN ALL FX" once. `Esc` closes.
- [ ] The "DEMO" tag is visible bottom-left while the mode is active; hotkeys do nothing while a form field has focus.
- [ ] This table covers only the presenter-stable hotkeys (`1`–`5`, `E`, `0`, `Esc`). If more were added today, `public/farm/demo.js`'s header comment has the current full list, and pressing `0` opens the on-screen QA self-test overlay to confirm each FX hook is wired.

**Reward pod — both paths (4 min)**
- [ ] Tap path: pod drops and wiggles → tap it → pop sound + orb cascade + banner.
- [ ] Ignore path: trigger another pod and do NOT touch it → it auto-bursts after ~8 s (nothing ever stalls; it also bursts on page-hide).

**Farm Case Quiz (4 min)**
- [ ] On the farm home page, tap the **QUIZ HARI INI** chip to open the quiz modal (`/api/daily-quiz`; needs milestone13 applied, see §1.2).
- [ ] Let one question's 15-second timer ring run to zero: it counts as a miss (0 XP — kind scoring, milestone17) and does not hang or freeze the modal.
- [ ] Answer wrong once: a category hint appears and the same question re-arms with a fresh 15 s timer. A miss never deducts XP (milestone17 kind scoring) — Bond Level can never go down.
- [ ] Answer the same question wrong a second time: the correct choice highlights with its explanation, then the quiz advances — no third attempt is offered.
- [ ] Answer correctly: a +1–3 XP orb animates into the XP badge, the mascot plays a short cheer plus a matching speech-bubble line, and a Level Up overlay fires if the new total crosses a threshold.
- [ ] Finish all 3 questions: a mastery-by-category summary appears, then **"Keep practicing →"** loads a fresh three-phase farm case (OBSERVE → UNDERSTAND → ACT) — the quiz is endless, not capped at 3/day.

**Collection rewards — tap to play (4 min)**
Open **Treasures** (`/collection`).
- [ ] Moods tab: tap a **discovered** mood card → a character reaction line + particle burst plays. Locked moods stay honest dark silhouettes with no reaction.
- [ ] Badges tab: tap a badge node on the wheel to select it, tap **"Try it now"** to preview its tap effect, then **"Activate"** to equip it as the home-tap effect (persists in `localStorage`) and **"Turn off"** to clear it.
- [ ] Story tab: open an unlocked chapter card and tap **"Play scene"** — a short pixel dialogue replay with its own particle/sound cue.
- [ ] Wisdom tab: tap **"Try a prediction"** on a wisdom card → a two-choice sensor-prediction question opens (practice mode — zero XP, zero sensor writes). Confirm both a correct and an incorrect answer show distinct feedback.
- [ ] If a badge unlocks live during rehearsal, its card flips with a coin sound the moment the `plant_badges` row is inserted — the same realtime path filming day will show.

**Resilience (4 min)**
- [ ] Reload with network off (or Supabase env unset on a preview): page still renders, FX degrade silently, honest "DEMO" tag shows in static demo mode, no error text on screen.

**Accessibility & display (5 min)**
- [ ] Reduced-motion pass: enable "reduce motion" in OS settings, reload — orb cascade collapses to the single count-up, no information is lost.
- [ ] Projector contrast: white cards on the tinted background, borders, and dark text (`#243421`) must be legible from the back of the room. Fix with projector brightness first, CSS never on filming day.

**Locale (3 min)**
- [ ] Toggle ID → EN, reload; then EN → ID, reload. Choice persists (cookie/localStorage) and bubbles, quests, and buttons all switch — no mixed-language leftovers.

**Night mode — only if filming after 18:00 WIB (4 min)**
- [ ] Happy mood inside 18:00–06:00 WIB shows sleeping Jamkachu: closed eyes, slow breath, sleep bubble, light row shown as "Night 🌙" — never as a problem.
- [ ] Problem moods ALWAYS override sleep (cycle with hotkey `5` to confirm the problem faces still show). Safety visibility wins.
- [ ] The window flips at 18:00 / 06:00 without a reload (60 s clock).

### 3. Filming: the three demo beats (+ optional Explore/Treasures close)

**Navigation orientation.** The app runs on a Tamagotchi game loop, not a dashboard: five sidebar tabs — **My Garden** (`/`, the pixel-farm home; Beats 1–3 live here), **Care** (`/quests`, live quest list + celebrations), **Explore** (`/plants`, Jember Crop Explorer), **Memories** (`/diary`, Care Memories + Growth Notes), and **Treasures** (`/collection`, the playable Collection Book). A smaller **Tool Pocket** underneath holds Sensors (`/monitoring`), Recap (`/reports`), and Tools (`/settings` — the Demo Control Center lives at `/settings?demo=1`). Every tab switch shows a tappable pixel Jamkachu loading toy — it is safe to poke on camera, it just bounces and settles.

**Beat 1 — Problem face + action.** Trigger a real problem (e.g. warm the sensor) → mood flips to Overheating, quest "Cool Me Down" appears, and the contextual care button shows the ONE safe action ("Move me to shade 🌳"). Tap it for the why-card. Film the face change and the button.

**Beat 2 — Real care, sensor-verified → XP.** Physically improve the environment → causal-echo chip on the gauge → quest turns VERIFYING (amber shimmer, "Sensor is checking…") → COMPLETED: pod drops, tap it, XP orbs cascade into the bar. Lucky ×2 may fire — it is real, server-deterministic, ~1-in-8, and honestly disclosed in-app.

**Beat 3 — Level-up → decoration.** XP crosses the threshold → level-up overlay → a new level decoration appears on the mascot stage (pot sticker, flag, …). Optional finale: chapter-gate peak.

**Beat 4 — Explore & Treasures (optional close).** Switch to **Explore** (`/plants`), scan the same real snapshot, and open a grounded explanation of the largest measured mismatch against a Jember crop reference. Switch to **Treasures** (`/collection`) and tap a freshly discovered Mood or the day's Badge to show that a reward is playable, not just a checkbox. If asked, mention **Companion Evolution** (Seed → Sprout → Bud → Bloom → Guardian) — a visual track separate from the Bond Level decorations on the mascot stage, driven only by completed sensor-verified care.

**Honest-demo rule (spec §4.5)**
- [ ] Prefer the **seeded-DB real-sensor path**: seed a replay-safe showcase via Settings → Demo Control Center (needs `DEMO_CHEAT_CODE`), then let the real sensor loop drive the three beats.
- [ ] **Disclose the `?demo=1` hotkeys to the producers**: they are presentation replays only — zero data writes, zero XP, zero network. Never present a hotkey replay as a live sensor event.
- [ ] The Farm Case Quiz is a separate, deliberately small scoring track (+1–3 XP correct, 0 on a miss) — never present a quiz answer on camera as sensor-verified care XP.
- [ ] Between takes, use "Reset to start" (sensor data, growth records, crop thresholds, and hardware control are untouched).

---

## Bahasa Indonesia

### 1. Penyiapan satu kali (pemilik proyek)

#### 1.1 Variabel lingkungan Vercel

Vercel → Project → **Settings → Environment Variables**. Isi untuk **Production** (tambahkan juga ke Preview jika latihan memakai URL preview). Nama harus sama persis dengan `.env.local.example`:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — `https://YOUR_PROJECT_REF.supabase.co` (Supabase Dashboard → Project Settings → API)
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — `sb_publishable_...` (aman untuk browser, hanya-baca lewat RLS; kunci lama `anon` juga bisa)
- [ ] `SUPABASE_SECRET_KEY` — `sb_secret_...` (**khusus server, jangan pernah di kode browser**; kunci lama `service_role` juga bisa)
- [ ] `DEVICE_API_TOKEN` — token bersama untuk endpoint perangkat. Jika diisi, Node-RED wajib mengirim `Authorization: Bearer <nilai>`. Biarkan terisi saat go-live: jika kosong, endpoint menerima kiriman tanpa autentikasi (hanya untuk mode prototipe lokal).
- [ ] `DEMO_CHEAT_CODE` — **minimal 8 karakter**. Mengaktifkan Settings → Demo Control Center ("Buka semuanya" = pameran Lv.10 yang aman diulang; "Kembali ke awal" = kembali ke Lv.1 / 0 XP). Diperiksa di sisi server, tidak pernah terkirim ke browser.
- [ ] `GEMINI_API_KEY` *(opsional)* — lapisan penjelasan Gemini, hanya di server. Jika kosong atau gagal, template deterministik mengambil alih.
- [ ] *(opsional)* `BMKG_ADM4_CODE` — kode prakiraan desa; default Tegalgede, Sumbersari, Jember (`35.09.21.1005`), jadi biasanya tidak perlu diubah.
- [ ] **Redeploy** setelah menyimpan. Perubahan variabel lingkungan hanya berlaku pada deployment baru.

#### 1.2 Migrasi Supabase (SQL Editor, sesuai urutan ini)

**Tidak ada `milestone2.sql`** — cakupannya sudah ada di `milestone1.sql`. Nama file persis di `supabase/`:

| # | File | Isi |
|---|---|---|
| 1 | `milestone1.sql` | plants, device_events, RLS, realtime |
| 2 | `milestone3.sql` | bond_state, quests, badges, buku besar XP, RPC `award_xp` |
| 3 | `milestone4-soil-quests.sql` | kunci quest tanah |
| 4 | `milestone5-growth-records.sql` | catatan diary pertumbuhan |
| 5 | `milestone6-crop-profiles.sql` | kunci profil tanaman (stroberi) pada plants |
| 6 | `milestone6-monitoring.sql` | kolom soil_moisture / light_lux |
| 7 | `milestone7-more-quests.sql` | kunci quest Humidify My Air + Stay Comfy |
| 8 | `milestone8-dopamine.sql` | progresi cerita/lencana/demo + realtime `bond_events` |
| 9 | `milestone9-raw-sensor-ingest.sql` | tabel `sensor_readings` — **wajib sebelum Node-RED pindah ke `/api/sensor-readings`** |
| 10 | `milestone10-jember-crop-catalog.sql` | 10 tanaman Jember dengan bukti/sumber berversi |
| 11 | `milestone11-tamagotchi.sql` | kolom status & tahap evolusi companion (Tamagotchi), realtime |
| 12 | `milestone12-selectable-crops.sql` | mengaktifkan profil kedelai + cabai rawit untuk quest otomatis |
| 13 | `milestone13-daily-quiz.sql` | tabel `daily_quiz_attempts` + RPC `answer_daily_quiz` — **wajib sebelum Farm Case Quiz bisa memberi XP** |
| 14 | `milestone14-fast-levels.sql` | progresi Bond Level rata 30 XP |
| 15 | `milestone15-light-percentage.sql` | `sensor_readings.light` disimpan sebagai persentase kalibrasi 0–100% (bukan lux/PPFD/DLI) |
| 16 | *(dicadangkan — belum ada file)* | tangga evolusi companion (Seed → Sprout → Bud → Bloom → Guardian) — masih dikerjakan, lewati sampai rilis |
| 17 | `milestone17-quiz-kind-scoring.sql` | quiz tidak lagi mengurangi XP — kind scoring: jawaban salah/timeout pada Daily Quiz kini memberi 0 XP, bukan −1, sehingga jawaban salah tidak akan pernah menurunkan Bond Level |
| 18 | `milestone18-seed-shop.sql` | ekonomi Toko Benih — `bond_state.seeds` + ledger `seed_rewards` + `shop_purchases` + RPC `award_seeds`/`purchase_item`/`equip_item`, realtime pada `shop_purchases`. Benih BOLEH berkurang (mata uang yang bisa dibelanjakan); XP/Bond Level tetap tidak pernah turun |
| 19 | `milestone19-photo-diary.sql` | bucket Storage `plant-photos` + kolom `growth_records.photo_url`/`ai_comment` — **wajib sebelum Camera photo diary bisa menyimpan foto**; tanpanya `/camera` menampilkan catatan operator "hampir siap" dan diary tampil tanpa thumbnail |

- [ ] Pada proyek Supabase tim yang sudah berjalan, **milestone1–milestone8 biasanya sudah diterapkan** (game yang berjalan bergantung padanya). **milestone9–milestone18 yang lebih baru** — pastikan kesembilannya sebelum go-live (milestone9, 10, 11, 12, 13, 14, 15, 17, 18 — milestone16 belum punya file, lihat di bawah).
- [ ] Menjalankan ulang aman: setiap file dijaga (`create ... if not exists`, `add column if not exists`, policy drop-lalu-buat-ulang). Jika ragu, jalankan lagi keenam belas file sesuai urutan (lewati milestone16 — dicadangkan, belum ada file).
- [ ] Milestone 10 mengisi profil Jember sebagai `draft` / `reference_only` dengan stroberi sudah disetujui; **milestone12 kemudian menambahkan kedelai + cabai rawit ke daftar yang disetujui untuk keputusan mood/quest otomatis** (tembakau dan tanaman tanpa sensor lengkap tetap tidak tersedia). Baca `docs/CROP-PROFILE-CATALOG-jember.md` sebelum mengaktifkan tanaman lain.
- [ ] Milestone 13 wajib agar chip Farm Case Quiz bisa memberi XP — tanpanya, quiz tetap tampil dan bisa dijawab, tapi aplikasi mengembalikan `quiz_migration_required`, bukan memberi XP.
- [ ] Milestone 16 belum punya file — dicadangkan untuk rencana tangga evolusi companion yang masih dikerjakan. Lewati dalam urutan migrasi sampai rilis.
- [ ] Milestone 17 menggantikan RPC `answer_daily_quiz` milik Milestone 13 di tempat yang sama (`create or replace`, signature/bentuk return tetap sama): jawaban Daily Quiz yang salah atau timeout kini memberi tepat 0 XP, bukan −1, sehingga Bond Level tidak akan pernah turun tepat setelah "LEVEL UP!". XP untuk jawaban benar tidak berubah.
- [ ] Milestone 18 diperlukan untuk Toko Benih. Tanpanya, rute /shop menampilkan status "segera hadir" yang ramah, chip Benih di HUD kebun disembunyikan, dan semua hadiah Benih menjadi no-op senyap — tidak ada yang rusak.
- [ ] Milestone 19 wajib untuk Camera photo diary. Tanpanya `/camera` menampilkan catatan operator dengan input kamera dinonaktifkan — tidak ada yang crash. Hadiah +1 Benih foto-pertama-hari-ini juga membutuhkan milestone18; tanpa milestone18 foto tetap tersimpan dan hadiahnya dilewati diam-diam. Komentar AI membutuhkan `GEMINI_API_KEY` di Vercel — tanpanya setiap foto mendapat komentar template sensor deterministik (tetap berfungsi penuh).

#### 1.3 Rekan hardware — arahkan ke sini

- [ ] Endpoint sensor mentah: **`POST /api/sensor-readings`** — bentuk payload, `readingId` idempoten, dan autentikasi Bearer didokumentasikan di **`docs/API-raw-sensor-ingest.md`**. `POST /api/device-events` (lama) masih menerima payload datar yang sama.
- [ ] Integrasi Node-RED: **`docs/INTEGRATION-PLAN-node-red.md`**, **`node-red/README.md`** (tiga bahasa), dan file flow `node-red/phase18-bridge-flow.json`.
- [ ] Urutan penting: terapkan `milestone9-raw-sensor-ingest.sql` dulu, samakan `DEVICE_API_TOKEN` di Vercel dan Node-RED, baru pindahkan flow.

### 2. Daftar periksa QA pra-syuting (±40 menit, di perangkat demo yang SEBENARNYA + jaringan lokasi)

**Suara (5 menit)**
- [ ] Ketukan pertama di mana pun membuka audio (suara default ON setelah gestur pertama). Tekan tombol apa pun, pastikan bunyi blip.
- [ ] Aktifkan mute → muat ulang → buka `/quests`: preferensi (`localStorage` `pm_sound`) bertahan dan sinkron antar halaman. Nyalakan lagi.

**Hotkey presenter — buka beranda farm dengan `?demo=1` (5 menit)**
- [ ] `1` efek stempel lucky ×2 tampil
- [ ] `2` overlay naik level tampil
- [ ] `3` puncak gerbang bab tampil
- [ ] `4` jatuhnya pod hadiah tampil
- [ ] `5` memutar keenam mood maskot (Happy → Overheating → DryAir → Sleepy → SoilAcidic → SoilAlkaline)
- [ ] `E` memutar upacara evolusi penuh (±7 detik): dialog → siluet berkedip yang makin cepat → satu kilatan layar penuh tunggal (aman WCAG 2.3.1, hanya terjadi sekali) → reveal dengan suara cry + fanfare; otomatis tertutup setelah 6 detik jika pemain tidak menyentuh apa pun. Mengetuk di mana saja saat berlangsung langsung mempercepat ke hasil akhir — tidak pernah kembali. Di perangkat reduced-motion, yang diputar adalah crossfade 900ms, bukan siluet berkedip/kilatan/goyangan.
- [ ] `0` membuka overlay uji-mandiri QA: PMSfx "loaded", preferensi suara, jumlah kunci PM_STRINGS, empat hook PMFx "yes", status reduced-motion, Supabase "configured". Jalankan "RUN ALL FX" sekali. `Esc` menutup.
- [ ] Label "DEMO" terlihat di kiri bawah selama mode aktif; hotkey tidak berfungsi saat kolom isian sedang fokus.
- [ ] Tabel ini hanya mencakup hotkey yang stabil untuk presenter (`1`–`5`, `E`, `0`, `Esc`). Jika ada tambahan hari ini, daftar lengkap terkini ada di komentar header `public/farm/demo.js`, dan menekan `0` membuka overlay uji-mandiri QA di layar untuk memastikan setiap hook FX tersambung.

**Pod hadiah — dua jalur (4 menit)**
- [ ] Jalur ketuk: pod jatuh dan bergoyang → ketuk → bunyi pop + kaskade orb + banner.
- [ ] Jalur diabaikan: munculkan pod lagi dan JANGAN disentuh → meledak sendiri setelah ±8 detik (tidak pernah macet; juga meledak saat halaman disembunyikan).

**Farm Case Quiz (4 menit)**
- [ ] Di beranda farm, ketuk chip **QUIZ HARI INI** untuk membuka modal quiz (`/api/daily-quiz`; butuh milestone13, lihat §1.2).
- [ ] Biarkan timer 15 detik satu soal habis sampai nol: dihitung sebagai jawaban salah (0 XP — skor ramah, milestone17) dan modal tidak macet/hang.
- [ ] Jawab salah sekali: petunjuk kategori muncul dan soal yang sama diulang dengan timer 15 detik baru. Jawaban salah tidak pernah mengurangi XP (skor ramah milestone17) — Level Ikatan tidak pernah turun.
- [ ] Jawab salah kedua kalinya pada soal yang sama: jawaban benar disorot beserta penjelasannya, lalu quiz lanjut — tidak ada percobaan ketiga.
- [ ] Jawab benar: orb +1–3 XP mengalir ke lencana XP, maskot memberi sorakan singkat + baris gelembung ucapan yang sesuai, dan overlay Level Up muncul jika total baru melewati ambang.
- [ ] Selesaikan 3 soal: ringkasan penguasaan per kategori muncul, lalu **"Lanjut latihan tanpa batas →"** memuat farm case tiga-fase baru (AMATI → PAHAMI → BERTINDAK) — quiz tidak terbatas, tidak dibatasi 3/hari.

**Hadiah koleksi — bisa diketuk untuk dimainkan (4 menit)**
Buka **Harta** (`/collection`).
- [ ] Tab Suasana: ketuk kartu mood yang **sudah ditemukan** → baris reaksi karakter + ledakan partikel tampil. Mood yang terkunci tetap tampil sebagai siluet gelap yang jujur, tanpa reaksi.
- [ ] Tab Lencana: ketuk node lencana di roda untuk memilihnya, ketuk **"Coba sekarang"** untuk melihat efek ketuknya, lalu **"Aktifkan"** untuk memasangnya sebagai efek ketuk beranda (tersimpan di `localStorage`) dan **"Matikan"** untuk melepasnya.
- [ ] Tab Cerita: buka kartu bab yang terbuka dan ketuk **"Putar adegan"** — replay dialog pixel singkat dengan partikel/suara sendiri.
- [ ] Tab Pengetahuan: ketuk **"Coba tebak"** pada kartu pengetahuan → muncul pertanyaan prediksi sensor dua pilihan (mode latihan — nol XP, nol tulisan sensor). Pastikan jawaban benar dan salah menampilkan status umpan balik yang berbeda.
- [ ] Jika lencana terbuka secara live saat latihan, kartunya membalik dengan bunyi koin tepat saat baris `plant_badges` disisipkan — jalur realtime yang sama yang akan tampil di hari syuting.

**Ketahanan (4 menit)**
- [ ] Muat ulang tanpa jaringan (atau Supabase belum diisi di preview): halaman tetap tampil, efek mundur diam-diam, label "DEMO" yang jujur tampil pada mode demo statis, tanpa teks error di layar.

**Aksesibilitas & tampilan (5 menit)**
- [ ] Uji reduced-motion: aktifkan "kurangi gerakan" di pengaturan OS, muat ulang — kaskade orb menjadi hitungan tunggal, tidak ada informasi yang hilang.
- [ ] Kontras proyektor: kartu putih di atas latar berwarna, garis tepi, dan teks gelap (`#243421`) harus terbaca dari belakang ruangan. Perbaiki lewat kecerahan proyektor dulu; jangan ubah CSS di hari syuting.

**Bahasa (3 menit)**
- [ ] Ganti ID → EN, muat ulang; lalu EN → ID, muat ulang. Pilihan bertahan (cookie/localStorage) dan gelembung, quest, serta tombol semuanya berganti — tanpa sisa campuran bahasa.

**Mode malam — hanya jika syuting setelah 18:00 WIB (4 menit)**
- [ ] Mood Happy dalam jendela 18:00–06:00 WIB menampilkan Jamkachu tidur: mata tertutup, napas pelan, gelembung tidur, baris cahaya tampil sebagai "Night 🌙" — tidak pernah sebagai masalah.
- [ ] Mood bermasalah SELALU mengalahkan tidur (putar dengan hotkey `5` untuk memastikan wajah masalah tetap tampil). Keterlihatan keselamatan menang.
- [ ] Jendela berganti pada 18:00 / 06:00 tanpa muat ulang (jam 60 detik).

### 3. Syuting: tiga adegan demo (+ penutup opsional Jelajah/Harta)

**Orientasi navigasi.** Aplikasi berjalan pada game loop Tamagotchi, bukan dasbor: lima tab sidebar — **Kebunku** (`/`, beranda pixel farm; Adegan 1–3 ada di sini), **Rawat** (`/quests`, daftar quest langsung + perayaan), **Jelajah** (`/plants`, Jember Crop Explorer), **Kenangan** (`/diary`, Kenangan Perawatan + Catatan Pertumbuhan), dan **Harta** (`/collection`, Buku Koleksi yang bisa dimainkan). Di bawahnya ada **Kantong Alat** yang lebih kecil berisi Sensor (`/monitoring`), Rekap (`/reports`), dan Alat (`/settings` — Demo Control Center ada di `/settings?demo=1`). Setiap pindah tab menampilkan mainan loading pixel Jamkachu yang bisa diketuk — aman disentuh di depan kamera, ia hanya memantul lalu diam.

**Adegan 1 — Wajah masalah + aksi.** Picu masalah nyata (mis. hangatkan sensor) → mood berubah ke Overheating, quest "Cool Me Down" muncul, dan tombol perawatan kontekstual menunjukkan SATU aksi aman ("Move me to shade 🌳"). Ketuk untuk kartu-alasan. Rekam perubahan wajah dan tombolnya.

**Adegan 2 — Perawatan nyata, diverifikasi sensor → XP.** Perbaiki lingkungan secara fisik → chip gema-kausal di gauge → quest menjadi VERIFYING (kilau amber, "Sensor is checking…") → COMPLETED: pod jatuh, ketuk, orb XP mengalir ke bar. Lucky ×2 bisa muncul — nyata, deterministik di server, ±1 dari 8, dan diungkap jujur di aplikasi.

**Adegan 3 — Naik level → dekorasi.** XP melewati ambang → overlay naik level → dekorasi level baru muncul di panggung maskot (stiker pot, bendera, …). Penutup opsional: puncak gerbang bab.

**Adegan 4 — Jelajah & Harta (penutup opsional).** Pindah ke **Jelajah** (`/plants`), pindai potret sensor nyata yang sama, dan buka penjelasan yang berdasar untuk ketidakcocokan terukur terbesar dibanding referensi tanaman Jember. Pindah ke **Harta** (`/collection`) dan ketuk Mood yang baru ditemukan atau Lencana hari itu untuk menunjukkan hadiahnya bisa dimainkan, bukan sekadar kotak centang. Jika ditanya, sebutkan **Evolusi Companion** (Seed → Sprout → Bud → Bloom → Guardian) — jalur visual terpisah dari dekorasi Bond Level di panggung maskot, digerakkan hanya oleh perawatan yang telah diverifikasi sensor.

**Aturan demo jujur (spec §4.5)**
- [ ] Utamakan **jalur sensor-nyata dengan DB ter-seed**: siapkan kondisi pameran yang aman diulang lewat Settings → Demo Control Center (butuh `DEMO_CHEAT_CODE`), lalu biarkan loop sensor nyata menggerakkan ketiga adegan.
- [ ] **Beri tahu produser tentang hotkey `?demo=1`**: hanya pemutaran ulang visual — tanpa tulis data, tanpa XP, tanpa jaringan. Jangan pernah menampilkan replay hotkey seolah-olah kejadian sensor langsung.
- [ ] Farm Case Quiz adalah jalur skor terpisah yang sengaja dibuat kecil (+1–3 XP benar, 0 untuk salah) — jangan pernah menampilkan jawaban quiz di kamera seolah-olah XP perawatan terverifikasi sensor.
- [ ] Di antara pengambilan gambar, gunakan "Kembali ke awal" (data sensor, catatan pertumbuhan, ambang tanaman, dan kontrol hardware tidak tersentuh).

---

## 한국어

### 1. 최초 1회 설정 (프로젝트 오너)

#### 1.1 Vercel 환경 변수

Vercel → Project → **Settings → Environment Variables**. **Production**에 설정 (프리뷰 URL로 리허설한다면 Preview에도 추가). 이름은 `.env.local.example`과 정확히 일치해야 합니다:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — `https://YOUR_PROJECT_REF.supabase.co` (Supabase Dashboard → Project Settings → API)
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — `sb_publishable_...` (브라우저에 안전, RLS로 읽기 전용; 구형 `anon` 키도 사용 가능)
- [ ] `SUPABASE_SECRET_KEY` — `sb_secret_...` (**서버 전용, 브라우저 코드에 절대 노출 금지**; 구형 `service_role` 키도 사용 가능)
- [ ] `DEVICE_API_TOKEN` — 디바이스 엔드포인트용 공유 토큰. 설정하면 Node-RED가 `Authorization: Bearer <값>`을 보내야 합니다. 고라이브 시 반드시 설정 유지: 비워 두면 엔드포인트가 인증 없는 요청을 받습니다 (로컬 프로토타입 모드 전용).
- [ ] `DEMO_CHEAT_CODE` — **8자 이상**. Settings → Demo Control Center를 활성화 ("Unlock everything" = 재실행 안전한 Lv.10 쇼케이스; "Reset to start" = Lv.1 / 0 XP로 복원). 서버에서만 검사하며 브라우저에 노출되지 않습니다.
- [ ] `GEMINI_API_KEY` *(선택)* — 서버 전용 Gemini 설명 레이어입니다. 미설정이거나 실패하면 결정론적 템플릿으로 대체됩니다.
- [ ] *(선택)* `BMKG_ADM4_CODE` — 마을 단위 예보 코드; 기본값은 Tegalgede, Sumbersari, Jember (`35.09.21.1005`)이므로 보통 그대로 둡니다.
- [ ] 저장 후 **Redeploy**. 환경 변수 변경은 새 배포에만 적용됩니다.

#### 1.2 Supabase 마이그레이션 (SQL Editor에서 이 순서대로)

**`milestone2.sql`은 존재하지 않습니다** — 해당 내용은 `milestone1.sql`에 포함되어 있습니다. `supabase/`의 정확한 파일명:

| # | 파일 | 내용 |
|---|---|---|
| 1 | `milestone1.sql` | plants, device_events, RLS, realtime |
| 2 | `milestone3.sql` | bond_state, quests, badges, XP 원장, `award_xp` RPC |
| 3 | `milestone4-soil-quests.sql` | 토양 퀘스트 키 |
| 4 | `milestone5-growth-records.sql` | 성장 일기 기록 |
| 5 | `milestone6-crop-profiles.sql` | plants의 작물 프로필(딸기) 키 |
| 6 | `milestone6-monitoring.sql` | soil_moisture / light_lux 컬럼 |
| 7 | `milestone7-more-quests.sql` | Humidify My Air + Stay Comfy 퀘스트 키 |
| 8 | `milestone8-dopamine.sql` | 스토리/배지/데모 진행 + `bond_events` realtime |
| 9 | `milestone9-raw-sensor-ingest.sql` | `sensor_readings` 테이블 — **Node-RED를 `/api/sensor-readings`로 전환하기 전에 필수** |
| 10 | `milestone10-jember-crop-catalog.sql` | 버전 관리된 근거/출처가 있는 Jember 작물 10종 |
| 11 | `milestone11-tamagotchi.sql` | 컴패니언(다마고치) 상태·진화 단계 컬럼, realtime |
| 12 | `milestone12-selectable-crops.sql` | 콩(soybean)+카옌 고추 프로필을 자동 퀘스트용으로 활성화 |
| 13 | `milestone13-daily-quiz.sql` | `daily_quiz_attempts` 테이블 + `answer_daily_quiz` RPC — **Farm Case Quiz가 XP를 지급하려면 필수** |
| 14 | `milestone14-fast-levels.sql` | 평평한 30 XP Bond Level 진행 |
| 15 | `milestone15-light-percentage.sql` | `sensor_readings.light`를 보정된 0–100% 값으로 저장 (lux/PPFD/DLI 아님) |
| 16 | *(예약됨 — 아직 파일 없음)* | 컴패니언 진화 단계 (Seed → Sprout → Bud → Bloom → Guardian) — 진행 중, 출시될 때까지 건너뛰기 |
| 17 | `milestone17-quiz-kind-scoring.sql` | 퀴즈가 더 이상 XP를 깎지 않음 — kind scoring: Daily Quiz 오답/시간초과가 이제 −1이 아니라 0 XP를 지급하여 오답으로 Bond Level이 절대 내려가지 않음 |
| 18 | `milestone18-seed-shop.sql` | Seed Shop 경제 — `bond_state.seeds` + `seed_rewards` 원장 + `shop_purchases` + `award_seeds`/`purchase_item`/`equip_item` RPC, `shop_purchases` realtime. Seeds는 줄어들 수 있음(소비 가능한 화폐); XP/Bond Level은 여전히 절대 감소하지 않음 |
| 19 | `milestone19-camera-guardian.sql` | Camera AI Live Guardian의 텍스트 이벤트 fan-out. 이미지·영상 Storage는 만들지 않음 |

- [ ] 팀이 이미 운영 중인 Supabase 프로젝트라면 **milestone1–milestone8은 보통 이미 적용되어 있습니다** (돌아가는 게임이 이에 의존). **milestone9–milestone18이 더 최신** — 고라이브 전에 아홉 개 모두 확인하세요 (milestone9, 10, 11, 12, 13, 14, 15, 17, 18 — milestone16은 아직 파일이 없습니다, 아래 참고).
- [ ] 재실행은 안전합니다: 모든 파일이 가드 처리되어 있습니다 (`create ... if not exists`, `add column if not exists`, 정책 drop 후 재생성). 확실하지 않으면 열여섯 개를 순서대로 다시 실행하세요 (milestone16은 건너뛰기 — 예약됨, 아직 파일 없음).
- [ ] Milestone 10은 Jember 프로필을 `draft` / `reference_only`로 시드하며 딸기는 처음부터 승인되어 있습니다; **milestone12가 콩(soybean)+카옌 고추를 자동 무드/퀘스트 판단 승인 목록에 추가**합니다 (담배와 센서가 부족한 작물은 계속 사용 불가). 다른 작물을 활성화하기 전에 `docs/CROP-PROFILE-CATALOG-jember.md`를 읽으세요.
- [ ] Milestone 13은 Farm Case Quiz 칩이 XP를 지급하는 데 필수입니다 — 없으면 퀴즈는 표시되고 답할 수 있지만, 앱은 XP 대신 `quiz_migration_required`를 반환합니다.
- [ ] Milestone 16은 아직 파일이 없습니다 — 진행 중인 컴패니언 진화 단계 계획을 위해 예약되어 있습니다. 출시될 때까지 마이그레이션 순서에서 건너뛰세요.
- [ ] Milestone 17은 Milestone 13의 `answer_daily_quiz` RPC를 같은 자리에서 대체합니다 (`create or replace`, 시그니처/반환 형태 동일): 오답이거나 시간초과된 Daily Quiz 답변은 이제 −1이 아니라 정확히 0 XP를 지급하므로 "LEVEL UP!" 직후에 Bond Level이 절대 내려가지 않습니다. 정답 XP는 변경되지 않았습니다.
- [ ] Milestone 18은 Seed Shop에 필요합니다. 없으면 /shop 라우트는 친절한 "곧 만나요" 상태를 보여주고, 농장 HUD의 Seeds 칩은 숨겨지며, 모든 Seed 지급은 조용한 no-op이 됩니다 — 아무것도 깨지지 않습니다.
- [ ] Milestone 19는 Camera AI 반응을 다른 Farm 화면에 전달할 때 필요합니다. 없어도 카메라 기기의 로컬 움직임 감지와 Jamkachu 반응은 계속 작동합니다.

#### 1.3 하드웨어 담당자 안내

- [ ] 원시 센서 엔드포인트: **`POST /api/sensor-readings`** — 페이로드 형태, 멱등 `readingId`, Bearer 인증은 **`docs/API-raw-sensor-ingest.md`**에 문서화되어 있습니다. 기존 `POST /api/device-events`도 동일한 평면 페이로드를 계속 받습니다.
- [ ] Node-RED 연동: **`docs/INTEGRATION-PLAN-node-red.md`**, 3개 언어 **`node-red/README.md`**, 플로우 파일 `node-red/phase18-bridge-flow.json`.
- [ ] 순서가 중요합니다: `milestone9-raw-sensor-ingest.sql`을 먼저 적용하고, Vercel과 Node-RED에 같은 `DEVICE_API_TOKEN`을 설정한 뒤, 플로우를 전환하세요.

### 2. 촬영 전 QA 체크리스트 (~40분, 실제 데모 기기 + 현장 네트워크에서)

**사운드 (5분)**
- [ ] 아무 곳이나 처음 탭하면 오디오가 잠금 해제됩니다 (첫 제스처 후 사운드 기본 ON). 아무 버튼이나 눌러 blip 소리를 확인.
- [ ] 음소거 토글 → 새로고침 → `/quests` 열기: 설정 (`localStorage` `pm_sound`)이 유지되고 페이지 간 동기화됨. 다시 ON으로 복귀.

**발표자 핫키 — 팜 홈을 `?demo=1`로 열기 (5분)**
- [ ] `1` 럭키 ×2 스탬프 FX 재생
- [ ] `2` 레벨업 오버레이 재생
- [ ] `3` 챕터 게이트 피크 재생
- [ ] `4` 보상 포드 드롭 재생
- [ ] `5` 마스코트 무드 6종 순환 (Happy → Overheating → DryAir → Sleepy → SoilAcidic → SoilAlkaline)
- [ ] `E` 전체 진화 의식 재생 (약 7초): 대사 비트 → 점점 빨라지는 실루엣 스트로브 → 단 한 번의 전체 화면 플래시(WCAG 2.3.1 안전, 정확히 한 번만 발생) → cry + 팡파르와 함께 공개; 플레이어가 탭하지 않으면 6초 후 자동으로 닫힘. 진행 중 아무 곳이나 탭하면 결과 장면으로 바로 빨리감기됨 — 절대 되돌아가지 않음. reduced-motion 기기에서는 스트로브/플래시/흔들림 대신 900ms 크로스페이드가 재생됩니다.
- [ ] `0` QA 셀프 테스트 오버레이: PMSfx "loaded", 사운드 설정, PM_STRINGS 키 수, PMFx 훅 4종 모두 "yes", reduced-motion 상태, Supabase "configured". "RUN ALL FX"를 한 번 실행. `Esc`로 닫기.
- [ ] 모드 활성 중 좌측 하단에 "DEMO" 태그 표시; 입력 필드에 포커스가 있으면 핫키가 동작하지 않음.
- [ ] 이 표는 발표자용으로 안정적인 핫키(`1`–`5`, `E`, `0`, `Esc`)만 다룹니다. 오늘 추가된 것이 있다면 `public/farm/demo.js` 헤더 주석에 최신 전체 목록이 있으며, `0`을 누르면 화면에 QA 셀프 테스트 오버레이가 열려 각 FX 훅이 연결되었는지 확인할 수 있습니다.

**보상 포드 — 두 경로 모두 (4분)**
- [ ] 탭 경로: 포드가 떨어져 흔들림 → 탭 → 팝 사운드 + 오브 캐스케이드 + 배너.
- [ ] 무시 경로: 포드를 다시 띄우고 건드리지 않음 → 약 8초 후 자동 터짐 (절대 멈추지 않음; 페이지 숨김 시에도 터짐).

**Farm Case Quiz (4분)**
- [ ] 팜 홈에서 **QUIZ HARI INI** 칩을 탭해 퀴즈 모달을 엽니다 (`/api/daily-quiz`; milestone13 필요, §1.2 참고).
- [ ] 한 문제의 15초 타이머를 0까지 흘려보내세요: 오답(0 XP — milestone17 친절 채점)으로 처리되며 모달이 멈추지 않아야 합니다.
- [ ] 한 번 오답: 카테고리 힌트가 뜨고 같은 문제가 새 15초 타이머로 다시 시작됩니다. 오답은 XP를 절대 차감하지 않습니다(milestone17 친절 채점) — Bond Level은 절대 내려가지 않습니다.
- [ ] 같은 문제에서 두 번째로 오답: 정답이 설명과 함께 강조되고 퀴즈가 다음으로 넘어갑니다 — 세 번째 시도는 없습니다.
- [ ] 정답: +1–3 XP 오브가 XP 배지로 애니메이션되고, 마스코트가 짧은 환호 + 어울리는 말풍선 대사를 재생하며, 새 총합이 임계값을 넘으면 Level Up 오버레이가 뜹니다.
- [ ] 3문제를 마치면 카테고리별 숙련도 요약이 뜨고, **"Keep practicing →"**를 누르면 새로운 3단계 농장 사례(OBSERVE → UNDERSTAND → ACT)가 로드됩니다 — 퀴즈는 하루 3개로 제한되지 않고 무한합니다.

**컬렉션 보상 — 탭해서 플레이 (4분)**
**Treasures**(`/collection`)를 엽니다.
- [ ] Moods 탭: **발견한** 무드 카드를 탭 → 캐릭터 반응 대사 + 파티클 효과 재생. 잠긴 무드는 정직한 어두운 실루엣으로 남고 반응이 없습니다.
- [ ] Badges 탭: 휠에서 배지 노드를 탭해 선택하고, **"Try it now"**로 탭 이펙트를 미리 보고, **"Activate"**로 홈 탭 이펙트로 장착(`localStorage`에 저장)하거나 **"Turn off"**로 해제합니다.
- [ ] Story 탭: 잠금 해제된 챕터 카드를 열고 **"Play scene"**을 탭 — 자체 파티클/사운드가 있는 짧은 픽셀 대사 리플레이.
- [ ] Wisdom 탭: 지혜 카드에서 **"Try a prediction"**을 탭 → 2지선다 센서 예측 문제가 열립니다 (연습 모드 — XP 0, 센서 기록 0). 정답과 오답이 각각 다른 피드백 상태를 보이는지 확인하세요.
- [ ] 리허설 중 배지가 실시간으로 해제되면 `plant_badges` 행이 삽입되는 순간 카드가 코인 소리와 함께 뒤집힙니다 — 촬영 당일 보여줄 것과 동일한 realtime 경로입니다.

**복원력 (4분)**
- [ ] 네트워크 끊고 새로고침 (또는 프리뷰에서 Supabase 미설정): 페이지가 여전히 렌더링되고, FX는 조용히 축소되며, 정적 데모 모드에서 정직한 "DEMO" 태그가 표시되고, 화면에 오류 텍스트가 없음.

**Camera AI Live Guardian (4분)**
- [ ] `/camera`에서 카메라 권한 허용 → `Watching` 상태와 실제 식물 영상 표시.
- [ ] 잎을 가볍게 건드림 → 카메라 기기의 Jamkachu가 즉시 반응하고, milestone19 적용 시 Farm 홈에도 반응이 전달됨. XP·퀘스트·Seeds 변화 없음.
- [ ] `GEMINI_API_KEY` 없이도 화면에 motion-only 모드가 표시되고 움직임 반응은 그대로 작동함.
- [ ] 영상은 저장되지 않으며 AI 확인 시 축소 스냅샷 한 장만 메모리에서 전송됨. 사람/얼굴이 프레임에 들어오지 않도록 식물만 비춤.

**접근성 & 화면 (5분)**
- [ ] Reduced-motion 점검: OS 설정에서 "동작 줄이기"를 켜고 새로고침 — 오브 캐스케이드가 단일 카운트업으로 축소되고 정보 손실이 없음.
- [ ] 프로젝터 대비: 틴트 배경 위 흰 카드, 테두리, 어두운 텍스트 (`#243421`)가 방 뒤에서도 읽혀야 함. 먼저 프로젝터 밝기로 해결; 촬영 당일 CSS 수정 금지.

**언어 (3분)**
- [ ] ID → EN 전환 후 새로고침; EN → ID 전환 후 새로고침. 선택이 유지되고 (cookie/localStorage) 말풍선·퀘스트·버튼이 모두 전환됨 — 언어 섞임 잔여물 없음.

**야간 모드 — 18:00 WIB 이후 촬영 시에만 (4분)**
- [ ] 18:00–06:00 WIB 사이 Happy 무드는 잠자는 Jamkachu를 표시: 감은 눈, 느린 숨, 잠 말풍선, 조도 행은 "Night 🌙"로 표시 — 절대 문제로 표시되지 않음.
- [ ] 문제 무드는 항상 수면보다 우선 (핫키 `5`로 순환하며 문제 얼굴이 계속 표시되는지 확인). 안전 가시성이 이깁니다.
- [ ] 18:00 / 06:00 경계는 새로고침 없이 전환됨 (60초 시계).

### 3. 촬영: 세 가지 데모 장면 (+ Explore·Treasures 선택적 마무리)

**내비게이션 안내.** 앱은 대시보드가 아니라 다마고치 게임 루프로 동작합니다: 사이드바 다섯 개 탭 — **My Garden**(`/`, 픽셀 팜 홈; 장면 1–3이 여기서 진행), **Care**(`/quests`, 실시간 퀘스트 목록 + 축하 연출), **Explore**(`/plants`, Jember Crop Explorer), **Memories**(`/diary`, 케어 메모리 + 성장 기록), **Treasures**(`/collection`, 플레이 가능한 컬렉션 북). 그 아래 작은 **Tool Pocket**에는 Sensors(`/monitoring`), Recap(`/reports`), Tools(`/settings` — Demo Control Center는 `/settings?demo=1`)가 있습니다. 탭을 전환할 때마다 탭 가능한 픽셀 Jamkachu 로딩 토이가 나타납니다 — 카메라 앞에서 눌러도 안전하며, 그냥 통통 튀었다가 멈춥니다.

**장면 1 — 문제 얼굴 + 행동.** 실제 문제를 유발 (예: 센서를 데우기) → 무드가 Overheating으로 전환, 퀘스트 "Cool Me Down" 등장, 상황별 케어 버튼이 안전한 행동 하나를 표시 ("Move me to shade 🌳"). 탭하면 이유 카드. 얼굴 변화와 버튼을 촬영.

**장면 2 — 실제 케어, 센서 검증 → XP.** 환경을 물리적으로 개선 → 게이지에 인과 에코 칩 → 퀘스트가 VERIFYING (앰버 반짝임, "Sensor is checking…") → COMPLETED: 포드 드롭, 탭, XP 오브가 바로 캐스케이드. 럭키 ×2가 나올 수 있음 — 실제이며 서버 결정론적, 약 8분의 1 확률, 앱 내에서 정직하게 공개됨.

**장면 3 — 레벨업 → 장식.** XP가 임계값을 넘음 → 레벨업 오버레이 → 마스코트 무대에 새 레벨 장식 등장 (화분 스티커, 깃발, …). 선택적 피날레: 챕터 게이트 피크.

**장면 4 — Explore & Treasures (선택적 마무리).** **Explore**(`/plants`)로 이동해 같은 실제 스냅샷을 스캔하고, 측정값 차이가 가장 큰 항목에 대해 Jember 작물 기준과 비교한 근거 있는 설명을 엽니다. **Treasures**(`/collection`)로 이동해 방금 발견한 Mood나 오늘의 Badge를 탭해 보상이 단순 체크리스트가 아니라 플레이 가능하다는 것을 보여주세요. 질문을 받으면 **Companion Evolution**(Seed → Sprout → Bud → Bloom → Guardian)을 언급할 수 있습니다 — 마스코트 무대의 Bond Level 장식과는 별개의 시각적 트랙이며, 오직 완료된 센서 검증 케어로만 진행됩니다.

**정직한 데모 원칙 (스펙 §4.5)**
- [ ] **시드된 DB + 실제 센서 경로를 우선**: Settings → Demo Control Center (`DEMO_CHEAT_CODE` 필요)로 재실행 안전한 쇼케이스 상태를 시드한 뒤, 실제 센서 루프가 세 장면을 이끌게 하세요.
- [ ] **`?demo=1` 핫키를 프로듀서에게 공개**: 프레젠테이션용 시각 재생일 뿐 — 데이터 쓰기 0, XP 0, 네트워크 0. 핫키 재생을 실제 센서 이벤트처럼 보여 주지 마세요.
- [ ] Farm Case Quiz는 의도적으로 작게 설계된 별도의 점수 트랙입니다 (정답 +1–3 XP, 오답 0) — 카메라 앞에서 퀴즈 정답을 센서 검증된 케어 XP인 것처럼 보여주지 마세요.
- [ ] 테이크 사이에는 "Reset to start" 사용 (센서 데이터, 성장 기록, 작물 임계값, 하드웨어 제어는 건드리지 않음).
