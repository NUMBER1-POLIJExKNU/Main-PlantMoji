-- Node-RED now publishes calibrated relative LDR values from 0 to 100%.
-- This is not lux, PPFD, DLI, or a crop-specific agronomic light target.

alter table public.sensor_readings
  alter column light type numeric using light::numeric;

alter table public.sensor_readings
  drop constraint if exists sensor_readings_light_percent_check;

alter table public.sensor_readings
  add constraint sensor_readings_light_percent_check
  check (light is null or (light >= 0 and light <= 100));

comment on column public.sensor_readings.light is
  'Calibrated relative LDR output, 0-100 percent. Values below 30 are operationally Low during configured lighting hours; this is not lux/PPFD/DLI.';
