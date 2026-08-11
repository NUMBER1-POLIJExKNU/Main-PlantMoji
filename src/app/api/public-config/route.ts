/**
 * GET /api/public-config — hands the BROWSER-SAFE Supabase config to the
 * static pixel-farm page (public/farm/live.js), which can't read Next.js
 * env vars at build time. Only NEXT_PUBLIC_* values are exposed — these are
 * public by definition; the secret key never appears here.
 *
 * Payload is constant per deployment (build-time env vars), but Next 16
 * Route Handlers are NOT cached by default — every request re-runs GET
 * unless a segment config opts in (node_modules/next/dist/docs/01-app/
 * 01-getting-started/15-route-handlers.md, "Caching"). `force-static`
 * prerenders/caches the response; `revalidate = false` pins it to cache
 * indefinitely (a new deployment is the only thing that can change these
 * values anyway).
 */
export const dynamic = "force-static";
export const revalidate = false;

export function GET() {
  return Response.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null,
  });
}
