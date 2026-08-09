# Jember crop profile catalog

`supabase/milestone10-jember-crop-catalog.sql` adds ten locally relevant crop records plus the existing strawberry profile to Supabase.

## Why these ten

The list uses the latest complete crop tables in *Kabupaten Jember Dalam Angka 2025* (2024 data). Food crops, horticulture, and estate crops use different reporting units and production systems, so `catalog_order` is a presentation order—not a claim that unlike categories form one exact league table.

| Order | Profile key | Local crop | BPS 2024 evidence | Kit status |
|---:|---|---|---:|---|
| 1 | `rice` | Padi | 158,727 ha harvested | Advisory only; water-level sensor missing |
| 2 | `maize` | Jagung | 68,380 ha harvested | Advisory only; large container |
| 3 | `tobacco` | Tembakau | 15,397.90 ha smallholder area | Reference only; not for a children's growing activity |
| 4 | `coconut` | Kelapa | 4,778.46 ha smallholder area | Seedling only |
| 5 | `robusta-coffee` | Kopi robusta | 3,872.90 ha coffee area | Seedling only |
| 6 | `sugarcane` | Tebu | 2,544.12 ha smallholder area | Advisory only; too large for the kit |
| 7 | `soybean` | Kedelai | 2,179 ha harvested | Pot candidate; review required |
| 8 | `cayenne-pepper` | Cabai rawit | 1,581 ha harvested | Pot candidate; review required |
| 9 | `watermelon` | Semangka | 1,270 ha harvested | Advisory only; vine space/support required |
| 10 | `red-chili` | Cabai merah besar | 293 ha harvested | Pot candidate; review required |

The existing `strawberry` row is also seeded so `plants.crop_profile_key` can become a foreign key without breaking `plant-01`.

## Stored environment evidence

The values below are research baselines, not yet automatic quest thresholds. Except for the existing strawberry profile, each row stays `draft` or `reference_only` and has `approved_for_quests=false`.

| Crop | Recommended temperature | Tolerated research band | Recommended air RH | Recommended soil pH | Light descriptor |
|---|---:|---:|---:|---:|---|
| Padi | 24–29°C | 18–35°C | 33–90% | 5.5–7.0 | Very bright |
| Jagung | 20–26°C | 16–32°C | ≥42% | 5.8–7.8 | Very bright |
| Tembakau | 22–28°C | 15–34°C | 24–75% | 5.5–6.2 | Daylight; type-specific shade may apply |
| Kelapa | 25–28°C | 20–35°C | ≥60% | 5.2–7.5 | Very bright |
| Kopi robusta | 20–24°C | 18–32°C | 45–80% | 5.3–6.0 | Clear/cloudy; growth-stage shade matters |
| Tebu | 24–30°C | 21–34°C | ≤70% | 5.5–7.5 | Very bright; official guide also uses annual sunshine hours |
| Kedelai | 23–25°C | 18–32°C | 24–80% | 5.5–7.5 | Very bright |
| Cabai rawit | 18–30°C | 18–30°C¹ | 60–80% | 6.0–7.0 | Bright during daylight; relative LDR only |
| Semangka | 22–30°C | 18–35°C | 24–80% | 5.8–7.6 | Clear skies / very bright |
| Cabai merah besar | 21–27°C | 14–30°C | Not supplied in the official S1 table | 6.0–7.6 | Very bright |

Open-ended values such as `≥42%` are represented with one nullable bound in the database. Missing evidence stays `NULL`; it is not guessed.

¹ The official cabai rawit guide gives a cultivation range but no separate tolerance band, so the draft repeats 18–30°C until local review.

Node-RED publishes the calibrated LDR output as a relative 0–100% value. The
runtime uses an operational classroom boundary of 30% during the configured
daytime window. This percentage is not a crop-specific light requirement and
does not measure lux, PPFD, DLI, or photosynthetic sufficiency. The catalog's
legacy `binary_ldr_required_during_window` field only records whether a crop
expects a daytime light check; it does not convert the percentage into an
agronomic claim. `quantitative_light_claim` therefore remains `false`.

## Activation rule

Only `status='active'` rows are readable through the public Supabase role. Draft and reference rows are available to the service role and Supabase dashboard for review.

Before activating a new profile:

1. Choose the actual local variety and growth stage.
2. Have a POLIJE/Jember agronomy reviewer approve the ranges.
3. Calibrate DHT11, pH, and LDR readings in the real kit location.
4. Define alert entry/recovery hysteresis separately from broad land-suitability ranges.
5. Add the approved profile to the web/quest/Node-RED runtime registry and bump its version.

This prevents field-scale land criteria from silently becoming indoor quest truth.

## Sources

- [BPS Kabupaten Jember — Kabupaten Jember Dalam Angka 2025](https://jemberkab.bps.go.id/id/publication/2025/02/28/0b6aa001308d7457d545932f/kabupaten-jember-dalam-angka-2025.html), tables 5.1.3, 5.2.3, and 5.3.3.
- [Kementerian Pertanian — Petunjuk Teknis Evaluasi Lahan untuk Komoditas Pertanian](https://repository.pertanian.go.id/handle/123456789/28827), crop-specific S1 suitability tables.
- [Kementerian Pertanian — Teknologi Budidaya Cabai Rawit](https://repository.pertanian.go.id/bitstream/handle/123456789/13263/Teknologi%20Budidaya%20Cabai%20Rawit.pdf?sequence=1).
- [Kementerian Pertanian — watermelon cultivation and land-suitability guide](https://repository.pertanian.go.id/server/api/core/bitstreams/93eb147e-cd28-41c4-9ae7-173fcbf2fa87/content).
- [Pemerintah Kabupaten Jember — Jember robusta coffee identity and Festival Kopi 2025 preparation](https://www.jemberkab.go.id/persiapan-optimal-menuju-festival-kopi-2025-dinas-tphp-jember-fokus-kualitas-kopi-dan-kreativitas-generasi-muda/).
- [FAO ECOCROP — Capsicum frutescens](https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=621) and [Capsicum annuum](https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=618), used as cross-checks where noted.
