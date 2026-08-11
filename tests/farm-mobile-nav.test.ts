import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source-contract guard for the ≤800px farm dock (milestone20 mobile nav
// fixes). Same read-the-source style as tests/farm-shop-layer.test.ts — the
// farm layer is plain CSS/HTML with nothing to import.
//
// Bug 1: the old phone dock hid .nav-section-title AND .nav-tool-pocket
// (display: none) while laying the dock out as repeat(7, 1fr) — /reports
// and /settings were COMPLETELY unreachable on phones. The fix dissolves
// the tool pocket into the dock row (display: contents) and makes the row
// horizontally scrollable, so all TEN destinations stay reachable.
//
// Bug 2: the fixed ? guide button (right/bottom 18px, z 190) sat exactly on
// the dock's right-most cell, blocking that cell's tap — a ≤800px override
// must lift it above the dock, safe-area aware.

const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");
const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");

/** The one phone-dock media block this contract is about. */
function mobileBlock(): string {
  const start = css.indexOf("@media (max-width: 800px)");
  expect(start, "style.css lost its ≤800px block").toBeGreaterThan(-1);
  const next = css.indexOf("@media", start + 1);
  return css.slice(start, next === -1 ? css.length : next);
}

describe("farm mobile dock (≤800px) reaches all ten destinations", () => {
  it("index.html still lists all ten nav destinations inside .nav-links", () => {
    const navStart = html.indexOf('<nav class="nav-links">');
    const navEnd = html.indexOf("</nav>", navStart);
    expect(navStart).toBeGreaterThan(-1);
    const nav = html.slice(navStart, navEnd);
    for (const href of ["/", "/quests", "/plants", "/camera", "/diary", "/collection", "/shop", "/monitoring", "/reports", "/settings"]) {
      expect(nav, `nav lost its ${href} destination`).toContain(`href="${href}"`);
    }
  });

  it("no longer hides the tool pocket without a reachable alternative", () => {
    const block = mobileBlock();
    // The old combined display:none (which removed /reports + /settings from
    // phones entirely) must be gone in any whitespace form…
    expect(block).not.toMatch(/\.nav-section-title\s*,\s*\.nav-tool-pocket\s*\{[^}]*display:\s*none/);
    expect(block).not.toMatch(/\.nav-tool-pocket\s*\{[^}]*display:\s*none/);
    // …replaced by the pocket + its grid dissolving as boxes so the three
    // tool links render as ordinary dock items in the same row.
    expect(block).toMatch(/\.nav-tool-pocket\s*\{[^}]*display:\s*contents/);
    expect(block).toMatch(/\.nav-tool-grid\s*\{[^}]*display:\s*contents/);
    // Only the tiny section headings stay hidden on phones.
    expect(block).toMatch(/\.nav-section-title\s*\{[^}]*display:\s*none/);
    // The tool items are re-styled consistently with the other dock items.
    expect(block).toMatch(/\.nav-item\.nav-tool\s*\{[^}]*min-width/);
  });

  it("lays the dock out as a horizontally scrollable row, not a 7-cell grid", () => {
    const block = mobileBlock();
    expect(block).not.toContain("repeat(7,");
    expect(block).toMatch(/\.nav-links\s*\{[^}]*display:\s*flex/);
    // The base .nav-links rule is a sidebar column — the dock must re-declare row.
    expect(block).toMatch(/\.nav-links\s*\{[^}]*flex-direction:\s*row/);
    expect(block).toMatch(/\.nav-links\s*\{[^}]*overflow-x:\s*auto/);
    expect(block).toMatch(/scroll-snap-type/);
    // Items must not shrink to nothing — a fixed min width per destination
    // is what makes the row overflow (and therefore scroll) on phones.
    expect(block).toMatch(/\.nav-item\s*\{[^}]*flex:\s*0 0 auto/);
    expect(block).toMatch(/\.nav-item\s*\{[^}]*min-width:\s*\d+px/);
    // The dock keeps respecting the home-indicator safe area.
    expect(block).toMatch(/\.nav-links\s*\{[^}]*env\(safe-area-inset-bottom\)/);
  });

  it("keeps a ≤800px .farm-guide-open override lifted clear of the dock", () => {
    const block = mobileBlock();
    // bottom: calc(<dock clearance> + env(safe-area-inset-bottom)) — the
    // base rule's bottom: 18px would sit ON the dock's right-most item.
    expect(block).toMatch(/\.farm-guide-open\s*\{[^}]*bottom:\s*calc\([^)]*env\(safe-area-inset-bottom\)[^)]*\)/);
  });

  it("keeps the >800px tool pocket its own section, stacked like the rows above", () => {
    // The base (non-media) rules still lay the pocket out as its own bordered
    // section. Its links are now stacked and sized exactly like the MY WORLD
    // rows — one vertical rhythm down the whole sidebar — instead of being
    // squeezed three-across with 6px centred captions.
    const base = css.slice(0, css.indexOf("@media (max-width: 800px)"));
    expect(base).toMatch(/\.nav-tool-pocket\s*\{[^}]*margin-top/);
    expect(base).toMatch(/\.nav-tool-grid\s*\{[^}]*flex-direction:\s*column/);
    expect(base).not.toMatch(/\.nav-tool-grid\s*\{[^}]*grid-template-columns/);
    expect(base).not.toMatch(/\.nav-item\.nav-tool\s*\{[^}]*flex-direction:\s*column/);
    // The phone dock still dissolves the pocket so all ten stay reachable.
    expect(mobileBlock()).toMatch(/\.nav-tool-pocket\s*\{\s*display:\s*contents/);
  });
});
