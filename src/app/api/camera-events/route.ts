import { getServerSupabase } from "@/lib/supabase/server";

const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 10_000;

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  if (input.kind !== "touch") return Response.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  const occurredAt = typeof input.occurredAt === "string" ? new Date(input.occurredAt) : null;
  if (!occurredAt || Number.isNaN(occurredAt.valueOf()) || Math.abs(Date.now() - occurredAt.valueOf()) > 60_000) return Response.json({ ok: false, error: "invalid_time" }, { status: 400 });
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const last = cooldowns.get(client) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) return Response.json({ ok: true, persisted: false, reason: "cooldown" });
  cooldowns.set(client, Date.now());
  const supabase = getServerSupabase();
  if (!supabase) return Response.json({ ok: true, persisted: false, reason: "offline" });
  const { error } = await supabase.from("camera_events").insert({ plant_id: "plant-01", kind: "touch", occurred_at: occurredAt.toISOString(), note: {} });
  return Response.json({ ok: true, persisted: !error, reason: error ? "migration_required" : null });
}
