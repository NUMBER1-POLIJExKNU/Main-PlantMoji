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
