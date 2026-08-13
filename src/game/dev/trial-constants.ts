// Trial Mode (game experience mode) — the ONE place its numbers live.
//
// Trial mode is the onboarding half of the classroom sandbox: a student who
// has never seen the app starts empty (Lv.1, nothing owned) and plays care
// actions until Lv.5, at which point full cheat mode opens. The whole run is
// budgeted at under two minutes of standing on My Garden.
//
// The engine itself is a plain browser script (public/farm/trial.js) so it can
// load on the static farm shell, which never runs React. It cannot import this
// module, so it mirrors these numbers and tests/trial-mode.test.ts pins the two
// together — the same arrangement SENSOR_LIMITS has with cheat.js.
//
// Nothing here touches the real economy. Trial XP and Seeds live in
// localStorage and are wiped on exit; src/game/progression and
// src/game/economy remain the authority for real progress.

import { MAX_BOND_LEVEL, XP_PER_LEVEL } from "@/types/game";

/**
 * Reaching this level opens cheat mode.
 *
 * Lv.5 (60 XP): the level where the DRAWING changes.
 *
 * The gate is the peak of the run, and it only reads as one if the cheat-mode
 * celebration and Jamkachu visibly growing happen together. That is a claim
 * about pixels, not about table rows, and it has now been got wrong twice:
 *
 * - Lv.6 was picked under the old seven-band ladder, where Lv.6 WAS the
 *   flower. The fifteen-band redraw moved the flower to Lv.15 and left Lv.6
 *   mid-band.
 * - Lv.7 was then picked because it opens band 4, "Bright Sprout". But bands 3
 *   and 4 draw the SAME artwork (phase 2, no ornament) and differ only in
 *   `scale` — which nothing reads: jamkachu-sprite.js writes
 *   --jamkachu-growth-scale and no stylesheet consumes it. The band's `name`
 *   is not rendered anywhere either, so crossing Lv.7 changes nothing about
 *   Jamkachu that a student can see — only the level number ticks up.
 *
 * Fifteen bands render as the same seven drawings the designer made. They
 * change at Lv.1, 5, 11, 15, 19, 23 and 27, so inside a two-minute run there
 * is exactly one real transformation to land on: Lv.5, where the seed becomes
 * a sprout. The gate goes there.
 *
 * The cost is pace — 60 XP is roughly 65–85s rather than the 95–125s Lv.7
 * bought, and one hazard fewer on the way. That is the right trade: a student
 * who wants more presses has "Keep growing" on the gate card, while a peak
 * nobody can see cannot be recovered later. Anyone stuck is covered by the
 * escape hatch, which opens cheat mode at any level (see
 * PMCheat.switchToCheat).
 *
 * tests/trial-mode.test.ts pins this against the drawn phase and tier, not the
 * band index — the assertion that would have caught both mistakes.
 */
export const TRIAL_GATE_LEVEL = 5;

/** Total XP the gate needs — derived, never hand-typed (60 at 15 XP/level). */
export const TRIAL_GATE_XP = (TRIAL_GATE_LEVEL - 1) * XP_PER_LEVEL;

/** Levels are derived from XP in trial mode, never stored independently. */
export const TRIAL_MAX_LEVEL = MAX_BOND_LEVEL;

export const TRIAL_XP = {
  /** A press that moves at least one reading toward its healthy band. */
  validAction: 5,
  /** Any other press — exploring is worth something, spamming is not. */
  invalidAction: 1,
  /** Mood returns to Happy after a hazard event. */
  eventResolved: 10,
  /** Paid once per drip interval while the mood is Happy — but only up to
   *  trialDripCeiling, so idling never levels you up. */
  dripPerTick: 1,
} as const;

export const TRIAL_SEEDS = {
  eventResolved: 10,
  dayAdvanced: 5,
  levelUp: 5,
} as const;

export const TRIAL_TIMING = {
  /** Happy drip cadence: +1 XP per 3s, i.e. 20 XP/minute. */
  dripIntervalMs: 3_000,
  /** Per-action spam guard; a press inside it pays nothing. */
  actionCooldownMs: 1_500,
  /** Grace period before the first hazard, so the intro can be read. */
  firstEventDelayMs: 15_000,
  /** Gap to the NEXT hazard, measured from the moment the last one was
   *  RESOLVED — never from when it fired, or a slow solve would be punished
   *  with an immediate second hazard. */
  eventGapMinMs: 10_000,
  eventGapMaxMs: 20_000,
  /** An unsolved hazard this old makes Jamkachu name the button to press. */
  hintAfterMs: 20_000,
  /** ...and say it again this often while it stays unsolved. Shown once, the
   *  hint held the bubble for a few seconds and was gone, so a student who
   *  looked up a moment later got no help at all — and someone stuck at twenty
   *  seconds is usually still stuck at forty. It stops the instant they fix
   *  it, which keeps this a nudge rather than nagging. */
  hintRepeatMs: 15_000,
  /** How long a day-change / hazard line holds the speech bubble. */
  noticeHoldMs: 3_500,
} as const;

/** Care actions per in-game day. Three (not four) so a two-minute run still
 *  turns the calendar two or three times and the day counter is felt. */
export const TRIAL_ACTIONS_PER_DAY = 3;

/**
 * Soil pH work skips whole days instead of counting as one action.
 *
 * Sprinkling ash or mixing in fresh soil takes days to register in a real pot —
 * the care buttons already carry a "⏳ days later" badge saying so. Trial mode
 * makes that literal: one press advances the calendar instead of the action
 * counter, which is the honest translation of the lesson into game grammar.
 */
export const TRIAL_SOIL_SKIP_DAYS = 3;

/** Level a trial XP total is worth. Mirrors levelForXp; kept here so the
 *  browser engine and the tests agree on one derivation. */
export function trialLevelForXp(totalXp: number): number {
  const safe = Math.max(0, Math.floor(Number(totalXp) || 0));
  return Math.min(TRIAL_MAX_LEVEL, Math.floor(safe / XP_PER_LEVEL) + 1);
}

/**
 * The most XP a level can hold — one short of the next level's floor.
 *
 * The idle drip is capped here: standing in a healthy garden fills the bar but
 * never tips it over. The drip is a reward for keeping Jamkachu well, not a way
 * of playing, and uncapped it let a student put the pot right once and then
 * collect levels for doing nothing. Every level is crossed by an ACT instead —
 * a care press, a hazard solved — and because the gate sits on a level floor,
 * idling can never open it either.
 *
 * At MAX_BOND_LEVEL there is no next level to reach, so nothing is withheld.
 */
export function trialDripCeiling(level: number): number {
  if (level >= TRIAL_MAX_LEVEL) return Number.POSITIVE_INFINITY;
  return level * XP_PER_LEVEL - 1;
}

/** XP still owed before the gate opens; 0 once it has. */
export function trialXpToGate(totalXp: number): number {
  return Math.max(0, TRIAL_GATE_XP - Math.max(0, Math.floor(Number(totalXp) || 0)));
}

/** The seven hazard events, in the order trial.js declares them. Each names
 *  the mood it forces, so a test can prove the pool covers every non-Happy
 *  face the mood engine can produce. */
export const TRIAL_EVENT_KEYS = [
  "heat",
  "cloud",
  "dry",
  "damp",
  "chill",
  "acidic",
  "alkaline",
] as const;

export type TrialEventKey = (typeof TRIAL_EVENT_KEYS)[number];

/** Mood each hazard forces — pinned against the sandbox mood derivation. */
export const TRIAL_EVENT_MOODS: Record<TrialEventKey, string> = {
  heat: "Overheating",
  cloud: "Sleepy",
  dry: "DryAir",
  damp: "HumidAir",
  chill: "TooCold",
  acidic: "SoilAcidic",
  alkaline: "SoilAlkaline",
};
