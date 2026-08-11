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
import { SHOP_UI_COPY, shopItemArt } from "@/game/economy/shop-catalog";
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
  const decorArt = item?.category === "decor" ? shopItemArt(item.key) : null;

  return (
    <section
      className={`pm-shop-stage${item ? ` is-${item.category}` : ""}`}
      aria-label={copy.tryOnStage}
      aria-live="polite"
    >
      <div className="pm-shop-stage-scene">
        <span className="pm-shop-stage-floor" aria-hidden="true" />
        <span className="pm-shop-stage-sign" aria-hidden="true">SEED SHOP</span>
        <div className="pm-shop-stage-cast">
          <div className="pm-shop-stage-jamkachu" role="img" aria-label="Jamkachu">
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
            <img src={spriteImgSrc} alt="" aria-hidden="true" draggable={false} />
            {item && item.category === "accessory" && (
              <span className="pm-shop-stage-acc-icon" aria-hidden="true">
                {/* The drawn accessory, floated by the plant's head. It is not
                    worn until you equip it — the note under the price says so
                    — but the emoji stand-in could not even show which one. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
                {shopItemArt(item.key) ? <img src={shopItemArt(item.key) as string} alt="" draggable={false} /> : item.emoji}
              </span>
            )}
          </div>
          {item && item.category === "decor" && (
            <span className="pm-shop-stage-decor-prop" aria-hidden="true">
              {/* The same sprite the farm will stand on the grass, so the
                  try-on is an honest promise rather than an emoji stand-in. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
              {decorArt ? <img src={decorArt} alt="" draggable={false} /> : item.emoji}
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
        <header className="pm-shop-stage-header">
          <span>{copy.tryOnStage}</span>
          <strong className="pm-shop-stage-balance" aria-live="polite">
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
            <img src="/icons/seed.png" alt="" className="pm-seed-icon" width={64} height={64} draggable={false} />
            {seeds} {copy.balanceLabel}
          </strong>
        </header>
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
            <small className="pm-shop-stage-category">{copy.categories[item.category]}</small>
            <h2>{item.name}</h2>
            <p className="pm-shop-stage-description">{item.blurb}</p>
            <div className="pm-shop-stage-meta">
              <strong className="pm-shop-stage-price">
                {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
                <img src="/icons/seed.png" alt="" className="pm-seed-icon" width={64} height={64} draggable={false} /> {item.price}
              </strong>
              {owned ? (
                <span className="pm-shop-stage-status">✓ {equipped ? copy.equipped : copy.owned}</span>
              ) : !affordable ? (
                <span className="pm-shop-stage-short">+{item.price - seeds} {copy.needMore}</span>
              ) : (
                <span className="pm-shop-stage-ready">{copy.previewing}</span>
              )}
            </div>
            {item.category === "accessory" && (
              <p className="pm-shop-stage-acc-note">{copy.accessoryPreviewNote}</p>
            )}
            {item.category === "decor" && <p className="pm-shop-stage-acc-note">↳ {copy.decorAuto}</p>}
            {owned ? (
              item.category !== "decor" && (
                <button
                  type="button"
                  className="pm-btn pm-btn-primary pm-shop-stage-action"
                  disabled={busy}
                  onClick={() => onEquip(item, !equipped)}
                >
                  {busy ? (locale === "id" ? "Sebentar…" : "One moment…") : equipped ? copy.unequip : copy.equip}
                </button>
              )
            ) : (
              <button
                type="button"
                className="pm-btn pm-btn-primary pm-shop-stage-action"
                disabled={busy || !affordable}
                onClick={(event) => onBuy(item, event.currentTarget)}
              >
                {busy ? (locale === "id" ? "Membeli…" : "Buying…") : affordable ? `${copy.buy} · ${item.price}` : copy.filters.affordable}
              </button>
            )}
          </>
        ) : (
          <p className="pm-shop-stage-hint">{copy.tryOnHint}</p>
        )}
        <p className="pm-shop-stage-honest">{copy.tryOnNote}</p>
      </div>
    </section>
  );
}
