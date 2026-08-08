-- LeafTalk · Milestone 3+ schema — backend game engine tables
-- (handoff §11–§22, §26–§29, §35)
--
-- ADDITIVE ONLY and re-runnable. Requires supabase/milestone1.sql first.
--
-- Ownership (Correction 1 — one XP source of truth):
--   * Node-RED v5 keeps writing its legacy tables (sensor_readings,
--     plant_state_events, game_state, game_events). We do NOT touch them.
--   * The game backend owns the NEW tables below. Bond XP (quest-based) is
--     authoritative here. Node-RED's healthy-time XP branch gets disabled
--     later, after this engine is proven (handoff §15).

-- ── bond_state ──────────────────────────────────────────────────────────
-- One row per plant: quest-driven progression (handoff §37 shape).
create table if not exists public.bond_state (
  plant_id text primary key references public.plants (id),
  total_xp integer not null default 0,
  bond_level integer not null default 1,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_qualified_date date,
  current_chapter integer not null default 1,
  updated_at timestamptz not null default now()
);

-- ── quests ──────────────────────────────────────────────────────────────
-- State machine rows; all timing via timestamps (Correction 4).
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants (id),
  quest_key text not null
    check (quest_key in ('KEEP_ME_HAPPY', 'COOL_ME_DOWN', 'GIVE_ME_MORE_LIGHT')),
  status text not null default 'ACTIVE'
    check (status in ('AVAILABLE', 'ACTIVE', 'VERIFYING', 'COMPLETED', 'EXPIRED', 'FAILED')),
  xp_reward integer not null,
  started_at timestamptz not null default now(),
  verifying_since timestamptz,
  completed_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists quests_plant_status_idx
  on public.quests (plant_id, status);

-- At most one live quest per key per plant — makes quest creation idempotent
-- under event replays.
create unique index if not exists quests_one_live_per_key
  on public.quests (plant_id, quest_key)
  where status in ('ACTIVE', 'VERIFYING');

-- ── plant_badges ────────────────────────────────────────────────────────
create table if not exists public.plant_badges (
  plant_id text not null references public.plants (id),
  badge_key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (plant_id, badge_key)
);

-- ── bond_events ─────────────────────────────────────────────────────────
-- Game events emitted by the backend (QUEST_*, XP_AWARDED, LEVEL_UP, ...).
-- event_id makes every emission idempotent under replays.
create table if not exists public.bond_events (
  event_id text primary key,
  plant_id text not null references public.plants (id),
  type text not null,
  occurred_at timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bond_events_plant_occurred_idx
  on public.bond_events (plant_id, occurred_at desc);

-- ── xp_rewards ──────────────────────────────────────────────────────────
-- Idempotency ledger for XP (handoff §28–§29): one row per reward_key,
-- so a replayed completion can never grant XP twice.
create table if not exists public.xp_rewards (
  reward_key text primary key,
  plant_id text not null references public.plants (id),
  amount integer not null,
  created_at timestamptz not null default now()
);

-- ── Seed ────────────────────────────────────────────────────────────────
insert into public.bond_state (plant_id)
values ('plant-01')
on conflict (plant_id) do nothing;

-- ── award_xp: atomic + idempotent XP grant (handoff §29) ────────────────
-- Within one transaction: dedup by reward_key → increment XP → derive level
-- → record events. Level formula must match levelForXp() in src/types/game.ts.
create or replace function public.award_xp(
  p_plant_id text,
  p_reward_key text,
  p_amount integer,
  p_reason text default null
) returns jsonb
language plpgsql
as $$
declare
  v_total integer;
  v_level_before integer;
  v_level_after integer;
begin
  insert into public.xp_rewards (reward_key, plant_id, amount)
  values (p_reward_key, p_plant_id, p_amount)
  on conflict (reward_key) do nothing;

  if not found then
    select total_xp, bond_level into v_total, v_level_after
    from public.bond_state where plant_id = p_plant_id;
    return jsonb_build_object(
      'duplicate', true,
      'total_xp', coalesce(v_total, 0),
      'bond_level', coalesce(v_level_after, 1),
      'leveled_up', false
    );
  end if;

  insert into public.bond_state (plant_id)
  values (p_plant_id)
  on conflict (plant_id) do nothing;

  select bond_level into v_level_before
  from public.bond_state where plant_id = p_plant_id for update;

  update public.bond_state
  set total_xp = total_xp + p_amount,
      bond_level = floor((total_xp + p_amount) / 30.0)::int + 1,
      updated_at = now()
  where plant_id = p_plant_id
  returning total_xp, bond_level into v_total, v_level_after;

  insert into public.bond_events (event_id, plant_id, type, occurred_at, data)
  values (
    'xp:' || p_reward_key, p_plant_id, 'XP_AWARDED', now(),
    jsonb_build_object('amount', p_amount, 'reason', p_reason, 'totalXp', v_total)
  )
  on conflict (event_id) do nothing;

  if v_level_after > v_level_before then
    insert into public.bond_events (event_id, plant_id, type, occurred_at, data)
    values (
      'levelup:' || p_reward_key, p_plant_id, 'LEVEL_UP', now(),
      jsonb_build_object(
        'levelBefore', v_level_before,
        'levelAfter', v_level_after,
        'totalXp', v_total
      )
    )
    on conflict (event_id) do nothing;
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'total_xp', v_total,
    'bond_level', v_level_after,
    'leveled_up', v_level_after > v_level_before
  );
end;
$$;

-- ── RLS: browser reads only; all writes via the server secret key ───────
alter table public.bond_state enable row level security;
alter table public.quests enable row level security;
alter table public.plant_badges enable row level security;
alter table public.bond_events enable row level security;
alter table public.xp_rewards enable row level security;

drop policy if exists "public read bond_state" on public.bond_state;
create policy "public read bond_state" on public.bond_state for select using (true);

drop policy if exists "public read quests" on public.quests;
create policy "public read quests" on public.quests for select using (true);

drop policy if exists "public read plant_badges" on public.plant_badges;
create policy "public read plant_badges" on public.plant_badges for select using (true);

drop policy if exists "public read bond_events" on public.bond_events;
create policy "public read bond_events" on public.bond_events for select using (true);

-- xp_rewards is an internal ledger — no anon read policy on purpose.

-- ── Realtime for live UI updates ────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.bond_state;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.quests;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.plant_badges;
exception when duplicate_object then null;
end $$;
