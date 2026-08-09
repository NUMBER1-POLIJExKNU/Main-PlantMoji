import { generateFarmerAiReply } from "@/lib/ai";
import { evaluateCropEnvironment, getCropProfile } from "@/lib/crop-profiles";
import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
import { ENVIRONMENT_DEMO_SNAPSHOT } from "@/lib/environment-demo";
import { deterministicFarmerReply, farmerFacts, validFarmerReply } from "@/lib/farmer-chat";
import { normalizeLocale } from "@/lib/i18n";
import { fetchPlant } from "@/lib/plants";
import { getServerSupabase } from "@/lib/supabase/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const requestWindows = new Map<string, { count: number; startedAt: number }>();

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function allowed(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const window = requestWindows.get(key);
  if (!window || now - window.startedAt >= WINDOW_MS) {
    requestWindows.set(key, { count: 1, startedAt: now });
    return true;
  }
  window.count += 1;
  return window.count <= MAX_REQUESTS;
}

export async function POST(request: Request) {
  if (!allowed(request)) return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const question = typeof input.question === "string" ? input.question.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (!question || question.length > 280) return Response.json({ ok: false, error: "invalid_question" }, { status: 400 });
  const locale = normalizeLocale(input.locale);
  const demo = input.demo === true;
  // Demo chat must remain instant and independent of Supabase availability.
  const plantResult = demo ? null : await fetchPlant("plant-01");
  const plant = plantResult?.status === "ok" ? plantResult.plant : null;
  const profile = getCropProfile(plant?.crop_profile_key);
  const supabase = getServerSupabase();
  const snapshot = demo ? ENVIRONMENT_DEMO_SNAPSHOT : supabase ? await getLatestSensorSnapshot(supabase, "plant-01") : null;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: profile.timezone }).format(new Date()));
  const lightingHours = hour >= profile.light.lightingHours.start && hour < profile.light.lightingHours.end;
  const context = {
    plantName: plant?.name ?? "Jamkachu",
    cropName: profile.displayName,
    snapshot,
    environment: evaluateCropEnvironment(snapshot, profile, lightingHours),
    locale,
  };
  const facts = farmerFacts(context);
  const fallback = deterministicFarmerReply(question, context);
  const aiReply = await generateFarmerAiReply({ question, verifiedFacts: facts, fallbackAnswer: fallback, locale });
  const reply = aiReply && validFarmerReply(aiReply, facts, locale) ? aiReply : fallback;
  return Response.json({ ok: true, reply, source: reply === aiReply ? "ai" : "fallback", dataSource: demo ? "demo" : snapshot ? "sensor" : "unavailable" });
}
