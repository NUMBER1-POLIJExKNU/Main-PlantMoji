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
import { npcStillImgProps } from "@/components/npc-badge";
import { SHOP_UI_COPY, shopItemArt } from "@/game/economy/shop-catalog";
import { spriteSrc } from "@/lib/jamkachu-sprite";
import { GOLDPOT_RAMP, GOLD_POT_LEVEL, swapPotPalette } from "@/lib/sprite-palette";
import { npcNameLabel, type AppLocale } from "@/lib/i18n";
import type { PlantMood } from "@/types/events";
import type { CompanionStage } from "@/types/game";

const CSS_INDONESIA_FLAG_KEYS = new Set(["decor_indonesia_flag", "acc_indonesia_sash"]);

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
  wornPotKey,
  wornAccessoryKey,
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
  /** What Jamkachu is wearing right now, so the stage shows something honest
   *  with nothing selected — and has somewhere to fall back to the moment an
   *  item is taken off. */
  wornPotKey?: string | null;
  wornAccessoryKey?: string | null;
  affordable: boolean;
  busy: boolean;
  onClear: () => void;
  onBuy: (item: ShopGridItem, anchor: HTMLElement) => void;
  onEquip: (item: ShopGridItem, nextEquipped: boolean) => void;
}) {
  const copy = SHOP_UI_COPY[locale];
  const baseSrc = spriteSrc({ stage: mascot.stage, mood: mascot.mood, bondLevel: mascot.bondLevel });
  // The stage stands for what Jamkachu is WEARING; the selected item is laid
  // over its own category on top of that. It used to draw the selection alone,
  // so a plant already wearing a pot stood bare until you tapped something —
  // and taking that pot off left the picture untouched, which is what made
  // equipping read as broken from inside the shop.
  const shownPotKey = item?.category === "pot" ? item.key : wornPotKey ?? null;
  const shownAccessoryKey = item?.category === "accessory" ? item.key : wornAccessoryKey ?? null;
  const shownPotArt = shownPotKey ? shopItemArt(shownPotKey) : null;
  const hasShopPot = Boolean(shownPotKey && shownPotArt);
  // A shop pot is drawn as its own catalog art below, replacing the sprite's
  // baked-in pot: a tin can and a coffee sack are different SHAPES, and the
  // palette swap this used to do flattened all six into one silhouette. Gold
  // stays the Lv.10 keepsake for when no shop pot is on, and is the only thing
  // left that still recolours the sprite.
  const goldPot = !hasShopPot && mascot.bondLevel >= GOLD_POT_LEVEL;
  const potRamp = goldPot ? GOLDPOT_RAMP : null;
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
  const isIndonesiaFlag = item ? CSS_INDONESIA_FLAG_KEYS.has(item.key) : false;
  const accessoryArt = shownAccessoryKey ? shopItemArt(shownAccessoryKey) : null;
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
          <div
            className={`pm-shop-stage-jamkachu${hasShopPot ? " has-shop-pot" : ""}`}
            role="img"
            aria-label="Jamkachu"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
            <img className="pm-shop-stage-sprite" src={spriteImgSrc} alt="" aria-hidden="true" draggable={false} />
            {hasShopPot && (
              /* The farm stands the plant in this same catalog image, so the
                 try-on is a promise it can keep. */
              // eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels
              <img
                className="pm-shop-stage-pot"
                src={shownPotArt as string}
                data-pot-key={shownPotKey}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
            )}
            {shownAccessoryKey && (
              <span className={`pm-shop-stage-acc-icon${isIndonesiaFlag ? " is-indonesia-flag" : ""}`} aria-hidden="true">
                {/* The accessory being worn, or the one being tried on. Taking
                    it off empties this slot — the whole point of the button. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
                {accessoryArt ? <img src={accessoryArt} alt="" draggable={false} /> : isIndonesiaFlag ? null : item?.emoji}
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
            {/* The idle GIF opens on a frame with transparency off, so
                Pedagang stood inside a solid rectangle over this grass. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
            <img {...npcStillImgProps("pedagang", "46px")} alt="" aria-hidden="true" draggable={false} />
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
              /* Decorations get this button too. Excluding them — together with
                 equip_item refusing the category — meant a decoration bought
                 once could never be taken back off the farm. */
              <button
                type="button"
                className="pm-btn pm-btn-primary pm-shop-stage-action"
                disabled={busy}
                onClick={() => onEquip(item, !equipped)}
              >
                {busy ? (locale === "id" ? "Sebentar…" : "One moment…") : equipped ? copy.unequip : copy.equip}
              </button>
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
      </div>
    </section>
  );
}
