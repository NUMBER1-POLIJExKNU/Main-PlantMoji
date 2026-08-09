# Sensor HUD stat cards — design spec (2026-08-09)

## Goal

Replace the thin env-strip line on the farm home (My Garden) with four big
game-HUD stat tiles (temperature, humidity, light, soil pH) — Pokémon
stat-bar energy, pixel-farm skin. User picked this direction over the
greenhouse-panel / diegetic / heart-meter concepts (2026-08-09).

## Layout

- 2×2 pm-panel tile grid in the env-strip's current slot; 4×1 row on
  ≥801px (desktop rail). Tiles are the dominant secondary element after the
  mascot — value typography roughly 2× the current strip.
- Each tile: pixel icon + localized label (strings.js: SUHU/UDARA/CAHAYA/
  TANAH for id; TEMP/HUMIDITY/LIGHT/SOIL for en) + big real reading +
  segmented 10-cell comfort gauge with the comfort band highlighted and a
  position marker at the current value + a "쾌적 ✓ / comfort" state line.

## Behavior (display-only, sensor truth preserved)

- The REAL number is always visible — gauges decorate, never replace.
- **Explicit suitable-range labels** (user request 2026-08-09): each tile
  shows the numeric optimal range under the gauge — e.g. "적정 18–26°C" /
  "Ideal 18–26°C" / "Ideal 60–85%" / "pH 5.5–6.8" / "Cahaya 40–80%" — so a
  student can compare the big reading against the target at a glance.
- **Single source of truth for ranges**: the numbers come from the ACTIVE
  crop profile's `evaluation_policy` (the same thresholds the engine uses
  for mood/quest decisions — e.g. soybean overheating enter ≥33 / recover
  ≤30, dry-air enter <24 / recover ≥29), fetched through the existing
  `/api/crop-profile` (or `/api/public-config`) endpoint, cached, refreshed
  with the normal poll. Never hand-typed display numbers: if the profile
  changes, the UI and the engine change together. Display rule: show the
  comfortable band (recover-side thresholds), one clean line per sensor.
  Light uses the calibrated 0-100% scale from milestone15. If the endpoint
  is unavailable, the range line hides (no invented numbers) and the gauge
  falls back to a neutral, band-less bar.
- Out-of-comfort: that tile pulses in the matching mood color, synced with
  the mascot's face state (same source: the mood from plant state — never a
  client-side re-derivation). `prefers-reduced-motion`: static highlight,
  no pulse.
- Staleness honesty (design-audit follow-up): reading older than ~10 min →
  tile dims and shows "terakhir 14:32 / last 14:32" under the value.
- Existing interactions survive: tiles keep the pressable-vitals tap
  behavior (why-chips) and remain keyboard-activatable; causal-echo chips
  keep anchoring correctly — the implementation must preserve the existing
  element IDs/hooks live.js writes into (#env-strip value nodes) or migrate
  every writer/anchor in the same change.

## Monitoring dashboard (second surface, same request)

The `/monitoring` (Sensors) page gets the same range intelligence:
- Each sensor chart draws a shaded horizontal comfort band (the profile's
  suitable range) behind the series line, so "in range" is visible across
  time, not just now.
- A compact range-legend card lists all four suitable ranges with the
  active crop's name ("Strawberry · Ideal ranges"), en/id.
- Same data source rule as above; charts render unchanged (no band) when
  ranges are unavailable.

## Files

Farm home: `public/farm/index.html` (tile markup replacing the strip),
`style.css` (tile/gauge/pulse/dim styles + both breakpoints), `live.js`
(render writes values + gauge positions + staleness + one cached range
fetch), `strings.js` (labels/state words, en/id).
Monitoring: `src/components/monitoring-live.tsx` + chart components (band +
legend card) — coordinate with the concurrent Codex dashboard work before
editing. Schema: none.

## Sequencing

Implementation starts only after the in-flight pokemon-FX workflow releases
live.js/style.css/strings.js (file ownership). Verify: node --check, strings
parity vitest, 360px/430px/desktop visual pass, tap/keyboard/why-chip
regression, demo hotkey `5` mood-cycle shows the tile↔face sync.
