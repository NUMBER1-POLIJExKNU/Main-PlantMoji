import { generateMemoryReflection } from "@/lib/ai";
import { normalizeLocale } from "@/lib/i18n";
import { MEMORY_EVENT_TYPES, memoryReflectionAngle, memoryTimeAgo, toJamkachuMemory, validMemoryReflection, type MemoryEventRow } from "@/lib/jamkachu-memory";
import { getServerSupabase } from "@/lib/supabase/server";
import { normalizePersonality } from "@/types/game";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const windows = new Map<string, { count: number; startedAt: number }>();
const cache = new Map<string, string>();

function allowed(request: Request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) { windows.set(key, { count: 1, startedAt: now }); return true; }
  current.count += 1;
  return current.count <= MAX_REQUESTS;
}

export async function POST(request: Request) {
  if (!allowed(request)) return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const eventId = typeof input.eventId === "string" ? input.eventId.trim().slice(0, 120) : "";
  const locale = normalizeLocale(input.locale);
  if (!eventId) return Response.json({ ok: false, error: "invalid_event" }, { status: 400 });
  const supabase = getServerSupabase();
  if (!supabase) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  const [result, plantResult] = await Promise.all([
    supabase.from("bond_events").select("event_id,type,data,occurred_at").eq("plant_id", "plant-01").eq("event_id", eventId).in("type", [...MEMORY_EVENT_TYPES]).maybeSingle(),
    supabase.from("plants").select("name,personality").eq("id", "plant-01").maybeSingle(),
  ]);
  const memory = result.data ? toJamkachuMemory(result.data as MemoryEventRow, locale) : null;
  if (!memory) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  const key = `${eventId}|${locale}`;
  const cached = cache.get(key);
  if (cached) return Response.json({ ok: true, reflection: cached, source: "ai" });
  const plant = plantResult.error ? null : plantResult.data;
  // Openings of the latest generated reflections — passed so the next entry
  // can't start the same way (the user-visible symptom of template sameness).
  const avoidOpenings = [...cache.values()].slice(-3).map((line) => line.split(/\s+/).slice(0, 5).join(" "));
  const ai = await generateMemoryReflection({
    plantName: typeof plant?.name === "string" && plant.name.trim() ? plant.name : "Jamkachu",
    verifiedMemory: memory.verifiedSummary,
    fallback: memory.fallback,
    locale,
    personality: normalizePersonality(plant?.personality),
    timeAgo: memoryTimeAgo(memory.occurredAt, locale),
    angle: memoryReflectionAngle(memory.id),
    avoidOpenings,
  });
  const reflection = ai && validMemoryReflection(ai, memory) ? ai : memory.fallback;
  if (reflection === ai) {
    cache.set(key, reflection);
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
  }
  return Response.json({ ok: true, reflection, source: reflection === ai ? "ai" : "fallback" });
}
