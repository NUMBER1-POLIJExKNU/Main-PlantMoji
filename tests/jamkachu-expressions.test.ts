import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source-contract guard for Jamkachu's tap-reaction expression variety
// (farm-wave item 18 — the direct user request: "표정 더 다양하게, 터치하면
// 표정이 달라진다던가"). Same read-the-source style as
// tests/farm-onboarding-tour.test.ts — the farm layer is plain JS/HTML.
//
// The contract: every mood owns a pool of ≥3 tap-reaction faces, taps CYCLE
// the pool (consecutive spam-taps always visibly differ), the reaction is a
// short flash that reverts to the deterministic mood face, the idle variety
// loop is skipped entirely under prefers-reduced-motion, the quiet gates
// (night sleep / hatch intro / first-day tour) are respected, and the whole
// system grants NOTHING — reactions, never rewards.

const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");

const MOOD_KEYS = ["Happy", "Overheating", "TooCold", "DryAir", "HumidAir", "Sleepy", "SoilAcidic", "SoilAlkaline"];
// The three shipped micro-expression groups reuse their original data-face
// names; every other pool face is a new "tap-<key>" SVG group.
const LEGACY_FACES = new Set(["curious", "proud", "giggle"]);

/** The whole expression block: pools + show/clear + the idle variety loop.
 *  It sits between the petting constants and the tactile-interactions
 *  section, so slicing to that landmark keeps it self-contained. */
function expressionSection(): string {
  const start = live.indexOf("const PET_EXPRESSION_POOLS");
  const end = live.indexOf("// ── Tactile interactions");
  expect(start, "live.js lost PET_EXPRESSION_POOLS").toBeGreaterThan(-1);
  expect(end, "live.js lost the tactile-interactions landmark").toBeGreaterThan(start);
  return live.slice(start, end);
}

/** Evaluate the PET_EXPRESSION_POOLS object literal from source. */
function loadPools(): Record<string, string[]> {
  const section = expressionSection();
  const eq = section.indexOf("= {");
  const close = section.indexOf("};", eq);
  expect(eq, "pools literal start").toBeGreaterThan(-1);
  expect(close, "pools literal end").toBeGreaterThan(eq);
  const literal = section.slice(eq + 2, close + 1);
  return new Function(`return (${literal});`)() as Record<string, string[]>;
}

describe("per-mood tap-reaction face pools", () => {
  const pools = loadPools();

  it("covers every mood with at least 3 distinct faces", () => {
    for (const mood of MOOD_KEYS) {
      const pool = pools[mood];
      expect(Array.isArray(pool), `${mood} pool should be an array`).toBe(true);
      expect(new Set(pool).size, `${mood} pool needs ≥3 DISTINCT faces`).toBeGreaterThanOrEqual(3);
      for (const face of pool) expect(typeof face, `${mood} pool entry`).toBe("string");
    }
    expect(Object.keys(pools).sort()).toEqual([...MOOD_KEYS].sort());
  });

  it("backs every pool face with real SVG art and a tap-face show rule", () => {
    const faces = new Set(Object.values(pools).flat());
    for (const face of faces) {
      const dataFace = LEGACY_FACES.has(face) ? face : `tap-${face}`;
      expect(html, `index.html lost the ${dataFace} face art`).toContain(`data-face="${dataFace}"`);
      expect(html, `index.html lost the tapface-${face} show rule`).toContain(`tapface-${face}`);
    }
    // The reaction layer must win over whichever mood face is showing.
    expect(html).toContain(".mascot-svg.is-tapface .mascot-face { display: none; }");
  });

  it("keeps problem-mood pools honest — no celebration faces over a struggling plant", () => {
    for (const mood of MOOD_KEYS) {
      if (mood === "Happy") continue;
      for (const face of pools[mood]) {
        expect(["love", "star", "blep", "giggle", "proud"], `${mood} shows party face '${face}'`).not.toContain(face);
      }
    }
  });
});

describe("tap handler behavior", () => {
  it("cycles the pool by a tap counter so consecutive taps differ", () => {
    const section = expressionSection();
    expect(section).toContain("pool[petExpressionIndex % pool.length]");
    expect(section).toContain("petExpressionIndex += 1");
    // Back-to-back taps restart cleanly (old face swapped out immediately).
    expect(section).toMatch(/clearPetExpression\(\); \/\/ restart cleanly/);
  });

  it("flashes ~1.2s then reverts to the mood face", () => {
    const section = expressionSection();
    expect(section).toContain("const PET_EXPRESSION_MS = 1200");
    expect(section).toMatch(/petExpressionTimer = setTimeout\([\s\S]{0,120}?clearPetExpression\(\);/);
  });

  it("respects the quiet gates: night sleep, hatch intro, first-day tour", () => {
    const section = expressionSection();
    expect(section).toMatch(/function showPetExpression[\s\S]{0,200}?if \(sleepShown \|\| hatchActive \|\| tourActive\) return;/);
    // Mood renders and sleep entry sweep any stale reaction face.
    expect(live).toMatch(/function setMascotMood\(state\) \{\s*\n\s*clearPetExpression\(\);/);
    expect(live).toMatch(/if \(sleepNow\) \{[\s\S]{0,300}?clearPetExpression\(\);/);
  });

  it("is wired into every tap flavor (full pet, cooldown, drowsy, hop, care press)", () => {
    expect(live).toMatch(/function quickPetResponse\(\) \{\s*\n\s*showPetExpression\(\);/);
    expect(live).toMatch(/function drowsyPetResponse\(\) \{\s*\n\s*showPetExpression\("blink"\)/);
    expect(live).toMatch(/function surpriseHop\(now\) \{[\s\S]{0,200}?showPetExpression\("surprised"/);
    // petMascot's full pet path reacts too (beyond the quick/drowsy paths).
    const petMascot = live.slice(live.indexOf("function petMascot"), live.indexOf("// ── Camera Live Guardian"));
    expect(petMascot).toContain("showPetExpression()");
  });
});

describe("idle expression variety", () => {
  it("runs on a randomized 25–45s cadence with a brief ~0.8s flash", () => {
    const section = expressionSection();
    expect(section).toContain("const IDLE_EXPRESSION_MIN_MS = 25_000");
    expect(section).toContain("const IDLE_EXPRESSION_MAX_MS = 45_000");
    expect(section).toContain("const IDLE_EXPRESSION_MS = 800");
    expect(section).toMatch(/IDLE_EXPRESSION_MIN_MS \+ Math\.random\(\) \* \(IDLE_EXPRESSION_MAX_MS - IDLE_EXPRESSION_MIN_MS\)/);
  });

  it("is skipped ENTIRELY under prefers-reduced-motion (matchMedia check)", () => {
    const section = expressionSection();
    expect(section).toMatch(/function maybeIdleExpression\(\) \{\s*\n\s*if \(prefersReducedMotion\(\)\) return;/);
    // prefersReducedMotion is the shared matchMedia guard.
    expect(live).toMatch(/function prefersReducedMotion[\s\S]{0,120}?matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  });

  it("stays quiet during sleep/hatch/tour, interaction, and celebrations", () => {
    const section = expressionSection();
    expect(section).toContain("if (sleepShown || hatchActive || tourActive || mascotDown) return;");
    expect(section).toMatch(/lastPointerAt < IDLE_EXPRESSION_MIN_MS\) return;/);
    expect(section).toContain("if (fxPlaying || fxQueue.length > 0) return;");
  });
});

describe("zero rewards — reactions only", () => {
  it("the expression block never touches network, storage, XP, or the celebration queue", () => {
    const section = expressionSection();
    expect(section).not.toMatch(/\bfetch\s*\(/);
    expect(section).not.toMatch(/supabase/i);
    expect(section).not.toMatch(/localStorage|sessionStorage/);
    expect(section).not.toMatch(/fxEnqueue|orbCascade|fxXpGain|spawnConfetti|notePresented|total_xp|seeds/);
  });
});
