import { getPlantCropProfile } from "@/lib/crop-profile-data";
import { toDeviceCropProfile } from "@/lib/crop-profiles";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requiredToken = process.env.DEVICE_API_TOKEN;
  if (requiredToken && request.headers.get("authorization") !== `Bearer ${requiredToken}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const plantId = new URL(request.url).searchParams.get("plantId") ?? "plant-01";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(plantId)) {
    return Response.json({ ok: false, error: "invalid plantId" }, { status: 400 });
  }
  const supabase = getServerSupabase();
  if (!supabase) return Response.json({ ok: false, error: "supabase is not configured" }, { status: 503 });
  try {
    const profile = await getPlantCropProfile(supabase, plantId);
    if (!profile) return Response.json({ ok: false, error: `unknown plantId: ${plantId}` }, { status: 404 });
    return Response.json({ ok: true, plantId, profile: toDeviceCropProfile(profile) });
  } catch (error) {
    console.error("crop-profile lookup failed:", error);
    return Response.json({ ok: false, error: "database error" }, { status: 500 });
  }
}
