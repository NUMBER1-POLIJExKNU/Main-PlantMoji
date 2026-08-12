"use client";

// Seed Shop grid (milestone18). Client island: renders catalog cards,
// calls the purchase/equip server actions, and keeps the Seeds balance
// live from bond_state realtime. NEVER optimistic-deducts — the balance
// shown is always the last server-confirmed number (spec: honest copy,
// never optimistic).

import { useEffect, useState } from "react";
import { equipShopItem, purchaseShopItem, type ShopActionResult } from "@/app/shop/actions";
import { useCheat } from "@/lib/pm-cheat";
import { SHOP_UI_COPY, shopCategoryArt, shopItemArt, type ShopCategory } from "@/game/economy/shop-catalog";
import { getBrowserSupabase } from "@/lib/supabase/client";
import ShopPreviewStage from "@/components/shop-preview";
import type { AppLocale } from "@/lib/i18n";
import type { PlantMood } from "@/types/events";
import type { CompanionStage } from "@/types/game";

export interface ShopGridItem {
  key: string;
  category: ShopCategory;
  price: number;
  emoji: string;
  name: string;
  blurb: string;
}

export interface ShopPurchaseRow {
  item_key: string;
  category: string;
  equipped: boolean;
}

const CATEGORY_ORDER: ShopCategory[] = ["pot", "decor", "accessory"];
type OwnershipFilter = "all" | "affordable" | "owned";
const FILTER_ORDER: OwnershipFilter[] = ["all", "affordable", "owned"];
// Windows commonly renders the Indonesia flag emoji as the regional code
// "ID". These catalog entries use a CSS-drawn Merah Putih instead so the
// item icon is a flag on every desktop platform and emoji font.
const CSS_INDONESIA_FLAG_KEYS = new Set(["decor_indonesia_flag", "acc_indonesia_sash"]);

function ShopItemVisual({ item }: { item: ShopGridItem }) {
  const art = shopItemArt(item.key);
  const isIndonesiaFlag = CSS_INDONESIA_FLAG_KEYS.has(item.key) && !art;
  return (
    <span className={`pm-shop-visual${isIndonesiaFlag ? " is-indonesia-flag" : ""}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
      {art ? <img src={art} alt="" className="pm-shop-art" width={128} height={128} draggable={false} /> : isIndonesiaFlag ? null : item.emoji}
    </span>
  );
}

function popConfetti(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const pieces = ["🌰", "✨", "🌱", "✨", "🌰"];
  pieces.forEach((piece, index) => {
    const span = document.createElement("span");
    span.className = "pm-shop-confetti";
    span.textContent = piece;
    span.style.left = `${rect.left + rect.width / 2}px`;
    span.style.top = `${rect.top + rect.height / 2}px`;
    span.style.setProperty("--dx", `${(index - 2) * 26}px`);
    document.body.appendChild(span);
    setTimeout(() => span.remove(), 950);
  });
}

export default function ShopGrid({
  locale,
  plantId,
  initialSeeds,
  items,
  initialPurchases,
  mascotMood,
  mascotStage,
  mascotBondLevel,
}: {
  locale: AppLocale;
  plantId: string;
  initialSeeds: number;
  items: ShopGridItem[];
  initialPurchases: ShopPurchaseRow[];
  /** Current companion state (kiki design integration §7) — feeds the
   *  try-on preview stage. Defaults to "Happy"/undefined stage/level 0 when
   *  the caller can't read it, which spriteSrc renders as p4 happy bare
   *  (the same graceful default the rest of the app uses). */
  mascotMood?: PlantMood;
  mascotStage?: CompanionStage;
  mascotBondLevel?: number;
}) {
  const copy = SHOP_UI_COPY[locale];
  const [seeds, setSeeds] = useState(initialSeeds);
  const [purchases, setPurchases] = useState<ShopPurchaseRow[]>(initialPurchases);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [category, setCategory] = useState<ShopCategory>("pot");
  const [filter, setFilter] = useState<OwnershipFilter>("all");
  const [previewKey, setPreviewKey] = useState<string | null>(() => items.find((item) => item.category === "pot")?.key ?? null);
  // Cheat sandbox (feature 3): buy/equip stay client-only so a classroom demo
  // never writes purchases or equips to Supabase. Trial mode shares that
  // containment (isActive() covers both) but NOT the free-money part: a trial
  // run's Seeds are earned by caring for the plant, and spending them is the
  // point of earning them, so the balance comes from the sandbox and a
  // purchase actually deducts.
  const { active: cheatActive, state: sandbox, api: sandboxApi } = useCheat();
  const trialActive = sandbox?.mode === "trial";
  const trialSeeds = trialActive ? Number(sandbox?.status?.seeds ?? 0) : null;
  const shownSeeds = trialSeeds ?? seeds;

  // Balance and ownership/equip state stay server-authoritative. Realtime
  // purchase events are re-read instead of reconstructed from the payload so
  // cross-tab equips and the category-exclusive unequip happen atomically in UI.
  useEffect(() => {
    // Either sandbox owns the shelf while it is running. Without this, one
    // realtime event from the real plant would overwrite the sandbox's
    // ownership — revealing the demo account's purchases to a trial run that
    // is supposed to own nothing, and wiping cheat mode's reveal-all.
    if (cheatActive) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const refreshPurchases = async () => {
      const { data, error } = await supabase
        .from("shop_purchases")
        .select("item_key, category, equipped")
        .eq("plant_id", plantId);
      if (!error && data) setPurchases(data as ShopPurchaseRow[]);
    };
    const channel = supabase
      .channel(`shop-live-${plantId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bond_state", filter: `plant_id=eq.${plantId}` },
        (payload) => {
          const next = (payload.new as { seeds?: number } | null)?.seeds;
          if (typeof next === "number") setSeeds(next);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_purchases", filter: `plant_id=eq.${plantId}` },
        () => { void refreshPurchases(); },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [plantId, cheatActive]);

  const applyResult = (result: ShopActionResult) => {
    if (result.seeds !== null) setSeeds(result.seeds);
    setToast({ kind: result.status === "success" ? "success" : "error", text: result.message });
  };

  const buy = async (item: ShopGridItem, anchor: HTMLElement) => {
    if (busyKey) return;
    if (trialActive) {
      // Priced for real against sandbox Seeds — refuse when short, exactly as
      // the server would. Still client-only: the deduction lands in
      // localStorage through PMCheat and never reaches Supabase.
      if ((trialSeeds ?? 0) < item.price) {
        window.PMSfx?.play("tick");
        return;
      }
      sandboxApi?.set({ status: { seeds: (trialSeeds ?? 0) - item.price } });
      setPurchases((prev) =>
        prev.some((p) => p.item_key === item.key)
          ? prev
          : [...prev, { item_key: item.key, category: item.category, equipped: false }],
      );
      window.PMSfx?.play("coin");
      popConfetti(anchor);
      return;
    }
    if (cheatActive) {
      setPurchases((prev) =>
        prev.some((p) => p.item_key === item.key)
          ? prev
          : [...prev, { item_key: item.key, category: item.category, equipped: false }],
      );
      window.PMSfx?.play("coin");
      popConfetti(anchor);
      return;
    }
    setBusyKey(item.key);
    try {
      const result = await purchaseShopItem(item.key, locale);
      applyResult(result);
      if (result.status === "success") {
        setPurchases((prev) =>
          prev.some((p) => p.item_key === item.key)
            ? prev
            : [...prev, { item_key: item.key, category: item.category, equipped: false }],
        );
        window.PMSfx?.play("coin");
        popConfetti(anchor);
      } else {
        window.PMSfx?.play("tick");
      }
    } finally {
      setBusyKey(null);
    }
  };

  // Pots and accessories are exclusive — wearing one takes the other off.
  // Decorations are not: a garden may show every one it owns at once, so
  // equipping one must never clear its siblings.
  const EXCLUSIVE: ShopCategory[] = ["pot", "accessory"];
  const applyEquip = (key: string, category: ShopCategory, nextEquipped: boolean) =>
    setPurchases((prev) =>
      prev.map((p) => {
        if (p.item_key === key) return { ...p, equipped: nextEquipped };
        if (nextEquipped && p.category === category && EXCLUSIVE.includes(category)) {
          return { ...p, equipped: false };
        }
        return p;
      }),
    );

  // Taking something off used to change a button label and nothing else: the
  // stage kept previewing whatever was selected, so the item stayed on the
  // plant. Dropping the selection hands the stage back to the real worn
  // loadout, which is the answer the tap asked for.
  const equip = async (item: ShopGridItem, nextEquipped: boolean) => {
    if (busyKey) return;
    if (cheatActive) {
      applyEquip(item.key, item.category, nextEquipped);
      if (!nextEquipped) setPreviewKey(null);
      window.PMSfx?.play("coin");
      return;
    }
    setBusyKey(item.key);
    try {
      const result = await equipShopItem(item.key, nextEquipped, locale);
      applyResult(result);
      if (result.status === "success") {
        const confirmedItemKey = result.itemKey ?? item.key;
        const confirmedCategory = result.category ?? item.category;
        const confirmedEquipped = result.equipped ?? nextEquipped;
        applyEquip(confirmedItemKey, confirmedCategory, confirmedEquipped);
        if (!confirmedEquipped) setPreviewKey(null);
        window.PMSfx?.play("coin");
      } else {
        window.PMSfx?.play("tick");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const ownedRow = (key: string) => purchases.find((p) => p.item_key === key) ?? null;
  const previewItem = items.find((item) => item.key === previewKey) ?? null;
  const previewOwned = previewItem ? ownedRow(previewItem.key) : null;
  const previewAffordable = previewItem ? shownSeeds >= previewItem.price : false;
  const shownItems = items.filter((item) => {
    if (item.category !== category) return false;
    const owned = Boolean(ownedRow(item.key));
    if (filter === "owned") return owned;
    if (filter === "affordable") return !owned && shownSeeds >= item.price;
    return true;
  });

  const selectCategory = (nextCategory: ShopCategory) => {
    setCategory(nextCategory);
    setPreviewKey(items.find((item) => item.category === nextCategory)?.key ?? null);
    window.PMSfx?.play("tick");
  };

  return (
    <div className="pm-shop-browser">
      {toast && (
        <p className={`pm-shop-toast${toast.kind === "error" ? " is-error" : ""}`} role="status">
          {toast.text}
        </p>
      )}

      <ShopPreviewStage
        locale={locale}
        mascot={{ mood: mascotMood ?? "Happy", stage: mascotStage, bondLevel: mascotBondLevel ?? 0 }}
        seeds={shownSeeds}
        item={previewItem}
        owned={previewOwned}
        wornPotKey={purchases.find((p) => p.category === "pot" && p.equipped)?.item_key ?? null}
        wornAccessoryKey={purchases.find((p) => p.category === "accessory" && p.equipped)?.item_key ?? null}
        affordable={previewAffordable}
        busy={previewItem !== null && busyKey === previewItem.key}
        onClear={() => setPreviewKey(null)}
        onBuy={buy}
        onEquip={equip}
      />

      <div className="pm-shop-controls">
        <nav className="pm-shop-category-tabs" aria-label={locale === "id" ? "Kategori toko" : "Shop categories"}>
          {CATEGORY_ORDER.map((entry) => (
            <button key={entry} type="button" className={category === entry ? "is-active" : ""} aria-pressed={category === entry} onClick={() => selectCategory(entry)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
              <img src={shopCategoryArt(entry)} alt="" className="pm-shop-tab-art" width={96} height={96} draggable={false} />
              <b>{copy.categories[entry]}</b>
            </button>
          ))}
        </nav>
        <div className="pm-shop-filter" role="group" aria-label={locale === "id" ? "Saring barang" : "Filter items"}>
          {FILTER_ORDER.map((entry) => (
            <button key={entry} type="button" className={filter === entry ? "is-active" : ""} aria-pressed={filter === entry} onClick={() => { setFilter(entry); window.PMSfx?.play("tick"); }}>
              {copy.filters[entry]}
            </button>
          ))}
        </div>
      </div>

      <div className="pm-shop-sections">
        <section aria-label={copy.categories[category]}>
          <div className="pm-shop-grid">
            {shownItems.map((item) => {
              const owned = ownedRow(item.key);
              const affordable = shownSeeds >= item.price;
              const isPreviewed = previewKey === item.key;
              return (
                <button
                  type="button"
                  key={item.key}
                  className={`pm-panel pm-shop-card${busyKey === item.key ? " is-busy" : ""}${isPreviewed ? " is-previewed" : ""}${owned ? " is-owned" : affordable ? "" : " is-locked"}`}
                  aria-busy={busyKey === item.key}
                  aria-pressed={isPreviewed}
                  onClick={() => setPreviewKey(item.key)}
                >
                  <ShopItemVisual item={item} />
                  <span className="pm-shop-card-copy">
                    <strong>{item.name}</strong>
                    <small>{item.blurb}</small>
                  </span>
                  <span className="pm-shop-card-foot">
                    <span className="pm-shop-price">
                      {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
                      <img src="/icons/seed.png" alt="" className="pm-seed-icon" width={64} height={64} draggable={false} /> {item.price}
                    </span>
                    {owned ? (
                      <span className="pm-shop-state is-owned">✓ {owned.equipped ? copy.equipped : copy.owned}</span>
                    ) : affordable ? (
                      <span className="pm-shop-state is-ready">{copy.preview} →</span>
                    ) : (
                      <span className="pm-shop-state is-short">+{item.price - shownSeeds}</span>
                    )}
                  </span>
                </button>
              );
            })}
            {shownItems.length === 0 && <p className="pm-shop-empty">{locale === "id" ? "Belum ada barang dalam filter ini." : "No items in this filter yet."}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
