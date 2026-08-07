import { getBmkgLocalContext } from "@/lib/bmkg";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getBmkgLocalContext();
  return Response.json(context, {
    status: context.ok ? 200 : 503,
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
