-- PlantMoji · Milestone 19 — Camera Live Guardian
-- Ephemeral camera events only. No image or video storage is created.
create table if not exists public.camera_events (
  id bigint generated always as identity primary key,
  plant_id text not null references public.plants(id) on delete cascade,
  kind text not null check (kind in ('touch', 'pest_advice')),
  occurred_at timestamptz not null default now(),
  note jsonb not null default '{}'::jsonb
);

create index if not exists camera_events_plant_time_idx
  on public.camera_events (plant_id, occurred_at desc);

alter table public.camera_events enable row level security;
drop policy if exists "camera events are readable" on public.camera_events;
create policy "camera events are readable" on public.camera_events
  for select to anon, authenticated using (true);

do $$ begin
  alter publication supabase_realtime add table public.camera_events;
exception when duplicate_object then null;
end $$;

revoke insert, update, delete on public.camera_events from anon, authenticated;
grant select on public.camera_events to anon, authenticated;
