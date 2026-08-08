# Raw sensor API for the new Node-RED flow

The new flow sends calibrated sensor values only. Vercel stores the sample,
loads the selected crop profile, applies hysteresis, detects a mood change,
and then runs the existing quest/XP/badge/story engine.

## Endpoint

```text
POST https://main-plant-moji.vercel.app/api/sensor-readings
Content-Type: application/json
Authorization: Bearer <DEVICE_API_TOKEN>   # only when configured in Vercel
```

`POST /api/device-events` accepts the same flat payload for compatibility,
but `/api/sensor-readings` is the recommended URL for the new flow. The old
semantic-event envelope remains supported.

## Request

```json
{
  "readingId": "plant-01-1723075200000",
  "plantId": "plant-01",
  "temperature": 23.5,
  "humidity": 55,
  "soilPH": 6.1,
  "light": 1,
  "timestamp": 1723075200000
}
```

- All four sensor fields are required JSON numbers.
- `light` is binary: `1 = bright`, `0 = dark`.
- `timestamp` is optional and may be epoch milliseconds or ISO 8601 with a
  timezone. When omitted, Vercel receipt time is used.
- `readingId` is optional but strongly recommended. Reusing it makes a
  Node-RED retry idempotent. Maximum length is 96 characters.
- `soilPh` is accepted as an alias, but `soilPH` is the canonical wire name.

## Node-RED function before the HTTP Request node

```js
const d = msg.payload;
const ts = Number(d.timestamp) || Date.now();

msg.payload = {
  readingId: "plant-01-" + ts,
  plantId: "plant-01",
  temperature: Number(d.temperature),
  humidity: Number(d.humidity),
  soilPH: Number(d.soilPH),
  light: Number(d.light),
  timestamp: ts
};

msg.headers = { "Content-Type": "application/json" };
const token = env.get("DEVICE_API_TOKEN");
if (token) msg.headers.Authorization = "Bearer " + token;
return msg;
```

The HTTP Request node method is `POST`, return type is parsed JSON, and its URL
is the endpoint above. Deploy `supabase/milestone9-raw-sensor-ingest.sql`
before switching the flow.

## Response

```json
{
  "ok": true,
  "contract": "raw-sensor-v1",
  "readingId": "plant-01-1723075200000",
  "recordedAt": "2024-08-08T00:00:00.000Z",
  "cropProfileKey": "strawberry",
  "cropProfileVersion": 1,
  "mood": "Happy",
  "previousMood": "Happy",
  "stateChanged": false,
  "eventId": null,
  "duplicateReading": false
}
```

## Responsibility boundary

- Arduino: reads sensors only.
- Node-RED: calibration, numeric normalization, retry queue, and POST.
- Vercel: database write, crop thresholds/hysteresis, mood transition, quests,
  XP, badges, and story progress.
- Browser: display only. It never decides sensor truth or rewards.
