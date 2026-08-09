import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPANION_STAGES } from "@/types/game";

// Source-contract guard for the evolution-ladder farm layer (plan Tasks 6+7):
// per-stage mascot visuals + form tint (index.html/style.css) and the
// ceremony trigger + demo hotkey (live.js/demo.js). Same read-the-source
// style as tests/farm-shop-layer.test.ts — the farm layer is plain JS/CSS
// with no module exports to import.

const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");
const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");
const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const demo = readFileSync(resolve(process.cwd(), "public/farm/demo.js"), "utf8");

const ACCENT_STAGES = [
  "stage-seedling",
  "stage-bud",
  "stage-bloom",
  "stage-fruit",
  "stage-elder",
  "stage-radiant",
  "stage-legend",
] as const;

const FORM_KEYS = ["cool", "air", "light", "soil", "steady", "balanced"] as const;

describe("per-stage mascot visuals (Task 6)", () => {
  it("index.html carries one hidden accent group per accent stage", () => {
    for (const cls of ACCENT_STAGES) {
      expect(html).toContain(`class="stage-extra ${cls}"`);
    }
    // Accents live inside .animated-leaves (they must scale with the head)
    // and BEFORE the face groups (faces always draw on top).
    const leavesIdx = html.indexOf('<g class="animated-leaves">');
    const accentIdx = html.indexOf('class="stage-extra');
    const faceIdx = html.indexOf('class="mascot-face face-default"');
    expect(leavesIdx).toBeGreaterThan(-1);
    expect(accentIdx).toBeGreaterThan(leavesIdx);
    expect(faceIdx).toBeGreaterThan(accentIdx);
  });

  it("style.css hides accents until renderCompanion's companion-<Stage> class shows them", () => {
    expect(css).toContain(".mascot-svg .stage-extra { display: none; }");
    // Every stage past Seed has a visual rule of its own (Seed is the bare
    // base body) — all ten stages render distinct.
    for (const stage of COMPANION_STAGES.slice(1)) {
      expect(css).toContain(`.mascot-svg.companion-${stage} `);
    }
  });

  it("shows accents cumulatively — Legend keeps every earned mark", () => {
    for (const cls of ["stage-seedling", "stage-bloom", "stage-fruit", "stage-elder", "stage-radiant", "stage-legend"]) {
      expect(css).toContain(`.mascot-svg.companion-Legend .${cls}`);
    }
    // The bud opens into the bloom: Bloom+ shows petals, not the closed bud.
    expect(css).toContain(".mascot-svg.companion-Bud .stage-bud");
    expect(css).not.toContain(".mascot-svg.companion-Bloom .stage-bud");
  });

  it("keeps the original five stages' scale rungs and extends the ladder", () => {
    // Originals untouched (Task 6 must not break the shipped five).
    expect(css).toContain(".mascot-svg.companion-Sprout .animated-leaves { transform: scale(1.03);");
    expect(css).toContain(".mascot-svg.companion-Guardian .animated-leaves { transform: scale(1.18);");
    // New rungs exist and stay monotonic at the top.
    expect(css).toContain(".mascot-svg.companion-Seedling .animated-leaves { transform: scale(1.05);");
    expect(css).toContain(".mascot-svg.companion-Legend .animated-leaves { transform: scale(1.25);");
  });

  it("tints accents per care-affinity form via --companion-accent", () => {
    for (const form of FORM_KEYS) {
      expect(css).toContain(`.mascot-svg[data-companion-form="${form}"] { --companion-accent:`);
    }
    // The accent shapes actually consume the property (with a fallback).
    expect(html).toContain("var(--companion-accent,");
    // live.js sets the attribute the tint selectors key on.
    expect(live).toContain("svg.dataset.companionForm = form");
  });
});

describe("evolution ceremony trigger + demo hotkey (Task 7)", () => {
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

  it("routes the trigger into the existing sequencer, generic over stage names", () => {
    expect(live).toContain("function runEvolutionSequence(oldStage, newStage)");
    // The sequencer applies stages via template classes — no hard-coded
    // five-stage mapping anywhere in the swap path.
    expect(live).toContain("svg.classList.add(`companion-${stage}`)");
  });

  it("PMFx.evolve walks the ladder so all ten stages can be demonstrated", () => {
    expect(live).toContain("evolve()");
    // Cursor advances at enqueue time and resets on any real data render.
    expect(live).toContain("evoDemoStage = newStage");
    expect(live).toContain("evoDemoStage = null; // real data render");
    // Legend wraps the demo pair forward (never reads as de-evolution).
    expect(live).toContain("STAGE_ORDER[1]");
  });

  it("demo.js keeps the E hotkey + QA row for the ceremony", () => {
    expect(demo).toContain('case "e":');
    expect(demo).toContain('case "E":');
    expect(demo).toContain('fireFx("evolve")');
    expect(demo).toContain('typeof window.PMFx?.evolve === "function"');
    // Legend row tells presenters repeat-pressing walks the ladder.
    expect(demo).toMatch(/\["E", "evolution ceremony[^"]*"\]/);
  });
});
