// Seed Shop route (milestone18). Server component: reads the balance and
// purchases with the service client, then hands plain serializable props to
// the ShopGrid island (same RSC split as /collection). Missing milestone18
// migration → friendly "coming soon" panel with an English operator note
// (same contract as the quiz.js migration copy).

import "./shop.css";
import PageHeader from "@/components/page-header";
import ShopGrid, { type ShopGridItem, type ShopPurchaseRow } from "@/components/shop-grid";
import Notice from "@/components/notice";
import { SHOP_CATALOG, SHOP_UI_COPY } from "@/game/economy/shop-catalog";
import { getRequestLocale } from "@/lib/i18n-server";
import { getServerSupabase } from "@/lib/supabase/server";
import { maybeScheduleGameTick } from "@/lib/tick-gate";

export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

export default async function ShopPage() {
  const locale = await getRequestLocale();
  const copy = SHOP_UI_COPY[locale];
  const supabase = getServerSupabase();

  if (!supabase) {
    return <Notice title={copy.offlineTitle} lines={[...copy.offlineLines]} />;
  }

  maybeScheduleGameTick(PLANT_ID);

  // Selecting the seeds column fails while milestone18 is missing (unknown
  // column), as does the shop_purchases read (unknown table) — either error
  // means "coming soon", never a crash.
  const [bondRes, purchasesRes] = await Promise.all([
    supabase.from("bond_state").select("seeds").eq("plant_id", PLANT_ID).maybeSingle(),
    supabase
      .from("shop_purchases")
      .select("item_key, category, equipped")
      .eq("plant_id", PLANT_ID),
  ]);

  if (bondRes.error || purchasesRes.error) {
    // Missing migration (supabase/milestone18-seed-shop.sql) → graceful
    // "coming soon" panel, never a crash.
    return <Notice title={copy.comingSoonTitle} lines={[...copy.comingSoonLines]} />;
  }

  const seeds = Number((bondRes.data as { seeds?: number } | null)?.seeds ?? 0);
  const purchases = (purchasesRes.data ?? []) as ShopPurchaseRow[];
  const items: ShopGridItem[] = SHOP_CATALOG.map((item) => ({
    key: item.key,
    category: item.category,
    price: item.price,
    emoji: item.emoji,
    name: item.name[locale],
    blurb: item.blurb[locale],
  }));

  return (
    <main className="pm-shop w-full">
      <PageHeader icon="🛒" eyebrow={copy.eyebrow} title={copy.title} description={copy.subtitle} />
      <ShopGrid
        locale={locale}
        plantId={PLANT_ID}
        initialSeeds={seeds}
        items={items}
        initialPurchases={purchases}
      />
    </main>
  );
}
