-- LeafTalk · Milestone 4 — soil-pH recovery quests
-- (handoff §16 "Healthy Soil / Balance My Soil")
--
-- ADDITIVE ONLY and re-runnable. Requires supabase/milestone3.sql first:
-- that script created public.quests with an inline unnamed check on
-- quest_key (auto-named quests_quest_key_check by Postgres). This script
-- widens that check so the table accepts the two new soil quest keys —
-- BALANCE_SOIL_ACIDIC / BALANCE_SOIL_ALKALINE — alongside the existing ones.

alter table public.quests
  drop constraint if exists quests_quest_key_check;

alter table public.quests
  add constraint quests_quest_key_check check (quest_key in (
    'KEEP_ME_HAPPY',
    'COOL_ME_DOWN',
    'GIVE_ME_MORE_LIGHT',
    'BALANCE_SOIL_ACIDIC',
    'BALANCE_SOIL_ALKALINE'
  ));
