import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const reactShell = source("src/components/reno-app-shell.tsx");
const reactCss = source("src/app/globals.css");

const TAB_HREFS = [
  "/",
  "/quests",
  "/plants",
  "/monitoring",
  "/collection",
  "/reports",
  "/settings",
] as const;

describe("shared PlantMoji application shell", () => {
  it("exposes the seven product destinations from the React shell", () => {
    for (const href of TAB_HREFS) {
      expect(reactShell).toContain(`href: "${href}"`);
    }

    expect(reactShell.match(/href: "\/settings"/g)).toHaveLength(1);
  });

  it("keeps Plants visible instead of aliasing the growth diary to Settings", () => {
    expect(reactShell).toContain('key: "plants", href: "/plants"');
    expect(reactShell).not.toContain('key: "diary"');
  });

  it("uses a seven-column mobile dock without widening the viewport", () => {
    expect(reactCss).toContain("grid-template-columns: repeat(7, minmax(0, 1fr))");
    expect(reactCss).toMatch(/\.reno-nav-links\s*\{[\s\S]*?position:\s*fixed/);
    expect(reactCss).toContain("env(safe-area-inset-bottom)");
    expect(reactCss).toContain("overflow-x: hidden");
  });

  it("frames React feature routes and uses a shared page header", () => {
    expect(reactShell).toContain('"reno-route-page"');
    expect(reactCss).toContain(".reno-route-page");

    for (const route of ["quests", "plants", "monitoring", "collection"]) {
      expect(source(`src/app/${route}/page.tsx`)).toContain("<PageHeader");
    }
  });

  it("renders backend notices in the normal farm panel language", () => {
    const notice = source("src/components/notice.tsx");
    expect(notice).toContain('className="pm-panel reno-notice-card"');
    expect(notice).not.toContain("min-h-screen");
  });
});
