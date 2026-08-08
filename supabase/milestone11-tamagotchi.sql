-- PlantMoji · Milestone 11 — virtual companion evolution
-- Additive and safe to re-run. Real plants.growth_stage remains untouched.

create table if not exists public.companion_state (
  plant_id text primary key references public.plants(id) on delete cascade,
  cycle integer not null default 1 check (cycle > 0),
  stage text not null default 'Seed' check (stage in ('Seed','Sprout','Bud','Bloom','Guardian')),
  form_key text not null default 'balanced' check (form_key in ('cool','air','light','soil','steady','balanced')),
  last_evolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.companion_evolutions (
  plant_id text not null references public.plants(id) on delete cascade,
  cycle integer not null check (cycle > 0),
  stage text not null check (stage in ('Sprout','Bud','Bloom','Guardian')),
  from_stage text not null check (from_stage in ('Seed','Sprout','Bud','Bloom')),
  form_key text not null check (form_key in ('cool','air','light','soil','steady','balanced')),
  care_snapshot jsonb not null default '{}'::jsonb,
  evolved_at timestamptz not null default now(),
  primary key (plant_id, cycle, stage)
);

alter table public.companion_state enable row level security;
alter table public.companion_evolutions enable row level security;

drop policy if exists "companion state public read" on public.companion_state;
create policy "companion state public read" on public.companion_state for select using (true);
drop policy if exists "companion evolutions public read" on public.companion_evolutions;
create policy "companion evolutions public read" on public.companion_evolutions for select using (true);

insert into public.companion_state (plant_id)
select id from public.plants
on conflict (plant_id) do nothing;

do $$
begin
  alter publication supabase_realtime add table public.companion_state;
exception when duplicate_object then null;
end $$;
