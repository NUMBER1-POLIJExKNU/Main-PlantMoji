-- ============================================================================
-- PlantMoji milestone 16-20 bundle — one paste for the Supabase SQL Editor.
-- Generated from the individual milestone files (byte-identical contents).
--
-- PREREQUISITE: milestone1 ... milestone15 already applied (runbook §1.2).
-- Every statement below is re-runnable: running this bundle twice is a no-op.
-- Order matters and is preserved: 16 → 17 → 18 (snapshots, seed shop) →
-- 19 (camera guardian, photo diary) → 20 (companion skins).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- >>> supabase/milestone16-evolution-ladder.sql
-- ─────────────────────────────────────────────────────────────────────────
-- PlantMoji · Milestone 16 — 10-stage companion evolution ladder.
-- Run after milestone11-tamagotchi.sql. Additive and safe to re-run.
-- Ladder source of truth: src/types/game.ts COMPANION_LADDER.

alter table public.companion_state
  drop constraint if exists companion_state_stage_check;
alter table public.companion_state
  add constraint companion_state_stage_check check (stage in
    ('Seed','Sprout','Seedling','Bud','Bloom','Fruit','Guardian','Elder','Radiant','Legend'));

alter table public.companion_evolutions
  drop constraint if exists companion_evolutions_stage_check;
alter table public.companion_evolutions
  add constraint companion_evolutions_stage_check check (stage in
    ('Sprout','Seedling','Bud','Bloom','Fruit','Guardian','Elder','Radiant','Legend'));

alter table public.companion_evolutions
  drop constraint if exists companion_evolutions_from_stage_check;
alter table public.companion_evolutions
  add constraint companion_evolutions_from_stage_check check (from_stage in
    ('Seed','Sprout','Seedling','Bud','Bloom','Fruit','Guardian','Elder','Radiant'));

-- Display-only progress counters, written by evaluateCompanion each sweep.
alter table public.companion_state add column if not exists care_count integer not null default 0;
alter table public.companion_state add column if not exists affinity_count integer not null default 0;
alter table public.companion_state add column if not exists day_count integer not null default 0;

-- ─────────────────────────────────────────────────────────────────────────
-- >>> supabase/milestone17-quiz-kind-scoring.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Kind scoring: a wrong/timed-out Daily Quiz answer now awards exactly 0 XP.
-- The previous answer_daily_quiz (milestone13) set v_xp := -1 on a miss and
-- called award_xp with a negative amount, which could demote total_xp/bond_level
-- right after the player saw "LEVEL UP!" -- XP/Bond Level must never decrease
-- (see AGENTS.md sensor-truth invariant). Misses now skip award_xp entirely
-- instead of passing a negative amount. Correct-answer behavior is unchanged.
-- Re-runnable (CREATE OR REPLACE). Run after milestone13-daily-quiz.sql.
-- Numbering: milestone15 = light-percentage (shipped); milestone16 is reserved
-- by the in-flight companion evolution ladder plan.

create or replace function public.answer_daily_quiz(
  p_plant_id text, p_quiz_date date, p_round_no integer, p_question_key text,
  p_answer_index integer, p_correct boolean
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.daily_quiz_attempts%rowtype;
  v_xp integer := 0;
  v_award jsonb;
  v_actual integer := 0;
begin
  insert into public.daily_quiz_attempts(plant_id, quiz_date, round_no, question_key)
  values (p_plant_id, p_quiz_date, p_round_no, p_question_key)
  on conflict do nothing;

  select * into v_row from public.daily_quiz_attempts
  where plant_id=p_plant_id and quiz_date=p_quiz_date and round_no=p_round_no and question_key=p_question_key
  for update;

  if v_row.completed_at is not null then
    return jsonb_build_object('correct', true, 'completed', true, 'duplicate', true,
      'attempts', v_row.attempts, 'xp_awarded', 0);
  end if;

  v_row.attempts := v_row.attempts + 1;
  -- Kind scoring: correct answers still roll 1-3 XP; a miss is worth 0, never negative.
  if p_correct then v_xp := 1 + floor(random()*3)::integer;
  else v_xp := 0; end if;
  v_actual := v_xp;

  update public.daily_quiz_attempts set
    attempts=v_row.attempts,
    selected_answers=array_append(selected_answers,p_answer_index),
    completed_at=case when p_correct or v_row.attempts >= 2 then now() else null end,
    xp_awarded=case when p_correct then v_actual else xp_awarded end,
    updated_at=now()
  where plant_id=p_plant_id and quiz_date=p_quiz_date and round_no=p_round_no and question_key=p_question_key;

  -- Misses never touch award_xp -- XP and Bond Level must never decrease.
  if p_correct then
    select public.award_xp(p_plant_id,
      'daily_quiz:' || p_quiz_date::text || ':' || p_round_no::text || ':' || p_question_key || ':complete',
      v_actual, 'DAILY_QUIZ') into v_award;
  end if;

  return jsonb_build_object('correct',p_correct,'completed',p_correct or v_row.attempts >= 2,'duplicate',false,
    'attempts',v_row.attempts,'xp_awarded',v_actual,
    'total_xp',case when v_award is null then null else v_award->'total_xp' end,
    'bond_level',case when v_award is null then null else v_award->'bond_level' end,
    'leveled_up',coalesce((v_award->>'leveled_up')::boolean,false));
end;
$$;

revoke all on function public.answer_daily_quiz(text,date,integer,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.answer_daily_quiz(text,date,integer,text,integer,boolean) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- >>> supabase/milestone18-growth-snapshots.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Optional real-photo snapshots for Growth Diary postcards.
-- Private bucket: browser code never receives write credentials; the server
-- uploads with the service role and renders short-lived signed read URLs.

alter table public.growth_records
  add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'growth-snapshots',
  'growth-snapshots',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.growth_records.photo_path is
  'Private growth-snapshots object path. Null means no real photo was captured.';

-- ─────────────────────────────────────────────────────────────────────────
-- >>> supabase/milestone18-seed-shop.sql
-- ─────────────────────────────────────────────────────────────────────────
-- PlantMoji · Milestone 18 — Seed Shop economy
-- ADDITIVE ONLY and re-runnable. Requires milestone1.sql + milestone3.sql.
--
-- Seeds are a SEPARATE, deliberately spendable currency: purchase_item may
-- decrement bond_state.seeds, but NOTHING in this file ever writes total_xp
-- or bond_level — the "XP/Bond Level never decrease" invariant (AGENTS.md,
-- milestone17) is untouched. Node-RED legacy tables are untouched.
--
-- Trust model: the static TS catalog (src/game/economy/shop-catalog.ts) is
-- the authoritative price list. Server actions look prices up there and call
-- purchase_item with the trusted amount; all three RPCs are revoked from
-- anon/authenticated and granted to service_role only, so no browser can
-- forge a price or a grant.

-- ── bond_state.seeds ─────────────────────────────────────────────────────
alter table public.bond_state
  add column if not exists seeds integer not null default 0;

-- ── seed_rewards ─────────────────────────────────────────────────────────
-- Idempotency ledger for Seed grants: one row per reward_key, mirroring
-- xp_rewards (milestone3) — a replayed grant can never pay twice.
create table if not exists public.seed_rewards (
  reward_key text primary key,
  plant_id text not null references public.plants (id),
  amount integer not null,
  created_at timestamptz not null default now()
);

-- ── shop_purchases ───────────────────────────────────────────────────────
-- Permanent unlocks: unique (plant_id, item_key), no consumables, no
-- re-buys. `equipped` matters only for pot/accessory (at most one each,
-- enforced by equip_item); decor displays whenever owned.
create table if not exists public.shop_purchases (
  plant_id text not null references public.plants (id),
  item_key text not null,
  category text not null check (category in ('pot', 'decor', 'accessory')),
  price_paid integer not null check (price_paid >= 0),
  equipped boolean not null default false,
  purchased_at timestamptz not null default now(),
  primary key (plant_id, item_key)
);

-- ── award_seeds: atomic + idempotent Seed grant ──────────────────────────
create or replace function public.award_seeds(
  p_plant_id text,
  p_reward_key text,
  p_amount integer,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_seeds integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'award_seeds: p_amount must be positive (got %)', p_amount;
  end if;

  insert into public.seed_rewards (reward_key, plant_id, amount)
  values (p_reward_key, p_plant_id, p_amount)
  on conflict (reward_key) do nothing;

  if not found then
    select seeds into v_seeds from public.bond_state where plant_id = p_plant_id;
    return jsonb_build_object('duplicate', true, 'seeds', coalesce(v_seeds, 0));
  end if;

  insert into public.bond_state (plant_id)
  values (p_plant_id)
  on conflict (plant_id) do nothing;

  update public.bond_state
  set seeds = seeds + p_amount,
      updated_at = now()
  where plant_id = p_plant_id
  returning seeds into v_seeds;

  return jsonb_build_object('duplicate', false, 'seeds', v_seeds);
end;
$$;

-- ── purchase_item: atomic validate → check balance → decrement → record ─
-- The ONLY code path anywhere that lowers seeds. Double-tap purchases hit
-- the (plant_id, item_key) primary key and come back as 'already_owned'
-- (the UI treats that as success — idempotent).
create or replace function public.purchase_item(
  p_plant_id text,
  p_item_key text,
  p_price integer,
  p_category text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_seeds integer;
begin
  if p_price is null or p_price < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_price');
  end if;
  if p_category not in ('pot', 'decor', 'accessory') then
    return jsonb_build_object('ok', false, 'error', 'invalid_category');
  end if;

  select seeds into v_seeds
  from public.bond_state where plant_id = p_plant_id for update;

  if v_seeds is null then
    return jsonb_build_object('ok', false, 'error', 'insufficient_seeds', 'seeds', 0);
  end if;

  if exists (
    select 1 from public.shop_purchases
    where plant_id = p_plant_id and item_key = p_item_key
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_owned', 'seeds', v_seeds);
  end if;

  if v_seeds < p_price then
    return jsonb_build_object('ok', false, 'error', 'insufficient_seeds', 'seeds', v_seeds);
  end if;

  -- A decoration goes out on the farm the moment it is bought — the shop card
  -- promises exactly that ("appears automatically on My Garden") — so it is
  -- purchased already equipped. Pots and accessories wait to be worn.
  insert into public.shop_purchases (plant_id, item_key, category, price_paid, equipped)
  values (p_plant_id, p_item_key, p_category, p_price, p_category = 'decor')
  on conflict (plant_id, item_key) do nothing;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'already_owned', 'seeds', v_seeds);
  end if;

  update public.bond_state
  set seeds = seeds - p_price,
      updated_at = now()
  where plant_id = p_plant_id
  returning seeds into v_seeds;

  return jsonb_build_object('ok', true, 'seeds', v_seeds);
end;
$$;

-- ── equip_item: at most one equipped pot and one accessory ──────────────
-- p_equipped=false unequips just that item. Decorations are equippable too:
-- refusing the category outright made every bought decoration permanent — the
-- farm showed decor from ownership alone and nothing could take it back off.
-- They are NOT exclusive the way a pot or an accessory is: a garden may show
-- every decoration at once, so only those two categories clear their siblings.
create or replace function public.equip_item(
  p_plant_id text,
  p_item_key text,
  p_equipped boolean default true
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_category text;
begin
  -- Per-plant serialization (same pattern as purchase_item): without this,
  -- two concurrent equips in one category can both commit equipped=true.
  perform 1 from public.bond_state where plant_id = p_plant_id for update;

  select category into v_category from public.shop_purchases
  where plant_id = p_plant_id and item_key = p_item_key;

  if v_category is null then
    return jsonb_build_object('ok', false, 'error', 'not_owned');
  end if;

  if coalesce(p_equipped, true) and v_category in ('pot', 'accessory') then
    update public.shop_purchases
    set equipped = false
    where plant_id = p_plant_id and category = v_category
      and item_key <> p_item_key and equipped;
  end if;

  update public.shop_purchases
  set equipped = coalesce(p_equipped, true)
  where plant_id = p_plant_id and item_key = p_item_key;

  return jsonb_build_object(
    'ok', true, 'category', v_category, 'equipped', coalesce(p_equipped, true)
  );
end;
$$;

-- ── RLS: browser reads shop_purchases only; ledger stays internal ───────
alter table public.seed_rewards enable row level security;
alter table public.shop_purchases enable row level security;

-- seed_rewards is an internal ledger — no anon read policy on purpose
-- (mirrors xp_rewards in milestone3.sql).

drop policy if exists "public read shop_purchases" on public.shop_purchases;
create policy "public read shop_purchases" on public.shop_purchases
  for select using (true);

-- ── Engine-only execution (milestone17 pattern) ─────────────────────────
revoke all on function public.award_seeds(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.award_seeds(text, text, integer, text) to service_role;
revoke all on function public.purchase_item(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.purchase_item(text, text, integer, text) to service_role;
revoke all on function public.equip_item(text, text, boolean) from public, anon, authenticated;
grant execute on function public.equip_item(text, text, boolean) to service_role;

-- ── Realtime: purchases render live on the farm ─────────────────────────
-- bond_state is already in the publication (milestone3), so the seeds
-- balance streams with zero new channels.
do $$
begin
  alter publication supabase_realtime add table public.shop_purchases;
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- >>> supabase/milestone19-camera-guardian.sql
-- ─────────────────────────────────────────────────────────────────────────
-- PlantMoji · Milestone 19 — Camera Live Guardian events
-- (docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md)
--
-- ADDITIVE ONLY and re-runnable. Requires supabase/milestone1.sql.
-- Supersedes the photo-diary design's milestone19-photo-diary.sql for the
-- /camera route: NO storage bucket is created here, and none is required —
-- the guardian analyzes one downscaled snapshot in memory and persists
-- ONLY text/jsonb rows. Node-RED legacy tables are untouched.
--
-- Trust model: browsers may READ camera_events (the farm layer renders
-- reactions from it); every WRITE goes through the two service-role API
-- routes (/api/camera-events for kind 'touch', /api/camera-scan for kind
-- 'pest_advice'), each with its own >=10s rate limit. Rows are
-- presentation + log only: nothing in this file (or downstream of it) can
-- grant XP, currency, or quests — camera signals are never rewards.

-- ── camera_events ────────────────────────────────────────────────────────
create table if not exists public.camera_events (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants (id),
  kind text not null check (kind in ('touch', 'pest_advice')),
  occurred_at timestamptz not null default now(),
  -- pest_advice rows carry { "message": <advisory line>, "locale": "en"|"id" }.
  -- touch rows carry null. Text only, always.
  note jsonb,
  created_at timestamptz not null default now()
);

-- Reconcile deployments that ran the earlier guardian schema (dd2dc1d),
-- where note was NOT NULL DEFAULT '{}'::jsonb. Touch rows carry no note, so
-- the column must accept null — `create table if not exists` never alters
-- an existing table, so the constraint is dropped explicitly here. Both
-- ALTERs are no-ops on a fresh database.
do $$
begin
  alter table public.camera_events alter column note drop not null;
  alter table public.camera_events alter column note drop default;
end $$;

-- Rate-limit lookup path: latest row per (plant, kind).
create index if not exists camera_events_plant_time_idx
  on public.camera_events (plant_id, kind, occurred_at desc);

-- ── RLS: browsers read, only the engine writes ──────────────────────────
alter table public.camera_events enable row level security;

drop policy if exists "public read camera_events" on public.camera_events;
create policy "public read camera_events" on public.camera_events
  for select using (true);

-- No write policies on purpose: the service-role key bypasses RLS, and the
-- browser must never write a camera event directly (the API routes own
-- validation + rate limiting).

-- ── Realtime: touches giggle on every farm-home screen ──────────────────
do $$
begin
  alter publication supabase_realtime add table public.camera_events;
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- >>> supabase/milestone19-photo-diary.sql
-- ─────────────────────────────────────────────────────────────────────────
-- LeafTalk · Milestone 19 — Camera growth photo diary
-- (docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md)
--
-- ADDITIVE ONLY and re-runnable. Requires supabase/milestone1.sql and
-- supabase/milestone5-growth-records.sql first. milestone18 (Seed Shop)
-- is NOT required — without it the +1 Seed photo grant is skipped
-- gracefully by the server action.
--
-- Privacy (kids, school devices): the bucket is public-READ for the MVP
-- (one shared classroom plant, no personal albums). Object paths are
-- always `<plant-id>/<wib-date>-<timestamp>.jpg` — never a student name
-- (enforced by photoStoragePath() in src/lib/photo-diary.ts). All WRITES
-- go through the server action with the service-role key (bypasses RLS);
-- the browser never holds write credentials, so no storage.objects
-- insert/update/delete policies are created on purpose.

-- ── plant-photos Storage bucket (public read) ───────────────────────────
insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true)
on conflict (id) do update set public = true;

-- ── growth_records: the photo diary IS the growth diary ─────────────────
-- One timeline, no second feed (spec §Flow-5). Both columns nullable so
-- every pre-existing manual record stays valid.
alter table public.growth_records
  add column if not exists photo_url text;

-- Jamkachu's observation line (Gemini Vision or deterministic template).
-- Flavor text only — NEVER parsed for game decisions.
alter table public.growth_records
  add column if not exists ai_comment text;

-- ─────────────────────────────────────────────────────────────────────────
-- >>> supabase/milestone20-companion-skins.sql
-- ─────────────────────────────────────────────────────────────────────────
-- PlantMoji · Milestone 20 — cosmetic Jember-crop companion skins.
-- Run after milestone16-evolution-ladder.sql. Additive and safe to re-run.
--
-- DISPLAY-ONLY semantics: skin_key changes how Jamkachu is DRAWN and nothing
-- else. It never grants or gates XP, seeds, quests, evolution, or sensors.
-- Unlocks are checked against bond_state.bond_level at selection time by the
-- API route; the DB only guards that the stored key is a real catalog key.
-- Catalog source of truth: src/types/game.ts COMPANION_SKINS.

alter table public.companion_state
  add column if not exists skin_key text not null default 'jamkachu';

alter table public.companion_state
  drop constraint if exists companion_state_skin_key_check;
alter table public.companion_state
  add constraint companion_state_skin_key_check check (skin_key in
    ('jamkachu','edamame','padi','jagung','kopi','kakao','buah_naga'));
