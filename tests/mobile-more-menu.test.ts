import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync("src/components/reno-app-shell.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

describe("mobile More navigation", () => {
  it("keeps five core destinations and exposes every remaining route", () => {
    expect(shell).toContain("NAV_ITEMS.slice(5)");
    expect(shell).toContain("...TOOL_ITEMS");
    expect(shell).toContain('aria-controls="reno-more-sheet"');
    expect(shell).toContain('id="reno-more-sheet"');
    expect(styles).toContain("grid-template-columns: repeat(6, minmax(0, 1fr));");
    expect(styles).toContain(".reno-nav-overflow { display:none; }");
  });

  it("supports dismissal without leaving a blocking backdrop", () => {
    expect(shell).toContain('event.key === "Escape"');
    expect(shell).toContain("setMoreOpen(false)");
    expect(shell).toContain("event.target === event.currentTarget");
    expect(shell).toContain('role="dialog" aria-modal="true"');
    expect(shell).toContain("moreButtonRef");
    expect(shell).toContain("keepFocusInside");
  });
});
