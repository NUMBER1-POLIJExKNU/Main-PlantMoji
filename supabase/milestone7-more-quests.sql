-- LeafTalk · Milestone 7 — more quests
-- (handoff §16–§17: HUMIDIFY_MY_AIR recovery quest for DryAir + STAY_COMFY
-- two-hour maintain quest for Happy)
--
-- ADDITIVE ONLY and re-runnable. Run after supabase/milestone4-soil-quests.sql:
-- that script last re-created quests_quest_key_check with the five original
-- quest keys. This script widens the check again so public.quests accepts all
-- seven keys. Nothing else changes — the quests_one_live_per_key partial
-- unique index is per (plant_id, quest_key), so the two Happy-triggered
-- maintain quests (KEEP_ME_HAPPY + STAY_COMFY) coexist without schema work.

alter table public.quests
  drop constraint if exists quests_quest_key_check;

alter table public.quests
  add constraint quests_quest_key_check check (quest_key in (
    'KEEP_ME_HAPPY',
    'COOL_ME_DOWN',
    'GIVE_ME_MORE_LIGHT',
    'BALANCE_SOIL_ACIDIC',
    'BALANCE_SOIL_ALKALINE',
    'HUMIDIFY_MY_AIR',
    'STAY_COMFY'
  ));
