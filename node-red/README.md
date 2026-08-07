# PlantMoji · Node-RED Game API Bridge (Phase 18) — English · Bahasa Indonesia · 한국어

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

A bridge that delivers the state-change detection results and sensor connectivity status (watchdog) from the verified v5 flow (`leaftalk_node_red_flow_v5_supabase_verified.json`, tab name **"LeafTalk Core Flow v5 · DB Persistence"**) to the PlantMoji game API (`POST /api/device-events`).

**The v5 flow itself must never be modified.** The bridge is imported as a separate tab, then connected by hand in the editor by adding just one parallel wire per chain (the state-change chain is §3, the sensor-status chain is §8).

### 1. What the Bridge Does

It receives v5's unified device command (`msg.payload`) as-is, and:

- Only when `payload.status.stateChanged === true` (a value computed by v5's **State Change Detector**) does it build and send a game event.
- If `stateChanged` is `false`, it returns `null`, so nothing is sent to the API while the state stays unchanged.

The body it sends follows the game side's `src/types/events.ts` `parseDeviceEvent` contract exactly:

```json
{
  "eventId": "evt-plant-01-<timestamp>-<primaryState, lowercase>",
  "plantId": "plant-01",
  "type": "PLANT_STATE_CHANGED",
  "occurredAt": "<ISO 8601 of the timestamp (…Z)>",
  "data": {
    "previousState": "<previous state or null>",
    "currentState": "<current state>",
    "temperature": 26.5,
    "humidity": 32,
    "light": 1,
    "soilPH": 6.5
  }
}
```

#### v5 → Game API Field Mapping (confirmed from actual v5 code)

| v5 unified command (`msg.payload`) | Game event | Notes |
| --- | --- | --- |
| `timestamp` | `eventId`, `occurredAt` | Set by v5's "Validate & Normalize Sensor Data" via `Date.now()` (epoch ms) |
| `status.stateChanged` | Send gate | Computed by v5's "State Change Detector" (`fn_state_change`) |
| `status.previousPrimaryState` | `data.previousState` | `null` on the first command right after a Node-RED restart or RESET — the API allows this |
| `status.primaryState` | `data.currentState` | See the mood code notes below |
| `readings.temperature` | `data.temperature` | |
| `readings.humidity` | `data.humidity` | |
| `readings.light` | `data.light` | 0 or 1 |
| `readings.soilPH` | `data.soilPH` | |

#### Mood Code Verification

The `primaryState` values produced by v5's "Combine Plant State" (`fn_state`) are
`"Happy"`, `"Overheating"`, `"DryAir"`, `"Sleepy"`, `"SoilAcidic"`, `"SoilAlkaline"`, and these **match exactly, spelling included**, the game side's `src/types/events.ts` `PLANT_MOODS` (no spaced variants like `"Dry Air"`).
Even so, the bridge's "Build Game Event" normalizes once more using the same rule as the API's `normalizeMood()` (strip whitespace/`_`/`-`, then compare case-insensitively), so the bridge won't break even if the v5 labels change later.

> See §8 for the **second chain** that delivers sensor connectivity status (`SENSOR_OFFLINE` / `SENSOR_ONLINE`) — it taps a different point (the v5 watchdog).

### 2. How to Import

1. Node-RED editor → top-right menu (☰) → **Import**.
2. Select the `node-red/phase18-bridge-flow.json` file or paste its contents → **Import**.
3. A new tab **"PlantMoji · Game API Bridge"** is created. Inside the tab:
   - `TEST → Simulated State Change` (inject) → `Build Test Command (v5 shape)` — for testing the state-change chain alone, without v5
   - **`Build Game Event` → `POST /api/device-events` → `Game API Response`** — the state-change chain (no link nodes, for manual wiring)
   - `TEST → Simulated Watchdog Event` (inject) → `Build Test Watchdog Event (v5 shape)` — for testing the sensor-status chain alone, without v5
   - **`Build Sensor Status Event` → `POST /api/device-events (sensor)` → `Sensor Status API Response`** — the sensor-status chain (§8)
4. **Deploy**.

### 3. Connecting to v5 — the Exact Node and Port

The connection point is the **sole output port (port 1)** of v5 tab's function node **"Build Unified Device Command"** (id: `fn_command`).

- Why this node: this is exactly where the `stateChanged` / `previousPrimaryState` values computed by the State Change Detector (`fn_state_change`) get folded into `msg.payload.status`. Tapping the State Change Detector's output directly won't work, because `msg.payload` is still in raw sensor-reading shape there, which doesn't match the bridge's input contract.
- This port already fans out to 3 destinations: `Final Command Preview` (debug), `Readings Log Preview` (debug), and `Build DB Operations` (`fn_db_dispatch`). The bridge is added here as a **4th parallel wire**.

Node-RED can't draw wires across tabs, so the order is:

1. In the bridge tab, select the 3 nodes `Build Game Event`, `POST /api/device-events`, `Game API Response` and copy them (Ctrl+C).
2. Switch to the v5 tab **"LeafTalk Core Flow v5 · DB Persistence"**, paste (Ctrl+V), and place them in an open area.
3. **Drag one wire from "Build Unified Device Command"'s output port to "Build Game Event"'s input** to add it. (Leave the existing 3 wires alone — don't delete or splice into anything.)
4. **Deploy**.

The original chain and TEST inject left in the bridge tab can stay as they are, and continue to be usable for testing the bridge on its own, with no wiring needed.

See §8 for the sensor-status chain's wiring (the second wire, tapped at v5's **"Sensor Watchdog"**).

### 4. Parallel Branch Rule (handoff §5.3) — Must Be Followed

**The bridge must always be a parallel branch.** When an output port has multiple wires, Node-RED clones the message and delivers it independently to each branch. Because of this:

- Even if the game API is down (connection refused) or returns 4xx/5xx, **it has zero effect on the hardware-control path (LCD/LED/buzzer/servo) or the Supabase save path.** Failures only show up inside this branch, in the `Game API Response` debug message (the http request node is configured to output errors as messages, and the bridge has no catch node).
- Never do this: insert the bridge node **in series**, in the middle of the device-command path between `Build Unified Device Command` → `Build DB Operations`. Doing so would let an API outage block hardware control.
- `Build Game Event` replaces `msg.payload` with a game event, but since the parallel branch works on a cloned message, this has no effect on the v5-side message.

### 5. Authentication (optional)

- If the Node-RED process environment variable `DEVICE_API_TOKEN` is set, `Build Game Event` automatically attaches an `Authorization: Bearer <token>` header (`env.get("DEVICE_API_TOKEN")` — the same way v5 reads `SUPABASE_URL`).
- It must match the game side's `DEVICE_API_TOKEN` value (`.env.local` or Vercel environment variables). The game API only checks the token when one is configured on its side, so for local prototyping, leaving both sides empty works with no authentication.
- Node-RED must be restarted after changing the token for it to take effect.

### 6. Switching the URL for Vercel Deployment

1. Double-click the `POST /api/device-events` node.
2. Change the URL from `http://localhost:3000/api/device-events` to `https://<your-app>.vercel.app/api/device-events` (must be `https`).
3. **Deploy**.
4. Confirm the game side's `DEVICE_API_TOKEN` (if used) and the Supabase keys are set in the Vercel project's environment variables, and set Node-RED's `DEVICE_API_TOKEN` to the same value.

### 7. Test Checklist

Prerequisite: the game server must be running at `http://localhost:3000`, and a `plant-01` seed must exist in Supabase (otherwise the API returns 404 `unknown plantId`).

- [ ] **Bridge-only test (before wiring):** In the bridge tab, click `TEST → Simulated State Change` → `Game API Response` shows `{ ok: true, eventId: "evt-plant-01-…-dryair", duplicate: false, applied: true }`. Also verifiable via the status text below the node.
- [ ] **Toggle test:** Click the same inject again → this time a `…-happy` event (every click toggles Happy ↔ DryAir; the eventId is always new).
- [ ] **v5 integration test:** After wiring per §3, click `TEST → Dry Air` in the v5 tab → on a state transition, `Game API Response` shows `ok: true`. **Click the same inject again in a row → nothing is sent** (`stateChanged: false` → the bridge returns `null`).
- [ ] Click `TEST → Happy` → a `DryAir → Happy` transition event is sent.
- [ ] **Isolation (§5.3) verification:** With the game server turned off, transition v5's state → `Game API Response` logs a connection error, but v5's `Final Command Preview` and Supabase save (`DB Save Success`) still work as normal.
- [ ] **Authentication test (if using a token):** If the two tokens differ, confirm `statusCode: 401` / `{ ok: false, error: "unauthorized" }` → matching the tokens returns normal behavior.
- [ ] **Game reflection check:** On the PlantMoji home screen, confirm `plant-01`'s mood has changed to the sent `currentState`.
- [ ] **Restart case:** Confirm that the first command right after a Node-RED restart (or v5's `RESET → Runtime State`) sends `previousState: null`, and that the API accepts it normally (`ok: true`).
- [ ] **Sensor offline/recovery test (§8):** After wiring per §8, unplug the serial feed and cut data for 30+ seconds → at the next watchdog tick (up to 30+10 seconds later), `SENSOR_OFFLINE` arrives **exactly once** (`ok: true` in `Sensor Status API Response`; no further sends even as the tick repeats every 10 seconds). Plug the feed back in → after valid data arrives, `SENSOR_ONLINE` arrives **exactly once** at the next tick.
- [ ] **Weekly-report exclusion check:** Confirm that the offline interval above (between `SENSOR_OFFLINE` and `SENSOR_ONLINE`) is excluded from the weekly report's healthy time — even if the mood right before going offline was Happy, that interval must not be counted.

### 8. Sensor Status Chain — SENSOR_OFFLINE / SENSOR_ONLINE

The second chain, which taps v5's **sensor watchdog** to deliver sensor-connectivity transitions to the game API. Because the weekly report excludes the interval between `SENSOR_OFFLINE` and `SENSOR_ONLINE` from healthy time (handoff §22·§45), this event is required for offline periods to be reflected accurately in the report.

#### v5 Watchdog Behavior (confirmed from actual v5 code)

- `Watchdog Tick · 10s` (inject, `inj_watch`) runs `Sensor Watchdog` (function, `fn_watch`) every 10 seconds.
- `fn_watch` compares `flow.lastSensorAt` (updated by "Validate & Normalize Sensor Data" (`fn_validate`) on every valid sensor reading) against the profile's `sensorTimeoutSeconds` (30 seconds in the demo profile) to determine offline status, tracking the previous state in `flow.sensorOffline`.
- It emits a message **only on transitions**: on entering offline, `{ type:"systemEvent", event:{ type:"sensorOffline", timestamp } }` (plus LCD/LED/buzzer output); on recovery, `{ … "sensorRecovered" … }`. On repeat ticks it returns `null`, so nothing is sent.
- `timestamp` is `fn_watch`'s own `Date.now()` (epoch ms).
- This node's sole output currently goes to just **one place**: `System Event Preview` (debug, `dbg_system`).

#### Wiring — the Tap Point Differs from §3

The connection point is the **sole output port (port 1)** of v5's function node **"Sensor Watchdog"** (id: `fn_watch`).

1. In the bridge tab, copy (Ctrl+C) the 3 nodes `Build Sensor Status Event`, `POST /api/device-events (sensor)`, `Sensor Status API Response`.
2. Paste (Ctrl+V) into the v5 tab **"LeafTalk Core Flow v5 · DB Persistence"**.
3. **Drag one wire from "Sensor Watchdog"'s output port to "Build Sensor Status Event"'s input** to add it. The bridge becomes the **2nd parallel branch** (leave the existing `System Event Preview` wire alone).
4. **Deploy**.

The parallel-branch rule from §4 (handoff §5.3) applies identically here — a game API outage must never block the watchdog's local warnings (LCD "Sensor offline" / red LED / buzzer) or any other v5 path.

#### Payload Sent

```json
{
  "eventId": "evt-plant-01-<timestamp>-sensor-offline",
  "plantId": "plant-01",
  "type": "SENSOR_OFFLINE",
  "occurredAt": "<ISO 8601 of the timestamp (…Z)>",
  "data": {}
}
```

On recovery, `eventId` ends in `…-sensor-online` and `type` is `SENSOR_ONLINE`. `data` is always an empty object.

#### Sent Only on Transitions (Anti-Spam)

- v5's `fn_watch` itself only emits on transitions, but because v5's `RESET · Runtime State` (`fn_reset`) resets `flow.sensorOffline` to `false`, pressing RESET while the sensor is still dead can cause `sensorOffline` to be emitted **one more time** without an actual recovery.
- Because of that, `Build Sensor Status Event` tracks the last status it sent itself, in a bridge-owned key `flow.bridgeLastSensorStatus`, and returns `null` (sending nothing) if the same status would repeat. **It does not rely on the API's eventId de-duplication** (though even if a resend does happen, the same `timestamp` produces the same `eventId`, so the API handles it harmlessly).
- Right after a Node-RED restart, `lastSensorAt` doesn't exist yet, so `SENSOR_OFFLINE` is sent once on the first tick (~10 seconds in), and `SENSOR_ONLINE` is sent on the next tick after the first valid sensor data arrives. This accurately reflects the real connection state.

#### Authentication · URL

Identical to the state-change chain — if the `DEVICE_API_TOKEN` environment variable (§5) is set, the `Authorization: Bearer` header is attached automatically, and when switching to Vercel (§6), the `POST /api/device-events (sensor)` node's URL is changed the same way.

#### Standalone Test (Before Wiring)

The bridge tab's `TEST → Simulated Watchdog Event` inject verifies this chain alone, without v5 — each click alternates between `sensorOffline` and `sensorRecovered`, so every click is a genuine transition. The first click should show a `…-sensor-offline` event, and the next click a `…-sensor-online` event, both with `ok: true` in `Sensor Status API Response`.

---

<a id="bahasa-indonesia"></a>
## 🇮🇩 Bahasa Indonesia

Bridge yang meneruskan hasil deteksi perubahan status dan status konektivitas sensor (watchdog) dari flow v5 yang telah diverifikasi (`leaftalk_node_red_flow_v5_supabase_verified.json`, nama tab **"LeafTalk Core Flow v5 · DB Persistence"**) ke API game PlantMoji (`POST /api/device-events`).

**Flow v5 itu sendiri tidak boleh diubah sama sekali.** Bridge di-import sebagai tab terpisah, lalu dihubungkan secara manual di editor dengan menambahkan satu wire paralel per chain (chain perubahan status ada di §3, chain status sensor ada di §8).

### 1. Yang Dilakukan Bridge

Bridge menerima unified device command dari v5 (`msg.payload`) apa adanya, lalu:

- Hanya ketika `payload.status.stateChanged === true` (nilai yang dihitung oleh **State Change Detector** milik v5) bridge akan membuat dan mengirim game event.
- Jika `stateChanged` bernilai `false`, bridge mengembalikan `null`, sehingga selama status tidak berubah, tidak ada apa pun yang dikirim ke API.

Body yang dikirim mengikuti kontrak `parseDeviceEvent` dari `src/types/events.ts` di sisi game, persis sama:

```json
{
  "eventId": "evt-plant-01-<timestamp>-<primaryState huruf kecil>",
  "plantId": "plant-01",
  "type": "PLANT_STATE_CHANGED",
  "occurredAt": "<timestamp dalam format ISO 8601 (…Z)>",
  "data": {
    "previousState": "<status sebelumnya atau null>",
    "currentState": "<status saat ini>",
    "temperature": 26.5,
    "humidity": 32,
    "light": 1,
    "soilPH": 6.5
  }
}
```

#### Pemetaan Field v5 → API Game (nilai terverifikasi dari kode v5 asli)

| Unified command v5 (`msg.payload`) | Game event | Catatan |
| --- | --- | --- |
| `timestamp` | `eventId`, `occurredAt` | Diset oleh "Validate & Normalize Sensor Data" milik v5 lewat `Date.now()` (epoch ms) |
| `status.stateChanged` | Gerbang pengiriman | Dihitung oleh "State Change Detector" milik v5 (`fn_state_change`) |
| `status.previousPrimaryState` | `data.previousState` | `null` pada command pertama tepat setelah restart Node-RED atau RESET — diperbolehkan oleh API |
| `status.primaryState` | `data.currentState` | Lihat catatan kode mood di bawah |
| `readings.temperature` | `data.temperature` | |
| `readings.humidity` | `data.humidity` | |
| `readings.light` | `data.light` | 0 atau 1 |
| `readings.soilPH` | `data.soilPH` | |

#### Verifikasi Kode Mood

Nilai `primaryState` yang dihasilkan oleh "Combine Plant State" milik v5 (`fn_state`) adalah
`"Happy"`, `"Overheating"`, `"DryAir"`, `"Sleepy"`, `"SoilAcidic"`, `"SoilAlkaline"`, dan nilai-nilai ini **cocok persis, termasuk ejaannya**, dengan `PLANT_MOODS` di `src/types/events.ts` sisi game (tidak ada varian dengan spasi seperti `"Dry Air"`).
Meski begitu, "Build Game Event" di bridge tetap melakukan normalisasi sekali lagi dengan aturan yang sama seperti `normalizeMood()` di API (menghapus spasi/`_`/`-`, lalu membandingkan tanpa memedulikan huruf besar/kecil), sehingga bridge tidak akan rusak meskipun label v5 berubah di kemudian hari.

> Untuk **chain kedua** yang mengirim status konektivitas sensor (`SENSOR_OFFLINE` / `SENSOR_ONLINE`), lihat §8. Titik tapping-nya berbeda (watchdog v5).

### 2. Cara Import

1. Editor Node-RED → menu kanan atas (☰) → **Import**.
2. Pilih file `node-red/phase18-bridge-flow.json` atau tempel isinya → **Import**.
3. Tab baru **"PlantMoji · Game API Bridge"** akan muncul. Di dalam tab tersebut:
   - `TEST → Simulated State Change` (inject) → `Build Test Command (v5 shape)` — untuk menguji chain perubahan status saja, tanpa v5
   - **`Build Game Event` → `POST /api/device-events` → `Game API Response`** — chain perubahan status (tanpa link node, untuk wiring manual)
   - `TEST → Simulated Watchdog Event` (inject) → `Build Test Watchdog Event (v5 shape)` — untuk menguji chain status sensor saja, tanpa v5
   - **`Build Sensor Status Event` → `POST /api/device-events (sensor)` → `Sensor Status API Response`** — chain status sensor (§8)
4. **Deploy**.

### 3. Menghubungkan ke v5 — Node dan Port yang Tepat

Titik koneksinya adalah **satu-satunya output port (port 1)** dari function node **"Build Unified Device Command"** (id: `fn_command`) di tab v5.

- Kenapa node ini: di sinilah nilai `stateChanged` / `previousPrimaryState` yang dihitung oleh State Change Detector (`fn_state_change`) dirapikan ke dalam `msg.payload.status`. Jika tapping langsung dilakukan di output State Change Detector, `msg.payload` masih berbentuk pembacaan sensor mentah sehingga tidak cocok dengan kontrak input bridge.
- Port ini sudah fan-out ke 3 tujuan: `Final Command Preview` (debug), `Readings Log Preview` (debug), dan `Build DB Operations` (`fn_db_dispatch`). Bridge ditambahkan di sini sebagai **wire paralel ke-4**.

Node-RED tidak bisa menggambar wire lintas tab, jadi urutannya:

1. Di tab bridge, pilih 3 node `Build Game Event`, `POST /api/device-events`, `Game API Response` lalu copy (Ctrl+C).
2. Pindah ke tab v5 **"LeafTalk Core Flow v5 · DB Persistence"**, tempel (Ctrl+V), letakkan di area kosong.
3. **Tarik satu wire dari output port "Build Unified Device Command" ke input "Build Game Event"** untuk menambahkannya. (Biarkan 3 wire yang sudah ada — jangan menghapus atau menyisipkan apa pun.)
4. **Deploy**.

Chain asli dan TEST inject yang tersisa di tab bridge bisa dibiarkan apa adanya, dan tetap bisa dipakai untuk menguji bridge sendiri tanpa wiring.

Untuk wiring chain status sensor (wire kedua, titik tapping di **"Sensor Watchdog"** milik v5), lihat §8.

### 4. Aturan Percabangan Paralel (handoff §5.3) — Wajib Dipatuhi

**Bridge harus selalu berupa percabangan paralel.** Ketika satu output port memiliki beberapa wire, Node-RED menduplikasi pesan dan mengirimkannya secara independen ke setiap cabang. Karena itu:

- Meskipun API game mati (connection refused) atau mengembalikan 4xx/5xx, **hal ini tidak berpengaruh sama sekali pada jalur kontrol hardware (LCD/LED/buzzer/servo) maupun jalur penyimpanan Supabase.** Kegagalan hanya muncul di dalam cabang ini, sebagai pesan debug `Game API Response` (node http request diatur untuk menampilkan error sebagai pesan, dan bridge tidak memiliki catch node).
- Jangan pernah: menyisipkan node bridge **secara seri** di tengah jalur device command, antara `Build Unified Device Command` → `Build DB Operations`. Jika dilakukan, gangguan API bisa menghalangi kontrol hardware.
- `Build Game Event` mengganti `msg.payload` dengan game event, tetapi karena percabangan paralel bekerja pada pesan hasil duplikasi, hal ini tidak berpengaruh pada pesan di sisi v5.

### 5. Autentikasi (opsional)

- Jika environment variable `DEVICE_API_TOKEN` pada proses Node-RED sudah diset, `Build Game Event` akan otomatis menambahkan header `Authorization: Bearer <token>` (`env.get("DEVICE_API_TOKEN")` — cara yang sama seperti v5 membaca `SUPABASE_URL`).
- Nilainya harus sama dengan `DEVICE_API_TOKEN` di sisi game (`.env.local` atau environment variable Vercel). API game hanya memeriksa token jika token diset di sisinya, sehingga untuk prototipe lokal, mengosongkan keduanya membuat sistem berjalan tanpa autentikasi.
- Node-RED perlu di-restart setelah token diubah agar perubahannya berlaku.

### 6. Mengganti URL untuk Deployment Vercel

1. Double-click node `POST /api/device-events`.
2. Ubah URL dari `http://localhost:3000/api/device-events` menjadi `https://<your-app>.vercel.app/api/device-events` (harus `https`).
3. **Deploy**.
4. Pastikan `DEVICE_API_TOKEN` sisi game (jika dipakai) dan key Supabase sudah diset di environment variable project Vercel, lalu samakan `DEVICE_API_TOKEN` di sisi Node-RED dengan nilai yang sama.

### 7. Checklist Pengujian

Prasyarat: game server harus berjalan di `http://localhost:3000`, dan seed `plant-01` harus ada di Supabase (jika tidak, API mengembalikan 404 `unknown plantId`).

- [ ] **Uji bridge sendiri (sebelum wiring):** Di tab bridge, klik `TEST → Simulated State Change` → `Game API Response` menampilkan `{ ok: true, eventId: "evt-plant-01-…-dryair", duplicate: false, applied: true }`. Bisa juga diverifikasi lewat teks status di bawah node.
- [ ] **Uji toggle:** Klik inject yang sama lagi → kali ini muncul event `…-happy` (setiap klik bergantian Happy ↔ DryAir, eventId selalu baru).
- [ ] **Uji integrasi v5:** Setelah wiring sesuai §3, klik `TEST → Dry Air` di tab v5 → jika terjadi transisi status, `Game API Response` menampilkan `ok: true`. **Klik inject yang sama lagi secara berurutan → tidak ada yang terkirim** (`stateChanged: false` → bridge mengembalikan `null`).
- [ ] Klik `TEST → Happy` → event transisi `DryAir → Happy` terkirim.
- [ ] **Verifikasi isolasi (§5.3):** Dengan game server dimatikan, ubah status v5 → `Game API Response` mencatat connection error, tetapi `Final Command Preview` v5 dan penyimpanan Supabase (`DB Save Success`) tetap berjalan normal.
- [ ] **Uji autentikasi (jika memakai token):** Jika kedua token berbeda, pastikan muncul `statusCode: 401` / `{ ok: false, error: "unauthorized" }` → setelah token disamakan, berjalan normal.
- [ ] **Verifikasi tampil di game:** Di layar home PlantMoji, pastikan mood `plant-01` sudah berubah sesuai `currentState` yang dikirim.
- [ ] **Kasus restart:** Pastikan command pertama tepat setelah restart Node-RED (atau `RESET → Runtime State` milik v5) terkirim dengan `previousState: null`, dan API menerimanya dengan normal (`ok: true`).
- [ ] **Uji sensor offline/recovery (§8):** Setelah wiring sesuai §8, cabut serial feed dan putus data selama 30+ detik → pada watchdog tick berikutnya (paling lambat 30+10 detik kemudian), `SENSOR_OFFLINE` sampai **tepat satu kali** (`ok: true` di `Sensor Status API Response`; tidak ada pengiriman tambahan meskipun tick berulang tiap 10 detik). Pasang kembali feed → setelah data valid masuk, `SENSOR_ONLINE` sampai **tepat satu kali** pada tick berikutnya.
- [ ] **Verifikasi pengecualian laporan mingguan:** Pastikan interval offline di atas (antara `SENSOR_OFFLINE` dan `SENSOR_ONLINE`) dikecualikan dari waktu healthy pada laporan mingguan — walaupun mood tepat sebelum offline adalah Happy, interval tersebut tidak boleh ikut dihitung.

### 8. Chain Status Sensor — SENSOR_OFFLINE / SENSOR_ONLINE

Chain kedua yang melakukan tapping pada **sensor watchdog** milik v5 untuk mengirim transisi status konektivitas sensor ke API game. Karena laporan mingguan mengecualikan interval antara `SENSOR_OFFLINE` dan `SENSOR_ONLINE` dari waktu healthy (handoff §22·§45), event ini diperlukan agar periode offline tercermin secara akurat di laporan.

#### Perilaku Watchdog v5 (nilai terverifikasi dari kode v5 asli)

- `Watchdog Tick · 10s` (inject, `inj_watch`) menjalankan `Sensor Watchdog` (function, `fn_watch`) setiap 10 detik.
- `fn_watch` membandingkan `flow.lastSensorAt` (diperbarui oleh "Validate & Normalize Sensor Data" (`fn_validate`) setiap ada pembacaan sensor yang valid) dengan `sensorTimeoutSeconds` milik profil (30 detik pada profil demo) untuk menentukan status offline, dan melacak status sebelumnya lewat `flow.sensorOffline`.
- Pesan hanya dikirim **saat terjadi transisi**: saat masuk status offline, `{ type:"systemEvent", event:{ type:"sensorOffline", timestamp } }` (plus output LCD/LED/buzzer); saat recovery, `{ … "sensorRecovered" … }`. Pada tick yang berulang, fungsi mengembalikan `null`, sehingga tidak ada yang terkirim.
- `timestamp` adalah `Date.now()` milik `fn_watch` sendiri (epoch ms).
- Satu-satunya output node ini saat ini hanya menuju **1 tempat**: `System Event Preview` (debug, `dbg_system`).

#### Wiring — Titik Tapping Berbeda dari §3

Titik koneksinya adalah **satu-satunya output port (port 1)** dari function node v5 **"Sensor Watchdog"** (id: `fn_watch`).

1. Di tab bridge, copy (Ctrl+C) 3 node `Build Sensor Status Event`, `POST /api/device-events (sensor)`, `Sensor Status API Response`.
2. Tempel (Ctrl+V) ke tab v5 **"LeafTalk Core Flow v5 · DB Persistence"**.
3. **Tarik satu wire dari output port "Sensor Watchdog" ke input "Build Sensor Status Event"** untuk menambahkannya. Bridge menjadi **percabangan paralel ke-2** (biarkan wire `System Event Preview` yang sudah ada).
4. **Deploy**.

Aturan percabangan paralel di §4 (handoff §5.3) berlaku sama persis di sini — gangguan API game tidak boleh pernah menghalangi peringatan lokal watchdog (LCD "Sensor offline" / LED merah / buzzer) atau jalur v5 lainnya.

#### Body yang Dikirim

```json
{
  "eventId": "evt-plant-01-<timestamp>-sensor-offline",
  "plantId": "plant-01",
  "type": "SENSOR_OFFLINE",
  "occurredAt": "<timestamp dalam format ISO 8601 (…Z)>",
  "data": {}
}
```

Saat recovery, `eventId` berakhiran `…-sensor-online` dan `type`-nya `SENSOR_ONLINE`. `data` selalu berupa objek kosong.

#### Hanya Terkirim Saat Transisi (Anti-Spam)

- `fn_watch` milik v5 sendiri hanya mengirim saat transisi, tetapi karena `RESET · Runtime State` milik v5 (`fn_reset`) mereset `flow.sensorOffline` menjadi `false`, menekan RESET saat sensor masih mati bisa menyebabkan `sensorOffline` terkirim **sekali lagi** tanpa recovery sesungguhnya.
- Karena itu, `Build Sensor Status Event` melacak status terakhir yang dikirimnya sendiri lewat key milik bridge `flow.bridgeLastSensorStatus`, dan mengembalikan `null` (tidak mengirim apa pun) jika status yang sama akan berulang. **Tidak bergantung pada deduplikasi eventId milik API** (meskipun jika pengiriman ulang terjadi, `timestamp` yang sama menghasilkan `eventId` yang sama, sehingga API memprosesnya tanpa masalah).
- Tepat setelah restart Node-RED, `lastSensorAt` belum ada, sehingga `SENSOR_OFFLINE` terkirim satu kali pada tick pertama (~10 detik), dan `SENSOR_ONLINE` terkirim pada tick berikutnya setelah data sensor valid pertama masuk. Perilaku ini secara akurat mencerminkan status koneksi sebenarnya.

#### Autentikasi · URL

Sama persis dengan chain perubahan status — jika environment variable `DEVICE_API_TOKEN` (§5) diset, header `Authorization: Bearer` ditambahkan otomatis, dan saat berpindah ke Vercel (§6), URL node `POST /api/device-events (sensor)` diubah dengan cara yang sama.

#### Uji Mandiri (Sebelum Wiring)

Inject `TEST → Simulated Watchdog Event` di tab bridge memverifikasi chain ini sendiri, tanpa v5 — setiap klik bergantian antara `sensorOffline` dan `sensorRecovered`, sehingga setiap klik adalah transisi sungguhan. Klik pertama harus menampilkan event `…-sensor-offline`, dan klik berikutnya event `…-sensor-online`, keduanya dengan `ok: true` di `Sensor Status API Response`.

---

<a id="korean"></a>
## 🇰🇷 한국어

검증된 v5 흐름(`leaftalk_node_red_flow_v5_supabase_verified.json`, 탭 이름 **"LeafTalk Core Flow v5 · DB Persistence"**)의 상태 변화 감지 결과와 센서 연결 상태(워치독)를 PlantMoji 게임 API(`POST /api/device-events`)로 전달하는 브리지입니다.

**v5 흐름 자체는 절대 수정하지 않습니다.** 브리지는 별도 탭으로 import한 뒤, 에디터에서 체인당 병렬 와이어 1개씩만 손으로 추가해 연결합니다 (상태 변화 체인은 §3, 센서 상태 체인은 §8).

### 1. 브리지가 하는 일

v5의 통합 디바이스 커맨드(`msg.payload`)를 그대로 받아서:

- `payload.status.stateChanged === true`일 때만 (v5의 **State Change Detector**가 계산한 값) 게임 이벤트를 만들어 전송합니다.
- `stateChanged`가 `false`이면 `null`을 반환하므로, 상태가 그대로인 동안에는 API로 아무것도 나가지 않습니다.

전송되는 본문은 게임 쪽 `src/types/events.ts`의 `parseDeviceEvent` 계약을 그대로 따릅니다:

```json
{
  "eventId": "evt-plant-01-<timestamp>-<primaryState 소문자>",
  "plantId": "plant-01",
  "type": "PLANT_STATE_CHANGED",
  "occurredAt": "<timestamp의 ISO 8601 (…Z)>",
  "data": {
    "previousState": "<이전 상태 또는 null>",
    "currentState": "<현재 상태>",
    "temperature": 26.5,
    "humidity": 32,
    "light": 1,
    "soilPH": 6.5
  }
}
```

#### v5 → 게임 API 필드 매핑 (실제 v5 코드에서 확인한 값)

| v5 통합 커맨드 (`msg.payload`) | 게임 이벤트 | 비고 |
| --- | --- | --- |
| `timestamp` | `eventId`, `occurredAt` | v5 "Validate & Normalize Sensor Data"가 `Date.now()`(epoch ms)로 설정 |
| `status.stateChanged` | 전송 여부 게이트 | v5 "State Change Detector"(`fn_state_change`)가 계산 |
| `status.previousPrimaryState` | `data.previousState` | Node-RED 재시작·RESET 직후 첫 커맨드에서는 `null` — API가 허용함 |
| `status.primaryState` | `data.currentState` | 아래 무드 코드 참고 |
| `readings.temperature` | `data.temperature` | |
| `readings.humidity` | `data.humidity` | |
| `readings.light` | `data.light` | 0 또는 1 |
| `readings.soilPH` | `data.soilPH` | |

#### 무드 코드 확인 결과

v5 "Combine Plant State"(`fn_state`)가 만드는 `primaryState` 값은
`"Happy"`, `"Overheating"`, `"DryAir"`, `"Sleepy"`, `"SoilAcidic"`, `"SoilAlkaline"` 이며,
게임 쪽 `src/types/events.ts`의 `PLANT_MOODS`와 **철자까지 정확히 일치**합니다 (`"Dry Air"` 같은 띄어쓰기 변형 없음).
그래도 브리지의 "Build Game Event"는 API의 `normalizeMood()`와 동일한 규칙(공백/`_`/`-` 제거 후 대소문자 무시 비교)으로 한 번 더 정규화하므로, 나중에 v5 라벨이 바뀌어도 브리지가 깨지지 않습니다.

> 센서 연결 상태(`SENSOR_OFFLINE` / `SENSOR_ONLINE`)를 전달하는 **두 번째 체인**은 §8을 참고하세요. 태핑 지점이 다릅니다 (v5 워치독).

### 2. Import 방법

1. Node-RED 에디터 → 우측 상단 메뉴(☰) → **Import**.
2. `node-red/phase18-bridge-flow.json` 파일을 선택하거나 내용을 붙여넣기 → **Import**.
3. 새 탭 **"PlantMoji · Game API Bridge"** 가 생깁니다. 탭 안에는:
   - `TEST → Simulated State Change` (inject) → `Build Test Command (v5 shape)` — v5 없이 상태 변화 체인만 테스트하는 용도
   - **`Build Game Event` → `POST /api/device-events` → `Game API Response`** — 상태 변화 체인 (link 노드 없음, 수동 배선용)
   - `TEST → Simulated Watchdog Event` (inject) → `Build Test Watchdog Event (v5 shape)` — v5 없이 센서 상태 체인만 테스트하는 용도
   - **`Build Sensor Status Event` → `POST /api/device-events (sensor)` → `Sensor Status API Response`** — 센서 상태 체인 (§8)
4. **Deploy**.

### 3. v5에 연결하기 — 정확한 노드와 포트

연결 지점은 v5 탭의 function 노드 **"Build Unified Device Command"** (id: `fn_command`) 의 **유일한 출력 포트(1번)** 입니다.

- 왜 이 노드인가: State Change Detector(`fn_state_change`)가 계산한 `stateChanged` / `previousPrimaryState`가 `msg.payload.status` 안에 정리되어 담기는 지점이 바로 여기입니다. State Change Detector 출력을 직접 태핑하면 `msg.payload`가 아직 센서 읽기 형태라 브리지 입력 계약과 맞지 않습니다.
- 이 포트는 이미 `Final Command Preview`(debug), `Readings Log Preview`(debug), `Build DB Operations`(`fn_db_dispatch`) 3곳으로 팬아웃되어 있습니다. 브리지는 여기에 **4번째 병렬 와이어**로 추가합니다.

Node-RED는 탭 사이에 와이어를 그릴 수 없으므로 순서는 다음과 같습니다:

1. 브리지 탭에서 `Build Game Event`, `POST /api/device-events`, `Game API Response` 3개 노드를 선택하고 복사(Ctrl+C).
2. v5 탭 **"LeafTalk Core Flow v5 · DB Persistence"** 로 이동해 붙여넣기(Ctrl+V), 빈 자리에 배치.
3. **"Build Unified Device Command"의 출력 포트에서 "Build Game Event"의 입력으로 와이어 1개를 드래그**해서 추가. (기존 와이어 3개는 그대로 둡니다 — 아무것도 지우거나 끼워 넣지 않습니다.)
4. **Deploy**.

브리지 탭에 남은 원본 체인과 TEST 인젝트는 그대로 두면 배선 없이 브리지 자체 테스트용으로 계속 쓸 수 있습니다.

센서 상태 체인의 배선(두 번째 와이어, 태핑 지점은 v5 **"Sensor Watchdog"**)은 §8을 참고하세요.

### 4. 병렬 분기 규칙 (handoff §5.3) — 반드시 지킬 것

**브리지는 반드시 병렬 분기여야 합니다.** Node-RED는 한 출력 포트에 여러 와이어가 있으면 메시지를 복제해서 각 분기에 독립적으로 전달합니다. 따라서:

- 게임 API가 죽어 있거나(연결 거부), 4xx/5xx를 돌려줘도 **하드웨어 제어 경로(LCD/LED/부저/서보)와 Supabase 저장 경로에는 어떤 영향도 없습니다.** 실패는 이 분기 안에서 `Game API Response` 디버그 메시지로만 표시됩니다 (http request 노드가 오류를 메시지로 출력하도록 설정되어 있고, 브리지에는 catch 노드도 없습니다).
- 절대 하지 말 것: 브리지 노드를 `Build Unified Device Command` → `Build DB Operations` 사이나 디바이스 커맨드 경로 **중간에 직렬로** 끼워 넣는 것. 그렇게 하면 API 장애가 하드웨어 제어를 막게 됩니다.
- `Build Game Event`는 `msg.payload`를 게임 이벤트로 교체하지만, 병렬 분기에서는 메시지가 복제본이므로 v5 쪽 메시지에는 영향이 없습니다.

### 5. 인증 (선택)

- Node-RED 프로세스 환경변수 `DEVICE_API_TOKEN`이 설정되어 있으면 `Build Game Event`가 `Authorization: Bearer <토큰>` 헤더를 자동으로 붙입니다 (`env.get("DEVICE_API_TOKEN")` — v5가 `SUPABASE_URL`을 읽는 방식과 동일).
- 게임 쪽(`.env.local` 또는 Vercel 환경변수)의 `DEVICE_API_TOKEN`과 값이 같아야 합니다. 게임 API는 자기 쪽에 토큰이 설정된 경우에만 검사하므로, 로컬 프로토타입에서는 양쪽 다 비워 두면 인증 없이 동작합니다.
- 토큰 변경 후에는 Node-RED를 재시작해야 반영됩니다.

### 6. Vercel 배포로 URL 전환

1. `POST /api/device-events` 노드 더블클릭.
2. URL을 `http://localhost:3000/api/device-events` 에서
   `https://<your-app>.vercel.app/api/device-events` 로 변경 (반드시 `https`).
3. **Deploy**.
4. Vercel 프로젝트 환경변수에 게임 쪽 `DEVICE_API_TOKEN`(사용하는 경우)과 Supabase 키가 설정되어 있는지 확인하고, Node-RED 쪽 `DEVICE_API_TOKEN`을 같은 값으로 맞춥니다.

### 7. 테스트 체크리스트

사전 준비: 게임 서버가 `http://localhost:3000` 에서 실행 중이고, Supabase에 `plant-01` 시드가 있어야 합니다 (없으면 API가 404 `unknown plantId` 반환).

- [ ] **브리지 단독 테스트 (배선 전):** 브리지 탭에서 `TEST → Simulated State Change` 클릭 → `Game API Response`에 `{ ok: true, eventId: "evt-plant-01-…-dryair", duplicate: false, applied: true }` 표시. 노드 아래 상태 텍스트로도 확인 가능.
- [ ] **토글 테스트:** 같은 inject를 다시 클릭 → 이번엔 `…-happy` 이벤트 (매 클릭마다 Happy ↔ DryAir 전환, eventId는 항상 새로움).
- [ ] **v5 연동 테스트:** §3대로 배선 후, v5 탭의 `TEST → Dry Air` inject 클릭 → 상태 전환이면 `Game API Response`에 `ok: true`. **같은 inject를 연달아 다시 클릭 → 아무것도 전송되지 않음** (`stateChanged: false` → 브리지가 `null` 반환).
- [ ] `TEST → Happy` 클릭 → `DryAir → Happy` 전환 이벤트 전송.
- [ ] **격리(§5.3) 검증:** 게임 서버를 끈 상태에서 v5 상태를 전환 → `Game API Response`에 연결 오류가 찍히지만, v5의 `Final Command Preview`와 Supabase 저장(`DB Save Success`)은 평소처럼 동작.
- [ ] **인증 테스트 (토큰 사용 시):** 양쪽 토큰이 다르면 `statusCode: 401` / `{ ok: false, error: "unauthorized" }` 확인 → 토큰을 맞추면 정상.
- [ ] **게임 반영 확인:** PlantMoji 홈 화면에서 `plant-01`의 무드가 전송한 `currentState`로 바뀌었는지 확인.
- [ ] **재시작 케이스:** Node-RED 재시작(또는 v5의 `RESET → Runtime State`) 직후 첫 커맨드는 `previousState: null`로 전송되며 API가 정상 수리(`ok: true`)하는지 확인.
- [ ] **센서 오프라인/복구 테스트 (§8):** §8대로 배선 후, 시리얼 피드를 뽑아 30초 이상 데이터를 끊는다 → 다음 워치독 틱(최대 30+10초 후)에 `SENSOR_OFFLINE`이 **딱 1번** 도착 (`Sensor Status API Response`에 `ok: true`; 틱이 10초마다 반복돼도 추가 전송 없음). 피드를 다시 꽂으면 → 유효 데이터 도착 후 다음 틱에 `SENSOR_ONLINE`이 **딱 1번** 도착.
- [ ] **주간 리포트 제외 확인:** 위 오프라인 구간(`SENSOR_OFFLINE` ~ `SENSOR_ONLINE` 사이)이 주간 리포트의 healthy 시간에서 제외되는지 확인 — 오프라인 직전 무드가 Happy였더라도 그 구간은 집계되지 않아야 합니다.

### 8. 센서 상태 체인 — SENSOR_OFFLINE / SENSOR_ONLINE

v5의 **센서 워치독**을 태핑해 센서 연결 상태 전환을 게임 API로 전달하는 두 번째 체인입니다. 주간 리포트는 `SENSOR_OFFLINE` ~ `SENSOR_ONLINE` 사이 구간을 healthy 시간에서 제외하므로 (handoff §22·§45), 이 이벤트가 있어야 오프라인 기간이 리포트에 정확히 반영됩니다.

#### v5 워치독 동작 (실제 v5 코드에서 확인한 값)

- `Watchdog Tick · 10s`(inject, `inj_watch`)가 10초마다 `Sensor Watchdog`(function, `fn_watch`)을 실행합니다.
- `fn_watch`는 `flow.lastSensorAt`("Validate & Normalize Sensor Data"(`fn_validate`)가 유효 센서 데이터마다 갱신)과 프로필의 `sensorTimeoutSeconds`(데모 프로필 30초)를 비교해 오프라인 여부를 판정하고, `flow.sensorOffline`으로 이전 상태를 추적합니다.
- **전환에서만** 메시지를 방출합니다: 오프라인 진입 시 `{ type:"systemEvent", event:{ type:"sensorOffline", timestamp } }` (+ LCD/LED/부저 출력), 복구 시 `{ … "sensorRecovered" … }`. 반복 틱에서는 `null`을 반환하므로 아무것도 나가지 않습니다.
- `timestamp`는 `fn_watch`가 찍는 `Date.now()`(epoch ms)입니다.
- 이 노드의 유일한 출력은 현재 `System Event Preview`(debug, `dbg_system`) **1곳으로만** 나갑니다.

#### 배선 — 태핑 지점이 §3과 다릅니다

연결 지점은 v5 function 노드 **"Sensor Watchdog"** (id: `fn_watch`) 의 **유일한 출력 포트(1번)** 입니다.

1. 브리지 탭에서 `Build Sensor Status Event`, `POST /api/device-events (sensor)`, `Sensor Status API Response` 3개 노드를 복사(Ctrl+C).
2. v5 탭 **"LeafTalk Core Flow v5 · DB Persistence"** 에 붙여넣기(Ctrl+V).
3. **"Sensor Watchdog"의 출력 포트에서 "Build Sensor Status Event"의 입력으로 와이어 1개를 드래그**해서 추가. 브리지는 **2번째 병렬 분기**가 됩니다 (기존 `System Event Preview` 와이어는 그대로 둡니다).
4. **Deploy**.

§4의 병렬 분기 규칙(handoff §5.3)이 그대로 적용됩니다 — 게임 API 장애가 워치독의 로컬 경고(LCD "Sensor offline" / 빨간 LED / 부저)나 다른 v5 경로를 절대 막지 않습니다.

#### 전송 본문

```json
{
  "eventId": "evt-plant-01-<timestamp>-sensor-offline",
  "plantId": "plant-01",
  "type": "SENSOR_OFFLINE",
  "occurredAt": "<timestamp의 ISO 8601 (…Z)>",
  "data": {}
}
```

복구 시에는 `eventId`가 `…-sensor-online`, `type`이 `SENSOR_ONLINE`입니다. `data`는 항상 빈 객체입니다.

#### 전환에서만 전송 (스팸 방지)

- v5 `fn_watch` 자체가 전환에서만 방출하지만, v5의 `RESET · Runtime State`(`fn_reset`)가 `flow.sensorOffline`을 `false`로 초기화하기 때문에, 센서가 계속 죽어 있는 상태에서 RESET을 누르면 복구 없이 `sensorOffline`이 **한 번 더** 방출될 수 있습니다.
- 그래서 `Build Sensor Status Event`는 마지막으로 전송한 상태를 브리지 소유 키 `flow.bridgeLastSensorStatus`로 자체 추적하고, 같은 상태가 반복되면 `null`을 반환해 아무것도 보내지 않습니다. **API의 eventId 중복 제거에 의존하지 않습니다** (물론 재전송이 일어나도 같은 `timestamp`면 eventId가 같아 API가 무해하게 처리합니다).
- Node-RED 재시작 직후에는 `lastSensorAt`이 없어 첫 틱(~10초)에 `SENSOR_OFFLINE`이 1번 전송되고, 첫 유효 센서 데이터 이후 다음 틱에 `SENSOR_ONLINE`이 전송됩니다. 실제 연결 상태를 정확히 반영하는 동작입니다.

#### 인증 · URL

상태 변화 체인과 완전히 동일합니다 — `DEVICE_API_TOKEN` 환경변수(§5)가 있으면 `Authorization: Bearer` 헤더가 자동으로 붙고, Vercel 전환(§6) 시 `POST /api/device-events (sensor)` 노드의 URL도 같은 방법으로 바꿉니다.

#### 단독 테스트 (배선 전)

브리지 탭의 `TEST → Simulated Watchdog Event` 인젝트는 v5 없이 이 체인만 검증합니다 — 클릭마다 `sensorOffline` ↔ `sensorRecovered`를 번갈아 만들어 매번 진짜 전환이 되게 합니다. 첫 클릭에 `…-sensor-offline`, 다음 클릭에 `…-sensor-online` 이벤트가 `Sensor Status API Response`에 `ok: true`로 표시되어야 합니다.
