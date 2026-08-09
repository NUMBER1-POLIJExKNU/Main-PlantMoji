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
- Comfort bands come from the active crop profile's thresholds when the
  client already has them; otherwise a static display-only mirror of the
  approved profile bands ships in the farm layer (clearly commented as
  display-only; light uses the calibrated 0-100% scale from milestone15).
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

## Files

`public/farm/index.html` (tile markup replacing the strip), `style.css`
(tile/gauge/pulse/dim styles + both breakpoints), `live.js` (render writes
values + gauge positions + staleness; no new data fetches), `strings.js`
(labels/state words, en/id). No React changes; no schema changes.

## Sequencing

Implementation starts only after the in-flight pokemon-FX workflow releases
live.js/style.css/strings.js (file ownership). Verify: node --check, strings
parity vitest, 360px/430px/desktop visual pass, tap/keyboard/why-chip
regression, demo hotkey `5` mood-cycle shows the tile↔face sync.
