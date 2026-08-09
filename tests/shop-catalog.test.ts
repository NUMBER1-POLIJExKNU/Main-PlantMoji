import { describe, expect, it } from "vitest";
import {
  PURCHASE_ERROR_CODES,
  SHOP_CATALOG,
  SHOP_UI_COPY,
  purchaseErrorCopy,
  shopItemByKey,
} from "@/game/economy/shop-catalog";

function leafPaths(node: unknown, prefix = "", out: string[] = []): string[] {
  if (typeof node === "object" && node !== null && !Array.isArray(node)) {
    for (const key of Object.keys(node)) {
      leafPaths((node as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.push(prefix);
  return out;
}

describe("SHOP_CATALOG", () => {
  it("has unique keys, valid categories, and positive integer prices", () => {
    const keys = SHOP_CATALOG.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of SHOP_CATALOG) {
      expect(["pot", "decor", "accessory"]).toContain(item.category);
      expect(Number.isInteger(item.price)).toBe(true);
      expect(item.price).toBeGreaterThan(0);
      expect(item.emoji.length).toBeGreaterThan(0);
    }
  });

  it("covers all three categories with the spec's item families", () => {
    const byCategory = (c: string) => SHOP_CATALOG.filter((i) => i.category === c).map((i) => i.key);
    expect(byCategory("pot")).toEqual(["pot_terracotta", "pot_batik", "pot_tincan"]);
    expect(byCategory("decor")).toEqual(["decor_scarecrow", "decor_fence", "decor_lantern", "decor_pond"]);
    expect(byCategory("accessory")).toEqual(["acc_strawhat", "acc_ribbon", "acc_glasses"]);
  });

  it("carries non-empty en AND id copy for every item (locale parity)", () => {
    for (const item of SHOP_CATALOG) {
      for (const locale of ["en", "id"] as const) {
        expect(item.name[locale].trim().length, `${item.key} name.${locale}`).toBeGreaterThan(0);
        expect(item.blurb[locale].trim().length, `${item.key} blurb.${locale}`).toBeGreaterThan(0);
      }
    }
  });

  it("shopItemByKey returns the item or null, never throws", () => {
    expect(shopItemByKey("pot_batik")?.price).toBeGreaterThan(0);
    expect(shopItemByKey("nope")).toBeNull();
  });
});

describe("SHOP_UI_COPY + purchaseErrorCopy", () => {
  it("en and id expose the identical key tree", () => {
    expect(leafPaths(SHOP_UI_COPY.en).sort()).toEqual(leafPaths(SHOP_UI_COPY.id).sort());
  });

  it("every purchase error code resolves to honest copy in both locales", () => {
    for (const code of PURCHASE_ERROR_CODES) {
      for (const locale of ["en", "id"] as const) {
        expect(purchaseErrorCopy(code, locale).trim().length).toBeGreaterThan(0);
      }
    }
  });
});
