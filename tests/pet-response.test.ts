import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Dopamine contract (2026-08-09): a tap on Jamkachu must NEVER die silently.
// The full pet path is paced (600ms cooldown, 5-in-30s satiation), but the
// declined taps still answer with a cheap acknowledgment — the pacing may
// change the response's flavor, never its existence. Source-contract style,
// like tests/farmer-npc-ui.test.ts.
const src = readFileSync("public/farm/live.js", "utf8");

describe("mascot tap dopamine contract — no silent taps", () => {
  it("satiated taps still answer with the drowsy response", () => {
    expect(src).toMatch(/if \(now < petSatiatedUntil\) \{\s*\n?\s*drowsyPetResponse\(\);/);
  });

  it("cooldown taps still answer with the quick response", () => {
    expect(src).toMatch(/if \(now < petCooldownUntil\) \{\s*\n?\s*quickPetResponse\(\);/);
  });

  it("acknowledgments never touch pacing accounting or the speech bubble", () => {
    const start = src.indexOf("function quickPetResponse");
    const end = src.indexOf("function petMascot");
    expect(start).toBeGreaterThan(-1);
    const helpers = src.slice(start, end > start ? end : undefined);
    expect(helpers).not.toMatch(/petTapTimes|petSatiatedUntil|petCooldownUntil\s*=|showTransientBubble/);
  });
});
