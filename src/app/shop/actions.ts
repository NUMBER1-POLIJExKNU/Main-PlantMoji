"use server";

// Seed Shop mutations. The ONLY spend path in the app: server action →
// service-role RPC. The browser sends an item key and nothing else; price
// and category come from the static catalog (the authoritative list), so a
// tampered client can never set its own price. Seeds may go down here —
// XP/Bond Level never (purchase_item touches only bond_state.seeds).

import { revalidatePath } from "next/cache";
import { normalizeLocale } from "@/lib/i18n";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  SHOP_UI_COPY,
  purchaseErrorCopy,
  shopItemByKey,
  type PurchaseErrorCode,
} from "@/game/economy/shop-catalog";

const PLANT_ID = "plant-01";

export interface ShopActionResult {
  status: "success" | "error";
  code: PurchaseErrorCode | null;
  message: string;
  /** Authoritative balance returned by the RPC, or null when unknown. */
  seeds: number | null;
}

function isMissingSchemaError(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /could not find the (function|table)/i.test(error.message)
  );
}

function failure(code: PurchaseErrorCode, locale: "en" | "id", seeds: number | null = null): ShopActionResult {
  return { status: "error", code, message: purchaseErrorCopy(code, locale), seeds };
}

export async function purchaseShopItem(itemKey: unknown, rawLocale: unknown): Promise<ShopActionResult> {
  const locale = normalizeLocale(rawLocale);
  const item = typeof itemKey === "string" ? shopItemByKey(itemKey) : null;
  if (!item) return failure("unknown_item", locale);

  const supabase = getServerSupabase();
  if (!supabase) return failure("offline", locale);

  const { data, error } = await supabase.rpc("purchase_item", {
    p_plant_id: PLANT_ID,
    p_item_key: item.key,
    p_price: item.price,
    p_category: item.category,
  });
  if (error) {
    return failure(isMissingSchemaError(error) ? "migration_missing" : "offline", locale);
  }

  const row = data as { ok: boolean; error?: string; seeds?: number };
  const seeds = typeof row.seeds === "number" ? row.seeds : null;

  // Double-tap idempotency (spec): already_owned is treated as success.
  if (!row.ok && row.error === "already_owned") {
    revalidatePath("/shop");
    return { status: "success", code: "already_owned", message: purchaseErrorCopy("already_owned", locale), seeds };
  }
  if (!row.ok) {
    const code: PurchaseErrorCode = row.error === "insufficient_seeds" ? "insufficient_seeds" : "offline";
    return failure(code, locale, seeds);
  }

  revalidatePath("/shop");
  revalidatePath("/");
  return { status: "success", code: null, message: SHOP_UI_COPY[locale].purchased, seeds };
}

export async function equipShopItem(
  itemKey: unknown,
  equipped: unknown,
  rawLocale: unknown,
): Promise<ShopActionResult> {
  const locale = normalizeLocale(rawLocale);
  const item = typeof itemKey === "string" ? shopItemByKey(itemKey) : null;
  if (!item) return failure("unknown_item", locale);

  const supabase = getServerSupabase();
  if (!supabase) return failure("offline", locale);

  const { data, error } = await supabase.rpc("equip_item", {
    p_plant_id: PLANT_ID,
    p_item_key: item.key,
    p_equipped: equipped !== false,
  });
  if (error) {
    return failure(isMissingSchemaError(error) ? "migration_missing" : "offline", locale);
  }

  const row = data as { ok: boolean; error?: string };
  if (!row.ok) {
    const code: PurchaseErrorCode =
      row.error === "not_owned" ? "not_owned" : row.error === "not_equippable" ? "not_equippable" : "offline";
    return failure(code, locale);
  }

  revalidatePath("/shop");
  revalidatePath("/");
  return { status: "success", code: null, message: SHOP_UI_COPY[locale].equippedToast, seeds: null };
}
