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
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  // Cheat sandbox (feature 3): buy/equip stay client-only so a classroom demo
  // never writes purchases or equips to Supabase.
  const { active: cheatActive } = useCheat();

  // Seeds balance stays live: bond_state is already realtime (milestone3),
  // so earned Seeds appear here without a reload. Display only.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel(`shop-seeds-${plantId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bond_state", filter: `plant_id=eq.${plantId}` },
        (payload) => {
          const next = (payload.new as { seeds?: number } | null)?.seeds;
          if (typeof next === "number") setSeeds(next);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [plantId]);

  const applyResult = (result: ShopActionResult) => {
    if (result.seeds !== null) setSeeds(result.seeds);
    setToast({ kind: result.status === "success" ? "success" : "error", text: result.message });
  };

  const buy = async (item: ShopGridItem, anchor: HTMLElement) => {
    if (busyKey) return;
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
  // Decorations are not: a garden may show every one it owns at once, which is
  // why equipping one must not clear its siblings here either.
  const EXCLUSIVE: ShopCategory[] = ["pot", "accessory"];
  const applyEquip = (item: ShopGridItem, nextEquipped: boolean) =>
    setPurchases((prev) =>
      prev.map((p) => {
        if (p.item_key === item.key) return { ...p, equipped: nextEquipped };
        if (nextEquipped && p.category === item.category && EXCLUSIVE.includes(item.category)) {
          return { ...p, equipped: false };
        }
        return p;
      }),
    );

  // Taking something off used to change a button label and nothing else: the
  // stage kept previewing whatever was selected, so the item stayed on the
  // plant and equipping read as broken. Dropping the selection hands the stage
  // back to the real worn loadout, which is the answer the tap asked for.
  const equip = async (item: ShopGridItem, nextEquipped: boolean) => {
    if (busyKey) return;
    if (cheatActive) {
      applyEquip(item, nextEquipped);
      if (!nextEquipped) setPreviewKey(null);
      window.PMSfx?.play("coin");
      return;
    }
    setBusyKey(item.key);
    try {
      const result = await equipShopItem(item.key, nextEquipped, locale);
      applyResult(result);
      if (result.status === "success") {
        applyEquip(item, nextEquipped);
        if (!nextEquipped) setPreviewKey(null);
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
  const previewAffordable = previewItem ? seeds >= previewItem.price : false;
  const shownItems = items.filter((item) => {
    if (item.category !== category) return false;
    const owned = Boolean(ownedRow(item.key));
    if (filter === "owned") return owned;
    if (filter === "affordable") return !owned && seeds >= item.price;
    return true;
  });

  return (
    <div>
      {toast && (
        <p className={`pm-shop-toast${toast.kind === "error" ? " is-error" : ""}`} role="status">
          {toast.text}
        </p>
      )}

      <ShopPreviewStage
        locale={locale}
        mascot={{ mood: mascotMood ?? "Happy", stage: mascotStage, bondLevel: mascotBondLevel ?? 0 }}
        seeds={seeds}
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

        <nav className="pm-shop-category-tabs" aria-label={locale === "id" ? "Kategori toko" : "Shop categories"}>
          {CATEGORY_ORDER.map((entry) => (
            <button key={entry} type="button" className={category === entry ? "is-active" : ""} aria-pressed={category === entry} onClick={() => { setCategory(entry); setPreviewKey(null); window.PMSfx?.play("tick"); }}>
              {/* The designer's tab art, so the three destinations look like
                  what they sell instead of three unrelated emoji. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
              <img src={shopCategoryArt(entry)} alt="" className="pm-shop-tab-art" width={96} height={96} draggable={false} />
              <span>{copy.categories[entry]}</span>
            </button>
          ))}
        </nav>
      <div className="pm-shop-filter" role="group" aria-label={locale === "id" ? "Saring barang" : "Filter items"}>{FILTER_ORDER.map((entry) => <button key={entry} type="button" className={filter === entry ? "is-active" : ""} aria-pressed={filter === entry} onClick={() => { setFilter(entry); window.PMSfx?.play("tick"); }}>{copy.filters[entry]}</button>)}</div>

      <div className="pm-shop-sections">
          <section aria-label={copy.categories[category]}>
            <div className="pm-shop-grid">
              {shownItems.map((item) => {
                  const isPreviewed = previewKey === item.key;
                  // A card used to show a picture, a name, a blurb and a
                  // Preview button — no price, no idea whether you owned it,
                  // no idea whether you could afford it. Buying rightly lives
                  // on the stage above, but the browsing surface still has to
                  // answer "what does this cost and do I have it".
                  const owned = ownedRow(item.key);
                  const affordable = seeds >= item.price;
                  const art = shopItemArt(item.key);
                  return (
                    <article
                      key={item.key}
                      className={`pm-panel pm-shop-card${busyKey === item.key ? " is-busy" : ""}${isPreviewed ? " is-previewed" : ""}${owned ? " is-owned" : affordable ? "" : " is-locked"}`}
                      aria-busy={busyKey === item.key}
                      // Tapping the card selects it into the try-on stage
                      // above — buy/equip live exclusively on that stage now
                      // (single coherent purchase surface). The eye button
                      // below stays the keyboard-operable, independently
                      // toggling control for the same selection.
                      onClick={() => setPreviewKey(item.key)}
                    >
                      <span className="pm-shop-emoji" aria-hidden="true">
                        {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
                        {art ? <img src={art} alt="" className="pm-shop-art" width={128} height={128} draggable={false} /> : item.emoji}
                      </span>
                      <h3>{item.name}</h3>
                      <p>{item.blurb}</p>
                      {item.category === "decor" && <small className="pm-shop-auto">↳ {copy.decorAuto}</small>}
                      <div className="pm-shop-card-foot">
                        <span className="pm-shop-price">
                          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
                          <img src="/icons/seed.png" alt="" className="pm-seed-icon" width={64} height={64} draggable={false} /> {item.price}
                        </span>
                        {owned
                          ? <span className="pm-shop-state is-owned">✓ {owned.equipped ? copy.equipped : copy.owned}</span>
                          : !affordable && <span className="pm-shop-state is-short">{item.price - seeds} {copy.needMore}</span>}
                      </div>
                      <button type="button" className={`pm-shop-preview-btn${isPreviewed ? " is-active" : ""}`} onClick={(event) => { event.stopPropagation(); setPreviewKey(isPreviewed ? null : item.key); }}>{isPreviewed ? `✓ ${copy.previewing}` : `👁 ${copy.preview}`}</button>
                    </article>
                  );
                })}
              {shownItems.length === 0 && <p className="pm-shop-empty">{locale === "id" ? "Belum ada barang dalam filter ini." : "No items in this filter yet."}</p>}
            </div>
          </section>
      </div>
    </div>
  );
}
