import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const map = readFileSync("src/components/how-to-play-map.tsx", "utf8");
const settings = readFileSync("src/app/settings/page.tsx", "utf8");

describe("interactive how-to-play map", () => {
  it("shows the complete game loop in both languages", () => {
    for (const label of ["SENSE", "UNDERSTAND", "ACT", "VERIFY", "REWARD", "GROW", "RASAKAN", "PAHAMI", "BERTINDAK", "PERIKSA", "HADIAH", "TUMBUH"]) {
      expect(map).toContain(label);
    }
  });

  it("links tutorial steps to playable routes from Settings", () => {
    expect(settings).toContain("<HowToPlayMap locale={locale}");
    for (const route of ["/monitoring", "/plants", "/quests", "/collection", "/diary"]) {
      expect(map).toContain(`href: "${route}"`);
    }
  });
});
