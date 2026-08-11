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
