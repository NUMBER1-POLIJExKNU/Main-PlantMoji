-- LeafTalk · Milestone 1–2 schema (handoff §35–§36, §47)
--
-- ADDITIVE ONLY: safe to run on the existing Supabase project that already
-- holds the Node-RED v5 tables (sensor_readings, plant_state_events,
-- game_state, game_events). Running it twice is also safe.
--
-- How to run: Supabase Dashboard → SQL Editor → paste this file → Run.

-- ── plants ──────────────────────────────────────────────────────────────
-- One row per physical plant. current_state mirrors the latest
-- PLANT_STATE_CHANGED event and is what the web home screen subscribes to.
create table if not exists public.plants (
  id text primary key,
  name text not null,
  species text,
  crop_profile_key text default 'strawberry',
  personality text,
  growth_stage text,
  current_state text not null default 'Happy'
    check (current_state in ('Happy', 'Overheating', 'DryAir', 'Sleepy', 'SoilAcidic', 'SoilAlkaline')),
  -- Epoch default (not null) so the API's "only newer events win" guard
  -- (state_changed_at <= occurredAt) always matches on a fresh row.
  state_changed_at timestamptz not null default to_timestamp(0),
  created_at timestamptz not null default now()
);

-- ── device_events ───────────────────────────────────────────────────────
-- Every semantic event delivered by Node-RED. event_id is the idempotency
-- key (handoff §28): a retried delivery inserts nothing.
create table if not exists public.device_events (
  event_id text primary key,
  plant_id text not null references public.plants (id),
  type text not null,
  occurred_at timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists device_events_plant_occurred_idx
  on public.device_events (plant_id, occurred_at desc);

-- ── Seed: Jamkachu — PlantMoji's first companion, named after Jember ────
-- (Team branding decision; the handoff §36 "Jin" was an example.)
insert into public.plants (id, name, species, crop_profile_key, personality, growth_stage)
values ('plant-01', 'Jamkachu', 'Strawberry', 'strawberry', 'funny', 'growing')
on conflict (id) do nothing;

-- ── RLS (handoff §9) ────────────────────────────────────────────────────
-- Browser (publishable key) may only read. All writes go through the
-- Next.js server with the secret key, which bypasses RLS.
alter table public.plants enable row level security;
alter table public.device_events enable row level security;

drop policy if exists "public read plants" on public.plants;
create policy "public read plants"
  on public.plants for select
  using (true);

drop policy if exists "public read device_events" on public.device_events;
create policy "public read device_events"
  on public.device_events for select
  using (true);

-- ── Realtime ────────────────────────────────────────────────────────────
-- The home screen subscribes to UPDATEs on plants (Milestone 2).
do $$
begin
  alter publication supabase_realtime add table public.plants;
exception
  when duplicate_object then null;
end $$;
