import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "src/app/shop/page.tsx"), "utf8");
const actions = readFileSync(resolve(process.cwd(), "src/app/shop/actions.ts"), "utf8");
const grid = readFileSync(resolve(process.cwd(), "src/components/shop-grid.tsx"), "utf8");

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
});
