-- PlantMoji · Milestone 21 — Bond-Level-only companion evolution.
-- Run after milestone16-evolution-ladder.sql. Re-runnable and safe.
--
-- Rule: Lv.1 Seed → one stage per level → Lv.10+ Legend.
-- Care count, care affinity variety, and elapsed days no longer gate stages.

create or replace function public.companion_stage_for_level(p_level integer)
returns text
language sql
immutable
as $$
  select (array[
    'Seed','Sprout','Seedling','Bud','Bloom',
    'Fruit','Guardian','Elder','Radiant','Legend'
  ])[least(10, greatest(1, coalesce(p_level, 1)))];
$$;

create or replace function public.sync_companion_stage_for_level(
  p_plant_id text,
  p_level integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stages constant text[] := array[
    'Seed','Sprout','Seedling','Bud','Bloom',
    'Fruit','Guardian','Elder','Radiant','Legend'
  ];
  v_state public.companion_state%rowtype;
  v_target text := public.companion_stage_for_level(p_level);
  v_current_index integer;
  v_target_index integer;
  v_index integer;
  v_from_stage text;
  v_stage text;
  v_now timestamptz := now();
begin
  -- Start from Seed so a new high-level row records every crossed rung.
  insert into public.companion_state (plant_id, stage, form_key)
  values (p_plant_id, 'Seed', 'balanced')
  on conflict (plant_id) do nothing;

  select * into v_state
  from public.companion_state
  where plant_id = p_plant_id
  for update;

  v_current_index := coalesce(array_position(v_stages, v_state.stage), 1);
  v_target_index := coalesce(array_position(v_stages, v_target), 1);
  v_from_stage := v_stages[v_current_index];

  if v_target_index > v_current_index then
    for v_index in (v_current_index + 1)..v_target_index loop
      v_stage := v_stages[v_index];
      insert into public.companion_evolutions (
        plant_id, cycle, stage, from_stage, form_key, care_snapshot, evolved_at
      ) values (
        p_plant_id,
        v_state.cycle,
        v_stage,
        v_from_stage,
        v_state.form_key,
        jsonb_build_object('bondLevel', greatest(1, coalesce(p_level, 1)), 'rule', 'bond-level'),
        v_now
      ) on conflict (plant_id, cycle, stage) do nothing;

      insert into public.bond_events (event_id, plant_id, type, occurred_at, data)
      values (
        'companion:' || p_plant_id || ':' || v_state.cycle || ':' || v_stage,
        p_plant_id,
        'COMPANION_EVOLVED',
        v_now,
        jsonb_build_object(
          'fromStage', v_from_stage,
          'stage', v_stage,
          'formKey', v_state.form_key,
          'bondLevel', greatest(1, coalesce(p_level, 1)),
          'reason', 'Bond Level ' || greatest(1, coalesce(p_level, 1))
        )
      ) on conflict (event_id) do nothing;

      v_from_stage := v_stage;
    end loop;
  end if;

  -- Exact normalization intentionally corrects legacy care-gated rows that
  -- are ahead of or behind the level-only mapping. History remains intact.
  update public.companion_state
  set stage = v_target,
      last_evolved_at = case when stage is distinct from v_target then v_now else last_evolved_at end,
      updated_at = v_now
  where plant_id = p_plant_id;
end;
$$;

create or replace function public.sync_companion_stage_on_bond_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_companion_stage_for_level(new.plant_id, new.bond_level);
  return new;
end;
$$;

drop trigger if exists bond_level_syncs_companion_stage on public.bond_state;
create trigger bond_level_syncs_companion_stage
after insert or update of bond_level on public.bond_state
for each row execute function public.sync_companion_stage_on_bond_change();

-- One-time/re-run-safe normalization of every existing player.
do $$
declare v_bond record;
begin
  for v_bond in select plant_id, bond_level from public.bond_state loop
    perform public.sync_companion_stage_for_level(v_bond.plant_id, v_bond.bond_level);
  end loop;
end;
$$;

revoke all on function public.companion_stage_for_level(integer) from public, anon, authenticated;
revoke all on function public.sync_companion_stage_for_level(text, integer) from public, anon, authenticated;
revoke all on function public.sync_companion_stage_on_bond_change() from public, anon, authenticated;
