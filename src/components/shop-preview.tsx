"use client";

// Seed Shop try-on preview (Phase 1, docs/superpowers/plans/
// 2026-08-11-kiki-design-integration.md) — a MapleStory-cash-shop-style
// sticky strip styled as a mini farm diorama: a grass-floor band (the farm's
// pixel grass palette, public/farm/style.css .grass-floor, read via the
// shared --color-grass/--color-grass-light/--color-forest tokens) with the
// player's current Jamkachu, the Pedagang merchant NPC standing beside it,
// and the selected item's info.
//
// Presentation only: tapping a card in ShopGrid just changes what this
// component shows. Buying/equipping still goes through the exact same
// buy()/equip() handlers ShopGrid always had — nothing about the purchase
// flow changes here.

import { useEffect, useState } from "react";
import type { ShopGridItem, ShopPurchaseRow } from "@/components/shop-grid";
import { npcIdleGifSrc, npcSpriteSrcSet } from "@/components/npc-badge";
import { SHOP_UI_COPY } from "@/game/economy/shop-catalog";
import { spriteSrc } from "@/lib/jamkachu-sprite";
import { GOLDPOT_RAMP, potRampFor, swapPotPalette } from "@/lib/sprite-palette";
import { npcNameLabel, type AppLocale } from "@/lib/i18n";
import type { PlantMood } from "@/types/events";
import type { CompanionStage } from "@/types/game";

export interface ShopPreviewMascot {
  mood: PlantMood;
  stage?: CompanionStage;
  bondLevel: number;
}

export default function ShopPreviewStage({
  locale,
  mascot,
  seeds,
  item,
  owned,
  affordable,
  busy,
  onClear,
  onBuy,
  onEquip,
}: {
  locale: AppLocale;
  mascot: ShopPreviewMascot;
  seeds: number;
  item: ShopGridItem | null;
  owned: ShopPurchaseRow | null;
  affordable: boolean;
  busy: boolean;
  onClear: () => void;
  onBuy: (item: ShopGridItem, anchor: HTMLElement) => void;
  onEquip: (item: ShopGridItem, nextEquipped: boolean) => void;
}) {
  const copy = SHOP_UI_COPY[locale];
  const baseSrc = spriteSrc({ stage: mascot.stage, mood: mascot.mood, bondLevel: mascot.bondLevel });
  // Bond Lv.10 keepsake: the real farm's activeRamp() shows the gold pot
  // unconditionally once bondLevel >= 10 — it wins over the equipped pot
  // AND over whatever's being previewed here, so the try-on stage stays
  // honest (never implies a previewed pot color would show when it can't).
  const goldPot = mascot.bondLevel >= 10;
  const potRamp = goldPot ? GOLDPOT_RAMP : item && item.category === "pot" ? potRampFor(item.key) : null;
  // Keyed by (baseSrc, ramp) so a stale in-flight swap from a previous
  // selection can never paint over a newer one, and — without ever calling
  // setState synchronously inside the effect — a key mismatch alone makes
  // spriteImgSrc fall back to the plain sprite the instant the selection
  // changes (never a blank preview while the new swap is still resolving).
  const rampKey = potRamp ? `${baseSrc}|${potRamp.body}|${potRamp.rim}|${potRamp.dark ?? ""}` : null;
  const [recolor, setRecolor] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (!rampKey || !potRamp) return undefined;
    let cancelled = false;
    swapPotPalette(baseSrc, potRamp).then((url) => {
      if (!cancelled && url) setRecolor({ key: rampKey, url });
    });
    return () => {
      cancelled = true;
    };
  }, [rampKey, baseSrc, potRamp]);

  const spriteImgSrc = recolor && recolor.key === rampKey ? recolor.url : baseSrc;
  const equipped = Boolean(owned?.equipped);

  return (
    <section
      className={`pm-shop-stage${item ? ` is-${item.category}` : ""}`}
      aria-label={copy.tryOnStage}
    >
      <div className="pm-shop-stage-scene">
        <span className="pm-shop-stage-floor" aria-hidden="true" />
        <div className="pm-shop-stage-cast">
          <div className="pm-shop-stage-jamkachu" role="img" aria-label="Jamkachu">
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
            <img src={spriteImgSrc} alt="" aria-hidden="true" draggable={false} />
            {item && item.category === "accessory" && (
              <span className="pm-shop-stage-acc-icon" aria-hidden="true">
                {item.emoji}
              </span>
            )}
          </div>
          {item && item.category === "decor" && (
            <span className="pm-shop-stage-decor-prop" aria-hidden="true">
              {item.emoji}
            </span>
          )}
          <div className="pm-shop-stage-npc">
            <picture>
              <source
                media="(prefers-reduced-motion: reduce)"
                srcSet={npcSpriteSrcSet("pedagang")}
                sizes="46px"
              />
              <img src={npcIdleGifSrc("pedagang")} alt="" aria-hidden="true" draggable={false} />
            </picture>
            <b>{npcNameLabel(locale, "pedagang")}</b>
          </div>
        </div>
      </div>

      <div className="pm-shop-stage-copy">
        <div className="pm-shop-stage-balance" aria-live="polite">
          <span aria-hidden="true">🌰</span>
          <span>
            {seeds} {copy.balanceLabel}
          </span>
        </div>
        <p className="pm-shop-stage-honest">{copy.tryOnNote}</p>

        {item ? (
          <>
            <button
              type="button"
              className="pm-shop-stage-clear"
              onClick={onClear}
              aria-label={copy.closePreview}
            >
              ×
            </button>
            <h2>{item.name}</h2>
            <strong>🌰 {item.price}</strong>
            {item.category === "accessory" && (
              <p className="pm-shop-stage-acc-note">{copy.accessoryPreviewNote}</p>
            )}
            {item.category === "decor" && <p className="pm-shop-stage-acc-note">↳ {copy.decorAuto}</p>}
            {owned ? (
              <>
                <span className="pm-shop-stage-status">✓ {equipped ? copy.equipped : copy.owned}</span>
                {item.category !== "decor" && (
                  <button
                    type="button"
                    className="pm-btn pm-btn-primary"
                    disabled={busy}
                    onClick={() => onEquip(item, !equipped)}
                  >
                    {equipped ? copy.unequip : copy.equip}
                  </button>
                )}
              </>
            ) : (
              <>
                {!affordable && (
                  <small className="pm-shop-stage-short">
                    {item.price - seeds} {copy.needMore}
                  </small>
                )}
                <button
                  type="button"
                  className="pm-btn pm-btn-primary"
                  disabled={busy || !affordable}
                  onClick={(event) => onBuy(item, event.currentTarget)}
                >
                  {copy.buy} · {item.price}
                </button>
              </>
            )}
          </>
        ) : (
          <p className="pm-shop-stage-hint">{copy.tryOnHint}</p>
        )}
      </div>
    </section>
  );
}
