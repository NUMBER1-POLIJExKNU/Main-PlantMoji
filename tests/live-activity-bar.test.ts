import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bar = readFileSync("src/components/live-activity-bar.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

describe("shared live sensor bar", () => {
  it("shows honest readings with stable decimal precision", () => {
    expect(bar).toContain("value.toFixed(1)");
    expect(bar).not.toContain("Math.random");
    expect(styles).toContain(".pm-live-values span{display:inline-block;min-width:70px;text-align:center}");
    expect(styles).toContain("font-variant-numeric:tabular-nums");
  });
});
