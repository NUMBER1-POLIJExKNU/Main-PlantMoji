-- PlantMoji · Milestone 20 — cosmetic Jember-crop companion skins.
-- Run after milestone16-evolution-ladder.sql. Additive and safe to re-run.
--
-- DISPLAY-ONLY semantics: skin_key changes how Jamkachu is DRAWN and nothing
-- else. It never grants or gates XP, seeds, quests, evolution, or sensors.
-- Unlocks are checked against bond_state.bond_level at selection time by the
-- API route; the DB only guards that the stored key is a real catalog key.
-- Catalog source of truth: src/types/game.ts COMPANION_SKINS.

alter table public.companion_state
  add column if not exists skin_key text not null default 'jamkachu';

alter table public.companion_state
  drop constraint if exists companion_state_skin_key_check;
alter table public.companion_state
  add constraint companion_state_skin_key_check check (skin_key in
    ('jamkachu','edamame','padi','jagung','kopi','kakao','buah_naga'));
