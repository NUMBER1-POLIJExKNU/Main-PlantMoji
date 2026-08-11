import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("student-first home actions", () => {
  it("localizes the current mission and exposes a clear action", () => {
    const card = read("src/components/home-quest-card.tsx");
    const home = read("src/components/plant-home.tsx");
    expect(card).toContain("MISI SEKARANG");
    expect(card).toContain("BUKA MISI →");
    expect(home).toContain("locale={locale}");
  });

  it("keeps the next step visible without an extra discovery tap", () => {
    const whatNow = read("src/components/what-now.tsx");
    expect(whatNow).toContain('className="pm-what-now" open');
    expect(whatNow).toContain("LANGKAH BERIKUTNYA");
    expect(whatNow).toContain("START NOW");
  });

  it("takes sensor details to monitoring instead of crop exploration", () => {
    expect(read("src/components/home-environment-glance.tsx")).toContain('href="/monitoring"');
  });

  it("keeps frequent mobile controls at finger-friendly sizes", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/\.pm-farmer-chat-prompts button\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.reno-more-sheet header button \{ width:44px; height:44px; \}/);
    expect(css).toMatch(/\.reno-locale-switch button \{[\s\S]*?min-height: 44px/);
  });
});
