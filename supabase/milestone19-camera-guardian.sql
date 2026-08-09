-- PlantMoji · Milestone 19 — Camera Live Guardian events
-- (docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md)
--
-- ADDITIVE ONLY and re-runnable. Requires supabase/milestone1.sql.
-- Supersedes the photo-diary design's milestone19-photo-diary.sql for the
-- /camera route: NO storage bucket is created here, and none is required —
-- the guardian analyzes one downscaled snapshot in memory and persists
-- ONLY text/jsonb rows. Node-RED legacy tables are untouched.
--
-- Trust model: browsers may READ camera_events (the farm layer renders
-- reactions from it); every WRITE goes through the two service-role API
-- routes (/api/camera-events for kind 'touch', /api/camera-scan for kind
-- 'pest_advice'), each with its own >=10s rate limit. Rows are
-- presentation + log only: nothing in this file (or downstream of it) can
-- grant XP, currency, or quests — camera signals are never rewards.

-- ── camera_events ────────────────────────────────────────────────────────
create table if not exists public.camera_events (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants (id),
  kind text not null check (kind in ('touch', 'pest_advice')),
  occurred_at timestamptz not null default now(),
  -- pest_advice rows carry { "message": <advisory line>, "locale": "en"|"id" }.
  -- touch rows carry null. Text only, always.
  note jsonb,
  created_at timestamptz not null default now()
);

-- Reconcile deployments that ran the earlier guardian schema (dd2dc1d),
-- where note was NOT NULL DEFAULT '{}'::jsonb. Touch rows carry no note, so
-- the column must accept null — `create table if not exists` never alters
-- an existing table, so the constraint is dropped explicitly here. Both
-- ALTERs are no-ops on a fresh database.
do $$
begin
  alter table public.camera_events alter column note drop not null;
  alter table public.camera_events alter column note drop default;
end $$;

-- Rate-limit lookup path: latest row per (plant, kind).
create index if not exists camera_events_plant_time_idx
  on public.camera_events (plant_id, kind, occurred_at desc);

-- ── RLS: browsers read, only the engine writes ──────────────────────────
alter table public.camera_events enable row level security;

drop policy if exists "public read camera_events" on public.camera_events;
create policy "public read camera_events" on public.camera_events
  for select using (true);

-- No write policies on purpose: the service-role key bypasses RLS, and the
-- browser must never write a camera event directly (the API routes own
-- validation + rate limiting).

-- ── Realtime: touches giggle on every farm-home screen ──────────────────
do $$
begin
  alter publication supabase_realtime add table public.camera_events;
exception when duplicate_object then null;
end $$;
