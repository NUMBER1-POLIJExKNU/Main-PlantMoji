import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
import { compareEnvironmentToCrops } from "@/lib/environment-analyzer";
import { getEnvironmentDemoPreset } from "@/lib/environment-demo";
import { normalizeLocale } from "@/lib/i18n";
import { getJemberCropCatalog } from "@/lib/jember-crop-catalog";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const plantId = params.get("plantId") ?? "plant-01";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(plantId)) return Response.json({ ok: false, error: "invalid_plant" }, { status: 400 });
  const supabase = getServerSupabase();
  if (!supabase) return Response.json({ ok: false, error: "no_env" }, { status: 503 });
  const locale = normalizeLocale(params.get("locale"));
  const demoValue = params.get("demo");
  const demo = demoValue !== null && demoValue !== "0";
  const [snapshot, crops] = await Promise.all([
    demo ? Promise.resolve(getEnvironmentDemoPreset(demoValue)) : getLatestSensorSnapshot(supabase, plantId),
    getJemberCropCatalog(supabase, locale),
  ]);
  if (!snapshot) return Response.json({ ok: false, error: "no_sensor_snapshot" }, { status: 404 });
  if (!crops.length) return Response.json({ ok: false, error: "catalog_unavailable" }, { status: 503 });
  return Response.json({ ok: true, source: demo ? "demo" : "sensor", snapshot, crops, results: compareEnvironmentToCrops(snapshot, crops) });
}
