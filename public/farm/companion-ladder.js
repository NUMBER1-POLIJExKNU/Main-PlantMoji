// PlantMoji farm-layer companion evolution ladder — a display-only mirror of
// COMPANION_LADDER in src/types/game.ts. Bond Level is the only unlock rule.
// tests/companion-ladder-parity.test.ts fails if the two tables drift, so
// always edit both files together.
//
// Plain synchronous script — NOT a module — so it can be loaded with a bare
// <script src="/farm/companion-ladder.js"> tag BEFORE live.js (same pattern
// as strings.js). It only assigns window.PM_LADDER and window.PM_NEXT_STAGE.
// Consumers must read them defensively (`window.PM_LADDER ?? []`,
// `window.PM_NEXT_STAGE?.(...)`) so a missing tag never breaks the page.
//
// Presentation only: the farm layer uses this table to render labels, the
// roadmap, and the honest next-stage progress line. The backend owns truth.

(function () {
  // One stage per Bond Level through Lv.10; Lv.10+ remains Legend.
  const PM_LADDER = [
    { stage: "Seed", level: 1 },
    { stage: "Sprout", level: 2 },
    { stage: "Seedling", level: 3 },
    { stage: "Bud", level: 4 },
    { stage: "Bloom", level: 5 },
    { stage: "Fruit", level: 6 },
    { stage: "Guardian", level: 7 },
    { stage: "Elder", level: 8 },
    { stage: "Radiant", level: 9 },
    { stage: "Legend", level: 10 },
  ];

  /**
   * The ladder row AFTER `stageName`, or null when the stage is unknown or
   * already the top stage — callers show a "fully grown" line instead then.
   * Unknown stage names (old client + newer DB, or vice versa) intentionally
   * return null rather than throwing: the progress line simply hides.
   */
  function PM_NEXT_STAGE(stageName) {
    const index = PM_LADDER.findIndex((row) => row.stage === stageName);
    if (index < 0 || index === PM_LADDER.length - 1) return null;
    return PM_LADDER[index + 1];
  }

  if (typeof window !== "undefined") {
    window.PM_LADDER = PM_LADDER;
    window.PM_NEXT_STAGE = PM_NEXT_STAGE;
  }
})();
