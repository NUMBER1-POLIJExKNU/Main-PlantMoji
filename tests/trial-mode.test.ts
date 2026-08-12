import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRIAL_ACTIONS_PER_DAY,
  TRIAL_EVENT_KEYS,
  TRIAL_EVENT_MOODS,
  TRIAL_GATE_LEVEL,
  TRIAL_GATE_XP,
  TRIAL_SEEDS,
  TRIAL_SOIL_SKIP_DAYS,
  TRIAL_TIMING,
  TRIAL_XP,
  trialDripCeiling,
  trialLevelForXp,
} from "@/game/dev/trial-constants";
import { XP_PER_LEVEL, levelForXp } from "@/types/game";
import { LEVEL_BANDS, bandForLevel } from "@/game/progression/level-bands";

// Trial mode is two browser scripts (public/farm/cheat.js's store and
// public/farm/trial.js's rules) plus a branch in live.js, so it is exercised
// two ways here:
//
//   1. Behaviourally — both scripts are evaluated in a jsdom-ish harness with
//      a fake localStorage and fake timers, and the game is actually played.
//      That is what catches a drip that never accumulates or a hazard the
//      simulation solves by itself.
//   2. By source contract — for the wiring no unit test can see (script tags,
//      cookies, which panels hide), mirroring cheat-sandbox-wiring.test.ts.
//
// The numbers live in src/game/dev/trial-constants.ts and are mirrored into
// trial.js by hand (a browser script cannot import TS), so every constant is
// pinned across that gap below.

const cheatSource = readFileSync("public/farm/cheat.js", "utf8");
const trialSource = readFileSync("public/farm/trial.js", "utf8");
const live = readFileSync("public/farm/live.js", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const farmHtml = readFileSync("public/farm/index.html", "utf8");
const settings = readFileSync("src/app/settings/page.tsx", "utf8");
const cheatToggle = readFileSync("src/components/cheat-mode-toggle.tsx", "utf8");
const trialToggle = readFileSync("src/components/trial-mode-toggle.tsx", "utf8");
const questPanel = readFileSync("src/components/cheat-quest-panel.tsx", "utf8");
const sensorPanel = readFileSync("src/components/cheat-sensor-panel.tsx", "utf8");
const collectionPage = readFileSync("src/app/collection/page.tsx", "utf8");
const shopPage = readFileSync("src/app/shop/page.tsx", "utf8");

// ── Harness ─────────────────────────────────────────────────────────────

interface Vitals { temperature: number; humidity: number; light: number; soilPh: number }

/** Evaluate cheat.js + trial.js against a minimal fake browser and hand back
 *  the globals they installed, so the game can be played for real. */
function bootSandbox() {
  const store = new Map<string, string>();
  const listeners = new Map<string, Array<(e: unknown) => void>>();

  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };

  class FakeCustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  interface FakeWindow {
    localStorage: typeof localStorage;
    CustomEvent: typeof FakeCustomEvent;
    setInterval: (fn: () => void, ms: number) => unknown;
    clearInterval: (id: unknown) => void;
    addEventListener: (type: string, cb: (e: unknown) => void) => void;
    removeEventListener: (type: string, cb: (e: unknown) => void) => void;
    dispatchEvent: (event: { type: string }) => boolean;
    document: unknown;
    PMCheat: Record<string, (...args: never[]) => unknown>;
    PMTrial: Record<string, (...args: never[]) => unknown>;
  }

  const win: FakeWindow = {
    localStorage,
    CustomEvent: FakeCustomEvent,
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: unknown) => clearInterval(id as ReturnType<typeof setInterval>),
    addEventListener(type: string, cb: (e: unknown) => void) {
      const list = listeners.get(type) ?? [];
      list.push(cb);
      listeners.set(type, list);
    },
    removeEventListener(type: string, cb: (e: unknown) => void) {
      const list = listeners.get(type) ?? [];
      const at = list.indexOf(cb);
      if (at >= 0) list.splice(at, 1);
    },
    dispatchEvent(event: { type: string }) {
      for (const cb of [...(listeners.get(event.type) ?? [])]) cb(event);
      return true;
    },
    // Both scripts install themselves onto `window`; these two are filled in
    // by evaluate() below.
    document: undefined,
    PMCheat: {} as FakeWindow["PMCheat"],
    PMTrial: {} as FakeWindow["PMTrial"],
  };

  // `document` is only reached by cheat.js's banner and cookie helpers. Just
  // enough of one to let mountBanner run and to read back what the banner
  // says — trial.js itself never touches the DOM, which a test below asserts.
  interface FakeNode {
    id: string;
    style: Record<string, unknown>;
    classList: { toggle(): void; add(): void; remove(): void };
    dataset: Record<string, unknown>;
    textContent: string;
    innerHTML: string;
    children: Map<string, FakeNode>;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    appendChild(child: FakeNode): void;
    removeChild(child: FakeNode): void;
    querySelector(sel: string): FakeNode;
    querySelectorAll(): FakeNode[];
    addEventListener(): void;
    parentNode: FakeNode | null;
  }

  const appended: FakeNode[] = [];

  const makeNode = (): FakeNode => ({
    id: "",
    style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    dataset: {},
    textContent: "",
    innerHTML: "",
    // Memoised per selector so a textContent written through querySelector is
    // still there to read afterwards — which is how the banner's progress line
    // is checked.
    children: new Map<string, FakeNode>(),
    setAttribute() {},
    removeAttribute() {},
    appendChild(child: FakeNode) { appended.push(child); },
    removeChild() {},
    querySelector(sel: string) {
      const existing = this.children.get(sel);
      if (existing) return existing;
      const child = makeNode();
      this.children.set(sel, child);
      return child;
    },
    querySelectorAll: () => [],
    addEventListener() {},
    parentNode: null,
  });

  const doc = {
    cookie: "",
    readyState: "complete",
    getElementById: (id: string) => appended.find((n) => n.id === id) ?? null,
    createElement: () => makeNode(),
    addEventListener() {},
    body: makeNode(),
  };
  win.document = doc;

  const evaluate = (source: string) => {
    // The scripts are IIFEs that close over `window` and `document`.
    const fn = new Function("window", "document", "globalThis", `${source}\n;return window;`);
    fn(win, doc, win);
  };

  evaluate(cheatSource);
  evaluate(trialSource);

  const call = (api: FakeWindow["PMCheat"], name: string, ...args: unknown[]) =>
    api[name](...(args as never[]));

  return {
    win,
    PMCheat: {
      getState: () => call(win.PMCheat, "getState"),
      getBands: () => call(win.PMCheat, "getBands"),
      getMode: () => call(win.PMCheat, "getMode"),
      set: (patch: Record<string, unknown>) => call(win.PMCheat, "set", patch),
      press: (id: string) => call(win.PMCheat, "press", id),
      switchToCheat: () => call(win.PMCheat, "switchToCheat"),
    },
    PMTrial: {
      start: () => call(win.PMTrial, "start"),
      moodFor: (vitals: Vitals, bands: unknown) => call(win.PMTrial, "moodFor", vitals, bands) as string,
    },
    /** Everything the injected banner currently reads out: its markup plus the
     *  progress line, which is written through querySelector. */
    bannerText() {
      const bar = appended.find((n) => n.id === "pm-cheat-banner");
      if (!bar) return "";
      return [bar.innerHTML, ...[...bar.children.values()].map((c) => c.textContent)].join(" ");
    },
    /** Collect every event of `type` dispatched from now on. */
    capture(type: string) {
      const seen: Array<Record<string, unknown>> = [];
      win.addEventListener(type, (e) => seen.push((e as { detail: Record<string, unknown> }).detail));
      return seen;
    },
    state: () => call(win.PMCheat, "getState") as {
      mode: string;
      status: { level: number; totalXp: number; days: number; seeds: number };
      vitals: Vitals;
      actions: Record<string, string | null>;
      trial: Record<string, unknown> | null;
    },
    setVitals: (patch: Partial<Vitals>) => call(win.PMCheat, "set", { vitals: patch }),
  };
}

type Sandbox = ReturnType<typeof bootSandbox>;

/** Default strawberry bands, as cheat.js declares them. */
const HAPPY: Vitals = { temperature: 22, humidity: 50, light: 60, soilPh: 6.0 };

function startTrial(sb: Sandbox): void {
  sb.PMTrial.start();
  sb.setVitals(HAPPY);
}

/** Advance fake timers far enough for `ms` of trial ticks to run. */
async function run(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

/**
 * Play for `ms` as a competent student would: healthy readings, and any hazard
 * that fires answered on the next step.
 *
 * Needed because the drip only pays while Jamkachu is Happy, so simply
 * advancing the clock stops earning the moment the first hazard lands at 15s —
 * which is the system working, not a test to write around.
 */
async function playHappily(sb: Sandbox, ms: number) {
  const step = 1000;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    sb.setVitals(HAPPY);
    await run(step);
  }
}

/**
 * Stand in a healthy garden doing absolutely nothing for `ms`.
 *
 * Hazards are pushed out of reach each step, which is what separates this from
 * playHappily: solving a hazard is an ACT and pays 10 XP, so a test about what
 * idling alone earns has to keep hazards out of the measurement entirely.
 */
async function idleHappily(sb: Sandbox, ms: number) {
  const step = 1000;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    sb.setVitals(HAPPY);
    sb.PMCheat.set({ trial: { nextHazardAt: Date.now() + 3_600_000 } });
    await run(step);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-13T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Requirement 1: an empty start ───────────────────────────────────────

describe("a trial run starts from nothing", () => {
  it("begins at Lv.1 with no XP, no Seeds and no days", () => {
    const sb = bootSandbox();
    startTrial(sb);
    const s = sb.state();
    expect(s.mode).toBe("trial");
    expect(s.status).toMatchObject({ level: 1, totalXp: 0, days: 0, seeds: 0 });
  });

  it("never inherits the demo account's unlocks", () => {
    const sb = bootSandbox();
    startTrial(sb);
    const s = sb.state() as unknown as {
      shop: { ownAll: boolean };
      collection: { revealAll: boolean };
    };
    // The two reveal-everything switches are what cheat mode turns on; a
    // trial must find its own collection or the first discovery means nothing.
    expect(s.shop.ownAll).toBe(false);
    expect(s.collection.revealAll).toBe(false);
  });

  it("hides the real plant's belongings server-side via pm_trial", () => {
    // The opposite lever from pm_cheat: that one reveals MORE than is owned,
    // this one shows LESS, so a student does not inherit a Lv.14 collection.
    expect(cheatSource).toContain('write("pm_trial", mode === "trial");');
    expect(collectionPage).toContain('const trial = jar.get("pm_trial")?.value === "1";');
    expect(collectionPage).toContain("seenMoods = trial ? [] : moods;");
    expect(collectionPage).toContain("badgeRows = trial ? [] : badges;");
    expect(collectionPage).toContain("currentChapter = trial ? 0 : bond?.current_chapter ?? 1;");
    expect(shopPage).toContain('const trial = jar.get("pm_trial")?.value === "1";');
    expect(shopPage).toContain("trial ? 0 : Number(bondRow?.seeds ?? 0)");
  });

  it("never sets both sandbox cookies at once", () => {
    // They pull in opposite directions; a page seeing both would have to guess.
    expect(cheatSource).toContain('write("pm_cheat", mode === "cheat");');
    expect(cheatSource).toContain('write("pm_trial", mode === "trial");');
  });
});

// ── Requirement 2: the gate ─────────────────────────────────────────────

describe("the Lv.6 gate", () => {
  it("derives its XP from the real level curve", () => {
    expect(TRIAL_GATE_XP).toBe((TRIAL_GATE_LEVEL - 1) * XP_PER_LEVEL);
    expect(TRIAL_GATE_XP).toBe(90);
    // Trial mode does not invent its own curve — the level a trial XP total is
    // worth must be the level the real game would give it.
    for (const xp of [0, 14, 15, 44, 74, 75, 200]) {
      expect(trialLevelForXp(xp)).toBe(levelForXp(xp));
    }
    expect(trialLevelForXp(TRIAL_GATE_XP)).toBe(TRIAL_GATE_LEVEL);
    expect(trialLevelForXp(TRIAL_GATE_XP - 1)).toBe(TRIAL_GATE_LEVEL - 1);
  });

  it("lands on a sprite band boundary, so the unlock coincides with a growth change", () => {
    // The gate is meant to be the peak of the run: the cheat-mode celebration
    // and Jamkachu visibly growing, together. That only holds while the gate
    // level starts a band — and it silently stopped holding once already, when
    // LEVEL_BANDS was redrawn from seven bands to fifteen and left the old
    // Lv.6 gate mid-band with nothing to show for it.
    const starts = LEVEL_BANDS.map((band) => band.from);
    expect(starts, `Lv.${TRIAL_GATE_LEVEL} must open a band`).toContain(TRIAL_GATE_LEVEL);
    expect(bandForLevel(TRIAL_GATE_LEVEL).from).toBe(TRIAL_GATE_LEVEL);
    // ...and the level below it must be a different look, or "it changed" is
    // not something a student could actually see.
    expect(bandForLevel(TRIAL_GATE_LEVEL - 1).band).toBeLessThan(bandForLevel(TRIAL_GATE_LEVEL).band);
  });

  it("is mirrored identically into both browser scripts", () => {
    expect(trialSource).toContain(`var GATE_LEVEL = ${TRIAL_GATE_LEVEL};`);
    expect(trialSource).toContain(`var XP_PER_LEVEL = ${XP_PER_LEVEL};`);
    expect(cheatSource).toContain(`var TRIAL_GATE_LEVEL = ${TRIAL_GATE_LEVEL};`);
    expect(cheatSource).toContain(`var TRIAL_XP_PER_LEVEL = ${XP_PER_LEVEL};`);
  });

  it("names the level in the banner instead of 'Lv.undefined'", () => {
    // The copy table bakes the level into a string when it is DEFINED, and
    // `var` hoists the declaration without the value — with the constants
    // below the table, the unlock line shipped as "Lv.undefined reached".
    expect(cheatSource.indexOf("var TRIAL_GATE_LEVEL")).toBeLessThan(
      cheatSource.indexOf("var TRIAL_BANNER_COPY"),
    );
    const sb = bootSandbox();
    startTrial(sb);
    sb.PMCheat.set({ status: { totalXp: TRIAL_GATE_XP } });
    const banner = sb.bannerText();
    expect(banner).toContain(`Lv.${TRIAL_GATE_LEVEL}`);
    expect(banner).not.toContain("undefined");
  });

  it("announces itself exactly once, when the XP crosses", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    const gates = sb.capture("pmtrial:gate");

    // Well short of the gate: nothing announced yet.
    await run(TRIAL_TIMING.dripIntervalMs * 4);
    expect(sb.state().status.totalXp).toBeLessThan(TRIAL_GATE_XP);
    expect(gates).toHaveLength(0);

    await playHappily(sb, 150_000);
    expect(sb.state().status.totalXp).toBeGreaterThanOrEqual(TRIAL_GATE_XP);
    expect(gates).toHaveLength(1);
    expect(gates[0]).toMatchObject({ level: TRIAL_GATE_LEVEL });

    // Earning past the gate must not announce it again.
    await playHappily(sb, 30_000);
    expect(gates).toHaveLength(1);
  });

  it("is reachable inside the two-minute budget the demo is given", async () => {
    // The whole design target: a student who has never seen the app holds the
    // loop once and unlocks cheat mode before their attention runs out.
    const sb = bootSandbox();
    startTrial(sb);
    await playHappily(sb, 120_000);
    expect(sb.state().status.totalXp).toBeGreaterThanOrEqual(TRIAL_GATE_XP);
    expect(sb.state().status.level).toBeGreaterThanOrEqual(TRIAL_GATE_LEVEL);
  });

  it("keeps the level derived from XP, never edited apart from it", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    await run(TRIAL_TIMING.dripIntervalMs * 20);
    const s = sb.state();
    expect(s.status.level).toBe(trialLevelForXp(s.status.totalXp));
  });
});

describe("the classroom escape hatch", () => {
  it("promotes a trial to cheat mode with everything earned intact", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    await run(TRIAL_TIMING.dripIntervalMs * 5);
    const before = sb.state();
    expect(before.status.totalXp).toBeGreaterThan(0);
    // Deliberately BELOW the gate: a demo goes wrong in a hundred ways and the
    // presenter must always be able to take the wheel.
    expect(before.status.totalXp).toBeLessThan(TRIAL_GATE_XP);

    sb.PMCheat.switchToCheat();

    const after = sb.state();
    expect(after.mode).toBe("cheat");
    expect(after.status.totalXp).toBe(before.status.totalXp);
    expect(after.status.seeds).toBe(before.status.seeds);
    expect(after.status.days).toBe(before.status.days);
    expect(after.vitals).toEqual(before.vitals);
  });

  it("stops paying trial XP once the wheel has been handed over", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    sb.PMCheat.switchToCheat();
    const xp = sb.state().status.totalXp;
    await run(TRIAL_TIMING.dripIntervalMs * 10);
    expect(sb.state().status.totalXp).toBe(xp);
  });

  it("still shows its card when the gate was crossed on another route", () => {
    // The engine runs everywhere but only My Garden can draw the card, so a
    // gate crossed while reading Collection or Shop fired its event into
    // nothing — the student lost both the moment and the button that opens
    // cheat mode. My Garden now catches up on arrival, exactly once.
    expect(trialSource).toContain("gateSeen: false,");
    const start = live.indexOf("function initTrialFarm(");
    const body = live.slice(start, live.indexOf("function flashDayChange("));
    expect(body).toContain('window.PMCheat?.get("trial.gateReached")');
    expect(body).toContain('!window.PMCheat?.get("trial.gateSeen")');
    // Drawing the card is what marks it seen, so the catch-up cannot repeat.
    const gateFn = live.slice(live.indexOf("function showTrialGate("));
    expect(gateFn.slice(0, 500)).toContain('window.PMCheat?.set({ trial: { gateSeen: true } })');
    // The catch-up line takes the level from the engine instead of repeating
    // it, so moving the gate cannot leave it announcing the old one.
    expect(live).toContain("trialLabels.gate(window.PMTrial?.GATE_LEVEL");
    expect(live).not.toMatch(/gate: \(level\) => `Lv\.\d/);
  });

  it("leaves the settings button always usable, never locked behind the gate", () => {
    expect(cheatToggle).toContain('if (api.getMode?.() === "trial")');
    expect(cheatToggle).toContain("api.switchToCheat();");
    // The gate distance is shown as guidance next to a working button, not as
    // a disabled state.
    expect(cheatToggle).toContain("t.toGate(Number(trialXpToGate))");
    expect(cheatToggle).not.toMatch(/disabled=\{[^}]*inTrial/);
  });
});

// ── Requirement 3: care actions pay, and turn the calendar ───────────────

describe("care actions", () => {
  it("pays more for a press that actually helps", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    // Force a heatwave by hand, then answer it correctly.
    sb.setVitals({ temperature: 34, light: 90 });
    const xpBefore = sb.state().status.totalXp;
    sb.PMCheat.press("shade"); // moves temperature back toward the band
    const helped = sb.state().status.totalXp - xpBefore;
    expect(helped).toBe(TRIAL_XP.validAction);

    // "Put it in the sun" while already overheating aims the wrong way.
    const before2 = sb.state().status.totalXp;
    sb.PMCheat.press("sun");
    expect(sb.state().status.totalXp - before2).toBe(TRIAL_XP.invalidAction);
  });

  it("judges a toggle by where it aims, not by the unchanged readings", () => {
    // A toggle changes nothing at press time — both "sun" and "shade" leave
    // the sensors exactly as they were — so scoring the readings alone would
    // score both identically. The press report carries the targets for this.
    expect(trialSource).toContain("if (detail.kind === \"delta\") return distance(detail.after, b) < before - 1e-6;");
    expect(cheatSource).toContain("targets: activeTargets(state.actions),");
  });

  it("pays nothing for a press inside the cooldown", () => {
    const sb = bootSandbox();
    startTrial(sb);
    sb.setVitals({ temperature: 34 });
    sb.PMCheat.press("shade");
    const afterFirst = sb.state().status.totalXp;
    sb.PMCheat.press("shade"); // same action, immediately
    expect(sb.state().status.totalXp).toBe(afterFirst);
  });

  it("turns the calendar every three actions, and says so", () => {
    const sb = bootSandbox();
    startTrial(sb);
    const days = sb.capture("pmtrial:day");
    const seedsBefore = sb.state().status.seeds;

    // Distinct actions, so nothing is swallowed by the per-action cooldown.
    sb.PMCheat.press("shade");
    sb.PMCheat.press("lamp");
    expect(days).toHaveLength(0);
    sb.PMCheat.press("vent");

    expect(TRIAL_ACTIONS_PER_DAY).toBe(3);
    expect(days).toHaveLength(1);
    expect(sb.state().status.days).toBe(1);
    // The announcement IS the feature: a day counter nobody notices is not a
    // day counter (implementation.md §4.3).
    expect(String(days[0].text)).toMatch(/Day 1|Hari ke-1/);
    expect(sb.state().status.seeds - seedsBefore).toBeGreaterThanOrEqual(TRIAL_SEEDS.dayAdvanced);
  });

  it("skips whole days for soil work instead of counting it as one action", () => {
    const sb = bootSandbox();
    startTrial(sb);
    const days = sb.capture("pmtrial:day");
    sb.PMCheat.press("ash"); // slow: true — soil pH takes days in a real pot

    expect(sb.state().status.days).toBe(TRIAL_SOIL_SKIP_DAYS);
    expect(days).toHaveLength(1);
    expect(Number(days[0].skipped)).toBe(TRIAL_SOIL_SKIP_DAYS);
    // ...and it did NOT also bank an ordinary action toward the next day.
    expect((sb.state().trial as { actionCount: number }).actionCount).toBe(0);
  });

  it("pays the skipped days' Seeds, once each", () => {
    const sb = bootSandbox();
    startTrial(sb);
    const before = sb.state().status.seeds;
    sb.PMCheat.press("ash");
    const gained = sb.state().status.seeds - before;
    // The day Seeds for three days, plus whatever levelling paid on the way.
    expect(gained).toBeGreaterThanOrEqual(TRIAL_SEEDS.dayAdvanced * TRIAL_SOIL_SKIP_DAYS);
  });
});

// ── Requirement 4: the Happy drip ───────────────────────────────────────

describe("the Happy drip", () => {
  it("pays 1 XP every three seconds while Jamkachu is Happy", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    expect(sb.state().status.totalXp).toBe(0);

    await run(TRIAL_TIMING.dripIntervalMs * 5);
    expect(sb.state().status.totalXp).toBe(5 * TRIAL_XP.dripPerTick);
  });

  it("stops the moment the mood is anything but Happy", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    await run(TRIAL_TIMING.dripIntervalMs * 2);
    const banked = sb.state().status.totalXp;

    sb.setVitals({ temperature: 34 }); // Overheating
    await run(TRIAL_TIMING.dripIntervalMs * 5);
    expect(sb.state().status.totalXp).toBe(banked);

    // Put it right and the drip resumes. Played rather than merely waited: by
    // now a hazard is due, and one landing would stop the drip again — which
    // is the rule under test, not a way around it.
    await playHappily(sb, TRIAL_TIMING.dripIntervalMs * 4);
    expect(sb.state().status.totalXp).toBeGreaterThan(banked);
  });

  it("fills the level's bar but never tips it over", async () => {
    const sb = bootSandbox();
    startTrial(sb);

    // Long enough to have crossed several levels if the drip were uncapped.
    await idleHappily(sb, 120_000);

    const s = sb.state();
    expect(s.status.level).toBe(1);
    expect(s.status.totalXp).toBe(trialDripCeiling(1));
    expect(s.status.totalXp).toBe(XP_PER_LEVEL - 1);
  });

  it("hands the level-up back the moment the student does something", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    await idleHappily(sb, 60_000);
    expect(sb.state().status.level).toBe(1);
    expect(sb.state().status.totalXp).toBe(trialDripCeiling(1));

    // One care press is all it takes — the bar was already full.
    sb.setVitals({ temperature: 34 });
    sb.PMCheat.press("shade");
    expect(sb.state().status.level).toBe(2);
  });

  it("banks nothing while capped, so a level-up is not followed by a flood", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    await idleHappily(sb, 90_000); // long spell sitting at the cap
    sb.setVitals({ temperature: 34 });
    sb.PMCheat.press("shade"); // +5 XP, crosses into Lv.2
    const justAfter = sb.state().status.totalXp;

    // A stockpile of idle seconds would show up here as a jump.
    sb.setVitals(HAPPY);
    await run(TRIAL_TIMING.dripIntervalMs);
    expect(sb.state().status.totalXp - justAfter).toBeLessThanOrEqual(TRIAL_XP.dripPerTick);
  });

  it("can never open the gate on its own", async () => {
    // The gate sits on a level floor, and the drip stops one short of every
    // floor — so the last step through it is always something the student did.
    const sb = bootSandbox();
    startTrial(sb);
    const gates = sb.capture("pmtrial:gate");
    sb.PMCheat.set({ status: { totalXp: TRIAL_GATE_XP - 1, level: TRIAL_GATE_LEVEL - 1 } });

    await idleHappily(sb, 60_000);
    expect(sb.state().status.totalXp).toBe(TRIAL_GATE_XP - 1);
    expect(gates).toHaveLength(0);
    expect(trialDripCeiling(TRIAL_GATE_LEVEL - 1)).toBe(TRIAL_GATE_XP - 1);
  });

  it("credits a throttled or sleeping tab as one ordinary step", async () => {
    // Otherwise a laptop lid closed for ten minutes pays ten minutes of drip
    // the moment it opens — the same trap cheat.js's MAX_STEP_MS guards.
    expect(trialSource).toContain("var MAX_STEP_MS = 1000;");
    expect(trialSource).toContain("Math.min(MAX_STEP_MS, Math.max(0, now - (runtime.lastTickAt || now)))");
  });
});

// ── Requirement 5: hazards ──────────────────────────────────────────────

describe("hazard events", () => {
  it("covers every unhappy face the mood engine can produce", () => {
    // A hazard pool missing a mood means a face a student can never be shown.
    const declared = [...trialSource.matchAll(/key: "([a-z]+)", emoji:/g)].map((m) => m[1]);
    expect(declared).toEqual([...TRIAL_EVENT_KEYS]);
    for (const key of TRIAL_EVENT_KEYS) {
      expect(trialSource).toContain(`mood: "${TRIAL_EVENT_MOODS[key]}"`);
    }
  });

  it("derives the same mood trial.js and live.js would draw", () => {
    // Two mirrored copies of the priority order (heat→cold→dry→humid→dark→
    // soil). If they drift, a hazard forces one face and the mascot shows
    // another.
    const order = (src: string, fn: string) => {
      const start = src.indexOf(fn);
      return [...src.slice(start, start + 900).matchAll(/return "([A-Za-z]+)";/g)].map((m) => m[1]);
    };
    expect(order(trialSource, "function moodFor(")).toEqual(order(live, "function cheatMoodFor("));
  });

  it("fires only after the opening grace period", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    const hazards = sb.capture("pmtrial:hazard");

    await run(TRIAL_TIMING.firstEventDelayMs - 1000);
    expect(hazards).toHaveLength(0);
    await run(2000);
    expect(hazards).toHaveLength(1);
  });

  it("forces a mood the student has to answer", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    const hazards = sb.capture("pmtrial:hazard");
    await run(TRIAL_TIMING.firstEventDelayMs + 1000);

    const fired = hazards[0];
    const bands = sb.PMCheat.getBands();
    const mood = sb.PMTrial.moodFor(sb.state().vitals, bands);
    expect(mood).not.toBe("Happy");
    expect(mood).toBe(fired.mood);
  });

  it("releases every held toggle so the simulation cannot solve it alone", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    sb.PMCheat.press("shade"); // student leaves the pot in the shade
    expect(sb.state().actions.place).toBe("shade");

    await run(TRIAL_TIMING.firstEventDelayMs + 1000);
    // A hazard that the previous rescue's toggle would quietly undo on the
    // drift tick is not a hazard.
    expect(sb.state().actions).toEqual({ place: null, cover: null, vent: null, lamp: null });
  });

  it("does not stack a second hazard on an unsolved one", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    const hazards = sb.capture("pmtrial:hazard");
    await run(TRIAL_TIMING.firstEventDelayMs + 1000);
    expect(hazards).toHaveLength(1);

    // Leave it unsolved for well past the longest gap.
    await run(TRIAL_TIMING.eventGapMaxMs * 4);
    expect(hazards).toHaveLength(1);
  });

  it("counts the gap to the next hazard from the RESOLUTION, not the firing", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    const hazards = sb.capture("pmtrial:hazard");
    const resolved = sb.capture("pmtrial:resolved");

    await run(TRIAL_TIMING.firstEventDelayMs + 1000);
    // Struggle for a while, then fix it.
    await run(30_000);
    expect(resolved).toHaveLength(0);
    sb.setVitals(HAPPY);
    await run(TRIAL_TIMING.dripIntervalMs);
    expect(resolved).toHaveLength(1);

    // A gap measured from the FIRING would already be long overdue here and
    // the next hazard would land instantly.
    await run(TRIAL_TIMING.eventGapMinMs - 2000);
    expect(hazards).toHaveLength(1);
    await run(TRIAL_TIMING.eventGapMaxMs);
    expect(hazards).toHaveLength(2);
  });

  it("pays XP and Seeds once when the mood comes back", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    await run(TRIAL_TIMING.firstEventDelayMs + 1000);
    const xpBefore = sb.state().status.totalXp;
    const seedsBefore = sb.state().status.seeds;

    sb.setVitals(HAPPY);
    await run(TRIAL_TIMING.dripIntervalMs / 2);

    const gainedXp = sb.state().status.totalXp - xpBefore;
    const gainedSeeds = sb.state().status.seeds - seedsBefore;
    expect(gainedXp).toBe(TRIAL_XP.eventResolved);
    expect(gainedSeeds).toBeGreaterThanOrEqual(TRIAL_SEEDS.eventResolved);

    // ...and does not pay again on the next tick.
    const settled = sb.state().status.seeds;
    await run(500);
    expect(sb.state().status.seeds).toBe(settled);
  });

  it("never repeats the same hazard back to back", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    const hazards = sb.capture("pmtrial:hazard");
    await run(TRIAL_TIMING.firstEventDelayMs + 1000);

    for (let i = 0; i < 6; i++) {
      sb.setVitals(HAPPY);
      await run(TRIAL_TIMING.dripIntervalMs);
      await run(TRIAL_TIMING.eventGapMaxMs + 2000);
    }
    expect(hazards.length).toBeGreaterThan(3);
    for (let i = 1; i < hazards.length; i++) {
      expect(hazards[i].key).not.toBe(hazards[i - 1].key);
    }
  });

  it("names the button to press for a student who is stuck", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    const hints = sb.capture("pmtrial:hint");
    await run(TRIAL_TIMING.firstEventDelayMs + 1000);

    await run(TRIAL_TIMING.hintAfterMs - 3000);
    expect(hints).toHaveLength(0);
    await run(4000);
    expect(hints).toHaveLength(1);
    expect((hints[0].actions as string[]).length).toBeGreaterThan(0);

    // ...and keeps offering it while they stay stuck. Shown once it held the
    // bubble for a few seconds and vanished, which is no safety net at all for
    // a student who looked up a moment later.
    await run(TRIAL_TIMING.hintRepeatMs + 2000);
    expect(hints.length).toBeGreaterThan(1);
    // But not every tick — that would be nagging, not help.
    expect(hints.length).toBeLessThan(5);
  });

  it("stops offering the hint the instant the hazard is solved", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    const hints = sb.capture("pmtrial:hint");
    await run(TRIAL_TIMING.firstEventDelayMs + 1000);
    await run(TRIAL_TIMING.hintAfterMs + 1000);
    const whileStuck = hints.length;
    expect(whileStuck).toBeGreaterThan(0);

    sb.setVitals(HAPPY);
    await run(TRIAL_TIMING.dripIntervalMs);
    await run(TRIAL_TIMING.hintRepeatMs * 2);
    expect(hints).toHaveLength(whileStuck);
  });

  it("points every hint at buttons that are actually on screen", () => {
    // The hint names action ids; live.js resolves them through cheat.js's
    // single ACTIONS list, so an id that is not in it would render nothing.
    const declared = new Set([...cheatSource.matchAll(/\{ id: "([a-z]+)", kind:/g)].map((m) => m[1]));
    const hinted = [...trialSource.matchAll(/hint: \[([^\]]+)\]/g)]
      .flatMap((m) => m[1].split(",").map((s) => s.trim().replace(/"/g, "")));
    expect(hinted.length).toBeGreaterThan(0);
    for (const id of hinted) expect(declared, `hint names unknown action ${id}`).toContain(id);
  });
});

// ── Requirement 6: Seeds ────────────────────────────────────────────────

describe("Seed rewards", () => {
  it("is mirrored into trial.js exactly", () => {
    expect(trialSource).toContain(`eventResolved: ${TRIAL_SEEDS.eventResolved},`);
    expect(trialSource).toContain(`dayAdvanced: ${TRIAL_SEEDS.dayAdvanced},`);
    expect(trialSource).toContain(`levelUp: ${TRIAL_SEEDS.levelUp},`);
    expect(trialSource).toContain(`validAction: ${TRIAL_XP.validAction},`);
    expect(trialSource).toContain(`invalidAction: ${TRIAL_XP.invalidAction},`);
    expect(trialSource).toContain(`eventResolved: ${TRIAL_XP.eventResolved},`);
    expect(trialSource).toContain(`dripIntervalMs: ${TRIAL_TIMING.dripIntervalMs},`);
    expect(trialSource).toContain(`actionCooldownMs: ${TRIAL_TIMING.actionCooldownMs},`);
    expect(trialSource).toContain(`firstEventDelayMs: ${TRIAL_TIMING.firstEventDelayMs},`);
    expect(trialSource).toContain(`eventGapMinMs: ${TRIAL_TIMING.eventGapMinMs},`);
    expect(trialSource).toContain(`eventGapMaxMs: ${TRIAL_TIMING.eventGapMaxMs},`);
    expect(trialSource).toContain(`hintAfterMs: ${TRIAL_TIMING.hintAfterMs},`);
    expect(trialSource).toContain(`hintRepeatMs: ${TRIAL_TIMING.hintRepeatMs},`);
    expect(trialSource).toContain(`var ACTIONS_PER_DAY = ${TRIAL_ACTIONS_PER_DAY};`);
    expect(trialSource).toContain(`var SOIL_SKIP_DAYS = ${TRIAL_SOIL_SKIP_DAYS};`);
  });

  it("pays for every level crossed", async () => {
    const sb = bootSandbox();
    startTrial(sb);
    await playHappily(sb, TRIAL_TIMING.dripIntervalMs * XP_PER_LEVEL * 2);
    const s = sb.state();
    expect(s.status.level).toBeGreaterThanOrEqual(3);
    // At least two levels crossed, so at least two level-up payouts.
    expect(s.status.seeds).toBeGreaterThanOrEqual(TRIAL_SEEDS.levelUp * 2);
  });

  it("buys two to three of the cheapest shop items inside a two-minute run", async () => {
    // The design target (implementation.md §4.5). Simulated conservatively:
    // drip only, plus two hazards solved and two days turned — no lucky
    // streak, no soil jackpot.
    const sb = bootSandbox();
    startTrial(sb);

    await run(TRIAL_TIMING.firstEventDelayMs + 1000);
    sb.setVitals(HAPPY);
    await run(TRIAL_TIMING.dripIntervalMs);
    sb.PMCheat.press("shade");
    sb.PMCheat.press("lamp");
    sb.PMCheat.press("vent"); // three actions → one day
    await run(TRIAL_TIMING.eventGapMaxMs + 2000);
    sb.setVitals(HAPPY);
    await run(TRIAL_TIMING.dripIntervalMs);
    sb.PMCheat.press("bag");
    sb.PMCheat.press("mist");
    sb.PMCheat.press("fan"); // three more → a second day
    await run(20_000);

    const cheapest = 20; // SHOP_CATALOG's lowest price
    const seeds = sb.state().status.seeds;
    expect(seeds).toBeGreaterThanOrEqual(cheapest * 2);
  });

  it("charges real Seeds in the shop instead of handing the catalogue over", () => {
    const shopGrid = readFileSync("src/components/shop-grid.tsx", "utf8");
    expect(shopGrid).toContain('const trialActive = sandbox?.mode === "trial";');
    expect(shopGrid).toContain("if ((trialSeeds ?? 0) < item.price)");
    expect(shopGrid).toContain("sandboxApi?.set({ status: { seeds: (trialSeeds ?? 0) - item.price } });");
  });
});

// ── Containment and wiring ──────────────────────────────────────────────

describe("trial mode is as contained as the cheat sandbox", () => {
  it("makes no network or database call of its own", () => {
    const source = trialSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/([^:])\/\/.*$/gm, "$1");
    for (const forbidden of [
      "fetch(",
      "XMLHttpRequest",
      "sendBeacon",
      "WebSocket",
      "createClient",
      "getBrowserSupabase",
      "@supabase/supabase-js",
      "/api/",
    ]) {
      expect(source, `trial.js must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("writes only through PMCheat, so it inherits the sandbox's containment", () => {
    expect(trialSource).not.toContain("localStorage.setItem");
    expect(trialSource).toContain("window.PMCheat.set(");
  });

  it("touches no DOM — presentation belongs to live.js", () => {
    for (const forbidden of ["document.createElement", "innerHTML", "document.body"]) {
      expect(trialSource, `trial.js must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("loads after cheat.js on both entry points", () => {
    // "/" is rewritten to the static shell, which never runs the React layout,
    // so BOTH need the tag — the bug cheat.js already shipped once.
    const cheatAt = farmHtml.indexOf('src="/farm/cheat.js"');
    const trialAt = farmHtml.indexOf('src="/farm/trial.js"');
    const liveAt = farmHtml.indexOf('src="/farm/live.js"');
    expect(trialAt).toBeGreaterThan(cheatAt);
    expect(trialAt).toBeLessThan(liveAt);
    expect(layout).toContain('<Script src="/farm/trial.js" strategy="beforeInteractive" />');
    expect(layout.indexOf("/farm/trial.js")).toBeGreaterThan(layout.indexOf("/farm/cheat.js"));
  });

  it("puts its entry card above the cheat sandbox's, the order they are met in", () => {
    expect(settings).toContain("<TrialModeToggle locale={locale} />");
    expect(settings.indexOf("<TrialModeToggle")).toBeLessThan(settings.indexOf("<CheatModeToggle"));
    // A trial starts EMPTY — passing the real-progress seed would defeat it.
    expect(trialToggle).toContain("window.PMTrial.start();");
    expect(trialSource).toContain('activate({ status: { level: 1, totalXp: 0, days: 0, seeds: 0 } }, "trial")');
  });

  it("withholds the cheat controls until the wheel is handed over", () => {
    // The gate teaches the loop; leaving the presenter tools on screen during
    // a trial would delete the game it exists to teach.
    expect(questPanel).toContain('state?.mode === "trial"');
    expect(sensorPanel).toContain('const trial = state.mode === "trial";');
    expect(sensorPanel).toContain("{!trial && (");
    // The farm panel drops the status + by-value editors and keeps the care
    // buttons, which ARE the trial's gameplay.
    expect(live).toContain("if (isTrialMode()) {");
    expect(live).toContain("buildTrialPanel(s, L);");
    const start = live.indexOf("function buildTrialPanel(");
    const body = live.slice(start, live.indexOf("const TRIAL_LABELS"));
    expect(body).toContain('cheatActionButtons("toggle")');
    expect(body).toContain('cheatActionButtons("delta")');
    expect(body).not.toContain("data-cheat-level");
    expect(body).not.toContain("pm-cheat-byvalue");
  });

  it("honours reduced motion on the day flash", () => {
    expect(live).toContain('window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches');
  });
});
