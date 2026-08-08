# PlantMoji — Filming & Go-Live Runbook

Same content three times: **English → Bahasa Indonesia → 한국어**. Print it, check the boxes.
Sources of truth: `.env.local.example`, `supabase/*.sql`, `docs/API-raw-sensor-ingest.md`, `public/farm/demo.js`, spec `docs/superpowers/specs/2026-08-07-dopamine-ux-reframe-design.md` (§4.5, §6).

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

- [ ] On the team's existing Supabase project, **milestone1–milestone8 are typically already applied** (the running game depends on them). **milestone9 and milestone10 are the newest** — verify these two before go-live.
- [ ] Re-running is safe: every file is guarded (`create ... if not exists`, `add column if not exists`, drop-and-recreate policies). When in doubt, run all ten again in order.
- [ ] Milestone 10 seeds Jember profiles as `draft` / `reference_only`; **strawberry stays the only profile approved for automatic mood/quest decisions**. Read `docs/CROP-PROFILE-CATALOG-jember.md` before activating another crop.

#### 1.3 Hardware teammate — where to point them

- [ ] Raw-sensor endpoint: **`POST /api/sensor-readings`** — payload shape, idempotent `readingId`, and Bearer auth are documented in **`docs/API-raw-sensor-ingest.md`**. Legacy `POST /api/device-events` still accepts the same flat payload.
- [ ] Node-RED integration: **`docs/INTEGRATION-PLAN-node-red.md`**, the trilingual **`node-red/README.md`**, and the flow file `node-red/phase18-bridge-flow.json`.
- [ ] Order matters: apply `milestone9-raw-sensor-ingest.sql` first, set the same `DEVICE_API_TOKEN` in Vercel and in Node-RED, then switch the flow.

### 2. Pre-filming QA checklist (~30 min, on the ACTUAL demo device + venue network)

**Sound (5 min)**
- [ ] First tap anywhere unlocks audio (sound is default ON after the first gesture). Press any button and confirm a blip.
- [ ] Toggle mute → reload → open `/quests`: the preference (`localStorage` `pm_sound`) persists and stays in sync across pages. Toggle back ON.

**Presenter hotkeys — open the farm home with `?demo=1` (5 min)**
- [ ] `1` lucky ×2 stamp FX plays
- [ ] `2` level-up overlay plays
- [ ] `3` chapter-gate peak plays
- [ ] `4` reward-pod drop plays
- [ ] `5` cycles all six mascot moods (Happy → Overheating → DryAir → Sleepy → SoilAcidic → SoilAlkaline)
- [ ] `0` opens the QA self-test overlay: PMSfx "loaded", sound pref, PM_STRINGS key count, all four PMFx hooks "yes", reduced-motion state, Supabase "configured". Run "RUN ALL FX" once. `Esc` closes.
- [ ] The "DEMO" tag is visible bottom-left while the mode is active; hotkeys do nothing while a form field has focus.

**Reward pod — both paths (4 min)**
- [ ] Tap path: pod drops and wiggles → tap it → pop sound + orb cascade + banner.
- [ ] Ignore path: trigger another pod and do NOT touch it → it auto-bursts after ~8 s (nothing ever stalls; it also bursts on page-hide).

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

### 3. Filming: the three demo beats

**Beat 1 — Problem face + action.** Trigger a real problem (e.g. warm the sensor) → mood flips to Overheating, quest "Cool Me Down" appears, and the contextual care button shows the ONE safe action ("Move me to shade 🌳"). Tap it for the why-card. Film the face change and the button.

**Beat 2 — Real care, sensor-verified → XP.** Physically improve the environment → causal-echo chip on the gauge → quest turns VERIFYING (amber shimmer, "Sensor is checking…") → COMPLETED: pod drops, tap it, XP orbs cascade into the bar. Lucky ×2 may fire — it is real, server-deterministic, ~1-in-8, and honestly disclosed in-app.

**Beat 3 — Level-up → decoration.** XP crosses the threshold → level-up overlay → a new level decoration appears on the mascot stage (pot sticker, flag, …). Optional finale: chapter-gate peak.

**Honest-demo rule (spec §4.5)**
- [ ] Prefer the **seeded-DB real-sensor path**: seed a replay-safe showcase via Settings → Demo Control Center (needs `DEMO_CHEAT_CODE`), then let the real sensor loop drive the three beats.
- [ ] **Disclose the `?demo=1` hotkeys to the producers**: they are presentation replays only — zero data writes, zero XP, zero network. Never present a hotkey replay as a live sensor event.
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

- [ ] Pada proyek Supabase tim yang sudah berjalan, **milestone1–milestone8 biasanya sudah diterapkan** (game yang berjalan bergantung padanya). **milestone9 dan milestone10 yang paling baru** — pastikan keduanya sebelum go-live.
- [ ] Menjalankan ulang aman: setiap file dijaga (`create ... if not exists`, `add column if not exists`, policy drop-lalu-buat-ulang). Jika ragu, jalankan lagi kesepuluhnya sesuai urutan.
- [ ] Milestone 10 mengisi profil Jember sebagai `draft` / `reference_only`; **stroberi tetap satu-satunya profil yang disetujui untuk keputusan mood/quest otomatis**. Baca `docs/CROP-PROFILE-CATALOG-jember.md` sebelum mengaktifkan tanaman lain.

#### 1.3 Rekan hardware — arahkan ke sini

- [ ] Endpoint sensor mentah: **`POST /api/sensor-readings`** — bentuk payload, `readingId` idempoten, dan autentikasi Bearer didokumentasikan di **`docs/API-raw-sensor-ingest.md`**. `POST /api/device-events` (lama) masih menerima payload datar yang sama.
- [ ] Integrasi Node-RED: **`docs/INTEGRATION-PLAN-node-red.md`**, **`node-red/README.md`** (tiga bahasa), dan file flow `node-red/phase18-bridge-flow.json`.
- [ ] Urutan penting: terapkan `milestone9-raw-sensor-ingest.sql` dulu, samakan `DEVICE_API_TOKEN` di Vercel dan Node-RED, baru pindahkan flow.

### 2. Daftar periksa QA pra-syuting (±30 menit, di perangkat demo yang SEBENARNYA + jaringan lokasi)

**Suara (5 menit)**
- [ ] Ketukan pertama di mana pun membuka audio (suara default ON setelah gestur pertama). Tekan tombol apa pun, pastikan bunyi blip.
- [ ] Aktifkan mute → muat ulang → buka `/quests`: preferensi (`localStorage` `pm_sound`) bertahan dan sinkron antar halaman. Nyalakan lagi.

**Hotkey presenter — buka beranda farm dengan `?demo=1` (5 menit)**
- [ ] `1` efek stempel lucky ×2 tampil
- [ ] `2` overlay naik level tampil
- [ ] `3` puncak gerbang bab tampil
- [ ] `4` jatuhnya pod hadiah tampil
- [ ] `5` memutar keenam mood maskot (Happy → Overheating → DryAir → Sleepy → SoilAcidic → SoilAlkaline)
- [ ] `0` membuka overlay uji-mandiri QA: PMSfx "loaded", preferensi suara, jumlah kunci PM_STRINGS, empat hook PMFx "yes", status reduced-motion, Supabase "configured". Jalankan "RUN ALL FX" sekali. `Esc` menutup.
- [ ] Label "DEMO" terlihat di kiri bawah selama mode aktif; hotkey tidak berfungsi saat kolom isian sedang fokus.

**Pod hadiah — dua jalur (4 menit)**
- [ ] Jalur ketuk: pod jatuh dan bergoyang → ketuk → bunyi pop + kaskade orb + banner.
- [ ] Jalur diabaikan: munculkan pod lagi dan JANGAN disentuh → meledak sendiri setelah ±8 detik (tidak pernah macet; juga meledak saat halaman disembunyikan).

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

### 3. Syuting: tiga adegan demo

**Adegan 1 — Wajah masalah + aksi.** Picu masalah nyata (mis. hangatkan sensor) → mood berubah ke Overheating, quest "Cool Me Down" muncul, dan tombol perawatan kontekstual menunjukkan SATU aksi aman ("Move me to shade 🌳"). Ketuk untuk kartu-alasan. Rekam perubahan wajah dan tombolnya.

**Adegan 2 — Perawatan nyata, diverifikasi sensor → XP.** Perbaiki lingkungan secara fisik → chip gema-kausal di gauge → quest menjadi VERIFYING (kilau amber, "Sensor is checking…") → COMPLETED: pod jatuh, ketuk, orb XP mengalir ke bar. Lucky ×2 bisa muncul — nyata, deterministik di server, ±1 dari 8, dan diungkap jujur di aplikasi.

**Adegan 3 — Naik level → dekorasi.** XP melewati ambang → overlay naik level → dekorasi level baru muncul di panggung maskot (stiker pot, bendera, …). Penutup opsional: puncak gerbang bab.

**Aturan demo jujur (spec §4.5)**
- [ ] Utamakan **jalur sensor-nyata dengan DB ter-seed**: siapkan kondisi pameran yang aman diulang lewat Settings → Demo Control Center (butuh `DEMO_CHEAT_CODE`), lalu biarkan loop sensor nyata menggerakkan ketiga adegan.
- [ ] **Beri tahu produser tentang hotkey `?demo=1`**: hanya pemutaran ulang visual — tanpa tulis data, tanpa XP, tanpa jaringan. Jangan pernah menampilkan replay hotkey seolah-olah kejadian sensor langsung.
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

- [ ] 팀이 이미 운영 중인 Supabase 프로젝트라면 **milestone1–milestone8은 보통 이미 적용되어 있습니다** (돌아가는 게임이 이에 의존). **milestone9와 milestone10이 가장 최신** — 고라이브 전에 이 둘을 확인하세요.
- [ ] 재실행은 안전합니다: 모든 파일이 가드 처리되어 있습니다 (`create ... if not exists`, `add column if not exists`, 정책 drop 후 재생성). 확실하지 않으면 열 개를 순서대로 다시 실행하세요.
- [ ] Milestone 10은 Jember 프로필을 `draft` / `reference_only`로 시드합니다; **자동 무드/퀘스트 판단에 승인된 프로필은 딸기뿐**입니다. 다른 작물을 활성화하기 전에 `docs/CROP-PROFILE-CATALOG-jember.md`를 읽으세요.

#### 1.3 하드웨어 담당자 안내

- [ ] 원시 센서 엔드포인트: **`POST /api/sensor-readings`** — 페이로드 형태, 멱등 `readingId`, Bearer 인증은 **`docs/API-raw-sensor-ingest.md`**에 문서화되어 있습니다. 기존 `POST /api/device-events`도 동일한 평면 페이로드를 계속 받습니다.
- [ ] Node-RED 연동: **`docs/INTEGRATION-PLAN-node-red.md`**, 3개 언어 **`node-red/README.md`**, 플로우 파일 `node-red/phase18-bridge-flow.json`.
- [ ] 순서가 중요합니다: `milestone9-raw-sensor-ingest.sql`을 먼저 적용하고, Vercel과 Node-RED에 같은 `DEVICE_API_TOKEN`을 설정한 뒤, 플로우를 전환하세요.

### 2. 촬영 전 QA 체크리스트 (~30분, 실제 데모 기기 + 현장 네트워크에서)

**사운드 (5분)**
- [ ] 아무 곳이나 처음 탭하면 오디오가 잠금 해제됩니다 (첫 제스처 후 사운드 기본 ON). 아무 버튼이나 눌러 blip 소리를 확인.
- [ ] 음소거 토글 → 새로고침 → `/quests` 열기: 설정 (`localStorage` `pm_sound`)이 유지되고 페이지 간 동기화됨. 다시 ON으로 복귀.

**발표자 핫키 — 팜 홈을 `?demo=1`로 열기 (5분)**
- [ ] `1` 럭키 ×2 스탬프 FX 재생
- [ ] `2` 레벨업 오버레이 재생
- [ ] `3` 챕터 게이트 피크 재생
- [ ] `4` 보상 포드 드롭 재생
- [ ] `5` 마스코트 무드 6종 순환 (Happy → Overheating → DryAir → Sleepy → SoilAcidic → SoilAlkaline)
- [ ] `0` QA 셀프 테스트 오버레이: PMSfx "loaded", 사운드 설정, PM_STRINGS 키 수, PMFx 훅 4종 모두 "yes", reduced-motion 상태, Supabase "configured". "RUN ALL FX"를 한 번 실행. `Esc`로 닫기.
- [ ] 모드 활성 중 좌측 하단에 "DEMO" 태그 표시; 입력 필드에 포커스가 있으면 핫키가 동작하지 않음.

**보상 포드 — 두 경로 모두 (4분)**
- [ ] 탭 경로: 포드가 떨어져 흔들림 → 탭 → 팝 사운드 + 오브 캐스케이드 + 배너.
- [ ] 무시 경로: 포드를 다시 띄우고 건드리지 않음 → 약 8초 후 자동 터짐 (절대 멈추지 않음; 페이지 숨김 시에도 터짐).

**복원력 (4분)**
- [ ] 네트워크 끊고 새로고침 (또는 프리뷰에서 Supabase 미설정): 페이지가 여전히 렌더링되고, FX는 조용히 축소되며, 정적 데모 모드에서 정직한 "DEMO" 태그가 표시되고, 화면에 오류 텍스트가 없음.

**접근성 & 화면 (5분)**
- [ ] Reduced-motion 점검: OS 설정에서 "동작 줄이기"를 켜고 새로고침 — 오브 캐스케이드가 단일 카운트업으로 축소되고 정보 손실이 없음.
- [ ] 프로젝터 대비: 틴트 배경 위 흰 카드, 테두리, 어두운 텍스트 (`#243421`)가 방 뒤에서도 읽혀야 함. 먼저 프로젝터 밝기로 해결; 촬영 당일 CSS 수정 금지.

**언어 (3분)**
- [ ] ID → EN 전환 후 새로고침; EN → ID 전환 후 새로고침. 선택이 유지되고 (cookie/localStorage) 말풍선·퀘스트·버튼이 모두 전환됨 — 언어 섞임 잔여물 없음.

**야간 모드 — 18:00 WIB 이후 촬영 시에만 (4분)**
- [ ] 18:00–06:00 WIB 사이 Happy 무드는 잠자는 Jamkachu를 표시: 감은 눈, 느린 숨, 잠 말풍선, 조도 행은 "Night 🌙"로 표시 — 절대 문제로 표시되지 않음.
- [ ] 문제 무드는 항상 수면보다 우선 (핫키 `5`로 순환하며 문제 얼굴이 계속 표시되는지 확인). 안전 가시성이 이깁니다.
- [ ] 18:00 / 06:00 경계는 새로고침 없이 전환됨 (60초 시계).

### 3. 촬영: 세 가지 데모 장면

**장면 1 — 문제 얼굴 + 행동.** 실제 문제를 유발 (예: 센서를 데우기) → 무드가 Overheating으로 전환, 퀘스트 "Cool Me Down" 등장, 상황별 케어 버튼이 안전한 행동 하나를 표시 ("Move me to shade 🌳"). 탭하면 이유 카드. 얼굴 변화와 버튼을 촬영.

**장면 2 — 실제 케어, 센서 검증 → XP.** 환경을 물리적으로 개선 → 게이지에 인과 에코 칩 → 퀘스트가 VERIFYING (앰버 반짝임, "Sensor is checking…") → COMPLETED: 포드 드롭, 탭, XP 오브가 바로 캐스케이드. 럭키 ×2가 나올 수 있음 — 실제이며 서버 결정론적, 약 8분의 1 확률, 앱 내에서 정직하게 공개됨.

**장면 3 — 레벨업 → 장식.** XP가 임계값을 넘음 → 레벨업 오버레이 → 마스코트 무대에 새 레벨 장식 등장 (화분 스티커, 깃발, …). 선택적 피날레: 챕터 게이트 피크.

**정직한 데모 원칙 (스펙 §4.5)**
- [ ] **시드된 DB + 실제 센서 경로를 우선**: Settings → Demo Control Center (`DEMO_CHEAT_CODE` 필요)로 재실행 안전한 쇼케이스 상태를 시드한 뒤, 실제 센서 루프가 세 장면을 이끌게 하세요.
- [ ] **`?demo=1` 핫키를 프로듀서에게 공개**: 프레젠테이션용 시각 재생일 뿐 — 데이터 쓰기 0, XP 0, 네트워크 0. 핫키 재생을 실제 센서 이벤트처럼 보여 주지 마세요.
- [ ] 테이크 사이에는 "Reset to start" 사용 (센서 데이터, 성장 기록, 작물 임계값, 하드웨어 제어는 건드리지 않음).
