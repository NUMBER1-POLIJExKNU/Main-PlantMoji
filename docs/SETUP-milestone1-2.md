# LeafTalk · Milestone 1–2 설정 가이드

> **Arduino senses → Node-RED decides → Next.js game engine rewards → Supabase remembers → Web app visualizes.**

이 문서는 인수인계 문서 §47의 첫 수직 슬라이스를 실행하는 방법입니다:

```text
Node-RED TEST · Overheating
→ POST /api/device-events
→ Next.js가 이벤트 검증
→ Supabase에 기록
→ 브라우저에서 Jin이 Happy → Overheating으로 새로고침 없이 변경
```

Quest / XP / AI / UI 폴리시는 **아직 구현 대상이 아닙니다** (Milestone 1·2 안정화 후 진행).

---

## 1. Supabase 설정

1. 기존 LeafTalk Supabase 프로젝트 대시보드 접속 (Node-RED v5가 쓰는 프로젝트 그대로 사용)
2. **SQL Editor** → `supabase/milestone1.sql` 내용 붙여넣기 → **Run**
   - 기존 v5 테이블(sensor_readings 등)은 건드리지 않는 **추가 전용** 스크립트이며, 두 번 실행해도 안전합니다.
   - 생성되는 것: `plants` 테이블(+ Jin 시드), `device_events` 테이블, 읽기 전용 RLS 정책, Realtime 발행 설정
3. **Project Settings → API**에서 키 3개 확인:
   - Project URL
   - Publishable key (`sb_publishable_...`) — 브라우저용, 읽기 전용
   - Secret key (`sb_secret_...`) — 서버 전용, **절대 브라우저/프론트 코드에 노출 금지**

## 2. 환경 변수

```powershell
Copy-Item .env.local.example .env.local
```

`.env.local`을 열어 값 입력:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
DEVICE_API_TOKEN=          # 선택. 설정하면 Node-RED도 같은 값을 보내야 함
```

## 3. 실행

```powershell
npm install
npm run dev
```

`http://localhost:3000` 접속:

- env 미설정 → "Connecting..." 안내 화면
- SQL 미실행 → "plant-01 데이터가 없습니다" 안내 화면
- 정상 → **Jin · Happy** 홈 화면 + 좌하단 LIVE 표시

## 4. API 스펙 — `POST /api/device-events`

요청 (Node-RED → Next.js):

```json
{
  "eventId": "evt-plant-01-1754550000000-overheating",
  "plantId": "plant-01",
  "type": "PLANT_STATE_CHANGED",
  "occurredAt": "2026-08-07T12:00:00+07:00",
  "data": {
    "previousState": "Happy",
    "currentState": "Overheating",
    "temperature": 34.2
  }
}
```

- `type` 허용값: `PLANT_STATE_CHANGED`, `PLANT_RECOVERED`, `SENSOR_OFFLINE`, `SENSOR_ONLINE`
  (게임 이벤트 QUEST_*/XP_* 등은 게임 엔진이 만들며, 이 API로 받지 않음 — 인수인계 Correction 3)
- `data.currentState` 허용값: `Happy`, `Overheating`, `DryAir`, `Sleepy`, `SoilAcidic`, `SoilAlkaline`
  (`"Dry Air"`처럼 띄어쓰기가 있어도 자동 정규화됨)
- `DEVICE_API_TOKEN`을 설정한 경우 헤더 필요: `Authorization: Bearer <토큰>`

응답:

| 상태 | 의미 |
|---|---|
| `200 {ok:true, duplicate:false, applied:true}` | 정상 처리, 화면 상태 갱신됨 |
| `200 {ok:true, duplicate:true, ...}` | 같은 `eventId` 재전송 — 저장/보상 없이 무시 (멱등성, §28) |
| `200 {..., applied:false}` | 더 새로운 상태가 이미 반영되어 있어 이 이벤트는 상태를 덮어쓰지 않음 |
| `400` | JSON/필드 검증 실패 (`error`에 이유) |
| `401` | 토큰 불일치 |
| `404` | 모르는 `plantId` |
| `500` | DB 오류 (예: milestone1.sql 미실행, Supabase 장애) — 서버 로그의 `device-events: ...` 메시지 확인 |
| `503` | 서버 env 미설정 |

## 5. 손으로 먼저 테스트 (Node-RED 없이)

PowerShell:

```powershell
$body = @{
  eventId    = "evt-test-$(Get-Date -UFormat %s)"
  plantId    = "plant-01"
  type       = "PLANT_STATE_CHANGED"
  occurredAt = (Get-Date).ToString("o")
  data       = @{ previousState = "Happy"; currentState = "Overheating"; temperature = 34.2 }
} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/device-events -Method Post -ContentType "application/json" -Body $body
```

curl (Git Bash / macOS):

```bash
curl -X POST http://localhost:3000/api/device-events \
  -H "Content-Type: application/json" \
  -d '{"eventId":"evt-test-1","plantId":"plant-01","type":"PLANT_STATE_CHANGED","occurredAt":"2026-08-07T12:00:00+07:00","data":{"currentState":"Overheating"}}'
```

브라우저를 열어 둔 채 실행하면 **새로고침 없이** Jin이 Overheating(🔥)으로 바뀌어야 합니다.
같은 명령을 그대로 한 번 더 보내면 `duplicate:true`가 와야 합니다 (같은 eventId).

## 6. Node-RED 연동

### 6.1 HTTP Request 노드 설정

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://localhost:3000/api/device-events` (같은 노트북에서 실행 시) |
| Payload | `msg.payload` (JSON 객체 그대로 — Node-RED가 JSON으로 전송) |
| Return | a parsed JSON object |
| Headers | Function 노드에서 `msg.headers`로 설정 (아래 참고) |

### 6.2 테스트 플로우 임포트 (검증된 v5 플로우와 별개의 새 탭)

Node-RED 메뉴 → Import → 아래 JSON 붙여넣기:

```json
[
  { "id": "lt-tab-1", "type": "tab", "label": "LeafTalk · TEST → Game API", "disabled": false, "info": "Milestone 1-2 vertical slice test. Does NOT touch the verified v5 flow." },
  { "id": "lt-inject-overheat", "type": "inject", "z": "lt-tab-1", "name": "TEST · Overheating", "props": [{ "p": "payload" }], "repeat": "", "crontab": "", "once": false, "onceDelay": 0.1, "topic": "", "payload": "Overheating", "payloadType": "str", "x": 170, "y": 80, "wires": [["lt-build-event"]] },
  { "id": "lt-inject-happy", "type": "inject", "z": "lt-tab-1", "name": "TEST · Happy", "props": [{ "p": "payload" }], "repeat": "", "crontab": "", "once": false, "onceDelay": 0.1, "topic": "", "payload": "Happy", "payloadType": "str", "x": 150, "y": 140, "wires": [["lt-build-event"]] },
  { "id": "lt-inject-dryair", "type": "inject", "z": "lt-tab-1", "name": "TEST · DryAir", "props": [{ "p": "payload" }], "repeat": "", "crontab": "", "once": false, "onceDelay": 0.1, "topic": "", "payload": "DryAir", "payloadType": "str", "x": 150, "y": 200, "wires": [["lt-build-event"]] },
  { "id": "lt-build-event", "type": "function", "z": "lt-tab-1", "name": "Build PLANT_STATE_CHANGED", "func": "const state = msg.payload;\nconst now = new Date().toISOString();\nmsg.payload = {\n    eventId: \"evt-plant-01-\" + Date.now() + \"-\" + state.toLowerCase(),\n    plantId: \"plant-01\",\n    type: \"PLANT_STATE_CHANGED\",\n    occurredAt: now,\n    data: {\n        previousState: flow.get(\"lastState\") || null,\n        currentState: state\n    }\n};\nflow.set(\"lastState\", state);\nmsg.headers = { \"Content-Type\": \"application/json\" };\nconst token = env.get(\"DEVICE_API_TOKEN\");\nif (token) {\n    msg.headers.Authorization = \"Bearer \" + token;\n}\nreturn msg;", "outputs": 1, "timeout": 0, "noerr": 0, "initialize": "", "finalize": "", "libs": [], "x": 430, "y": 140, "wires": [["lt-post-game-api"]] },
  { "id": "lt-post-game-api", "type": "http request", "z": "lt-tab-1", "name": "POST /api/device-events", "method": "POST", "ret": "obj", "paytoqs": "ignore", "url": "http://localhost:3000/api/device-events", "tls": "", "persist": false, "proxy": "", "insecureHTTPParser": false, "authType": "", "senderr": false, "headers": [], "x": 690, "y": 140, "wires": [["lt-debug"]] },
  { "id": "lt-debug", "type": "debug", "z": "lt-tab-1", "name": "Game API response", "active": true, "tosidebar": true, "console": false, "tostatus": true, "complete": "payload", "targetType": "msg", "statusVal": "payload.ok", "statusType": "auto", "x": 920, "y": 140, "wires": [] }
]
```

`TEST · Overheating` 인젝트 버튼 클릭 → debug 창에 `{ok: true, duplicate: false, applied: true}` → 브라우저의 Jin이 🔥 Overheating으로 변경.

`DEVICE_API_TOKEN`을 쓰는 경우 Node-RED 실행 전에:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
$env:SUPABASE_SECRET_KEY="sb_secret_..."
$env:DEVICE_API_TOKEN="같은_값"
node-red
```

### 6.3 실제 v5 플로우 연결 (Phase 18에서)

검증된 v5 플로우의 **State Change Detection** 출력에 위의 `Build PLANT_STATE_CHANGED` function → `http request` 체인을 병렬로 연결하면 됩니다 (기존 하드웨어/안전 로직 와이어는 수정하지 않음). 그때 function 입력만 v5의 상태 메시지 형식에 맞게 조정하세요. 인수인계 원칙: **로컬 제어는 API 실패와 무관하게 계속 동작해야 함** — http request 실패가 하드웨어 분기에 영향을 주지 않도록 별도 분기로만 연결합니다.

## 7. 인수 기준 체크리스트 (§40 Vertical Slice 1)

```text
□ Next.js 프로젝트 실행됨 (localhost:3000)
□ Supabase 연결됨 (Jin · Happy 홈 화면 표시)
□ plants / device_events 테이블 존재
□ POST /api/device-events 동작 (5장 수동 테스트)
□ Node-RED 테스트 플로우가 API 호출 성공
□ 웹 Mood가 새로고침 없이 실시간 변경
□ 같은 eventId 재전송 시 duplicate:true (중복 저장 없음)
```

## 8. 다음 단계 (이 슬라이스가 안정된 후에만)

Quest Engine → Quest 검증 → XP → Bond Level (인수인계 Phase 5–9).
게임 진행(XP)은 **Next.js 백엔드가 단일 소스**가 될 예정이며, Node-RED의 기존 XP 분기는 백엔드 XP 엔진이 검증된 후에 비활성화합니다 (Correction 1).
