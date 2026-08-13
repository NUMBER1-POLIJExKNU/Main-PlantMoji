import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const explorer = readFileSync(resolve(process.cwd(), "src/components/crop-explorer.tsx"), "utf8");
const catalog = readFileSync(resolve(process.cwd(), "src/lib/jember-crop-catalog.ts"), "utf8");
const analyzer = readFileSync(resolve(process.cwd(), "src/lib/environment-analyzer.ts"), "utf8");

// Step 2 of the Crop Explorer once showed only three crops. Nothing was
// broken in any way a test could see: the catalog returned all eleven, the
// analyzer ranked all eleven, and all eleven <button>s were in the DOM. A
// single `:nth-child(n+4){display:none}` appended to an unrelated CSS line
// hid the rest. The screen disagreed with the data and every layer reported
// success, so the guard has to sit on the last layer — what is visible.
describe("Crop Explorer step 2 shows every ranked crop", () => {
  it("never hides trailing cards in the rank grid", () => {
    // Any nth-child/nth-of-type rule scoped at the rank grid is suspect: the
    // grid is a ranked list of every compared crop, so position must never
    // decide visibility.
    const positional = css.match(/\.pm-crop-rank-grid[^{]*:nth-(child|of-type)\([^)]*\)[^{]*\{[^}]*\}/g) ?? [];
    expect(
      positional,
      `A positional rule is scoped at .pm-crop-rank-grid: ${positional.join(" ")}. ` +
        "That is how step 2 silently shrank to three cards.",
    ).toEqual([]);
  });

  it("keeps the rank grid free of any height clamp that could crop rows", () => {
    const gridRules = css.match(/\.pm-crop-rank-grid\s*\{[^}]*\}/g) ?? [];
    expect(gridRules.length).toBeGreaterThan(0);
    for (const rule of gridRules) {
      expect(rule, `${rule} clamps the grid's height — later rows would be cut off`).not.toMatch(
        /max-height|overflow\s*:\s*hidden/,
      );
    }
  });

  it("renders one card per analyzer result, unsliced", () => {
    expect(explorer).toContain("data.results.map(");
    // A .slice() between the results and the grid would reintroduce the same
    // bug one layer up, where the CSS guard above cannot see it.
    expect(explorer).not.toMatch(/data\.results\s*\.slice/);
    expect(explorer).not.toMatch(/results\.slice\(0,\s*\d/);
  });

  it("compares every catalog crop rather than a filtered subset", () => {
    // The catalog drops only retired crops; drafts and reference-only crops
    // are still educational cards. Narrowing this to status='active' would
    // cut the explorer back to the three quest-approved crops.
    expect(catalog).toContain('.neq("status", "retired")');
    expect(catalog).not.toContain('.eq("status", "active")');
    expect(analyzer).toContain("profiles.map((profile) => analyzeEnvironment(snapshot, profile))");
  });
});
