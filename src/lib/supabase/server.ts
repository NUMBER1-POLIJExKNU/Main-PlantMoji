import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
let cachedSlow: SupabaseClient | null = null;

// A dead or paused Supabase project must not trap every server-rendered tab
// behind Next's loading screen. The pages already render safe Notice states
// for query errors; this transport cap lets them reach that fallback quickly.
const SUPABASE_REQUEST_TIMEOUT_MS = 2_500;

// Bulk history reads are a different shape of request and 2.5s misjudges them
// as a dead project. /api/sensor-history pulls up to 1000 rows for the last
// hour, and at the rate the device posts that is a real, healthy query that
// routinely takes longer — measured aborting at exactly 2.5s under the 5s and
// 10s pollers, which turned the light chart blank while the gauges above it
// still had numbers. Still bounded, just bounded for the work being done.
const SUPABASE_BULK_TIMEOUT_MS = 15_000;

function timeoutFetch(limitMs: number) {
  return async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limitMs);
    const upstreamSignal = init?.signal;
    const signal = upstreamSignal
      ? AbortSignal.any([upstreamSignal, controller.signal])
      : controller.signal;

    try {
      return await fetch(input, { ...init, signal });
    } finally {
      clearTimeout(timer);
    }
  };
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
      global: { fetch: timeoutFetch(SUPABASE_REQUEST_TIMEOUT_MS) },
    });
  }
  return cached;
}

/**
 * Same client, with the transport cap raised for bulk history reads.
 *
 * Only for endpoints that legitimately pull hundreds of rows — page renders
 * must keep the short cap, or a paused project hangs them. Everything else
 * about the client is identical, including the secret key: never import this
 * from a client component.
 */
export function getServerSupabaseForBulkRead(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;

  if (!cachedSlow) {
    cachedSlow = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: timeoutFetch(SUPABASE_BULK_TIMEOUT_MS) },
    });
  }
  return cachedSlow;
}
