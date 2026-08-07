# PlantMoji · Node-RED ↔ Backend Integration Plan

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

Audience: the hardware teammate who built the Arduino + Node-RED dashboard
Prerequisite: physical planter + temperature/humidity/light/soil pH sensors fully wired to the Node-RED dashboard in real time

The backend is **finished and waiting**. The game API (`POST /api/device-events`), Supabase schema, web screens, and quest/XP engine all work, and have been verified with a test flow. The only thing left is for **Node-RED to send data in the agreed shape**.

---

### 0. Pre-flight Checklist (decide together with your teammate)

| # | Item to confirm | Why it matters |
|---|---|---|
| 1 | Whether the current flow is a **brand-new flow you built yourself**, or based on the existing **v5 verified flow** | Changes how you connect it (branches at Step 1 below) |
| 2 | **LDR polarity**: is 0 dark or bright? | The game contract assumes `light: 1 = bright`. If it's inverted, flip it in Node-RED |
| 3 | Is pH a **calibrated value** (0–14), or raw ADC/voltage? | The game only accepts calibrated pH (handoff document §3) |
| 4 | Is the laptop clock correct (synced to internet time)? | The API rejects timestamps more than 10 minutes in the future |
| 5 | Demo plant species and threshold profile | Defaults: pH 6.0–7.0, overheat ≥32°C/≤30°C, dry <40%/≥45% (§5.2) |

---

### 1. Data Contract the Backend Accepts (send exactly this)

#### 1-A. Game Events — send only when the state **changes**

`POST http://localhost:3000/api/device-events` (Content-Type: application/json)

```json
{
  "eventId": "evt-plant-01-1754550000000-overheating",
  "plantId": "plant-01",
  "type": "PLANT_STATE_CHANGED",
  "occurredAt": "2026-08-07T12:00:00+07:00",
  "data": {
    "previousState": "Happy",
    "currentState": "Overheating",
    "temperature": 34.2,
    "humidity": 61,
    "light": 1,
    "soilPH": 6.5
  }
}
```

- Allowed `currentState` values (exactly these 6): `Happy` `Overheating` `DryAir` `Sleepy` `SoilAcidic` `SoilAlkaline`
- `eventId`: must be unique every time (recommended: include a timestamp). Safe to resend — the server ignores duplicates
- `occurredAt`: **timezone offset required** (`+07:00` or `Z`). If missing, it's rejected with a 400
- Sensor values in `data` are optional, but **strongly recommended** — the server re-validates "did it really recover" using sensor values (e.g., even if the mood changed, if `temperature > 30` the server won't start verifying the Cool Me Down quest)
- On sensor disconnect/reconnect (transition only): `type: "SENSOR_OFFLINE"` / `"SENSOR_ONLINE"`, `data: {}`

#### 1-B. Raw Telemetry — periodic ingestion (~every 10 seconds)

Direct to the Supabase `sensor_readings` table (same as the v5 approach):

```json
{
  "reading_key": "leaftalk-01:1754550000000",
  "plant_id": "plant-01",
  "recorded_at": "2026-08-07T12:00:00+07:00",
  "temperature": 27.4, "humidity": 61, "light": 1, "soil_ph": 6.5,
  "primary_state": "Happy", "healthy": true
}
```

The temperature/humidity/light gauges on the main web screen (pixel farm) read the **latest row** in this table. Without it, the gauges stay stuck in a "waiting for sensors" state.

> Core principle (handoff document, Correction 3): **raw samples go to Supabase, meaningful transition events go to the game API.** Don't send every sample to the game API.

---

### 2. Implementation Steps (recommended order)

#### Step 1 — Decide on connection approach (30 min)

**Case A: already using the v5 flow, or can adopt it** → the fastest path.
v5 already has validation / state-determination / hysteresis / DB-ingestion / watchdog built in. Just import the bridge (`phase18-bridge-flow.json`) as described in `node-red/README.md`, and add a single wire to v5's **"Build Unified Device Command"** output. Done → jump to Step 3.

**Case B: a brand-new dashboard flow you built yourself** → follow Step 2 onward below, in order.
(Leave the dashboard as it is; add this as a parallel branch alongside it.)

#### Step 2 — Add the state-determination engine (Case B only, half a day)

In parallel, right after the dashboard flow's normalized sensor message:

1. **State-determination function**: uses thresholds + hysteresis to decide one of the 6 moods (use the §5.2 values; recommended to copy v5's "Combine Plant State" code — it's already verified)
2. **Transition-detection function**: compares against `flow.get("lastState")` and only passes through when it changed
3. The repo's **`docs/SETUP-milestone1-2.md` §6.2 `Build PLANT_STATE_CHANGED` function** (builds the event envelope) → **http request** node (POST)

#### Step 3 — Smoke test the game API connection (30 min)

1. Confirm the game server is running (`npm run dev`, localhost:3000)
2. Artificially trigger a state change (heater/flashlight/ice, etc.) to cause a transition
3. Confirm debug shows `{ok:true, duplicate:false, applied:true}` and **the Jamkachu mood changes on the web screen without a refresh**
4. Confirm resending the same state produces no output (transition detection working)

#### Step 4 — Telemetry ingestion (half a day; already done for Case A)

Upsert into `sensor_readings` every 10 seconds (ignore `reading_key` conflicts). Copying v5's DB branch (group F) gets you retry handling and secret handling for free. Done when: the main web screen gauges show actual temperature/humidity.

#### Step 5 — Watchdog (optional, 1 hour)

45 seconds with no serial data → send `SENSOR_OFFLINE`; on next reception, send `SENSOR_ONLINE` (transition only; an example exists in the extended bridge). Used by the weekly report to exclude disconnected time from "healthy time."

#### Step 6 — Full rehearsal (1 hour)

- `scripts\test-device-events.ps1` — automatically verifies all 8 API contract cases
- `scripts\demo-rehearsal.ps1` — rehearses the filming scenario (Happy → Overheating → recovery → 5-min verification → +XP → level up)
- Failure test (§Phase 19): does hardware control keep working with the game server turned off, and does it recover once turned back on?

---

### 3. "Data Processing" List to Request from Your Teammate

> Answer to "let me know if other data processing is needed." Things Node-RED needs to handle to satisfy the contract above:

| # | Processing | Details | Priority |
|---|---|---|---|
| 1 | **Field name/type normalization** | `{temperature, humidity, light, soilPH}` — all numeric, no strings. Field name spelling must be exact | Required |
| 2 | **pH calibration** | raw ADC → calibrated pH (0–14). At least 2-point calibration (pH 4.0/6.86 buffers), then linear transform. Keep calibration coefficients as constants in the function node | Required |
| 3 | **Unify LDR polarity** | Fix `light: 1 = bright`. If the hardware is inverted, `light = 1 - raw` | Required |
| 4 | **State determination + hysteresis** | So state doesn't flicker when crossing thresholds (§5.2: overheat ≥32/≤30, dry <40/≥45, pH ±0.2) | Required |
| 5 | **Transition detection** | Remember the previous state; emit exactly one event only when it changes. Don't repeatedly send the same state | Required |
| 6 | **Event envelope** | Unique `eventId`, `occurredAt` with timezone (you can copy the function code from the repo) | Required |
| 7 | **Include sensor values** | Include temperature/humidity/light/pH at that moment in the event's `data` — used for the server's recovery re-validation | Strongly recommended |
| 8 | **Outlier filter** | Ignore DHT11 momentary spikes (e.g., temperature -999, humidity 0) — keep the last valid value or drop that sample | Recommended |
| 9 | **10-second telemetry interval** | Ingest into `sensor_readings` (recommended to reuse v5's DB branch) | Recommended |
| 10 | **Watchdog transition events** | No data → OFFLINE, recovery → ONLINE (each only once) | Optional |

**Things you don't need to do** (the backend already handles these): XP/quest/level calculation, normalizing spacing in state strings (e.g., "Dry Air" is also accepted), duplicate-event prevention logic (safe to resend), AI messages.

---

### 4. Reference Files

| File | Purpose |
|---|---|
| `node-red/phase18-bridge-flow.json` + `node-red/README.md` | Bridge for v5 (Case A) + wiring guide |
| `docs/SETUP-milestone1-2.md` chapters 4–6 | API spec · manual testing · importable test flow (includes Case B's envelope function) |
| `docs/SETUP-game-systems.md` | How the game systems consume events |
| `scripts/test-device-events.ps1` | Automated contract verification (run after connecting) |
| `scripts/demo-rehearsal.ps1` | Automated filming rehearsal |

---

<a id="indonesia"></a>

## 🇮🇩 Bahasa Indonesia

Target: anggota tim hardware yang membangun dashboard Arduino + Node-RED
Prasyarat: pot tanaman fisik + sensor suhu/kelembapan/cahaya/pH tanah sudah terhubung real-time ke dashboard Node-RED

Backend sudah **selesai dan siap menunggu**. Game API (`POST /api/device-events`), skema Supabase, layar web, serta mesin quest/XP semuanya sudah berjalan, dan sudah diverifikasi lewat alur pengujian (test flow). Yang masih diperlukan hanya **Node-RED mengirim data dalam bentuk yang sudah disepakati**.

---

### 0. Pengecekan Sebelum Mulai (diputuskan bersama rekan tim)

| # | Hal yang perlu dipastikan | Kenapa penting |
|---|---|---|
| 1 | Apakah flow saat ini adalah **flow baru buatan sendiri**, atau berbasis **flow v5 yang sudah tervalidasi** | Menentukan cara penyambungannya (bercabang di Langkah 1 di bawah) |
| 2 | **Polaritas LDR**: apakah 0 berarti gelap atau terang? | Kontrak game mengasumsikan `light: 1 = terang`. Jika terbalik, harus dibalik di Node-RED |
| 3 | Apakah pH sudah berupa **nilai hasil kalibrasi** (0–14), atau masih raw ADC/tegangan? | Game hanya menerima pH yang sudah dikalibrasi (dokumen serah terima §3) |
| 4 | Apakah jam laptop sudah benar (tersinkron dengan waktu internet)? | API menolak timestamp yang lebih dari 10 menit ke depan |
| 5 | Spesies tanaman demo dan profil ambang batas | Default: pH 6.0–7.0, kepanasan ≥32°C/≤30°C, kering <40%/≥45% (§5.2) |

---

### 1. Kontrak Data yang Diterima Backend (kirim persis seperti ini)

#### 1-A. Event Game — kirim hanya saat state **berubah**

`POST http://localhost:3000/api/device-events` (Content-Type: application/json)

```json
{
  "eventId": "evt-plant-01-1754550000000-overheating",
  "plantId": "plant-01",
  "type": "PLANT_STATE_CHANGED",
  "occurredAt": "2026-08-07T12:00:00+07:00",
  "data": {
    "previousState": "Happy",
    "currentState": "Overheating",
    "temperature": 34.2,
    "humidity": 61,
    "light": 1,
    "soilPH": 6.5
  }
}
```

- Nilai `currentState` yang diizinkan (harus persis salah satu dari 6 ini): `Happy` `Overheating` `DryAir` `Sleepy` `SoilAcidic` `SoilAlkaline`
- `eventId`: harus unik setiap kali (disarankan menyertakan timestamp). Aman dikirim ulang — server mengabaikan duplikat
- `occurredAt`: **wajib menyertakan offset zona waktu** (`+07:00` atau `Z`). Jika tidak ada, akan ditolak dengan status 400
- Nilai sensor di dalam `data` bersifat opsional, tapi **sangat disarankan untuk disertakan** — server melakukan validasi ulang "apakah benar-benar sudah pulih" menggunakan nilai sensor tersebut (misalnya, walau mood sudah berubah, jika `temperature > 30` server tidak akan mulai memverifikasi quest Cool Me Down)
- Saat sensor putus/tersambung kembali (hanya saat transisi): `type: "SENSOR_OFFLINE"` / `"SENSOR_ONLINE"`, `data: {}`

#### 1-B. Telemetri Mentah — pengiriman berkala (~setiap 10 detik)

Langsung ke tabel Supabase `sensor_readings` (sama seperti pendekatan v5):

```json
{
  "reading_key": "leaftalk-01:1754550000000",
  "plant_id": "plant-01",
  "recorded_at": "2026-08-07T12:00:00+07:00",
  "temperature": 27.4, "humidity": 61, "light": 1, "soil_ph": 6.5,
  "primary_state": "Happy", "healthy": true
}
```

Gauge suhu/kelembapan/cahaya pada layar web utama (pixel farm) membaca **baris terbaru** dari tabel ini. Tanpa ini, gauge akan tetap berada dalam status "waiting for sensors".

> Prinsip inti (dokumen serah terima, Correction 3): **sampel mentah dikirim ke Supabase, event transisi yang bermakna dikirim ke game API.** Jangan mengirim setiap sampel ke game API.

---

### 2. Langkah Implementasi (urutan yang disarankan)

#### Langkah 1 — Menentukan cara penyambungan (30 menit)

**Kasus A: sudah memakai flow v5, atau bisa mengadopsinya** → jalur tercepat.
v5 sudah punya validasi / penentuan state / histeresis / pemasukan ke DB / watchdog secara bawaan. Cukup impor bridge (`phase18-bridge-flow.json`) sesuai `node-red/README.md`, lalu tambahkan satu kabel (wire) ke output **"Build Unified Device Command"** milik v5. Selesai → langsung lompat ke Langkah 3.

**Kasus B: flow dashboard baru buatan sendiri** → ikuti Langkah 2 dan seterusnya di bawah secara berurutan.
(Dashboard dibiarkan seperti semula; tambahkan ini sebagai cabang paralel di sampingnya.)

#### Langkah 2 — Menambahkan mesin penentuan state (khusus Kasus B, setengah hari)

Secara paralel, tepat setelah pesan sensor yang sudah dinormalisasi dari flow dashboard:

1. **Function penentuan state**: menentukan salah satu dari 6 mood berdasarkan ambang batas + histeresis (gunakan nilai di §5.2; disarankan menyalin kode "Combine Plant State" dari v5 — sudah tervalidasi)
2. **Function deteksi transisi**: membandingkan dengan `flow.get("lastState")`, hanya diteruskan jika ada perubahan
3. **Function `Build PLANT_STATE_CHANGED`** dari `docs/SETUP-milestone1-2.md` §6.2 di repo (membuat amplop/envelope event) → node **http request** (POST)

#### Langkah 3 — Uji coba (smoke test) koneksi ke game API (30 menit)

1. Pastikan game server sedang berjalan (`npm run dev`, localhost:3000)
2. Picu perubahan state secara manual (heater/senter/es, dll.) untuk memicu transisi
3. Pastikan debug menampilkan `{ok:true, duplicate:false, applied:true}` dan **mood Jamkachu berubah di layar web tanpa refresh**
4. Pastikan mengirim ulang state yang sama tidak menghasilkan output apa pun (deteksi transisi berjalan)

#### Langkah 4 — Pengiriman telemetri (setengah hari; untuk Kasus A sudah selesai)

Upsert ke `sensor_readings` setiap 10 detik (abaikan konflik `reading_key`). Menyalin cabang DB milik v5 (grup F) otomatis memberi penanganan retry dan secret juga. Kriteria selesai: gauge suhu/kelembapan di layar web utama menampilkan data aktual.

#### Langkah 5 — Watchdog (opsional, 1 jam)

45 detik tanpa data serial → kirim `SENSOR_OFFLINE`; saat data diterima lagi, kirim `SENSOR_ONLINE` (hanya saat transisi; contohnya ada di versi bridge yang diperluas). Dipakai laporan mingguan untuk mengecualikan waktu terputus dari "waktu sehat".

#### Langkah 6 — Gladi bersih penuh (1 jam)

- `scripts\test-device-events.ps1` — memverifikasi otomatis 8 skenario kontrak API
- `scripts\demo-rehearsal.ps1` — gladi bersih skenario syuting (Happy → Overheating → pemulihan → verifikasi 5 menit → +XP → naik level)
- Uji kegagalan (§Phase 19): apakah kontrol hardware tetap berjalan saat game server dimatikan / apakah pulih saat dinyalakan kembali?

---

### 3. Daftar "Pemrosesan Data" yang Perlu Diminta ke Rekan Tim

> Jawaban untuk "beri tahu jika ada pemrosesan data lain yang diperlukan." Hal-hal yang perlu dilakukan di dalam Node-RED agar memenuhi kontrak di atas:

| # | Pemrosesan | Detail | Prioritas |
|---|---|---|---|
| 1 | **Normalisasi nama field & tipe data** | `{temperature, humidity, light, soilPH}` — semua harus numerik, jangan string. Ejaan nama field harus persis | Wajib |
| 2 | **Kalibrasi pH** | raw ADC → pH terkalibrasi (0–14). Kalibrasi minimal 2 titik (buffer pH 4.0/6.86), lalu transformasi linear. Koefisien kalibrasi disimpan sebagai konstanta di function node | Wajib |
| 3 | **Menyamakan polaritas LDR** | Tetapkan `light: 1 = terang`. Jika hardware terbalik, `light = 1 - raw` | Wajib |
| 4 | **Penentuan state + histeresis** | Agar state tidak berkedip-kedip saat melewati ambang batas (§5.2: kepanasan ≥32/≤30, kering <40/≥45, pH ±0.2) | Wajib |
| 5 | **Deteksi transisi** | Mengingat state sebelumnya, kirim tepat 1 event hanya saat berubah. Jangan mengirim state yang sama berulang-ulang | Wajib |
| 6 | **Amplop event (event envelope)** | `eventId` unik, `occurredAt` dengan zona waktu (bisa menyalin kode function dari repo) | Wajib |
| 7 | **Menyertakan nilai sensor** | Sertakan suhu/kelembapan/cahaya/pH saat itu di dalam `data` event — dipakai untuk validasi ulang pemulihan di server | Sangat disarankan |
| 8 | **Filter nilai anomali (outlier)** | Abaikan lonjakan sesaat dari DHT11 (misalnya suhu -999, kelembapan 0) — pertahankan nilai valid terakhir atau buang sampel tersebut | Disarankan |
| 9 | **Telemetri interval 10 detik** | Masukkan ke `sensor_readings` (disarankan memakai ulang cabang DB v5) | Disarankan |
| 10 | **Event transisi watchdog** | Tidak ada data → OFFLINE, pulih → ONLINE (masing-masing hanya sekali) | Opsional |

**Yang tidak perlu dilakukan** (backend sudah menanganinya): perhitungan XP/quest/level, normalisasi spasi pada string state (misalnya "Dry Air" juga diterima), logika pencegahan event duplikat (aman dikirim ulang), pesan AI.

---

### 4. Berkas Referensi

| Berkas | Kegunaan |
|---|---|
| `node-red/phase18-bridge-flow.json` + `node-red/README.md` | Bridge untuk v5 (Kasus A) + panduan pengkabelan |
| `docs/SETUP-milestone1-2.md` bab 4–6 | Spesifikasi API · pengujian manual · flow uji yang bisa diimpor (termasuk function envelope untuk Kasus B) |
| `docs/SETUP-game-systems.md` | Cara sistem game mengonsumsi event |
| `scripts/test-device-events.ps1` | Verifikasi kontrak otomatis (jalankan setelah tersambung) |
| `scripts/demo-rehearsal.ps1` | Otomasi gladi bersih syuting |

---

<a id="korean"></a>

## 🇰🇷 한국어

대상: 아두이노 + Node-RED 대시보드를 구현한 하드웨어 담당 팀원
전제: 실물 화분 + 온도/습도/조도/토양 pH 센서가 Node-RED 대시보드와 실시간 연동 완료

백엔드는 **완성되어 대기 중**입니다. 게임 API(`POST /api/device-events`), Supabase 스키마, 웹 화면, 퀘스트/XP 엔진이 모두 동작하며, 테스트 플로우로 검증돼 있습니다. 이제 필요한 것은 **Node-RED가 약속된 형태의 데이터를 보내는 것**뿐입니다.

---

### 0. 시작 전 확인 (팀원과 함께 결정)

| # | 확인 사항 | 왜 필요한가 |
|---|---|---|
| 1 | 지금 플로우가 **직접 만든 새 플로우**인지, 기존 **v5 검증 플로우** 기반인지 | 연결 방법이 달라짐 (아래 1단계에서 분기) |
| 2 | **LDR 극성**: 0이 어두움인가 밝음인가 | 게임은 `light: 1 = 밝음`으로 약속함. 반대라면 Node-RED에서 뒤집어야 함 |
| 3 | **pH가 캘리브레이션된 값**인가 (0–14), raw ADC/전압인가 | 게임은 보정된 pH만 받음 (인수인계 §3) |
| 4 | 노트북 시계가 맞는가 (인터넷 시간 동기화) | API가 10분 이상 미래 타임스탬프를 거부함 |
| 5 | 데모 식물 종과 임계값 프로필 | 기본값: pH 6.0–7.0, 환기 ≥32°C/≤30°C, 건조 <40%/≥45% (§5.2) |

---

### 1. 백엔드가 받는 데이터 계약 (이대로만 보내면 됨)

#### 1-A. 게임 이벤트 — 상태가 **바뀔 때만** 전송

`POST http://localhost:3000/api/device-events` (Content-Type: application/json)

```json
{
  "eventId": "evt-plant-01-1754550000000-overheating",
  "plantId": "plant-01",
  "type": "PLANT_STATE_CHANGED",
  "occurredAt": "2026-08-07T12:00:00+07:00",
  "data": {
    "previousState": "Happy",
    "currentState": "Overheating",
    "temperature": 34.2,
    "humidity": 61,
    "light": 1,
    "soilPH": 6.5
  }
}
```

- `currentState` 허용값 (정확히 이 6개): `Happy` `Overheating` `DryAir` `Sleepy` `SoilAcidic` `SoilAlkaline`
- `eventId`: 매번 유니크 (타임스탬프 포함 추천). 재전송해도 안전 — 서버가 중복을 무시함
- `occurredAt`: **타임존 오프셋 필수** (`+07:00` 또는 `Z`). 없으면 400 거부
- `data`의 센서 값들은 선택이지만 **넣는 것을 강력 추천** — 서버가 "정말 회복됐는지" 센서 값으로 재검증함 (예: 무드가 바뀌어도 temperature > 30이면 Cool Me Down 퀘스트 검증을 시작하지 않음)
- 센서 끊김/복구 시(전이만): `type: "SENSOR_OFFLINE"` / `"SENSOR_ONLINE"`, `data: {}`

#### 1-B. 원시 텔레메트리 — 주기 적재 (약 10초 간격)

Supabase `sensor_readings` 테이블로 직접 (v5 방식 그대로):

```json
{
  "reading_key": "leaftalk-01:1754550000000",
  "plant_id": "plant-01",
  "recorded_at": "2026-08-07T12:00:00+07:00",
  "temperature": 27.4, "humidity": 61, "light": 1, "soil_ph": 6.5,
  "primary_state": "Happy", "healthy": true
}
```

웹 메인 화면(픽셀 팜)의 온도·습도·조도 게이지가 이 테이블의 **최신 행**을 읽습니다. 이게 없으면 게이지가 "waiting for sensors" 상태로 남습니다.

> 핵심 원칙 (인수인계 Correction 3): **원시 샘플은 Supabase로, 의미 있는 전이 이벤트는 게임 API로.** 매 샘플을 게임 API로 보내지 마세요.

---

### 2. 구현 단계 (권장 순서)

#### 1단계 — 연결 방식 결정 (30분)

**케이스 A: v5 플로우를 쓰고 있거나 도입 가능** → 가장 빠른 길.
v5에는 검증/상태판정/히스테리시스/DB적재/워치독이 이미 다 있음. `node-red/README.md`대로 브리지(`phase18-bridge-flow.json`)를 임포트하고 v5의 **"Build Unified Device Command"** 출력에 와이어 1개만 추가하면 끝. → 3단계로 점프.

**케이스 B: 직접 만든 새 대시보드 플로우** → 아래 2단계부터 순서대로.
(대시보드는 그대로 두고, 그 옆에 병렬 분기로 추가하는 방식)

#### 2단계 — 상태 판정 엔진 추가 (케이스 B만, 반나절)

대시보드 플로우의 정규화된 센서 메시지 뒤에 병렬로:

1. **상태 판정 function**: 임계값 + 히스테리시스로 6개 무드 중 하나 결정 (§5.2 값 사용, v5의 "Combine Plant State" 코드를 복사해오는 것을 추천 — 검증된 코드임)
2. **전이 감지 function**: `flow.get("lastState")`와 비교해 바뀌었을 때만 통과
3. 레포의 **`docs/SETUP-milestone1-2.md` 6.2의 `Build PLANT_STATE_CHANGED` function** (이벤트 봉투 생성) → **http request** (POST)

#### 3단계 — 게임 API 연결 스모크 테스트 (30분)

1. 게임 서버 실행 중인지 확인 (`npm run dev`, localhost:3000)
2. 상태를 인위적으로 바꿔 (히터/손전등/얼음 등) 전이 발생
3. debug에 `{ok:true, duplicate:false, applied:true}` + **웹 화면에서 Jamkachu 무드가 새로고침 없이 변경** 확인
4. 같은 상태로 재전송 시 아무것도 안 나가는지 (전이 감지 동작) 확인

#### 4단계 — 텔레메트리 적재 (반나절, 케이스 A는 이미 됨)

10초 간격으로 `sensor_readings` upsert (reading_key 충돌 무시). v5의 DB 분기(F 그룹)를 복사해오면 재시도·시크릿 처리까지 그대로 얻음. 완료 기준: 웹 메인 화면 게이지에 실제 온습도 표시.

#### 5단계 — 워치독 (선택, 1시간)

시리얼 무수신 45초 → `SENSOR_OFFLINE` 전송, 다음 수신 때 `SENSOR_ONLINE` (전이만, 브리지 확장판에 예시 있음). 주간 리포트가 끊긴 시간을 "건강 시간"에서 제외하는 데 쓰임.

#### 6단계 — 전체 리허설 (1시간)

- `scripts\test-device-events.ps1` — API 계약 8종 자동 검증
- `scripts\demo-rehearsal.ps1` — 촬영 시나리오 리허설 (Happy → Overheating → 회복 → 5분 검증 → +XP → 레벨업)
- 실패 테스트 (§Phase 19): 게임 서버 끈 상태에서 하드웨어 제어가 계속 되는지 / 다시 켜면 복구되는지

---

### 3. 팀원에게 요청할 "데이터 가공" 목록

> "다른 데이터 가공이 필요하면 말해달라"에 대한 답. 위 계약을 만족시키기 위해 Node-RED 안에서 해줘야 하는 것들:

| # | 가공 | 내용 | 우선순위 |
|---|---|---|---|
| 1 | **필드명·타입 정규화** | `{temperature, humidity, light, soilPH}` — 전부 숫자형, 문자열 금지. 필드명 철자 정확히 | 필수 |
| 2 | **pH 캘리브레이션** | raw ADC → 보정된 pH(0–14). 최소 2점 교정(pH 4.0/6.86 버퍼) 후 선형 변환. 보정 계수는 function 노드 상수로 | 필수 |
| 3 | **LDR 극성 통일** | `light: 1 = 밝음`으로 고정. 하드웨어가 반대면 `light = 1 - raw` | 필수 |
| 4 | **상태 판정 + 히스테리시스** | 임계값 넘나들 때 상태가 깜빡이지 않게 (§5.2: 환기 ≥32/≤30, 건조 <40/≥45, pH ±0.2) | 필수 |
| 5 | **전이 감지** | 이전 상태 기억, **바뀔 때만** 이벤트 1개. 같은 상태 반복 전송 금지 | 필수 |
| 6 | **이벤트 봉투** | 유니크 `eventId`, 타임존 포함 `occurredAt` (레포의 function 코드 복사하면 됨) | 필수 |
| 7 | **센서 값 동봉** | 이벤트 `data`에 당시 온도/습도/조도/pH 포함 — 서버의 회복 재검증에 사용 | 강력 추천 |
| 8 | **이상값 필터** | DHT11 순간 튐(예: 온도 -999, 습도 0) 무시 — 직전 유효값 유지 또는 해당 샘플 드롭 | 추천 |
| 9 | **10초 간격 텔레메트리** | `sensor_readings` 적재 (v5 DB 분기 재사용 추천) | 추천 |
| 10 | **워치독 전이 이벤트** | 무수신 → OFFLINE, 복구 → ONLINE (각 1회만) | 선택 |

**하지 않아도 되는 것** (백엔드가 이미 함): XP/퀘스트/레벨 계산, 상태 문자열 띄어쓰기 정규화("Dry Air"도 받아줌), 중복 이벤트 방지 판단(재전송 안전), AI 메시지.

---

### 4. 참고 파일

| 파일 | 용도 |
|---|---|
| `node-red/phase18-bridge-flow.json` + `node-red/README.md` | v5용 브리지 (케이스 A) + 배선 가이드 |
| `docs/SETUP-milestone1-2.md` 4–6장 | API 스펙 · 수동 테스트 · 임포트용 테스트 플로우 (케이스 B의 봉투 function 포함) |
| `docs/SETUP-game-systems.md` | 게임 시스템이 이벤트를 어떻게 소비하는지 |
| `scripts/test-device-events.ps1` | 계약 자동 검증 (연결 후 실행) |
| `scripts/demo-rehearsal.ps1` | 촬영 리허설 자동화 |
