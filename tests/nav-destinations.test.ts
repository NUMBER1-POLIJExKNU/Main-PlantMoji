import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_DESTINATIONS, NAV_DESTINATIONS, NAV_TOOLS, navDestination } from "@/lib/nav-destinations";

// A destination is pictured twice: once in the sidebar rail, once in the header
// of the board it opens. Those two lists used to live apart, and every single
// route had drifted — the rail drew the designer's quest scroll and the page
// said 🎯, the rail drew the crop-explorer map and the page said 🌱, the rail
// drew the monitoring dish and the page said 📈. Both read one list now; this
// keeps it that way.

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const shell = read("src/components/reno-app-shell.tsx");
const header = read("src/components/page-header.tsx");

/** Every React route that draws a PageHeader, and the destination it is. */
const ROUTED_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["src/app/quests/page.tsx", "quests"],
  ["src/app/plants/page.tsx", "plants"],
  ["src/app/camera/page.tsx", "camera"],
  ["src/app/diary/page.tsx", "diary"],
  ["src/app/collection/page.tsx", "collection"],
  ["src/app/shop/page.tsx", "shop"],
  ["src/app/monitoring/page.tsx", "status"],
  ["src/app/reports/page.tsx", "reports"],
  ["src/app/settings/page.tsx", "settings"],
];

describe("nav destinations", () => {
  it("ships the designer's drawing for every destination that claims one", () => {
    for (const entry of ALL_DESTINATIONS) {
      if (!entry.art) continue;
      expect(entry.art, `${entry.key} art path`).toMatch(/^\/icons\/[a-z-]+\.png$/);
      expect(existsSync(resolve(process.cwd(), `public${entry.art}`)), `public${entry.art}`).toBe(true);
    }
  });

  it("keeps an emoji fallback on every destination, drawn or not", () => {
    // Every destination has a drawing now (Collection was the last one), but
    // the fallback still has to be there: an entry that loses its art must
    // land on the rail's own emoji, not on a second one picked by the page.
    for (const entry of ALL_DESTINATIONS) expect(entry.icon, `${entry.key} needs a fallback`).not.toBe("");
  });

  it("is the single list the sidebar rail draws from", () => {
    expect(shell).toContain('from "@/lib/nav-destinations"');
    expect(shell).toContain("const NAV_ITEMS = NAV_DESTINATIONS;");
    expect(shell).toContain("const TOOL_ITEMS = NAV_TOOLS;");
    // No second private copy of the list hiding in the shell.
    expect(shell).not.toMatch(/art:\s*"\/icons\//);
  });

  it("is the same list every board header draws from", () => {
    expect(header).toContain('import { navDestination } from "@/lib/nav-destinations"');
    expect(header).toContain("entry?.art");
    for (const [path, key] of ROUTED_HEADERS) {
      const page = read(path);
      expect(page, `${path} should name its destination`).toContain(`destination="${key}"`);
      // The emoji-per-page prop is what drifted; no route may go back to it.
      expect(page, `${path} still hard-codes a header emoji`).not.toMatch(/<PageHeader[\s\S]{0,300}?icon="/);
      expect(navDestination(key), `${key} is not a real destination`).not.toBeNull();
    }
  });

  it("routes every header at a destination the rail actually links to", () => {
    const linked = new Set([...NAV_DESTINATIONS, ...NAV_TOOLS].map((entry) => entry.key));
    for (const [, key] of ROUTED_HEADERS) expect(linked.has(key), `${key} is not in the rail`).toBe(true);
  });

  it("keeps the static farm shell's rail on the same drawings", () => {
    // next.config.ts rewrites "/" to public/farm/index.html, which never runs
    // React and so cannot import this list — the same split that let the shop
    // catalog drift away from the farm.
    const html = read("public/farm/index.html");
    for (const entry of ALL_DESTINATIONS) {
      if (!entry.art) continue;
      expect(html, `the farm rail is missing ${entry.art}`).toContain(`src="${entry.art}"`);
    }
  });
});
