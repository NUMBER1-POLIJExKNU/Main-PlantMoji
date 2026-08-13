import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOP_MATCH_COUNT, topMatchKeys } from "@/components/crop-explorer";
import type { EnvironmentAnalysis } from "@/lib/environment-analyzer";

// Step 2 highlights the three crops the scan ranked highest — the same three
// the grid already badges #1/#2/#3. Ties are the norm (a real Jember scan
// gives Coconut 3/3 then seven crops level at 2/3), and extending the
// highlight through them was tried and rejected: it gilds eight of eleven
// cards and contradicts the numbering already on screen. The one thing worth
// guarding is a scan that measured nothing at all.

/** Minimal stand-in; only the four fields the podium reads are meaningful. */
function analysis(cropKey: string, matched: number, evaluated = 4): EnvironmentAnalysis {
  return {
    cropKey,
    cropName: cropKey,
    conditions: {},
    matchedConditions: matched,
    evaluatedConditions: evaluated,
    label: evaluated === 0 ? "not_enough_data" : "partial",
    largestMismatch: null,
  } as unknown as EnvironmentAnalysis;
}

const keys = (results: EnvironmentAnalysis[]) => [...topMatchKeys(results)].sort();

describe("crop explorer top-match highlight", () => {
  it("marks the top three when the ranking separates them", () => {
    const results = [
      analysis("a", 4), analysis("b", 3), analysis("c", 2),
      analysis("d", 1), analysis("e", 0),
    ];
    expect(keys(results)).toEqual(["a", "b", "c"]);
    expect(TOP_MATCH_COUNT).toBe(3);
  });

  it("marks exactly three on the real Jember shape", () => {
    // The live demo scan: one clear winner, then a seven-way tie. Marking the
    // whole tie would gild eight of eleven cards; the badges already say #1-#11
    // and every card prints its own score, so the tie stays legible.
    const results = [
      analysis("coconut", 3, 3),
      ...["paddy", "maize", "tobacco", "coffee", "cane", "soy", "melon"].map((k) => analysis(k, 2, 3)),
      analysis("cayenne", 1, 3), analysis("strawberry", 0, 3), analysis("chili", 0, 2),
    ];
    expect(keys(results)).toEqual(["coconut", "maize", "paddy"]);
  });

  it("highlights nothing when no condition was measured", () => {
    // Sensors off: every crop scores 0/0 and the order is pure tie-break, so
    // a podium here would be alphabetical dressed up as a recommendation.
    const results = [analysis("a", 0, 0), analysis("b", 0, 0), analysis("c", 0, 0), analysis("d", 0, 0)];
    expect(keys(results)).toEqual([]);
  });

  it("still marks three when the whole catalog ties", () => {
    // Consistent with the badges: something is #1/#2/#3 either way, and the
    // identical scores printed on every card are what tell the viewer the
    // ranking did not really separate them.
    const results = [
      analysis("a", 2), analysis("b", 2), analysis("c", 2),
      analysis("d", 2), analysis("e", 2),
    ];
    expect(keys(results)).toEqual(["a", "b", "c"]);
  });

  it("skips unmeasured crops even when they sit in the first three rows", () => {
    const results = [analysis("a", 1), analysis("b", 0, 0), analysis("c", 0, 0)];
    expect(keys(results)).toEqual(["a"]);
  });

  it("survives a short or empty result list", () => {
    expect(keys([])).toEqual([]);
    // Both are inside a top-three — literally correct, and unreachable with
    // the eleven-crop Jember catalog anyway.
    expect(keys([analysis("a", 3), analysis("b", 1)])).toEqual(["a", "b"]);
  });
});

describe("crop explorer top-match rendering", () => {
  const source = readFileSync("src/components/crop-explorer.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");

  it("emphasises the podium instead of hiding the rest", () => {
    // The rule this replaces did the opposite: `:nth-child(n+4){display:none}`
    // clipped step 2 to three cards and hid the other eight entirely.
    expect(css).not.toMatch(/\.pm-crop-rank-grid\s*>\s*button:nth-child/);
    expect(css).toContain(".pm-crop-rank-grid > button.is-top");
    expect(source).toContain('topKeys.has(item.cropKey) ? "is-top" : ""');
  });

  it("lets a card be both top-ranked and selected", () => {
    // Two different facts about one card; selection keeps the green border.
    expect(source).toContain('${selected?.cropKey === item.cropKey ? " is-selected" : ""}');
    expect(css).toContain(".pm-crop-rank-grid > button.is-top.is-selected");
  });

  it("labels the highlight in both languages without claiming a count", () => {
    // "TOP 3" would be wrong on the tie case above, which can mark four.
    expect(source).toContain('topMatch: "BEST MATCH"');
    expect(source).toContain('topMatch: "PALING COCOK"');
    expect(source).not.toMatch(/topMatch: "TOP 3"/);
  });
});
