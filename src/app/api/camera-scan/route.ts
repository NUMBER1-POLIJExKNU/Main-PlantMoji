import { CAMERA_COPY } from "@/app/camera/copy";
import { normalizeLocale } from "@/lib/i18n";
import { analyzePestSnapshot } from "@/lib/pest-advisory";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/camera-scan — ONE downscaled JPEG in, advisory language out
 * (spec: docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
 *
 * PRIVACY CONTRACT (spec §Invariants): the snapshot exists only as the
 * base64 string inside this request's memory. It is never decoded into a
 * buffer, never uploaded, never written to any table — the pest_advice row
 * is text/jsonb only. Person in frame → analyzePestSnapshot returns
 * "discarded" → generic line, nothing persisted.
 *
 * REWARDS CONTRACT: the verdict is advisory copy. This route grants
 * nothing, and nothing downstream may parse it into a game decision.
 */

const VALID_PLANT = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_IMAGE_BYTES = 200 * 1024;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const MIN_ADVICE_GAP_MS = 10_000;

function isMissingSchemaError(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /could not find the (function|table)/i.test(error.message)
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const plantId = typeof body.plantId === "string" ? body.plantId : "plant-01";
  if (!VALID_PLANT.test(plantId)) {
    return Response.json({ ok: false, error: "invalid_plant" }, { status: 400 });
  }
  if (body.mimeType !== "image/jpeg") {
    return Response.json({ ok: false, error: "bad_type" }, { status: 400 });
  }
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  if (!imageBase64 || !BASE64_RE.test(imageBase64)) {
    return Response.json({ ok: false, error: "bad_image" }, { status: 400 });
  }
  // Size check on the ENCODED string (≈ decoded × 4/3) — the snapshot is
  // never decoded server-side; it stays an opaque string end to end.
  if ((imageBase64.length * 3) / 4 > MAX_IMAGE_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 400 });
  }
  const locale = normalizeLocale(body.locale);

  // The paid vision call sits BEHIND the server-side rate limit, not in
  // front of it: a scripted client must not be able to burn GEMINI_API_KEY
  // quota by looping POSTs. The latest pest_advice row is the shared clock;
  // when Supabase or milestone19 is missing the gate is open by design
  // (local/dev — the camera page still self-limits to one scan per 10 min).
  const supabase = getServerSupabase();
  let gateReadOk = false;
  if (supabase) {
    const { data: lastRows, error: lastError } = await supabase
      .from("camera_events")
      .select("occurred_at")
      .eq("plant_id", plantId)
      .eq("kind", "pest_advice")
      .order("occurred_at", { ascending: false })
      .limit(1);
    if (!lastError) {
      gateReadOk = true;
      const lastAt = lastRows?.[0]?.occurred_at
        ? Date.parse(String(lastRows[0].occurred_at))
        : null;
      if (lastAt !== null && Number.isFinite(lastAt) && Date.now() - lastAt < MIN_ADVICE_GAP_MS) {
        return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
      }
    } else if (!isMissingSchemaError(lastError)) {
      console.error(`camera-scan(${plantId}) rate-limit read failed:`, lastError.message);
    }
  }

  const outcome = await analyzePestSnapshot({ imageBase64, mimeType: "image/jpeg", locale });

  if (outcome.status === "disabled") {
    // No key / timeout / network / malformed → client stays motion-only.
    return Response.json({ ok: true, disabled: true });
  }
  if (outcome.status === "clear") {
    return Response.json({ ok: true, verdict: "none" });
  }
  if (outcome.status === "discarded") {
    // Person in frame → NO_PLANT sentinel → snapshot dropped, generic line
    // shown, NOTHING persisted (spec §Invariants).
    return Response.json({ ok: true, verdict: "none", advisory: CAMERA_COPY[locale].scanGeneric });
  }

  // Pest verdict → best-effort TEXT-ONLY advisory row for the farm fan-out.
  // The ≥10s gap was already checked above (before the vision call); missing
  // Supabase config, missing milestone19, or an insert failure all still
  // return the advisory to the camera page.
  if (supabase && gateReadOk) {
    const { error: insertError } = await supabase.from("camera_events").insert({
      plant_id: plantId,
      kind: "pest_advice",
      occurred_at: new Date().toISOString(),
      note: { message: outcome.advisory, locale },
    });
    if (insertError && !isMissingSchemaError(insertError)) {
      console.error(`camera-scan(${plantId}) advisory insert failed:`, insertError.message);
    }
  }

  return Response.json({ ok: true, verdict: "pest", advisory: outcome.advisory });
}
