import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "src/app/shop/page.tsx"), "utf8");
const actions = readFileSync(resolve(process.cwd(), "src/app/shop/actions.ts"), "utf8");
const grid = readFileSync(resolve(process.cwd(), "src/components/shop-grid.tsx"), "utf8");
const preview = readFileSync(resolve(process.cwd(), "src/components/shop-preview.tsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/app/shop/shop.css"), "utf8");

describe("/shop route", () => {
  it("uses the shared page header and farm panel language", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain('import "./shop.css"');
  });

  it("renders the graceful coming-soon state when milestone18 is missing", () => {
    expect(page).toContain("comingSoonTitle");
    expect(page).toContain("milestone18-seed-shop.sql");
  });

  it("actions look prices up in the static catalog and never trust the client", () => {
    expect(actions).toContain('"use server"');
    expect(actions).toContain("shopItemByKey");
    expect(actions).toContain("p_price: item.price");
    expect(actions).not.toMatch(/formData\.get\(["']price["']\)/);
  });

  it("treats already_owned as success (idempotent double-tap)", () => {
    expect(actions).toMatch(/already_owned[\s\S]{0,300}status:\s*"success"/);
  });

  it("never optimistic-deducts: the grid renders the seeds the server returned", () => {
    expect(grid).toContain("result.seeds");
    expect(grid).not.toContain("seeds - item.price");
  });

  it("keeps equip on the single preview action surface and reconciles the RPC-confirmed state", () => {
    expect(preview).toContain('className="pm-btn pm-btn-primary pm-shop-stage-action"');
    expect(grid).not.toContain("pm-shop-equip-btn");
    expect(grid).toContain("result.equipped ?? nextEquipped");
    expect(grid).toContain("result.category ?? item.category");
    expect(css).toMatch(/\.pm-shop-stage-action\s*\{[^}]*width:100%/);
  });

  it("re-reads purchases after realtime shop changes", () => {
    expect(grid).toContain('table: "shop_purchases"');
    expect(grid).toContain('.select("item_key, category, equipped")');
    expect(grid).toContain("refreshPurchases");
  });

  it("supports category, ownership, and non-persistent previews", () => {
    expect(grid).toContain("pm-shop-category-tabs");
    expect(grid).toContain('type OwnershipFilter = "all" | "affordable" | "owned"');
    expect(grid).toContain("setPreviewKey");
    expect(grid).not.toMatch(/purchaseShopItem\([^)]*price/);
  });

  it("draws both Indonesia items as flags instead of the Windows ID glyph", () => {
    expect(grid).toContain('new Set(["decor_indonesia_flag", "acc_indonesia_sash"])');
    expect(grid).toContain('pm-shop-visual${isIndonesiaFlag ? " is-indonesia-flag" : ""}');
    expect(grid).toContain("isIndonesiaFlag ? null : item.emoji");
    expect(preview).toContain('new Set(["decor_indonesia_flag", "acc_indonesia_sash"])');
    expect(preview).toContain('isIndonesiaFlag ? null : item.emoji');
    expect(preview).toContain('pm-shop-stage-acc-icon${isIndonesiaFlag ? " is-indonesia-flag" : ""}');
    expect(grid).toContain("<ShopItemVisual item={item} />");
    expect(css).toContain(".pm-shop-visual.is-indonesia-flag::before");
    expect(css).toContain("background:linear-gradient(to bottom,#ce1126 0 50%,#fff 50% 100%)");
    expect(css).toContain(".pm-shop-stage-acc-icon.is-indonesia-flag");
  });
});
