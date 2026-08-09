-- PlantMoji · Milestone 16 — 10-stage companion evolution ladder.
-- Run after milestone11-tamagotchi.sql. Additive and safe to re-run.
-- Ladder source of truth: src/types/game.ts COMPANION_LADDER.

alter table public.companion_state
  drop constraint if exists companion_state_stage_check;
alter table public.companion_state
  add constraint companion_state_stage_check check (stage in
    ('Seed','Sprout','Seedling','Bud','Bloom','Fruit','Guardian','Elder','Radiant','Legend'));

alter table public.companion_evolutions
  drop constraint if exists companion_evolutions_stage_check;
alter table public.companion_evolutions
  add constraint companion_evolutions_stage_check check (stage in
    ('Sprout','Seedling','Bud','Bloom','Fruit','Guardian','Elder','Radiant','Legend'));

alter table public.companion_evolutions
  drop constraint if exists companion_evolutions_from_stage_check;
alter table public.companion_evolutions
  add constraint companion_evolutions_from_stage_check check (from_stage in
    ('Seed','Sprout','Seedling','Bud','Bloom','Fruit','Guardian','Elder','Radiant'));

-- Display-only progress counters, written by evaluateCompanion each sweep.
alter table public.companion_state add column if not exists care_count integer not null default 0;
alter table public.companion_state add column if not exists affinity_count integer not null default 0;
alter table public.companion_state add column if not exists day_count integer not null default 0;
