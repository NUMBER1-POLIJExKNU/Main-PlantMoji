-- LeafTalk · Milestone 8 — dopamine layer realtime
-- (dopamine UX reframe spec D2 / plan Task 7)
--
-- Adds public.bond_events to the supabase_realtime publication so the farm
-- page can subscribe to XP_AWARDED inserts live and label reward chips by
-- reason (e.g. 'lucky-bonus:<quest_key>' → the gold "LUCKY! ×2" stamp).
-- The table itself, its RLS, and its read policy already exist
-- (supabase/milestone3.sql) — this script changes the publication ONLY.
--
-- Run in the Supabase SQL Editor. ADDITIVE ONLY and safe to re-run: the
-- duplicate_object guard makes a repeat run a no-op, matching the
-- publication blocks in milestone1.sql and milestone3.sql.

do $$
begin
  alter publication supabase_realtime add table public.bond_events;
exception when duplicate_object then null;
end $$;
