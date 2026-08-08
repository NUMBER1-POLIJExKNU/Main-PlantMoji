-- Friendly progression curve: every 30 XP advances one Bond level.
-- Replaces the already-deployed milestone3 RPC without changing its API.
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
    bond_level=floor(greatest(0,total_xp+p_amount)/30.0)::int+1,
    updated_at=now()
  where plant_id=p_plant_id returning total_xp,bond_level into v_total,v_level_after;
  insert into public.bond_events(event_id,plant_id,type,occurred_at,data)
  values('xp:'||p_reward_key,p_plant_id,'XP_AWARDED',now(),jsonb_build_object('amount',p_amount,'reason',p_reason,'totalXp',v_total))
  on conflict(event_id) do nothing;
  if v_level_after>v_level_before then
    insert into public.bond_events(event_id,plant_id,type,occurred_at,data)
    values('levelup:'||p_reward_key,p_plant_id,'LEVEL_UP',now(),jsonb_build_object('levelBefore',v_level_before,'levelAfter',v_level_after,'totalXp',v_total))
    on conflict(event_id) do nothing;
  end if;
  return jsonb_build_object('duplicate',false,'total_xp',v_total,'bond_level',v_level_after,'leveled_up',v_level_after>v_level_before);
end; $$;
