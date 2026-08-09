import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentCropProfile } from "@/lib/environment-analyzer";
import type { AppLocale } from "@/lib/i18n";
import { LIGHT_SUFFICIENT_PERCENT } from "@/lib/light-sensor";

export interface ExplorerCrop extends EnvironmentCropProfile {
  scientificName: string;
  educationNote: string;
  limitations: string[];
  reviewStatus: string;
}

type ProfileRow = { key: string; display_name_en: string; display_name_id: string; scientific_name: string; status: EnvironmentCropProfile["status"]; catalog_order: number | null; education_note_en: string; education_note_id: string };
type VersionRow = { crop_profile_key: string; temperature_tolerated_min: number; temperature_tolerated_max: number; air_humidity_recommended_min: number | null; air_humidity_recommended_max: number | null; soil_ph_recommended_min: number; soil_ph_recommended_max: number; binary_ldr_required_during_window: 0 | 1; lighting_window_start: string; lighting_window_end: string; limitations: unknown; review_status: string };

function hour(value: string) { return Number(value.slice(0, 2)); }
function inLightingWindow(now: Date, start: string, end: string) {
  const current = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(now));
  const from = hour(start); const to = hour(end);
  return from < to ? current >= from && current < to : current >= from || current < to;
}

export async function getJemberCropCatalog(supabase: SupabaseClient, locale: AppLocale, now = new Date()): Promise<ExplorerCrop[]> {
  const [profilesResult, versionsResult] = await Promise.all([
    supabase.from("crop_profiles").select("key, display_name_en, display_name_id, scientific_name, status, catalog_order, education_note_en, education_note_id").neq("status", "retired").order("catalog_order", { ascending: true, nullsFirst: true }),
    supabase.from("crop_profile_versions").select("crop_profile_key, temperature_tolerated_min, temperature_tolerated_max, air_humidity_recommended_min, air_humidity_recommended_max, soil_ph_recommended_min, soil_ph_recommended_max, binary_ldr_required_during_window, lighting_window_start, lighting_window_end, limitations, review_status").eq("is_current", true),
  ]);
  if (profilesResult.error || versionsResult.error) return [];
  const versions = new Map((versionsResult.data as VersionRow[]).map((row) => [row.crop_profile_key, row]));
  return (profilesResult.data as ProfileRow[]).flatMap((profile) => {
    const version = versions.get(profile.key); if (!version) return [];
    return [{
      key: profile.key, displayName: locale === "id" ? profile.display_name_id : profile.display_name_en,
      scientificName: profile.scientific_name, status: profile.status, catalogOrder: profile.catalog_order,
      educationNote: locale === "id" ? profile.education_note_id : profile.education_note_en,
      limitations: Array.isArray(version.limitations) ? version.limitations.filter((item): item is string => typeof item === "string") : [],
      reviewStatus: version.review_status,
      temperature: { min: version.temperature_tolerated_min, max: version.temperature_tolerated_max },
      airHumidity: { min: version.air_humidity_recommended_min, max: version.air_humidity_recommended_max },
      soilPh: { min: version.soil_ph_recommended_min, max: version.soil_ph_recommended_max },
      light: { minimumPercent: version.binary_ldr_required_during_window === 1 ? LIGHT_SUFFICIENT_PERCENT : null, evaluateNow: inLightingWindow(now, version.lighting_window_start, version.lighting_window_end) },
    }];
  });
}
