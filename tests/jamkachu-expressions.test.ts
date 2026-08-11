import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source-contract guard for Jamkachu's tap-reaction expression variety,
// re-seated on the kiki designer sprites (2026-08-11 design integration).
// Same read-the-source style as tests/farm-onboarding-tour.test.ts — the
// farm layer is plain JS/HTML.
//
// The contract: every mood owns a pool of ≥3 DISTINCT {spriteMood,
// emojiBurst} reaction pairs, taps CYCLE the pool (consecutive spam-taps
// always visibly differ), a reaction flashes an ALTERNATE designer-sprite
// mood via PMSprite for ~1.2s then reverts to the deterministic mood frame,
// plus one emoji burst and a distinct positive face glyph ride the existing
// particle styling. The idle
// variety loop is a bob/tilt class flash + occasional sparkle (no more
// pupil/blink DOM writes), skipped entirely under prefers-reduced-motion.
// The quiet gates (night sleep / hatch intro / first-day tour / PMSprite
// absent) are respected, and the whole system grants NOTHING — reactions,
// never rewards.

const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");

const MOOD_KEYS = ["Happy", "Overheating", "TooCold", "DryAir", "HumidAir", "Sleepy", "SoilAcidic", "SoilAlkaline"];
/** The 5 expressions the designer drew per phase (plan mood table). */
const SPRITE_MOODS = new Set(["happy", "plain", "thirsty", "sleepy", "overheat"]);
/** Mood→sprite mapping (plan table) — the honest "own body" per mood. */
const OWN_SPRITE: Record<string, string> = {
  Overheating: "overheat",
  TooCold: "happy",
  DryAir: "thirsty",
  HumidAir: "happy",
  Sleepy: "happy",
  SoilAcidic: "happy",
  SoilAlkaline: "happy",
};

interface ReactionPair {
  spriteMood: string;
  emojiBurst: string;
}

/** The whole expression block: pools + burst/show/clear + the idle variety
 *  loop. It sits between the petting constants and the tactile-interactions
 *  section, so slicing to that landmark keeps it self-contained. */
function expressionSection(): string {
  const start = live.indexOf("const PET_EXPRESSION_POOLS");
  const end = live.indexOf("// ── Tactile interactions");
  expect(start, "live.js lost PET_EXPRESSION_POOLS").toBeGreaterThan(-1);
  expect(end, "live.js lost the tactile-interactions landmark").toBeGreaterThan(start);
  return live.slice(start, end);
}

/** Evaluate the PET_EXPRESSION_POOLS object literal from source. */
function loadPools(): Record<string, ReactionPair[]> {
  const section = expressionSection();
  const eq = section.indexOf("= {");
  const close = section.indexOf("\n};", eq);
  expect(eq, "pools literal start").toBeGreaterThan(-1);
  expect(close, "pools literal end").toBeGreaterThan(eq);
  const literal = section.slice(eq + 2, close + 2);
  return new Function(`return (${literal});`)() as Record<string, ReactionPair[]>;
}

describe("per-mood tap-reaction pair pools", () => {
  const pools = loadPools();

  it("covers every mood with at least 3 distinct {spriteMood, emojiBurst} pairs", () => {
    for (const mood of MOOD_KEYS) {
      const pool = pools[mood];
      expect(Array.isArray(pool), `${mood} pool should be an array`).toBe(true);
      const distinct = new Set(pool.map((pair) => `${pair.spriteMood}|${pair.emojiBurst}`));
      expect(distinct.size, `${mood} pool needs ≥3 DISTINCT pairs`).toBeGreaterThanOrEqual(3);
    }
    expect(Object.keys(pools).sort()).toEqual([...MOOD_KEYS].sort());
  });

  it("gives Happy taps a large, all-positive face variety", () => {
    expect(pools.Happy.length).toBeGreaterThanOrEqual(12);
    expect(new Set(pools.Happy.map((pair) => pair.emojiBurst)).size).toBeGreaterThanOrEqual(12);
    const section = expressionSection();
    expect(section).toContain("const POSITIVE_FACE_GLYPHS");
    expect(section).toContain('expression.textContent = POSITIVE_FACE_GLYPHS[reaction.emojiBurst] ?? "😊"');
    expect(section).not.toMatch(/Happy:[\s\S]{0,1200}spriteMood: "(?:plain|sleepy)"/);
  });

  it("only flashes sprite moods the designer actually drew, with a real emoji burst", () => {
    for (const mood of MOOD_KEYS) {
      for (const pair of pools[mood]) {
        expect(SPRITE_MOODS.has(pair.spriteMood), `${mood} flashes unknown sprite mood '${pair.spriteMood}'`).toBe(true);
        expect(typeof pair.emojiBurst, `${mood} pair emojiBurst`).toBe("string");
        expect(pair.emojiBurst.length, `${mood} pair emojiBurst empty`).toBeGreaterThan(0);
      }
    }
  });

  it("problem-mood taps stay encouraging but keep honest concern flashes", () => {
    // The MOOD frame carries the honest status; tap reactions answer the
    // affection, so warm happy-flashes are welcome on problem moods too.
    // Two lines hold: every problem pool keeps ≥2 entries flashing the
    // mood's OWN drawn body (struggle never fully disappears), and every
    // pool keeps ≥2 warm happy-flashes (a tap always feels answered).
    for (const mood of MOOD_KEYS) {
      const pool = pools[mood];
      const warm = pool.filter((pair) => pair.spriteMood === "happy");
      expect(warm.length, `${mood} lost its warm happy flashes`).toBeGreaterThanOrEqual(2);
      if (mood === "Happy") continue;
      const honest = pool.filter((pair) => pair.spriteMood === OWN_SPRITE[mood]);
      expect(honest.length, `${mood} lost its honest own-body flashes`).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps named reactions for the explicit callers (drowsy blink, hop giggle)", () => {
    const section = expressionSection();
    expect(section).toContain("const PET_NAMED_REACTIONS");
    expect(section).toMatch(/blink: \{ spriteMood: "happy"/);
    expect(section).toMatch(/giggle: \{ spriteMood: "happy"/);
  });
});

describe("tap handler behavior", () => {
  it("cycles the pool by a tap counter so consecutive taps differ", () => {
    const section = expressionSection();
    expect(section).toContain("pool[petExpressionIndex % pool.length]");
    expect(section).toContain("petExpressionIndex += 1");
    // Back-to-back taps restart cleanly (old flash swapped out immediately).
    expect(section).toMatch(/clearPetExpression\(\); \/\/ restart cleanly/);
  });

  it("flashes the alternate sprite mood via PMSprite plus one emoji burst", () => {
    const section = expressionSection();
    expect(section).toContain("window.PMSprite.set({ flashMood: reaction.spriteMood })");
    expect(section).toContain("spawnPetEmojiBurst(reaction.emojiBurst)");
    expect(section).toContain('document.getElementById("positive-expression")');
    expect(section).toContain('expression.classList.add("is-visible")');
    // The burst rides the shipped badge-tap particle styling.
    expect(section).toContain('el.className = "badge-tap-particle"');
  });

  it("flashes ~1.2s then reverts to the mood frame (flashMood cleared)", () => {
    const section = expressionSection();
    expect(section).toContain("const PET_EXPRESSION_MS = 1200");
    expect(section).toMatch(/petExpressionTimer = setTimeout\([\s\S]{0,120}?clearPetExpression\(\);/);
    expect(section).toContain("window.PMSprite?.set({ flashMood: null })");
    expect(section).toContain('expression.classList.remove("is-visible")');
  });

  it("respects the quiet gates: night sleep, hatch intro, tour, PMSprite absent", () => {
    const section = expressionSection();
    expect(section).toMatch(/function showPetExpression[\s\S]{0,200}?if \(sleepShown \|\| hatchActive \|\| tourActive\) return;/);
    expect(section).toMatch(/if \(!window\.PMSprite\) return;/);
    // Mood renders and sleep entry sweep any stale reaction flash.
    expect(live).toMatch(/function setMascotMood\(state\) \{\s*\n\s*clearPetExpression\(\);/);
    expect(live).toMatch(/if \(sleepNow\) \{[\s\S]{0,300}?clearPetExpression\(\);/);
  });

  it("is wired into every tap flavor (full pet, cooldown, drowsy, hop, care press)", () => {
    expect(live).toMatch(/function quickPetResponse\(\) \{\s*\n\s*showPetExpression\(\);/);
    expect(live).toMatch(/function drowsyPetResponse\(\) \{\s*\n\s*showPetExpression\("blink"\)/);
    expect(live).toMatch(/function surpriseHop\(now\) \{[\s\S]{0,200}?showPetExpression\("giggle"/);
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

  it("bobs/tilts the sprite container or spawns a quiet sparkle (no pupil writes)", () => {
    const section = expressionSection();
    expect(section).toContain('svg.classList.add("idle-bob")');
    expect(section).toContain("spawnSparkles(mascotRect(), 3)");
    expect(section).not.toContain(".pupils");
    // style.css backs the class flash with a one-shot keyframe on the img,
    // inside the reduced-motion-gated block.
    expect(css).toMatch(/\.mascot-svg\.idle-bob #jamkachu-sprite \{ animation: pm-idle-bob/);
    const gate = css.indexOf(".mascot-svg.idle-bob #jamkachu-sprite");
    const media = css.lastIndexOf("@media (prefers-reduced-motion: no-preference)", gate);
    expect(media, "idle-bob rule must sit under a no-preference gate").toBeGreaterThan(-1);
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
