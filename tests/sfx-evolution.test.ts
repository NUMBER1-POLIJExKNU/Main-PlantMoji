import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sfx = readFileSync(resolve(process.cwd(), "public/farm/sfx.js"), "utf8");

describe("evolution reveal audio", () => {
  it("keeps the original ceremony API and exposes dedicated impact variants", () => {
    expect(sfx).toContain("function evoRiser(loops)");
    expect(sfx).toContain("function evoFanfare()");
    expect(sfx).toContain("function cry()");
    expect(sfx).toContain("function evoImpact(options)");
    expect(sfx).toContain("function evoFinalForm()");
    expect(sfx).toContain("evoImpact,");
    expect(sfx).toContain("evoFinalForm,");
  });

  it("registers impact cues for probing while keeping the grand hit its own recipe", () => {
    // The recipe is byte-for-byte the sound it always was. Only the name moved
    // off "jackpot", because this fires when a plant reaches its final stage —
    // the end of days of care, not a payout.
    expect(sfx).toContain("evoImpact: (c) => impactRecipe(c, c.destination, false)");
    expect(sfx).toContain("evoFinalForm: (c) => impactRecipe(c, c.destination, true)");
    expect(sfx).toContain("function impactRecipe(c, dest, grand)");
    expect(sfx).toContain("const chord = grand");
    expect(sfx).toContain("if (grand)");
    expect(sfx).not.toContain("pachinko");
  });

  it("uses a low reveal hit, bright major chord, and rising sparkle", () => {
    const recipe = sfx.slice(sfx.indexOf("function impactRecipe"), sfx.indexOf("// ── Cue recipes"));
    expect(recipe).toContain('low.type = "sine"');
    expect(recipe).toContain("low.frequency.exponentialRampToValueAtTime");
    expect(recipe).toContain('osc.type = "triangle"');
    expect(recipe).toContain("N.C5");
    expect(recipe).toContain("N.E5");
    expect(recipe).toContain("N.G5");
    expect(recipe).toContain("N.C6");
    expect(recipe).toContain("[N.C6, N.E6, N.G6, N.C6 * 2]");
  });

  it("preserves mute, unlock, and no-rate-limit ceremony guardrails", () => {
    const methods = sfx.slice(sfx.indexOf("function evoRiser"), sfx.indexOf("function buzz"));
    expect(methods).toContain("const c = readyContext();");
    expect(methods).toContain("function evoImpact(options)");
    expect(methods).toContain("return impactRecipe(c, c.destination, grand);");
    // Dedicated ceremony calls intentionally bypass play(), whose ordinary
    // cues remain rate-limited. The guard is shared in readyContext().
    expect(methods).not.toContain("lastPlayedAt");
    const ready = sfx.slice(sfx.indexOf("function readyContext"), sfx.indexOf("// Evolution ceremony methods"));
    expect(ready).toContain("if (readMuted()) return null");
    expect(ready).toContain("if (blocked) return null");
    expect(ready).toContain("if (!c) return null");
  });
});
