import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// A dead or paused Supabase project must not trap every server-rendered tab
// behind Next's loading screen. The pages already render safe Notice states
// for query errors; this transport cap lets them reach that fallback quickly.
const SUPABASE_REQUEST_TIMEOUT_MS = 2_500;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);
  const upstreamSignal = init?.signal;
  const signal = upstreamSignal
    ? AbortSignal.any([upstreamSignal, controller.signal])
    : controller.signal;

  try {
    return await fetch(input, { ...init, signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server-side Supabase client using the secret key.
 * Never import this from client components — the secret key must not reach
 * the browser (handoff §9).
 *
 * Returns null when env vars are missing so callers can render a setup hint
 * instead of crashing.
 */
export function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;

  if (!cached) {
    cached = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout },
    });
  }
  return cached;
}
