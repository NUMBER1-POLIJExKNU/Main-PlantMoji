-- Crop profiles are code-defined; plants store only the stable registry key.
-- Additive and safe to run repeatedly.
alter table public.plants
  add column if not exists crop_profile_key text;

update public.plants
set crop_profile_key = 'strawberry', species = 'Strawberry'
where id = 'plant-01';

alter table public.plants
  alter column crop_profile_key set default 'strawberry';

alter table public.plants
  drop constraint if exists plants_crop_profile_key_check;

alter table public.plants
  add constraint plants_crop_profile_key_check
  check (crop_profile_key in ('strawberry'));
