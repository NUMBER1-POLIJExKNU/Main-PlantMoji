// Seed Shop route (milestone18). Server component: reads the balance and
// purchases with the service client, then hands plain serializable props to
// the ShopGrid island (same RSC split as /collection). Missing milestone18
// migration → friendly "coming soon" panel with an English operator note
// (same contract as the quiz.js migration copy).

import "./shop.css";
import NpcBadge from "@/components/npc-badge";
import PageHeader from "@/components/page-header";
import ShopGrid, { type ShopGridItem, type ShopPurchaseRow } from "@/components/shop-grid";
import Notice from "@/components/notice";
import { SHOP_CATALOG, SHOP_UI_COPY } from "@/game/economy/shop-catalog";
import { npcTagline } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { getServerSupabase } from "@/lib/supabase/server";
import { maybeScheduleGameTick } from "@/lib/tick-gate";
import { normalizeMood } from "@/types/events";
import { COMPANION_STAGES, type CompanionStage } from "@/types/game";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

export default async function ShopPage() {
  const locale = await getRequestLocale();
  const copy = SHOP_UI_COPY[locale];
  const supabase = getServerSupabase();

  if (!supabase) {
    return <Notice locale={locale} title={copy.offlineTitle} lines={[...copy.offlineLines]} />;
  }

  maybeScheduleGameTick(PLANT_ID);

  // Selecting the seeds column fails while milestone18 is missing (unknown
  // column), as does the shop_purchases read (unknown table) — either error
  // means "coming soon", never a crash. plantRes/companionRes feed the
  // try-on preview stage only (Phase 1, kiki design integration) — they
  // never gate the page: any error there just falls back to the graceful
  // "p4 happy bare" sprite default below, same as spriteSrc's own default.
  const [bondRes, purchasesRes, plantRes, companionRes] = await Promise.all([
    supabase.from("bond_state").select("seeds, bond_level").eq("plant_id", PLANT_ID).maybeSingle(),
    supabase
      .from("shop_purchases")
      .select("item_key, category, equipped")
      .eq("plant_id", PLANT_ID),
    supabase.from("plants").select("current_state").eq("id", PLANT_ID).maybeSingle(),
    supabase.from("companion_state").select("stage").eq("plant_id", PLANT_ID).maybeSingle(),
  ]);

  if (bondRes.error || purchasesRes.error) {
    // Missing migration (supabase/milestone18-seed-shop.sql) → graceful
    // "coming soon" panel, never a crash.
    return <Notice locale={locale} title={copy.comingSoonTitle} lines={[...copy.comingSoonLines]} />;
  }

  // Cheat sandbox (feature 3): own every item with a huge balance so the
  // whole catalog is unlocked to browse. Set client-side by cheat.js; the
  // grid additionally short-circuits real buy/equip writes while active, so
  // nothing here reaches Supabase.
  const cheat = (await cookies()).get("pm_cheat")?.value === "1";
  const bondRow = bondRes.data as { seeds?: number; bond_level?: number } | null;
  const seeds = cheat ? 999999 : Number(bondRow?.seeds ?? 0);
  const mascotBondLevel = Number(bondRow?.bond_level ?? 0);
  // Try-on preview stage (Phase 1): the same current-Jamkachu state the rest
  // of the app reads (plants.current_state / companion_state.stage) — an
  // unavailable or unrecognized value degrades to undefined/"Happy", which
  // spriteSrc renders as the graceful p4 happy bare default.
  const mascotMood =
    normalizeMood((plantRes.data as { current_state?: string } | null)?.current_state) ?? "Happy";
  const companionStageRaw = (companionRes.data as { stage?: string } | null)?.stage;
  const mascotStage: CompanionStage | undefined = (
    COMPANION_STAGES as readonly string[]
  ).includes(companionStageRaw ?? "")
    ? (companionStageRaw as CompanionStage)
    : undefined;
  const items: ShopGridItem[] = SHOP_CATALOG.map((item) => ({
    key: item.key,
    category: item.category,
    price: item.price,
    emoji: item.emoji,
    name: item.name[locale],
    blurb: item.blurb[locale],
  }));
  const purchases: ShopPurchaseRow[] = cheat
    ? SHOP_CATALOG.map((item) => ({ item_key: item.key, category: item.category, equipped: false }))
    : ((purchasesRes.data ?? []) as ShopPurchaseRow[]);

  return (
    <main className="pm-shop w-full">
      <PageHeader
        icon="🛒"
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.subtitle}
        // Pedagang (designer NPC cast) keeps the shop — a header greeting,
        // not a layout change.
        meta={<NpcBadge npc="pedagang" locale={locale} note={npcTagline(locale, "pedagang")} />}
      />
      <ShopGrid
        locale={locale}
        plantId={PLANT_ID}
        initialSeeds={seeds}
        items={items}
        initialPurchases={purchases}
        mascotMood={mascotMood}
        mascotStage={mascotStage}
        mascotBondLevel={mascotBondLevel}
      />
    </main>
  );
}
