-- Bond levels stop at 30, and one level now costs 15 XP instead of 30.
--
-- Why 15, pinned from both sides. From below: one class period is 20-30
-- minutes of hands-on time, worth roughly 150-200 XP. At 30 XP a level that is
-- Lv.6 and the plant never changes its drawn look even once; at 15 it is
-- Lv.11-14, three or four visible changes. From above: the one-time XP pool is
-- 410 (badges 12x15, chapters 6x25, mood discoveries 8x5, streak milestones
-- 4x10) and the cap costs 29*15 = 435, so that pool alone cannot max the plant
-- and quests still matter afterwards. Anything below 15 breaks that half.
--
-- Why a cap at all: past it the level was a counter that changed nothing, and
-- the sprite table has no band above 30 to draw. The cap is enforced HERE, not
-- only in TypeScript, because this function is what actually writes
-- bond_level -- the app is display.
--
-- total_xp is deliberately NOT capped. The ledger, the weekly report and the
-- badge rules all read it, seeds keep flowing so the shop still has a point,
-- and a future cap raise picks up exactly where the player really is.
--
-- Replaces milestone14-fast-levels.sql without changing the API.
-- Mirrors src/types/game.ts (XP_PER_LEVEL, MAX_BOND_LEVEL) -- change both.

create or replace function public.award_xp(
  p_plant_id text, p_reward_key text, p_amount integer, p_reason text default null
) returns jsonb language plpgsql as $$
declare v_total integer; v_level_before integer; v_level_after integer;
begin
  insert into public.xp_rewards(reward_key,plant_id,amount)
  values(p_reward_key,p_plant_id,p_amount) on conflict(reward_key) do nothing;
  if not found then
    select total_xp,bond_level into v_total,v_level_after from public.bond_state where plant_id=p_plant_id;
    return jsonb_build_object('duplicate',true,'total_xp',coalesce(v_total,0),'bond_level',coalesce(v_level_after,1),'leveled_up',false);
  end if;
  insert into public.bond_state(plant_id) values(p_plant_id) on conflict(plant_id) do nothing;
  select bond_level into v_level_before from public.bond_state where plant_id=p_plant_id for update;
  update public.bond_state set
    total_xp=greatest(0,total_xp+p_amount),
    bond_level=least(30,floor(greatest(0,total_xp+p_amount)/15.0)::int+1),
    updated_at=now()
  where plant_id=p_plant_id returning total_xp,bond_level into v_total,v_level_after;
  insert into public.bond_events(event_id,plant_id,type,occurred_at,data)
  values('xp:'||p_reward_key,p_plant_id,'XP_AWARDED',now(),jsonb_build_object('amount',p_amount,'reason',p_reason,'totalXp',v_total))
  on conflict(event_id) do nothing;
  -- At the cap this is simply never true again, so no LEVEL_UP event is written
  -- and nothing downstream celebrates a level that did not happen.
  if v_level_after>v_level_before then
    insert into public.bond_events(event_id,plant_id,type,occurred_at,data)
    values('levelup:'||p_reward_key,p_plant_id,'LEVEL_UP',now(),jsonb_build_object('levelBefore',v_level_before,'levelAfter',v_level_after,'totalXp',v_total))
    on conflict(event_id) do nothing;
  end if;
  return jsonb_build_object('duplicate',false,'total_xp',v_total,'bond_level',v_level_after,'leveled_up',v_level_after>v_level_before);
end; $$;

-- Existing rows were levelled under the old 30-XP curve and have no cap, so
-- they are re-derived once here. Nobody loses progress: total_xp is untouched
-- and every level is recomputed from it.
update public.bond_state
set bond_level = least(30, floor(greatest(0,total_xp)/15.0)::int + 1),
    updated_at = now()
where bond_level is distinct from least(30, floor(greatest(0,total_xp)/15.0)::int + 1);
