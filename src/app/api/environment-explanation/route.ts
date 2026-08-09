import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
import { analyzeEnvironment } from "@/lib/environment-analyzer";
import { ENVIRONMENT_DEMO_SNAPSHOT } from "@/lib/environment-demo";
import { explainCropMismatch } from "@/lib/environment-explanation";
import { normalizeLocale } from "@/lib/i18n";
import { getJemberCropCatalog } from "@/lib/jember-crop-catalog";
import { getServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const cropKey = typeof input.cropKey === "string" ? input.cropKey : "";
  const locale = normalizeLocale(input.locale);
  const demo = input.demo === true;
  const supabase = getServerSupabase();
  if (!supabase) return Response.json({ ok: false, error: "no_env" }, { status: 503 });
  const [snapshot, crops] = await Promise.all([
    demo ? Promise.resolve(ENVIRONMENT_DEMO_SNAPSHOT) : getLatestSensorSnapshot(supabase, "plant-01"),
    getJemberCropCatalog(supabase, locale),
  ]);
  const crop = crops.find((item) => item.key === cropKey);
  if (!snapshot || !crop) return Response.json({ ok: false, error: "unavailable" }, { status: 404 });
  const analysis = analyzeEnvironment(snapshot, crop);
  return Response.json({ ok: true, explanation: await explainCropMismatch(crop, analysis, locale), analysis });
}
