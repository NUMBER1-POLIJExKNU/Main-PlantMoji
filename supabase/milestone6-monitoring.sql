-- LeafTalk · Milestone 6 — live monitoring columns + browser read access
-- for the PlantMoji /monitoring dashboard.
--
-- ADDITIVE ONLY and re-runnable, in the style of milestone3.sql.
--
-- public.sensor_readings is created by the ops team's v5 schema, which may
-- not have been run in this Supabase project yet. Every statement below is
-- wrapped in a DO block that swallows undefined_table: if the table does not
-- exist yet this file is a no-op — re-run it after the v5 schema lands and
-- the changes apply.
--
-- The hardware team's new flow reports two extra readings:
--   * soil_moisture — capacitive soil probe, percent (0–100)
--   * light_lux     — analog light sensor, lux
-- Both columns are nullable, so old v5 writers keep inserting unchanged.

do $$
begin
  alter table public.sensor_readings add column if not exists soil_moisture numeric;
  alter table public.sensor_readings add column if not exists light_lux numeric;
exception
  when undefined_table then null; -- v5 schema not run yet — no-op
end $$;

-- Read-only browser access (milestone3 policy style) so the monitoring
-- gauges can poll sensor_readings with the publishable key. Node-RED keeps
-- WRITING via the secret (service-role) key, which bypasses RLS — enabling
-- RLS with a select-only policy does not affect it.
do $$
begin
  alter table public.sensor_readings enable row level security;
  drop policy if exists "public read sensor_readings" on public.sensor_readings;
  create policy "public read sensor_readings"
    on public.sensor_readings for select using (true);
exception
  when undefined_table then null; -- v5 schema not run yet — no-op
end $$;
