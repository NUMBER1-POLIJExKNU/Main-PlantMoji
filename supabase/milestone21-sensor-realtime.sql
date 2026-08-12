-- milestone21 — live sensor readings
--
-- The four numbers on My Garden were the only values in the app still waiting
-- for a poll: the farm home refetched every 15s, /monitoring every 10s. Every
-- other moving part (plants, bond_state, quests, companion_state,
-- shop_purchases, camera_events) has been pushed over realtime since
-- milestone1, so this closes the last gap using the pattern already proven
-- six times over.
--
-- Idempotent, like every other publication add in this repo: re-running it on
-- a project that already has the table is a no-op rather than an error.
--
-- NOTE: this raises the FLOOR, not the ceiling. A reading cannot be pushed
-- before it is written, so the visible latency is still whatever Node-RED's
-- POST interval is, plus well under a second for the push. If the device
-- posts every 10s the screen still moves every 10s — it simply stops adding
-- up to 15s of polling delay on top.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sensor_readings'
  ) then
    alter publication supabase_realtime add table public.sensor_readings;
  end if;
end
$$;
