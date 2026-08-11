// PlantMoji farm-layer companion evolution ladder (evolution-ladder plan,
// Task 4) — a display-only mirror of COMPANION_LADDER in src/types/game.ts,
// which stays the single source of truth read by the engine.
// tests/companion-ladder-parity.test.ts fails if the two tables drift, so
// always edit both files together.
//
// Plain synchronous script — NOT a module — so it can be loaded with a bare
// <script src="/farm/companion-ladder.js"> tag BEFORE live.js (same pattern
// as strings.js). It only assigns window.PM_LADDER and window.PM_NEXT_STAGE.
// Consumers must read them defensively (`window.PM_LADDER ?? []`,
// `window.PM_NEXT_STAGE?.(...)`) so a missing tag never breaks the page.
//
// Presentation only: the farm layer uses this table to render labels and the
// honest next-stage progress line. It NEVER decides game truth — stage and
// counters always come from companion_state written by the backend engine.

(function () {
  // Evolution requirements per stage — verified care count / distinct care
  // affinities / distinct WIB days. Order matches COMPANION_STAGES exactly.
  const PM_LADDER = [
    { stage: "Seed", care: 0, affinities: 0, days: 0 },
    { stage: "Sprout", care: 1, affinities: 0, days: 0 },
    { stage: "Seedling", care: 2, affinities: 0, days: 2 },
    { stage: "Bud", care: 3, affinities: 2, days: 0 },
    { stage: "Bloom", care: 7, affinities: 3, days: 2 },
    { stage: "Fruit", care: 11, affinities: 3, days: 4 },
    { stage: "Guardian", care: 15, affinities: 4, days: 5 },
    { stage: "Elder", care: 25, affinities: 4, days: 8 },
    { stage: "Radiant", care: 40, affinities: 4, days: 12 },
    { stage: "Legend", care: 60, affinities: 4, days: 20 },
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
