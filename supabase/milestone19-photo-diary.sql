-- LeafTalk · Milestone 19 — Camera growth photo diary
-- (docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md)
--
-- ADDITIVE ONLY and re-runnable. Requires supabase/milestone1.sql and
-- supabase/milestone5-growth-records.sql first. milestone18 (Seed Shop)
-- is NOT required — without it the +1 Seed photo grant is skipped
-- gracefully by the server action.
--
-- Privacy (kids, school devices): the bucket is public-READ for the MVP
-- (one shared classroom plant, no personal albums). Object paths are
-- always `<plant-id>/<wib-date>-<timestamp>.jpg` — never a student name
-- (enforced by photoStoragePath() in src/lib/photo-diary.ts). All WRITES
-- go through the server action with the service-role key (bypasses RLS);
-- the browser never holds write credentials, so no storage.objects
-- insert/update/delete policies are created on purpose.

-- ── plant-photos Storage bucket (public read) ───────────────────────────
insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true)
on conflict (id) do update set public = true;

-- ── growth_records: the photo diary IS the growth diary ─────────────────
-- One timeline, no second feed (spec §Flow-5). Both columns nullable so
-- every pre-existing manual record stays valid.
alter table public.growth_records
  add column if not exists photo_url text;

-- Jamkachu's observation line (Gemini Vision or deterministic template).
-- Flavor text only — NEVER parsed for game decisions.
alter table public.growth_records
  add column if not exists ai_comment text;
