# PlantMoji · Node-RED 게임 API 브리지 (Phase 18)

검증된 v5 흐름(`leaftalk_node_red_flow_v5_supabase_verified.json`, 탭 이름 **"LeafTalk Core Flow v5 · DB Persistence"**)의 상태 변화 감지 결과를 PlantMoji 게임 API(`POST /api/device-events`)로 전달하는 브리지입니다.

**v5 흐름 자체는 절대 수정하지 않습니다.** 브리지는 별도 탭으로 import한 뒤, 에디터에서 와이어 1개만 손으로 추가해 연결합니다.

## 1. 브리지가 하는 일

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

### v5 → 게임 API 필드 매핑 (실제 v5 코드에서 확인한 값)

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

### 무드 코드 확인 결과

v5 "Combine Plant State"(`fn_state`)가 만드는 `primaryState` 값은
`"Happy"`, `"Overheating"`, `"DryAir"`, `"Sleepy"`, `"SoilAcidic"`, `"SoilAlkaline"` 이며,
게임 쪽 `src/types/events.ts`의 `PLANT_MOODS`와 **철자까지 정확히 일치**합니다 (`"Dry Air"` 같은 띄어쓰기 변형 없음).
그래도 브리지의 "Build Game Event"는 API의 `normalizeMood()`와 동일한 규칙(공백/`_`/`-` 제거 후 대소문자 무시 비교)으로 한 번 더 정규화하므로, 나중에 v5 라벨이 바뀌어도 브리지가 깨지지 않습니다.

## 2. Import 방법

1. Node-RED 에디터 → 우측 상단 메뉴(☰) → **Import**.
2. `node-red/phase18-bridge-flow.json` 파일을 선택하거나 내용을 붙여넣기 → **Import**.
3. 새 탭 **"PlantMoji · Game API Bridge"** 가 생깁니다. 탭 안에는:
   - `TEST → Simulated State Change` (inject) → `Build Test Command (v5 shape)` — v5 없이 브리지만 테스트하는 용도
   - **`Build Game Event` → `POST /api/device-events` → `Game API Response`** — 실제 브리지 체인 (link 노드 없음, 수동 배선용)
4. **Deploy**.

## 3. v5에 연결하기 — 정확한 노드와 포트

연결 지점은 v5 탭의 function 노드 **"Build Unified Device Command"** (id: `fn_command`) 의 **유일한 출력 포트(1번)** 입니다.

- 왜 이 노드인가: State Change Detector(`fn_state_change`)가 계산한 `stateChanged` / `previousPrimaryState`가 `msg.payload.status` 안에 정리되어 담기는 지점이 바로 여기입니다. State Change Detector 출력을 직접 태핑하면 `msg.payload`가 아직 센서 읽기 형태라 브리지 입력 계약과 맞지 않습니다.
- 이 포트는 이미 `Final Command Preview`(debug), `Readings Log Preview`(debug), `Build DB Operations`(`fn_db_dispatch`) 3곳으로 팬아웃되어 있습니다. 브리지는 여기에 **4번째 병렬 와이어**로 추가합니다.

Node-RED는 탭 사이에 와이어를 그릴 수 없으므로 순서는 다음과 같습니다:

1. 브리지 탭에서 `Build Game Event`, `POST /api/device-events`, `Game API Response` 3개 노드를 선택하고 복사(Ctrl+C).
2. v5 탭 **"LeafTalk Core Flow v5 · DB Persistence"** 로 이동해 붙여넣기(Ctrl+V), 빈 자리에 배치.
3. **"Build Unified Device Command"의 출력 포트에서 "Build Game Event"의 입력으로 와이어 1개를 드래그**해서 추가. (기존 와이어 3개는 그대로 둡니다 — 아무것도 지우거나 끼워 넣지 않습니다.)
4. **Deploy**.

브리지 탭에 남은 원본 체인과 TEST 인젝트는 그대로 두면 배선 없이 브리지 자체 테스트용으로 계속 쓸 수 있습니다.

## 4. 병렬 분기 규칙 (handoff §5.3) — 반드시 지킬 것

**브리지는 반드시 병렬 분기여야 합니다.** Node-RED는 한 출력 포트에 여러 와이어가 있으면 메시지를 복제해서 각 분기에 독립적으로 전달합니다. 따라서:

- 게임 API가 죽어 있거나(연결 거부), 4xx/5xx를 돌려줘도 **하드웨어 제어 경로(LCD/LED/부저/서보)와 Supabase 저장 경로에는 어떤 영향도 없습니다.** 실패는 이 분기 안에서 `Game API Response` 디버그 메시지로만 표시됩니다 (http request 노드가 오류를 메시지로 출력하도록 설정되어 있고, 브리지에는 catch 노드도 없습니다).
- 절대 하지 말 것: 브리지 노드를 `Build Unified Device Command` → `Build DB Operations` 사이나 디바이스 커맨드 경로 **중간에 직렬로** 끼워 넣는 것. 그렇게 하면 API 장애가 하드웨어 제어를 막게 됩니다.
- `Build Game Event`는 `msg.payload`를 게임 이벤트로 교체하지만, 병렬 분기에서는 메시지가 복제본이므로 v5 쪽 메시지에는 영향이 없습니다.

## 5. 인증 (선택)

- Node-RED 프로세스 환경변수 `DEVICE_API_TOKEN`이 설정되어 있으면 `Build Game Event`가 `Authorization: Bearer <토큰>` 헤더를 자동으로 붙입니다 (`env.get("DEVICE_API_TOKEN")` — v5가 `SUPABASE_URL`을 읽는 방식과 동일).
- 게임 쪽(`.env.local` 또는 Vercel 환경변수)의 `DEVICE_API_TOKEN`과 값이 같아야 합니다. 게임 API는 자기 쪽에 토큰이 설정된 경우에만 검사하므로, 로컬 프로토타입에서는 양쪽 다 비워 두면 인증 없이 동작합니다.
- 토큰 변경 후에는 Node-RED를 재시작해야 반영됩니다.

## 6. Vercel 배포로 URL 전환

1. `POST /api/device-events` 노드 더블클릭.
2. URL을 `http://localhost:3000/api/device-events` 에서
   `https://<your-app>.vercel.app/api/device-events` 로 변경 (반드시 `https`).
3. **Deploy**.
4. Vercel 프로젝트 환경변수에 게임 쪽 `DEVICE_API_TOKEN`(사용하는 경우)과 Supabase 키가 설정되어 있는지 확인하고, Node-RED 쪽 `DEVICE_API_TOKEN`을 같은 값으로 맞춥니다.

## 7. 테스트 체크리스트

사전 준비: 게임 서버가 `http://localhost:3000` 에서 실행 중이고, Supabase에 `plant-01` 시드가 있어야 합니다 (없으면 API가 404 `unknown plantId` 반환).

- [ ] **브리지 단독 테스트 (배선 전):** 브리지 탭에서 `TEST → Simulated State Change` 클릭 → `Game API Response`에 `{ ok: true, eventId: "evt-plant-01-…-dryair", duplicate: false, applied: true }` 표시. 노드 아래 상태 텍스트로도 확인 가능.
- [ ] **토글 테스트:** 같은 inject를 다시 클릭 → 이번엔 `…-happy` 이벤트 (매 클릭마다 Happy ↔ DryAir 전환, eventId는 항상 새로움).
- [ ] **v5 연동 테스트:** §3대로 배선 후, v5 탭의 `TEST → Dry Air` inject 클릭 → 상태 전환이면 `Game API Response`에 `ok: true`. **같은 inject를 연달아 다시 클릭 → 아무것도 전송되지 않음** (`stateChanged: false` → 브리지가 `null` 반환).
- [ ] `TEST → Happy` 클릭 → `DryAir → Happy` 전환 이벤트 전송.
- [ ] **격리(§5.3) 검증:** 게임 서버를 끈 상태에서 v5 상태를 전환 → `Game API Response`에 연결 오류가 찍히지만, v5의 `Final Command Preview`와 Supabase 저장(`DB Save Success`)은 평소처럼 동작.
- [ ] **인증 테스트 (토큰 사용 시):** 양쪽 토큰이 다르면 `statusCode: 401` / `{ ok: false, error: "unauthorized" }` 확인 → 토큰을 맞추면 정상.
- [ ] **게임 반영 확인:** PlantMoji 홈 화면에서 `plant-01`의 무드가 전송한 `currentState`로 바뀌었는지 확인.
- [ ] **재시작 케이스:** Node-RED 재시작(또는 v5의 `RESET → Runtime State`) 직후 첫 커맨드는 `previousState: null`로 전송되며 API가 정상 수리(`ok: true`)하는지 확인.
