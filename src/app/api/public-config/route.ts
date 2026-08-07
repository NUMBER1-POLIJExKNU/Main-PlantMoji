/**
 * GET /api/public-config — hands the BROWSER-SAFE Supabase config to the
 * static pixel-farm page (public/farm/live.js), which can't read Next.js
 * env vars at build time. Only NEXT_PUBLIC_* values are exposed — these are
 * public by definition; the secret key never appears here.
 */
export function GET() {
  return Response.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null,
  });
}
