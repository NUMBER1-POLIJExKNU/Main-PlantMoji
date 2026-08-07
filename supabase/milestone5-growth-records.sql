-- LeafTalk · Milestone 5 — manual Growth Records (handoff §14, §35)
--
-- ADDITIVE ONLY and re-runnable. Requires supabase/milestone1.sql first.
--
-- Growth Stage vs Bond Level (handoff §14 — mandatory distinction):
--   * Bond Level = user care consistency (quest/XP driven, owned by
--     bond_state / milestone3.sql). Never decreases.
--   * Growth Stage = real plant biological growth. Current sensors cannot
--     reliably infer physical growth, so Growth Stage is MANUAL or
--     record-based ONLY — never inferred from current sensor readings.
--
-- This table is the append-only log of manual growth observations
-- (handoff §14: "manual, or based on photo/height/leaf-count records").
-- `plants.growth_stage` remains the single "current stage" field shown on
-- the home/settings screens; each new record becomes the new source of
-- truth for it (see addGrowthRecord in src/app/settings/actions.ts).

-- ── growth_records ──────────────────────────────────────────────────────
create table if not exists public.growth_records (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants (id),
  recorded_at timestamptz not null default now(),
  stage text not null
    check (stage in ('New Plant', 'Settled', 'Growing', 'Thriving', 'Mature')),
  height_cm numeric,
  leaf_count integer,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists growth_records_plant_recorded_idx
  on public.growth_records (plant_id, recorded_at desc);

-- ── RLS: browser reads only; all writes via the server secret key ───────
-- Same pattern as milestone3.sql — the settings page's addGrowthRecord
-- server action writes with getServerSupabase() (secret key, bypasses RLS).
alter table public.growth_records enable row level security;

drop policy if exists "public read growth_records" on public.growth_records;
create policy "public read growth_records" on public.growth_records for select using (true);
