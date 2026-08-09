import { generateCameraAdvice } from "@/lib/ai";
import { normalizeLocale } from "@/lib/i18n";
import { getServerSupabase } from "@/lib/supabase/server";

const MAX_BASE64_CHARS = 270_000;
const scanWindows = new Map<string, number>();

export async function POST(request: Request) {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const lastScan = scanWindows.get(client) ?? 0;
  if (Date.now() - lastScan < 30_000) return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const locale = normalizeLocale(input.locale);
  const image = typeof input.image === "string" ? input.image : "";
  const match = image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1].length > MAX_BASE64_CHARS) return Response.json({ ok: false, error: "invalid_image" }, { status: 400 });
  scanWindows.set(client, Date.now());
  if (!process.env.GEMINI_API_KEY) return Response.json({ ok: true, disabled: true, verdict: "none" });
  const verdict = await generateCameraAdvice({ imageBase64: match[1], mimeType: "image/jpeg", locale });
  if (verdict !== "POSSIBLE_PEST") return Response.json({ ok: true, verdict: "none" });
  const advice = locale === "id" ? "Mungkin ada sesuatu di daun. Yuk periksa bersama guru." : "Something may be on a leaf. Please look closely with a teacher.";
  const supabase = getServerSupabase();
  if (supabase) await supabase.from("camera_events").insert({ plant_id: "plant-01", kind: "pest_advice", occurred_at: new Date().toISOString(), note: { advice, locale } });
  return Response.json({ ok: true, verdict: "possible_pest", advice });
}
