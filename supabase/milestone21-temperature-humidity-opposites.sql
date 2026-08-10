-- PlantMoji · Milestone 20 — add the two missing opposite moods.
--
-- Adds TooCold (temperature below the low band — the opposite of Overheating)
-- and HumidAir (air humidity above the high band — the opposite of DryAir),
-- plus their recovery quests WARM_ME_UP and DEHUMIDIFY_MY_AIR. Mirrors the
-- code contracts in src/types/events.ts (PLANT_MOODS) and src/types/game.ts
-- (QUEST_KEYS).
--
-- ADDITIVE ONLY and re-runnable. Run after milestone12-selectable-crops.sql.
-- Nothing is dropped except the two CHECK constraints, which are immediately
-- re-created wider; existing rows keep their values (the new options only
-- widen what is accepted, so no data can violate the new checks).

-- 1) plants.current_state — widen from six moods to eight.
--    milestone1.sql created this as the inline, Postgres-auto-named
--    plants_current_state_check.
alter table public.plants
  drop constraint if exists plants_current_state_check;

alter table public.plants
  add constraint plants_current_state_check check (current_state in (
    'Happy',
    'Overheating',
    'TooCold',
    'DryAir',
    'HumidAir',
    'Sleepy',
    'SoilAcidic',
    'SoilAlkaline'
  ));

-- 2) quests.quest_key — widen from seven keys to nine (milestone7 set the
--    previous seven).
alter table public.quests
  drop constraint if exists quests_quest_key_check;

alter table public.quests
  add constraint quests_quest_key_check check (quest_key in (
    'KEEP_ME_HAPPY',
    'COOL_ME_DOWN',
    'WARM_ME_UP',
    'GIVE_ME_MORE_LIGHT',
    'BALANCE_SOIL_ACIDIC',
    'BALANCE_SOIL_ALKALINE',
    'HUMIDIFY_MY_AIR',
    'DEHUMIDIFY_MY_AIR',
    'STAY_COMFY'
  ));

-- 3) Catalog consistency (optional; runtime thresholds live in code, not here).
--    Merge the cold / humid_air bands into each active crop's current
--    evaluation_policy so the catalog snapshot matches src/lib/crop-profiles.ts.
--    jsonb `||` is a shallow merge, so re-running simply overwrites the two keys.
update public.crop_profile_versions
set evaluation_policy = evaluation_policy || case crop_profile_key
      when 'strawberry' then
        '{"cold":{"enter_at_or_below":14,"recover_at_or_above":16},"humid_air":{"enter_above":60,"recover_at_or_below":55}}'::jsonb
      when 'soybean' then
        '{"cold":{"enter_at_or_below":17,"recover_at_or_above":20},"humid_air":{"enter_above":80,"recover_at_or_below":75}}'::jsonb
      when 'cayenne-pepper' then
        '{"cold":{"enter_at_or_below":17,"recover_at_or_above":19},"humid_air":{"enter_above":80,"recover_at_or_below":75}}'::jsonb
      else '{}'::jsonb
    end
where crop_profile_key in ('strawberry', 'soybean', 'cayenne-pepper')
  and is_current
  and evaluation_policy ? 'overheating';
