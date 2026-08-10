import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appearance = readFileSync("src/components/appearance-controls.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

describe("mobile shell focus", () => {
  it("keeps appearance tools out of ordinary mobile play routes", () => {
    expect(appearance).toContain('pathname.startsWith("/settings")');
    expect(appearance).toContain('" is-settings"');
    expect(styles).toContain(".reno-appearance-controls:not(.is-settings) { display: none; }");
  });
});
