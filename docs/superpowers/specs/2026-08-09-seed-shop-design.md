# Seed Shop — design spec (2026-08-09)

## Goal

A real Shop (the nav button has been an honest "disabled" placeholder until
now): players earn **Seed coins** through verified play and spend them on
cosmetic farm/pot/accessory items. Spending never touches XP — the "XP/Bond
Level never decrease" invariant (reinforced today by milestone17) stays
intact because Seeds are a separate, deliberately spendable currency.

User decisions (2026-08-09): currency = new Seed coin; catalog = pots, farm
decorations, and Jamkachu accessories; no gameplay boosters; the real-seed
kit exchange idea is out of scope (noted in roadmap).

## Economy

- **Currency**: Seeds (en "Seeds", id "Benih"). Stored as `bond_state.seeds
  integer not null default 0` — bond_state is backend-owned and the farm
  layer already subscribes to it in realtime, so the balance updates live
  with zero new channels.
- **Earning** (deterministic, sensor-truth-derived events only — never
  AI-judged): quest completed +3 · badge unlocked +5 · chapter unlocked +10 ·
  daily-quiz correct +1 · streak qualifying day +1. Amounts live in ONE
  exported table (`SEED_GRANTS` in `src/game/economy/seed-grants.ts`) wired
  into the same engine sites that award XP today.
- **Idempotency**: `seed_rewards` ledger mirrors the `xp_rewards` pattern —
  RPC `award_seeds(plant_id, amount, reward_key)` inserts the ledger row
  first (unique reward_key) and increments the balance only on a fresh key.
- **Spending**: RPC `purchase_item(plant_id, item_key)` — atomic: validates
  the catalog price server-side, checks balance, decrements seeds, inserts
  into `shop_purchases` (unique(plant_id, item_key) — items are permanent
  unlocks, no consumables, no re-buys). Seeds may go down; XP never.

## Catalog & equipping

- Static catalog in TypeScript (`src/game/economy/shop-catalog.ts`, en/id
  names + prices + category), mirroring the MVP pattern used by story
  chapters. Categories:
  - `pot` — mascot pot skins (e.g. terracotta, batik-pattern, tin can).
  - `decor` — farm scene props (scarecrow, bamboo fence, lantern, mini pond).
  - `accessory` — Jamkachu wearables (straw hat, ribbon, round glasses) —
    small SVG groups anchored so they NEVER cover the face groups and
    compose safely with evolution-stage visuals and the sleep face.
- Equip state: `shop_purchases.equipped boolean`; RPC `equip_item` enforces
  at most one equipped `pot` and one `accessory`; `decor` items all display
  once purchased (no equip concept).
- Rendering: farm layer fetches purchases with the boot Promise.all and
  subscribes to `shop_purchases` realtime; pot/accessory/decor render as
  CSS-class-toggled SVG groups in the mascot / scene (same mechanism as
  level decorations `applyDecorations`). Display-only — the browser never
  computes balances.

## Shop UI

- New React route `/shop`, pixel-farm styled (pm-* system), replacing the
  disabled sidebar button in both navs (farm `index.html` + `reno-app-shell`).
  Grid by category; owned items show "Owned/Equipped", affordable items show
  the seed price, unaffordable show price + how to earn hint. Purchase =
  server action → RPC; celebration: small confetti + coin sfx (T2, no
  full-screen ceremony — buying is frequent, keep it light per the FX
  weight-tiering principle).
- Seeds balance chip appears on the farm HUD (next to the XP coin badge) and
  in the shop header, both fed by bond_state realtime.

## Data (milestone18-seed-shop.sql)

`bond_state.seeds` column · `seed_rewards` ledger · `shop_purchases` table ·
`award_seeds` / `purchase_item` / `equip_item` RPCs · realtime on
`shop_purchases`. All additive, re-runnable, backend-owned (Node-RED tables
untouched). Missing migration = shop route shows a friendly "coming soon at
this school" state and the farm layer renders nothing new (graceful no-op,
same contract as milestone11/13).

## Error handling

- purchase with insufficient seeds → RPC returns `insufficient_seeds`; UI
  shows honest copy, never optimistic-deducts.
- Double-tap purchase → unique constraint returns `already_owned`; UI treats
  as success (idempotent).
- Missing migration → RPC error surfaced as the "coming soon" state,
  operator note in English (quiz.js migration-note pattern).

## Testing

- Unit: seed-grants table wiring (each engine event grants exactly once —
  reward_key idempotency), catalog en/id parity, equip exclusivity logic.
- The full suite + build stay green.

## Out of scope (roadmap)

Real-seed kit exchange coupons; seasonal/rotating stock; gifting between
classmates; accessory layering (multiple at once).

## User actions after merge

Run `supabase/milestone18-seed-shop.sql`; redeploy.
