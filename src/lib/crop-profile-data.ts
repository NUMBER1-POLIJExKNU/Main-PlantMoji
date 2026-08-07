import type { SupabaseClient } from "@supabase/supabase-js";
import { getCropProfile, type SensorSnapshot } from "@/lib/crop-profiles";

export async function getPlantCropProfile(supabase: SupabaseClient, plantId: string) {
  const { data, error } = await supabase
    .from("plants")
    .select("id, crop_profile_key")
    .eq("id", plantId)
    .maybeSingle();

  if (error) {
    // An installation that has not run milestone6 still gets the documented
    // strawberry default. Other errors remain real database failures.
    if (/crop_profile_key/i.test(error.message)) {
      const fallback = await supabase.from("plants").select("id").eq("id", plantId).maybeSingle();
      if (fallback.error) throw new Error(fallback.error.message);
      return fallback.data ? getCropProfile(null) : null;
    }
    throw new Error(error.message);
  }
  return data ? getCropProfile(data.crop_profile_key) : null;
}

export async function getLatestSensorSnapshot(
  supabase: SupabaseClient,
  plantId: string,
): Promise<SensorSnapshot | null> {
  const { data, error } = await supabase
    .from("sensor_readings")
    .select("temperature, humidity, soil_ph, light, recorded_at")
    .eq("plant_id", plantId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (/sensor_readings|schema cache|does not exist/i.test(error.message)) return null;
    console.error(`getLatestSensorSnapshot(${plantId}) failed:`, error.message);
    return null;
  }
  if (!data) return null;
  const finite = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  return {
    temperature: finite(data.temperature),
    humidity: finite(data.humidity),
    soilPh: finite(data.soil_ph),
    light: finite(data.light),
    recordedAt: typeof data.recorded_at === "string" ? data.recorded_at : null,
  };
}
