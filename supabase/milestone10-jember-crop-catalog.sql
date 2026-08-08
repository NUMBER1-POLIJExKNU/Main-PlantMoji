-- PlantMoji · Milestone 10 · Jember crop profile catalog
--
-- ADDITIVE + RE-RUNNABLE.
-- Run after milestone6-crop-profiles.sql. This migration replaces the
-- one-value plants.crop_profile_key check with a real foreign key, while
-- keeping strawberry as the only approved runtime profile for now.
--
-- Selection evidence:
--   BPS Kabupaten Jember, Kabupaten Jember Dalam Angka 2025, tables
--   5.1.3 (horticulture), 5.2.3 (smallholder estates), and 5.3.3 (food crops).
-- Environment evidence:
--   Kementerian Pertanian, Petunjuk Teknis Evaluasi Lahan untuk Komoditas
--   Pertanian (S1 = highly suitable), plus crop-specific references below.

create table if not exists public.crop_profiles (
  key text primary key
    check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name_en text not null,
  display_name_id text not null,
  scientific_name text not null,
  species text not null,
  crop_group text not null
    check (crop_group in ('existing', 'food_crop', 'horticulture', 'estate_crop')),
  lifecycle text not null
    check (lifecycle in ('annual', 'short_lived_perennial', 'perennial')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'reference_only', 'retired')),
  kit_suitability text not null default 'advisory_only'
    check (kit_suitability in ('supported', 'advisory_only', 'seedling_only', 'unsupported')),
  catalog_order smallint,
  jember_evidence jsonb not null default '{}'::jsonb,
  education_note_en text not null,
  education_note_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crop_profile_versions (
  crop_profile_key text not null references public.crop_profiles (key) on update cascade on delete restrict,
  version integer not null check (version > 0),
  timezone text not null default 'Asia/Jakarta',
  growth_stage_scope text not null default 'general',
  environment_basis text not null
    check (environment_basis in ('indoor_potted', 'field_land_suitability', 'seedling_advisory')),
  temperature_recommended_min numeric(5,2) not null,
  temperature_recommended_max numeric(5,2) not null,
  temperature_tolerated_min numeric(5,2) not null,
  temperature_tolerated_max numeric(5,2) not null,
  air_humidity_recommended_min numeric(5,2),
  air_humidity_recommended_max numeric(5,2),
  soil_ph_recommended_min numeric(4,2) not null,
  soil_ph_recommended_max numeric(4,2) not null,
  light_descriptor text not null,
  light_sensor_type text not null default 'binary-ldr'
    check (light_sensor_type = 'binary-ldr'),
  binary_ldr_required_during_window smallint not null default 1
    check (binary_ldr_required_during_window in (0, 1)),
  lighting_window_start time not null default '06:00',
  lighting_window_end time not null default '18:00',
  quantitative_light_claim boolean not null default false,
  evaluation_policy jsonb not null default '{"mode":"advisory_only","approved_for_quests":false}'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  review_status text not null default 'needs_local_review'
    check (review_status in ('approved', 'needs_local_review', 'reference_only')),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (crop_profile_key, version),
  check (temperature_recommended_min <= temperature_recommended_max),
  check (temperature_tolerated_min <= temperature_recommended_min),
  check (temperature_recommended_max <= temperature_tolerated_max),
  check (air_humidity_recommended_min is null or air_humidity_recommended_min between 0 and 100),
  check (air_humidity_recommended_max is null or air_humidity_recommended_max between 0 and 100),
  check (
    air_humidity_recommended_min is null
    or air_humidity_recommended_max is null
    or air_humidity_recommended_min <= air_humidity_recommended_max
  ),
  check (soil_ph_recommended_min between 0 and 14),
  check (soil_ph_recommended_max between 0 and 14),
  check (soil_ph_recommended_min <= soil_ph_recommended_max),
  check (quantitative_light_claim = false)
);

create unique index if not exists crop_profile_versions_one_current_idx
  on public.crop_profile_versions (crop_profile_key)
  where is_current;

create table if not exists public.crop_profile_sources (
  crop_profile_key text not null,
  profile_version integer not null,
  source_key text not null,
  organization text not null,
  title text not null,
  url text not null,
  source_kind text not null
    check (source_kind in ('local_statistics', 'local_context', 'environment_criteria', 'crop_guide', 'global_database')),
  supported_fields text[] not null default '{}'::text[],
  citation_note text not null default '',
  accessed_on date not null default current_date,
  primary key (crop_profile_key, profile_version, source_key),
  foreign key (crop_profile_key, profile_version)
    references public.crop_profile_versions (crop_profile_key, version)
    on update cascade on delete cascade
);

-- Strawberry remains the only profile approved for automatic mood/quest use.
-- The ten Jember rows are deliberately draft/reference rows until a local
-- agronomy reviewer approves their sensor alert and hysteresis policies.
insert into public.crop_profiles (
  key, display_name_en, display_name_id, scientific_name, species,
  crop_group, lifecycle, status, kit_suitability, catalog_order,
  jember_evidence, education_note_en, education_note_id
)
values
  ('strawberry', 'Strawberry', 'Stroberi', 'Fragaria × ananassa', 'Strawberry',
    'existing', 'short_lived_perennial', 'active', 'supported', null,
    '{"basis":"existing_mvp_crop"}'::jsonb,
    'Current indoor-pot MVP profile. Variety-specific calibration may differ.',
    'Profil MVP pot dalam ruangan saat ini. Kalibrasi dapat berbeda menurut varietas.'),
  ('rice', 'Paddy rice', 'Padi', 'Oryza sativa', 'Paddy Rice',
    'food_crop', 'annual', 'draft', 'advisory_only', 1,
    '{"year":2024,"table":"5.3.3","measure":"harvested_area_ha","value":158727}'::jsonb,
    'Jember major crop. Flooded rice needs water-level monitoring that this kit does not have.',
    'Komoditas utama Jember. Padi sawah memerlukan pemantauan tinggi air yang belum dimiliki kit ini.'),
  ('maize', 'Maize', 'Jagung', 'Zea mays', 'Maize',
    'food_crop', 'annual', 'draft', 'advisory_only', 2,
    '{"year":2024,"table":"5.3.3","measure":"harvested_area_ha","value":68380}'::jsonb,
    'Locally important but needs a large container and stronger quantitative light monitoring.',
    'Penting di Jember, tetapi memerlukan pot besar dan pemantauan cahaya kuantitatif yang lebih baik.'),
  ('tobacco', 'Tobacco', 'Tembakau', 'Nicotiana tabacum', 'Tobacco',
    'estate_crop', 'annual', 'reference_only', 'unsupported', 3,
    '{"year":2024,"table":"5.2.3","measure":"smallholder_area_ha","value":15397.90}'::jsonb,
    'Stored for local agricultural context only. Nicotine exposure makes it unsuitable for a children''s growing activity.',
    'Disimpan hanya sebagai konteks pertanian lokal. Paparan nikotin membuatnya tidak sesuai untuk kegiatan tanam anak.'),
  ('coconut', 'Coconut', 'Kelapa', 'Cocos nucifera', 'Coconut',
    'estate_crop', 'perennial', 'draft', 'seedling_only', 4,
    '{"year":2024,"table":"5.2.3","measure":"smallholder_area_ha","value":4778.46}'::jsonb,
    'A mature palm is not a pot crop; the profile is for seedling observation only.',
    'Kelapa dewasa bukan tanaman pot; profil ini hanya untuk pengamatan bibit.'),
  ('robusta-coffee', 'Robusta coffee', 'Kopi robusta', 'Coffea canephora', 'Robusta Coffee',
    'estate_crop', 'perennial', 'draft', 'seedling_only', 5,
    '{"year":2024,"table":"5.2.3","measure":"smallholder_area_ha","value":3872.90,"local_species":"robusta"}'::jsonb,
    'The kit can observe a seedling; it cannot claim mature-tree yield suitability.',
    'Kit dapat mengamati bibit, tetapi tidak dapat menilai kesesuaian hasil pohon dewasa.'),
  ('sugarcane', 'Sugarcane', 'Tebu', 'Saccharum officinarum', 'Sugarcane',
    'estate_crop', 'perennial', 'draft', 'advisory_only', 6,
    '{"year":2024,"table":"5.2.3","measure":"smallholder_area_ha","value":2544.12}'::jsonb,
    'Field guidance is stored, but crop size and ripening requirements exceed a small classroom pot.',
    'Panduan lahan disimpan, tetapi ukuran tanaman dan kebutuhan pemasakan melebihi pot kelas kecil.'),
  ('soybean', 'Soybean', 'Kedelai', 'Glycine max', 'Soybean',
    'food_crop', 'annual', 'draft', 'supported', 7,
    '{"year":2024,"table":"5.3.3","measure":"harvested_area_ha","value":2179}'::jsonb,
    'Container-compatible candidate; local variety and sensor thresholds still need reviewer approval.',
    'Kandidat yang cocok untuk pot; varietas lokal dan ambang sensor masih perlu persetujuan peninjau.'),
  ('cayenne-pepper', 'Cayenne pepper', 'Cabai rawit', 'Capsicum frutescens', 'Cayenne Pepper',
    'horticulture', 'short_lived_perennial', 'draft', 'supported', 8,
    '{"year":2024,"table":"5.1.3","measure":"harvested_area_ha","value":1581}'::jsonb,
    'Strong classroom-pot candidate and Jember''s largest seasonal vegetable area in the BPS table.',
    'Kandidat pot kelas yang kuat dan sayuran semusim dengan area terbesar pada tabel BPS Jember.'),
  ('watermelon', 'Watermelon', 'Semangka', 'Citrullus lanatus', 'Watermelon',
    'horticulture', 'annual', 'draft', 'advisory_only', 9,
    '{"year":2024,"table":"5.1.3","measure":"harvested_area_ha","value":1270}'::jsonb,
    'Locally prominent, but vines need substantial space and fruit support.',
    'Menonjol di Jember, tetapi sulurnya memerlukan ruang luas dan penyangga buah.'),
  ('red-chili', 'Large red chili', 'Cabai merah besar', 'Capsicum annuum', 'Large Red Chili',
    'horticulture', 'annual', 'draft', 'supported', 10,
    '{"year":2024,"table":"5.1.3","measure":"harvested_area_ha","value":293}'::jsonb,
    'Container-compatible candidate; the official land table does not provide a numeric air-humidity S1 range.',
    'Kandidat yang cocok untuk pot; tabel lahan resmi tidak memberikan rentang S1 kelembapan udara numerik.')
on conflict (key) do update set
  display_name_en = excluded.display_name_en,
  display_name_id = excluded.display_name_id,
  scientific_name = excluded.scientific_name,
  species = excluded.species,
  crop_group = excluded.crop_group,
  lifecycle = excluded.lifecycle,
  -- Do not undo a later agronomy review when this migration is re-run.
  status = public.crop_profiles.status,
  kit_suitability = public.crop_profiles.kit_suitability,
  catalog_order = excluded.catalog_order,
  jember_evidence = excluded.jember_evidence,
  education_note_en = excluded.education_note_en,
  education_note_id = excluded.education_note_id,
  updated_at = now();

insert into public.crop_profile_versions (
  crop_profile_key, version, timezone, growth_stage_scope, environment_basis,
  temperature_recommended_min, temperature_recommended_max,
  temperature_tolerated_min, temperature_tolerated_max,
  air_humidity_recommended_min, air_humidity_recommended_max,
  soil_ph_recommended_min, soil_ph_recommended_max,
  light_descriptor, binary_ldr_required_during_window,
  lighting_window_start, lighting_window_end, quantitative_light_claim,
  evaluation_policy, limitations, review_status, is_current
)
values
  ('strawberry', 1, 'Asia/Jakarta', 'general', 'indoor_potted',
    20, 24, 15, 27, 40, 60, 5.5, 6.5, 'bright during the configured lighting window', 1, '06:00', '18:00', false,
    '{"mode":"automatic","approved_for_quests":true,"overheating":{"enter_at_or_above":28,"recover_at_or_below":26},"dry_air":{"enter_below":40,"recover_at_or_above":45}}'::jsonb,
    '["General greenhouse guidance; variety and sensor calibration may differ","Binary LDR cannot measure PPFD or DLI"]'::jsonb,
    'approved', false),
  ('rice', 1, 'Asia/Jakarta', 'general', 'field_land_suitability',
    24, 29, 18, 35, 33, 90, 5.5, 7.0, 'very bright', 1, '06:00', '18:00', false,
    '{"mode":"advisory_only","approved_for_quests":false}'::jsonb,
    '["Requires a water-level or flooding sensor","Field S1 range is not an indoor-pot prescription","Binary LDR cannot measure PPFD or DLI"]'::jsonb,
    'needs_local_review', false),
  ('maize', 1, 'Asia/Jakarta', 'general', 'field_land_suitability',
    20, 26, 16, 32, 42, null, 5.8, 7.8, 'very bright', 1, '06:00', '18:00', false,
    '{"mode":"advisory_only","approved_for_quests":false}'::jsonb,
    '["Official S1 humidity criterion is open-ended (>42%)","Needs a large container","Binary LDR cannot measure crop light quantity"]'::jsonb,
    'needs_local_review', false),
  ('tobacco', 1, 'Asia/Jakarta', 'general', 'field_land_suitability',
    22, 28, 15, 34, 24, 75, 5.5, 6.2, 'daylight; type-specific shade management may apply', 1, '06:00', '18:00', false,
    '{"mode":"reference_only","approved_for_quests":false}'::jsonb,
    '["Not selectable in the children''s kit","Nicotine exposure risk","Besuki types require local type-specific review"]'::jsonb,
    'reference_only', false),
  ('coconut', 1, 'Asia/Jakarta', 'seedling', 'seedling_advisory',
    25, 28, 20, 35, 60, null, 5.2, 7.5, 'very bright', 1, '06:00', '18:00', false,
    '{"mode":"advisory_only","approved_for_quests":false}'::jsonb,
    '["Seedling observation only","Official S1 humidity criterion is open-ended (>60%)","Mature-palm performance is out of scope"]'::jsonb,
    'needs_local_review', false),
  ('robusta-coffee', 1, 'Asia/Jakarta', 'seedling', 'seedling_advisory',
    20, 24, 18, 32, 45, 80, 5.3, 6.0, 'clear to cloudy skies; shade depends on growth stage', 1, '06:00', '18:00', false,
    '{"mode":"advisory_only","approved_for_quests":false}'::jsonb,
    '["Seedling observation only","Shade cannot be quantified by the binary LDR","Field S1 range is not a mature-yield prediction"]'::jsonb,
    'needs_local_review', false),
  ('sugarcane', 1, 'Asia/Jakarta', 'general', 'field_land_suitability',
    24, 30, 21, 34, null, 70, 5.5, 7.5, 'very bright; official guide also specifies annual sunshine hours', 1, '06:00', '18:00', false,
    '{"mode":"advisory_only","approved_for_quests":false}'::jsonb,
    '["Official S1 humidity criterion is open-ended (<=70%)","Crop size exceeds the small-pot kit","Binary LDR cannot verify 1800 sunshine hours per year"]'::jsonb,
    'needs_local_review', false),
  ('soybean', 1, 'Asia/Jakarta', 'general', 'field_land_suitability',
    23, 25, 18, 32, 24, 80, 5.5, 7.5, 'very bright', 1, '06:00', '18:00', false,
    '{"mode":"advisory_only","approved_for_quests":false}'::jsonb,
    '["Local variety review required","Field S1 range must be tested in the classroom container","Binary LDR cannot measure PPFD or DLI"]'::jsonb,
    'needs_local_review', false),
  ('cayenne-pepper', 1, 'Asia/Jakarta', 'general', 'field_land_suitability',
    18, 30, 18, 30, 60, 80, 6.0, 7.0, 'bright during daylight; binary LDR only', 1, '06:00', '18:00', false,
    '{"mode":"advisory_only","approved_for_quests":false}'::jsonb,
    '["Local variety review required","The official guide supplies no separate tolerated temperature band, so this draft repeats its cultivation range","The official guide supplies no quantitative light target; binary LDR cannot measure PPFD or DLI"]'::jsonb,
    'needs_local_review', false),
  ('watermelon', 1, 'Asia/Jakarta', 'general', 'field_land_suitability',
    22, 30, 18, 35, 24, 80, 5.8, 7.6, 'clear skies to very bright', 1, '06:00', '18:00', false,
    '{"mode":"advisory_only","approved_for_quests":false}'::jsonb,
    '["Needs substantial vine space and fruit support","Field S1 range is not a small-pot prescription","Binary LDR cannot measure PPFD or DLI"]'::jsonb,
    'needs_local_review', false),
  ('red-chili', 1, 'Asia/Jakarta', 'general', 'field_land_suitability',
    21, 27, 14, 30, null, null, 6.0, 7.6, 'very bright', 1, '06:00', '18:00', false,
    '{"mode":"advisory_only","approved_for_quests":false}'::jsonb,
    '["Official S1 table does not state a numeric air-humidity range","Local variety review required","Binary LDR cannot measure PPFD or DLI"]'::jsonb,
    'needs_local_review', false)
on conflict (crop_profile_key, version) do update set
  timezone = excluded.timezone,
  growth_stage_scope = excluded.growth_stage_scope,
  environment_basis = excluded.environment_basis,
  temperature_recommended_min = excluded.temperature_recommended_min,
  temperature_recommended_max = excluded.temperature_recommended_max,
  temperature_tolerated_min = excluded.temperature_tolerated_min,
  temperature_tolerated_max = excluded.temperature_tolerated_max,
  air_humidity_recommended_min = excluded.air_humidity_recommended_min,
  air_humidity_recommended_max = excluded.air_humidity_recommended_max,
  soil_ph_recommended_min = excluded.soil_ph_recommended_min,
  soil_ph_recommended_max = excluded.soil_ph_recommended_max,
  light_descriptor = excluded.light_descriptor,
  binary_ldr_required_during_window = excluded.binary_ldr_required_during_window,
  lighting_window_start = excluded.lighting_window_start,
  lighting_window_end = excluded.lighting_window_end,
  quantitative_light_claim = excluded.quantitative_light_claim,
  -- Approval/current-version state belongs to a later reviewed migration.
  evaluation_policy = public.crop_profile_versions.evaluation_policy,
  limitations = excluded.limitations,
  review_status = public.crop_profile_versions.review_status,
  is_current = public.crop_profile_versions.is_current;

-- New rows start non-current so re-running this migration cannot collide
-- with a later v2/v3 current profile. Promote v1 only when no current version
-- exists yet for that crop.
update public.crop_profile_versions seeded
set is_current = true
where seeded.version = 1
  and seeded.crop_profile_key in (
    'strawberry', 'rice', 'maize', 'tobacco', 'coconut',
    'robusta-coffee', 'sugarcane', 'soybean', 'cayenne-pepper',
    'watermelon', 'red-chili'
  )
  and not exists (
    select 1
    from public.crop_profile_versions current_version
    where current_version.crop_profile_key = seeded.crop_profile_key
      and current_version.is_current
  );

-- Local prevalence source for each of the ten Jember additions.
insert into public.crop_profile_sources (
  crop_profile_key, profile_version, source_key, organization, title, url,
  source_kind, supported_fields, citation_note, accessed_on
)
select
  evidence.crop_profile_key, 1, 'bps-jember-figures-2025',
  'BPS Kabupaten Jember', 'Kabupaten Jember Dalam Angka 2025',
  'https://jemberkab.bps.go.id/id/publication/2025/02/28/0b6aa001308d7457d545932f/kabupaten-jember-dalam-angka-2025.html',
  'local_statistics', array['jember_evidence'], evidence.citation_note, date '2026-08-08'
from (values
  ('rice', 'Table 5.3.3: 2024 harvested area 158,727 ha'),
  ('maize', 'Table 5.3.3: 2024 harvested area 68,380 ha'),
  ('tobacco', 'Table 5.2.3: 2024 smallholder area 15,397.90 ha'),
  ('coconut', 'Table 5.2.3: 2024 smallholder area 4,778.46 ha'),
  ('robusta-coffee', 'Table 5.2.3: 2024 coffee area 3,872.90 ha; the separate Jember government source supports the robusta species choice'),
  ('sugarcane', 'Table 5.2.3: 2024 smallholder area 2,544.12 ha'),
  ('soybean', 'Table 5.3.3: 2024 harvested area 2,179 ha'),
  ('cayenne-pepper', 'Table 5.1.3: 2024 harvested area 1,581 ha'),
  ('watermelon', 'Table 5.1.3: 2024 harvested area 1,270 ha'),
  ('red-chili', 'Table 5.1.3: 2024 harvested area 293 ha')
) as evidence(crop_profile_key, citation_note)
on conflict (crop_profile_key, profile_version, source_key) do update set
  organization = excluded.organization,
  title = excluded.title,
  url = excluded.url,
  source_kind = excluded.source_kind,
  supported_fields = excluded.supported_fields,
  citation_note = excluded.citation_note,
  accessed_on = excluded.accessed_on;

-- Indonesian official land-suitability criteria. These values describe S1
-- field suitability; they are not automatically approved as indoor alerts.
insert into public.crop_profile_sources (
  crop_profile_key, profile_version, source_key, organization, title, url,
  source_kind, supported_fields, citation_note, accessed_on
)
select
  evidence.crop_profile_key, 1, 'kementan-land-evaluation',
  'Balai Penelitian Tanah, Kementerian Pertanian',
  'Petunjuk Teknis Evaluasi Lahan untuk Komoditas Pertanian',
  'https://repository.pertanian.go.id/handle/123456789/28827',
  'environment_criteria', evidence.supported_fields, evidence.citation_note, date '2026-08-08'
from (values
  ('rice', array['temperature','air_humidity','soil_ph','drainage'], 'Irrigated paddy S1 criteria, page 30'),
  ('maize', array['temperature','air_humidity','soil_ph','drainage'], 'Maize S1 criteria, page 34'),
  ('soybean', array['temperature','air_humidity','soil_ph','drainage'], 'Soybean S1 criteria, page 42'),
  ('tobacco', array['temperature','air_humidity','soil_ph','drainage'], 'Tobacco S1 criteria, page 121'),
  ('coconut', array['temperature','air_humidity','soil_ph','drainage'], 'Coconut S1 criteria, page 114'),
  ('robusta-coffee', array['temperature','air_humidity','soil_ph','drainage'], 'Robusta coffee S1 criteria, page 117'),
  ('sugarcane', array['temperature','air_humidity','soil_ph','light'], 'Sugarcane S1 criteria, page 122'),
  ('watermelon', array['temperature','air_humidity','soil_ph','drainage'], 'Watermelon criteria reproduced in the official crop guide'),
  ('red-chili', array['temperature','soil_ph','drainage'], 'Red chili S1 criteria, page 54; no numeric humidity range supplied')
) as evidence(crop_profile_key, supported_fields, citation_note)
on conflict (crop_profile_key, profile_version, source_key) do update set
  organization = excluded.organization,
  title = excluded.title,
  url = excluded.url,
  source_kind = excluded.source_kind,
  supported_fields = excluded.supported_fields,
  citation_note = excluded.citation_note,
  accessed_on = excluded.accessed_on;

insert into public.crop_profile_sources (
  crop_profile_key, profile_version, source_key, organization, title, url,
  source_kind, supported_fields, citation_note, accessed_on
)
values
  ('robusta-coffee', 1, 'jember-robusta-identity', 'Pemerintah Kabupaten Jember',
    'Persiapan Optimal Menuju Festival Kopi 2025, Dinas TPHP Jember Fokus Kualitas Kopi dan Kreativitas Generasi Muda',
    'https://www.jemberkab.go.id/persiapan-optimal-menuju-festival-kopi-2025-dinas-tphp-jember-fokus-kualitas-kopi-dan-kreativitas-generasi-muda/',
    'local_context', array['species','jember_context'],
    'Dinas TPHP Jember identifies and promotes local robusta coffee as part of Jember coffee identity', date '2026-08-08'),
  ('cayenne-pepper', 1, 'kementan-cayenne-guide', 'Kementerian Pertanian',
    'Teknologi Budidaya Cabai Rawit',
    'https://repository.pertanian.go.id/bitstream/handle/123456789/13263/Teknologi%20Budidaya%20Cabai%20Rawit.pdf?sequence=1',
    'crop_guide', array['temperature','air_humidity','soil_ph'],
    'Cultivation range 18–30°C, air humidity 60–80%, and soil pH 6.0–7.0', date '2026-08-08'),
  ('cayenne-pepper', 1, 'fao-ecocrop-cayenne', 'Food and Agriculture Organization of the United Nations',
    'ECOCROP data sheet: Capsicum frutescens',
    'https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=621',
    'global_database', array['temperature','soil_ph','light'],
    'Cross-check only; Indonesian official guidance remains primary', date '2026-08-08'),
  ('watermelon', 1, 'kementan-watermelon-guide', 'Kementerian Pertanian',
    'Teknologi Budidaya Semangka di Lahan Kering Dataran Rendah',
    'https://repository.pertanian.go.id/server/api/core/bitstreams/93eb147e-cd28-41c4-9ae7-173fcbf2fa87/content',
    'crop_guide', array['temperature','air_humidity','soil_ph'],
    'Contains the watermelon land-suitability table used by this draft', date '2026-08-08'),
  ('red-chili', 1, 'fao-ecocrop-red-chili', 'Food and Agriculture Organization of the United Nations',
    'ECOCROP data sheet: Capsicum annuum',
    'https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=618',
    'global_database', array['temperature','soil_ph','light'],
    'Cross-check only; Indonesian official land criteria remain primary', date '2026-08-08'),
  ('strawberry', 1, 'ohio-state-strawberry-cea', 'Ohio State University CEA',
    'CEBPI Environment', 'https://ohceac.osu.edu/CEBPI-Environment',
    'crop_guide', array['temperature','air_humidity'], 'Existing MVP profile source', date '2026-08-08'),
  ('strawberry', 1, 'umn-strawberry-nutrition', 'University of Minnesota Extension',
    'Strawberry nutrient management', 'https://extension.umn.edu/strawberry-farming/strawberry-nutrient-management',
    'crop_guide', array['soil_ph'], 'Existing MVP profile source', date '2026-08-08'),
  ('strawberry', 1, 'penn-state-strawberry-production', 'Penn State Extension',
    'Strawberry Production', 'https://extension.psu.edu/strawberry-production',
    'crop_guide', array['temperature','soil_ph'], 'Existing MVP profile source', date '2026-08-08')
on conflict (crop_profile_key, profile_version, source_key) do update set
  organization = excluded.organization,
  title = excluded.title,
  url = excluded.url,
  source_kind = excluded.source_kind,
  supported_fields = excluded.supported_fields,
  citation_note = excluded.citation_note,
  accessed_on = excluded.accessed_on;

-- Replace milestone6's one-key check with a catalog FK. Unknown legacy
-- values are normalized to the documented strawberry fallback first.
alter table public.plants
  add column if not exists crop_profile_key text;

update public.plants
set crop_profile_key = 'strawberry'
where crop_profile_key is null
   or not exists (
     select 1 from public.crop_profiles profile
     where profile.key = public.plants.crop_profile_key
   );

alter table public.plants
  alter column crop_profile_key set default 'strawberry';

alter table public.plants
  alter column crop_profile_key set not null;

alter table public.plants
  drop constraint if exists plants_crop_profile_key_check;

alter table public.plants
  drop constraint if exists plants_crop_profile_key_fkey;

alter table public.plants
  add constraint plants_crop_profile_key_fkey
  foreign key (crop_profile_key) references public.crop_profiles (key)
  on update cascade on delete restrict;

-- Public clients can discover only approved profiles. Draft/reference rows
-- remain visible to the Supabase service role and dashboard for review.
alter table public.crop_profiles enable row level security;
alter table public.crop_profile_versions enable row level security;
alter table public.crop_profile_sources enable row level security;

drop policy if exists "public read active crop profiles" on public.crop_profiles;
create policy "public read active crop profiles"
  on public.crop_profiles for select
  using (status = 'active');

drop policy if exists "public read active crop profile versions" on public.crop_profile_versions;
create policy "public read active crop profile versions"
  on public.crop_profile_versions for select
  using (exists (
    select 1 from public.crop_profiles profile
    where profile.key = public.crop_profile_versions.crop_profile_key
      and profile.status = 'active'
  ));

drop policy if exists "public read active crop profile sources" on public.crop_profile_sources;
create policy "public read active crop profile sources"
  on public.crop_profile_sources for select
  using (exists (
    select 1 from public.crop_profiles profile
    where profile.key = public.crop_profile_sources.crop_profile_key
      and profile.status = 'active'
  ));

grant select on public.crop_profiles to anon, authenticated;
grant select on public.crop_profile_versions to anon, authenticated;
grant select on public.crop_profile_sources to anon, authenticated;

comment on table public.crop_profiles is
  'Stable crop identities and Jember relevance. Only status=active profiles may drive automatic game decisions.';
comment on table public.crop_profile_versions is
  'Versioned environment evidence. Draft field ranges are advisory until a local reviewer approves evaluation_policy.';
comment on column public.crop_profile_versions.quantitative_light_claim is
  'Must remain false while the hardware supplies only a binary LDR value.';
