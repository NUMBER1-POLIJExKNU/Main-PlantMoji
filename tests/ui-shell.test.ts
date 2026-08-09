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
  "/diary",
  "/monitoring",
  "/collection",
  "/reports",
  "/settings",
] as const;

describe("shared PlantMoji application shell", () => {
  it("exposes the game destinations, two visible coming-soon tabs, and three utility destinations", () => {
    for (const href of TAB_HREFS) {
      expect(reactShell).toContain(`href: "${href}"`);
    }

    expect(reactShell.match(/href: "\/settings"/g)).toHaveLength(1);
    expect(reactShell).toContain('key: "camera", href: null');
    expect(reactShell).toContain('key: "shop", href: null');
    expect(reactShell).toContain('className="reno-nav-item reno-nav-disabled"');
  });

  it("keeps crop exploration and care memories as distinct game destinations", () => {
    expect(reactShell).toContain('key: "plants", href: "/plants"');
    expect(reactShell).toContain('key: "diary", href: "/diary"');
    expect(reactShell).toContain("const TOOL_ITEMS");
  });

  it("uses a seven-action mobile game dock without widening the viewport", () => {
    expect(reactCss).toContain("grid-template-columns: repeat(7, minmax(0, 1fr))");
    expect(reactCss).toMatch(/\.reno-nav-links\s*\{[\s\S]*?position:\s*fixed/);
    expect(reactCss).toContain("env(safe-area-inset-bottom)");
    expect(reactCss).toContain("overflow-x: hidden");
    expect(reactCss).toMatch(/\.reno-nav-tool-pocket\s*\{\s*display:\s*none/);
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
