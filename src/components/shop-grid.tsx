"use client";

// Seed Shop grid (milestone18). Client island: renders catalog cards,
// calls the purchase/equip server actions, and keeps the Seeds balance
// live from bond_state realtime. NEVER optimistic-deducts — the balance
// shown is always the last server-confirmed number (spec: honest copy,
// never optimistic).

import { useEffect, useState } from "react";
import { equipShopItem, purchaseShopItem, type ShopActionResult } from "@/app/shop/actions";
import { SHOP_UI_COPY, type ShopCategory } from "@/game/economy/shop-catalog";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { AppLocale } from "@/lib/i18n";

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
}: {
  locale: AppLocale;
  plantId: string;
  initialSeeds: number;
  items: ShopGridItem[];
  initialPurchases: ShopPurchaseRow[];
}) {
  const copy = SHOP_UI_COPY[locale];
  const [seeds, setSeeds] = useState(initialSeeds);
  const [purchases, setPurchases] = useState<ShopPurchaseRow[]>(initialPurchases);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

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

  const equip = async (item: ShopGridItem, nextEquipped: boolean) => {
    if (busyKey) return;
    setBusyKey(item.key);
    try {
      const result = await equipShopItem(item.key, nextEquipped, locale);
      applyResult(result);
      if (result.status === "success") {
        setPurchases((prev) =>
          prev.map((p) => {
            if (p.item_key === item.key) return { ...p, equipped: nextEquipped };
            if (nextEquipped && p.category === item.category) return { ...p, equipped: false };
            return p;
          }),
        );
        window.PMSfx?.play("coin");
      } else {
        window.PMSfx?.play("tick");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const ownedRow = (key: string) => purchases.find((p) => p.item_key === key) ?? null;

  return (
    <div>
      <div className="pm-shop-balance" aria-live="polite">
        <span aria-hidden="true">🌰</span>
        <span>{seeds} {copy.balanceLabel}</span>
      </div>
      <p className="mt-2 text-xs opacity-75">{copy.earnHint}</p>
      {toast && (
        <p className={`pm-shop-toast${toast.kind === "error" ? " is-error" : ""}`} role="status">
          {toast.text}
        </p>
      )}

      <div className="pm-shop-sections">
        {CATEGORY_ORDER.map((category) => (
          <section key={category} aria-label={copy.categories[category]}>
            <h2 className="pm-heading text-sm">{copy.categories[category]}</h2>
            <div className="pm-shop-grid mt-2">
              {items
                .filter((item) => item.category === category)
                .map((item) => {
                  const owned = ownedRow(item.key);
                  const affordable = seeds >= item.price;
                  return (
                    <article key={item.key} className="pm-panel pm-shop-card">
                      <span className="pm-shop-emoji" aria-hidden="true">{item.emoji}</span>
                      <h3>{item.name}</h3>
                      <p>{item.blurb}</p>
                      {owned ? (
                        <>
                          <span className="pm-shop-owned">
                            {owned.equipped ? `✓ ${copy.equipped}` : `✓ ${copy.owned}`}
                          </span>
                          {item.category !== "decor" && (
                            <button
                              type="button"
                              className="pm-btn"
                              disabled={busyKey !== null}
                              onClick={() => equip(item, !owned.equipped)}
                            >
                              {owned.equipped ? copy.unequip : copy.equip}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <span className={`pm-shop-price${affordable ? "" : " is-short"}`}>
                            🌰 {item.price}
                          </span>
                          <button
                            type="button"
                            className="pm-btn pm-btn-primary"
                            disabled={busyKey !== null || !affordable}
                            onClick={(event) => buy(item, event.currentTarget)}
                          >
                            {copy.buy} · {item.price}
                          </button>
                        </>
                      )}
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
