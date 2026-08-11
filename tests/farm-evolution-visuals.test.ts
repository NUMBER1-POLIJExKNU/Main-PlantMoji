import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { COMPANION_STAGES } from "@/types/game";

// Source-contract guard for the evolution farm layer, re-seated on the kiki
// designer sprites (2026-08-11): the ten companion stages bucket into the
// four drawn growth phases (jamkachu-sprite.js STAGE_PHASE — plan table,
// decided, do not redesign), late-stage differentiation rides the
// --companion-accent aura on the sprite img, and the ceremony sequencer
// swaps sprite frames per strobe step via PMSprite. Same read-the-source
// style as tests/farm-shop-layer.test.ts.

const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");
const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const demo = readFileSync(resolve(process.cwd(), "public/farm/demo.js"), "utf8");
const spriteJs = readFileSync(resolve(process.cwd(), "public/farm/jamkachu-sprite.js"), "utf8");

const FORM_KEYS = ["cool", "air", "light", "soil", "steady", "balanced"] as const;

interface SpriteTables {
  STAGE_PHASE: Record<string, number>;
  PHASE_SLUG: Record<number, string>;
}

function loadSpriteTables(): SpriteTables {
  const stubWindow: { PMSprite?: { tables: SpriteTables } } = {};
  const context = vm.createContext({ window: stubWindow });
  vm.runInContext(spriteJs, context, { filename: "jamkachu-sprite.js" });
  if (!stubWindow.PMSprite) throw new Error("jamkachu-sprite.js did not assign window.PMSprite");
  return stubWindow.PMSprite.tables;
}

describe("stage→phase mapping on the designer sprite (plan table)", () => {
  const tables = loadSpriteTables();

  it("buckets all ten companion stages into the four drawn phases exactly as decided", () => {
    expect(tables.STAGE_PHASE).toEqual({
      Seed: 1,
      Sprout: 2,
      Seedling: 2,
      Bud: 3,
      Bloom: 3,
      Fruit: 4,
      Guardian: 4,
      Elder: 4,
      Radiant: 4,
      Legend: 4,
    });
    // Every engine stage is covered — no stage can fall through to a guess.
    for (const stage of COMPANION_STAGES) {
      expect(tables.STAGE_PHASE[stage], `stage ${stage} unmapped`).toBeGreaterThanOrEqual(1);
    }
    expect(tables.PHASE_SLUG).toEqual({ 1: "seed", 2: "sprout", 3: "flower", 4: "fruit" });
  });

  it("live.js renderCompanion feeds the stage into PMSprite", () => {
    const fn = live.slice(live.indexOf("function renderCompanion"), live.indexOf("const $ ="));
    expect(fn).toContain("window.PMSprite?.set({ stage })");
  });
});

describe("late-stage differentiation (aura + form tint, stage-extras retired)", () => {
  it("upper-ladder stages glow via --companion-accent drop-shadow on the sprite img", () => {
    for (const stage of ["Guardian", "Radiant", "Legend"]) {
      expect(css).toMatch(
        new RegExp(`\\.mascot-svg\\.companion-${stage} #jamkachu-sprite \\{ filter:[^}]*drop-shadow\\([^)]*var\\(--companion-accent`),
      );
    }
    // Saturation ramps monotonically upward at the top of the ladder.
    const sat = (stage: string) => {
      const match = css.match(new RegExp(`\\.mascot-svg\\.companion-${stage} #jamkachu-sprite \\{ filter: saturate\\(([\\d.]+)\\)`));
      expect(match, `${stage} lost its saturation rung`).not.toBeNull();
      return Number(match![1]);
    };
    expect(sat("Fruit")).toBeGreaterThan(sat("Bloom"));
    expect(sat("Legend")).toBeGreaterThan(sat("Radiant"));
    expect(sat("Radiant")).toBeGreaterThan(sat("Guardian"));
  });

  it("keeps the care-affinity form tint feeding the aura", () => {
    for (const form of FORM_KEYS) {
      expect(css).toContain(`.mascot-svg[data-companion-form="${form}"] { --companion-accent:`);
    }
    // live.js sets the attribute the tint selectors key on.
    expect(live).toContain("svg.dataset.companionForm = form");
  });

  it("the old stage-extra accent groups are fully retired", () => {
    expect(css).not.toContain(".stage-extra {");
    expect(css).not.toContain(".mascot-svg.companion-Legend .stage-legend");
  });
});

describe("evolution ceremony trigger + sequencer", () => {
  it("live.js stage-order fallback lists all ten stages in engine order", () => {
    const literal = COMPANION_STAGES.map((stage) => `"${stage}"`).join(", ");
    expect(live).toContain(`[${literal}]`);
  });

  it("celebrates only a genuine rank increase, never the first render", () => {
    expect(live).toContain("let prevCompanionStage = null");
    expect(live).toContain(
      "priorStage !== null && STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(priorStage)",
    );
  });

  it("marks the cycle-aware pm_evo_seen key BEFORE enqueuing the ceremony", () => {
    expect(live).toContain('const EVO_SEEN_KEY = "pm_evo_seen"');
    expect(live).toContain("`${state.cycle ?? 1}:${stage}`");
    const setIdx = live.indexOf("localStorage.setItem(EVO_SEEN_KEY, seenKey)");
    const enqueueIdx = live.indexOf("fxEvolve(priorStage, stage)");
    expect(setIdx).toBeGreaterThan(-1);
    expect(enqueueIdx).toBeGreaterThan(setIdx); // crash-safe: marked first
  });

  it("the strobe's setLook swaps both the class and the bond-owned sprite form", () => {
    const seq = live.slice(live.indexOf("async function runEvolutionSequence"), live.indexOf("function fxEvolveNow"));
    expect(seq).toContain("svg.classList.add(`companion-${stage}`)");
    expect(seq).toContain("window.PMSprite?.set(bondLevel === null ? { stage } : { stage, bondLevel })");
  });

  it("runs the full ceremony when a bond level crosses a two-level visual band", () => {
    expect(live).toContain("function fxBondEvolve(oldLevel, newLevel)");
    expect(live).toContain("if (nextVisual > previousVisual) fxBondEvolve(prevLevel, level);");
    expect(live).toContain("else fxLevelUp(level);");
    expect(live).toContain("oldBondLevel: oldLevel");
    expect(live).toContain("newBondLevel: newLevel");
    expect(live).toContain('grand: newVisual === 15');
  });

  it("same-phase strobes still alternate two visibly distinct silhouettes", () => {
    // 6 of the 9 ladder transitions bucket onto ONE drawn phase (e.g.
    // Sprout→Seedling — pinned here from the decided table), so oldStage
    // and newStage render byte-identical sprite frames. The ceremony marks
    // the new-stage strobe beats with .evo-sil-alt and style.css stretches
    // that silhouette into a second shape — without this pair the suspense
    // strobe freezes into a static white cutout for two-thirds of all
    // evolutions.
    const tables = loadSpriteTables();
    expect(tables.STAGE_PHASE.Sprout).toBe(tables.STAGE_PHASE.Seedling);
    const seq = live.slice(live.indexOf("async function runEvolutionSequence"), live.indexOf("function fxEvolveNow"));
    expect(seq).toContain("window.PMSprite?.stagePhase(oldStage) === window.PMSprite?.stagePhase(newStage)");
    expect(seq).toContain('svg.classList.toggle("evo-sil-alt", strobeSamePhase && stage === newStage');
    expect(css).toContain(".mascot-svg.evo-sil.evo-sil-alt #jamkachu-sprite { transform: scaleY(1.28) scaleX(0.78) rotate(2deg); }");
    // Both the payoff reveal and the finally-cleanup clear the alt marker
    // together with the silhouette, so no stretch can leak past the show.
    expect(seq).toContain('svg.classList.remove("evo-sil", "evo-sil-alt")');
    expect(seq).toContain('svg.classList.remove("evo-sil", "evo-sil-alt", "evo-reveal-bounce", "evo-xfade")');
  });

  it("the ceremony filters land on the div/img (selectors still match)", () => {
    // Silhouette on the container div flattens img + overlay together…
    expect(css).toContain(".mascot-svg.evo-sil { filter: brightness(0) invert(1); transition: none !important; }");
    // …and the breath bob on the img is killed so the silhouette holds still.
    expect(css).toContain(".mascot-svg.evo-sil #jamkachu-sprite { animation: none !important; }");
    // Reduced motion: crossfade only, silhouette/flash/tint disabled.
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.mascot-svg\.evo-sil \{ filter: none; \}/);
    expect(css).toMatch(/\.mascot-svg\.evo-xfade \{ transition: opacity/);
    // The hitstop freeze targets the img's animation now.
    expect(live).toMatch(/function setBreathPaused[\s\S]{0,200}?#jamkachu-sprite/);
  });

  it("promotes the tiny desktop LIVE badge into a full-screen evolution arena", () => {
    const seq = live.slice(live.indexOf("async function runEvolutionSequence"), live.indexOf("function fxEvolveNow"));
    expect(seq).toContain('document.body?.classList.add("evolution-active")');
    expect(seq).toContain('wrap.classList.add("evo-arena")');
    expect(seq).toContain('wrap.classList.remove("evo-arena", "evo-pulse", "evo-shake-lg")');
    expect(css).toMatch(/\.mascot-wrapper\.evo-arena > \.mascot-svg \{[\s\S]*?width:min\(54vmin,460px\)/);
    expect(css).toContain(".mascot-wrapper.evo-arena .positive-expression");
  });

  it("keeps the full-weight payoff without repeated full-screen flashes", () => {
    const seq = live.slice(live.indexOf("async function runEvolutionSequence"), live.indexOf("function fxEvolveNow"));
    expect(seq.match(/flashOnce\(/g)).toHaveLength(1);
    expect(seq).toContain("spawnEvoChargeOrbs(grand ? 32 : 22)");
    expect(seq).toContain("spawnEvoShockwaves(grand)");
    expect(seq).toContain("window.PMSfx?.evoImpact?.({ grand })");
    expect(seq).toContain("spawnEvoStars(grand ? 52 : 36)");
    // The banner is localized now and says what actually happened. "GRAND
    // JACKPOT" was hard-coded English AND casino wording for the one moment in
    // this app that is entirely earned. The staging above is untouched.
    expect(live).toContain('grand ? `${finalFormLabel} · ${stageLabel}` : stageLabel');
    expect(live).toContain("const finalFormLabel = PM().evo?.finalForm ?? EVO_FALLBACK.finalForm;");
    expect(live).not.toContain("GRAND JACKPOT ·");
    expect(css).toContain("@keyframes evoShockwave");
    expect(css).toContain("@keyframes evoResultSlam");
  });

  it("keeps the stronger ceremony safe under reduced motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.evo-shockwave,\.fx-evo-charge \{ display:none; \}/);
    expect(css).toContain(".evo-ceremony-hud * { animation:none !important; transition:none !important; }");
  });

  it("PMFx.evolve walks the ladder so all ten stages can be demonstrated", () => {
    expect(live).toContain("evolve()");
    expect(live).toContain("evoDemoStage = newStage");
    expect(live).toContain("evoDemoStage = null; // real data render");
    expect(live).toContain("STAGE_ORDER[1]");
  });

  it("demo.js keeps the E hotkey + QA row for the ceremony", () => {
    expect(demo).toContain('case "e":');
    expect(demo).toContain('case "E":');
    expect(demo).toContain('fireFx("evolve")');
    expect(demo).toContain('typeof window.PMFx?.evolve === "function"');
    expect(demo).toMatch(/\["E", "evolution ceremony[^"]*"\]/);
  });
});
