import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source-contract guard for the first-day tour + honest empty states.
// Same read-the-source style as tests/farm-mobile-nav.test.ts — the farm
// layer is plain JS/HTML with nothing to import.
//
// The tour is a display-only follow-up to the one-time hatch intro: four
// spotlight cards (sensor HUD → care button → daily quiz → quest slot + ?
// guide FAB) that must never touch the network, never grant anything, and
// never replay (pm_tour_seen_v1, write-first like pm_hatched). Alongside
// it, two honesty fixes: a "waiting…" state for a connected-but-silent
// sensor board, and expectation-setting quest-empty copy.

const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");
const stringsSource = readFileSync(resolve(process.cwd(), "public/farm/strings.js"), "utf8");

/** The whole tour section: constants + scheduleTour + runFirstDayTour.
 *  It sits between the hatch intro and the Supabase loader, so slicing to
 *  the loader doc-comment keeps the block free of any client code. */
function tourSection(): string {
  const start = live.indexOf("const TOUR_KEY");
  const end = live.indexOf("/** Build the Supabase client.");
  expect(start, "live.js lost its TOUR_KEY constant").toBeGreaterThan(-1);
  expect(end, "live.js lost the Supabase loader landmark").toBeGreaterThan(start);
  return live.slice(start, end);
}

/** Just the runFirstDayTour function body (to the end of the section). */
function tourRunner(): string {
  const section = tourSection();
  const start = section.indexOf("function runFirstDayTour");
  expect(start, "tour section lost runFirstDayTour").toBeGreaterThan(-1);
  return section.slice(start);
}

// strings.js executed against stub windows, exactly like tests/strings.test.ts:
// EN forced through the cookie path, ID through the localStorage path.
type TourStep = { title: string; line: string; waiting?: string };
type StubStrings = {
  tour: { skip: string; senses: TourStep; care: TourStep; quiz: TourStep; quest: TourStep };
  sensorWait: { status: string; note: string };
  [key: string]: unknown;
};
type StubWindow = {
  PM_STRINGS?: StubStrings;
  document?: { cookie: string };
  localStorage?: { getItem(key: string): string | null };
};

function loadStrings(stubWindow: StubWindow): StubStrings {
  new Function("window", stringsSource)(stubWindow);
  if (!stubWindow.PM_STRINGS) throw new Error("strings.js did not assign window.PM_STRINGS");
  return stubWindow.PM_STRINGS;
}

const EN = loadStrings({
  document: { cookie: "plantmoji_locale=en" },
  localStorage: { getItem: () => null },
});
const ID = loadStrings({
  document: { cookie: "" },
  localStorage: { getItem: (key) => (key === "plantmoji_locale" ? "id" : null) },
});

function expectCopy(value: unknown, label: string) {
  expect(typeof value, `${label} should be a string`).toBe("string");
  expect((value as string).trim().length, `${label} should be non-empty`).toBeGreaterThan(0);
}

describe("first-day tour (display-only, one-time)", () => {
  it("gates on pm_tour_seen_v1 and writes the flag FIRST (like pm_hatched)", () => {
    const section = tourSection();
    expect(section).toContain('const TOUR_KEY = "pm_tour_seen_v1"');
    // Write-first: the flag lands immediately after tourActive flips, long
    // before the first step runs — a mid-tour reload can never replay it.
    expect(tourRunner()).toMatch(
      /tourActive = true;[\s\S]{0,400}?localStorage\.setItem\(TOUR_KEY, "1"\)/,
    );
    const runner = tourRunner();
    expect(runner.indexOf('localStorage.setItem(TOUR_KEY, "1")')).toBeLessThan(
      runner.indexOf("const steps = ["),
    );
  });

  it("stays silent when storage is unreadable (fail-closed, never replays forever)", () => {
    // scheduleTour's read is try/catch → return, same shape as pm_streak_nudge.
    expect(tourSection()).toMatch(
      /seen = window\.localStorage\.getItem\(TOUR_KEY\);\s*\n\s*\} catch \{\s*\n\s*return;/,
    );
  });

  it("never runs while the hatch intro is pending or active, and chains after finish()", () => {
    expect(tourSection()).toMatch(/function scheduleTour\(\) \{\s*\n\s*if \(hatchPendingOrActive\(\)\) return;/);
    // The hatch finish() hands over to the tour for brand-new players.
    const hatchIntro = live.slice(live.indexOf("function runHatchIntro"), live.indexOf("const TOUR_KEY"));
    expect(hatchIntro).toContain("scheduleTour()");
    // Already-hatched players (pre-update installs) get it on page load.
    const scheduleHatch = live.slice(live.indexOf("function scheduleHatch"), live.indexOf("function runHatchIntro"));
    expect(scheduleHatch).toMatch(/if \(seen \|\| hatchActive\) \{[\s\S]{0,300}?scheduleTour\(\);/);
  });

  it("is presentation-only: no fetch and no supabase anywhere in the tour block", () => {
    const section = tourSection();
    expect(section).not.toMatch(/\bfetch\s*\(/);
    expect(section).not.toMatch(/supabase/i);
    // No reward surfaces either — the tour must never celebrate or grant.
    expect(section).not.toMatch(/orbCascade|fxEnqueue|fxXpGain|spawnConfetti|seeds|total_xp/);
  });

  it("spotlights the four step targets with the shared .hatch-highlight class", () => {
    const runner = tourRunner();
    for (const target of ["#env-strip", "#care-action", "#daily-quiz-open", "#current-quest", "#farm-guide-open"]) {
      expect(tourSection(), `tour lost its ${target} spotlight target`).toContain(`"${target}"`);
      expect(html).toContain(`id="${target.slice(1)}"`);
    }
    expect(runner).toContain('classList.add("hatch-highlight")');
    // finish() sweeps every spotlight it may have left behind.
    expect(runner).toMatch(/finish[\s\S]{0,400}?classList\.remove\("hatch-highlight"\)/);
  });

  it("quiets the same systems the hatch intro quiets via the shared tourActive flag", () => {
    // Declared beside hatchActive…
    expect(live).toMatch(/let hatchActive = false;[\s\S]{0,200}?let tourActive = false;/);
    // …and checked in the same gates: idle behaviors, wind, camera pokes,
    // farmer autonomy/speech, gaze.
    expect(live).toContain("sleepShown || hatchActive || tourActive || mascotDown");
    expect(live).toContain("fxQueue.length > 0 || hatchActive || tourActive");
    expect(live).toContain("hatchActive || tourActive || isNightWIB()");
    expect(live).toMatch(/&& !hatchActive\s*\n\s*&& !tourActive/);
    expect(live).toContain("hatchPendingOrActive() || tourActive");
  });

  it("does not stack with the guide modal: auto-open defers to the pending tour", () => {
    // While the tour is owed, the guide is marked seen instead of opening —
    // tour step 4 points at the ? FAB, so nothing is lost.
    expect(live).toMatch(
      /if \(!localStorage\.getItem\("pm_tour_seen_v1"\)\) \{\s*\n\s*localStorage\.setItem\("plantmoji_guide_seen_v1", "1"\);\s*\n\s*\} else if \(!localStorage\.getItem\("plantmoji_guide_seen_v1"\)\) \{\s*\n\s*openFarmGuide\(\);/,
    );
    // The tour's own write-first block sets the guide flag alongside its own.
    expect(tourRunner()).toContain('localStorage.setItem("plantmoji_guide_seen_v1", "1")');
  });

  it("carries full tour copy in BOTH locales plus the live.js English fallback", () => {
    for (const [locale, S] of [["en", EN], ["id", ID]] as const) {
      expectCopy(S.tour?.skip, `[${locale}] tour.skip`);
      for (const step of ["senses", "care", "quiz", "quest"] as const) {
        expectCopy(S.tour?.[step]?.title, `[${locale}] tour.${step}.title`);
        expectCopy(S.tour?.[step]?.line, `[${locale}] tour.${step}.line`);
      }
      expectCopy(S.tour?.senses?.waiting, `[${locale}] tour.senses.waiting`);
    }
    // Real translation, not a copy of English.
    expect(ID.tour.senses.line).not.toBe(EN.tour.senses.line);
    expect(ID.tour.quest.line).not.toBe(EN.tour.quest.line);
    expect(live).toContain("const TOUR_FALLBACK");
  });
});

describe("honest sensor-waiting state (configured DB, zero readings)", () => {
  it("renders waiting copy from the refresh else-branch, but never over an error", () => {
    expect(live).toMatch(
      /if \(sensorRes\.data\) renderSensors\(sensorRes\.data\);[\s\S]{0,400}?else if \(!sensorRes\.error\) renderSensorsWaiting\(\);/,
    );
  });

  it("fills every .env-status and the note, and renderSensors overwrites it (no timers)", () => {
    const start = live.indexOf("function renderSensorsWaiting");
    expect(start).toBeGreaterThan(-1);
    const body = live.slice(start, live.indexOf("function renderSensors(", start));
    expect(body).toContain('querySelectorAll("#env-strip .env-status")');
    expect(body).toContain('$("#env-waiting-note")');
    expect(body).not.toMatch(/setTimeout|setInterval/);
    // A real reading that already painted the tiles wins over a late call.
    expect(body).toContain("if (lastReading != null) return;");
    // renderSensors hides the note as part of its normal overwrite.
    const render = live.slice(live.indexOf("function renderSensors("), live.indexOf("function weatherIcon"));
    expect(render).toMatch(/env-waiting-note[\s\S]{0,80}?hidden = true/);
  });

  it("keeps the 2x2 board markup and adds the note INSIDE #env-strip", () => {
    const stripStart = html.indexOf('<section id="env-strip"');
    const stripEnd = html.indexOf("</section>", stripStart);
    expect(stripStart).toBeGreaterThan(-1);
    const strip = html.slice(stripStart, stripEnd);
    expect(strip).toContain('id="env-waiting-note"');
    expect(strip).toContain("hidden");
    // The four tile anchors are untouched (tests/farm-adventure-hud pins them too).
    for (const id of ["env-temp", "env-hum", "env-light", "env-ph"]) {
      expect(strip).toContain(`id="${id}"`);
    }
  });

  it("carries waiting copy in BOTH locales plus the live.js English fallback", () => {
    for (const [locale, S] of [["en", EN], ["id", ID]] as const) {
      expectCopy(S.sensorWait?.status, `[${locale}] sensorWait.status`);
      expectCopy(S.sensorWait?.note, `[${locale}] sensorWait.note`);
    }
    expect(ID.sensorWait.status).not.toBe(EN.sensorWait.status);
    expect(ID.sensorWait.note).not.toBe(EN.sensorWait.note);
    expect(live).toContain("const SENSOR_WAIT_FALLBACK");
  });
});

describe("honest quest-empty copy", () => {
  it("sets expectations in both live.js locale tables (no more bare 'No active quest')", () => {
    expect(live).toContain('"quest.none": "Missions appear when my sensors feel a change"');
    expect(live).toContain('"quest.none": "Misi muncul saat sensorku merasakan perubahan"');
    expect(live).not.toContain('"No active quest"');
    expect(live).not.toContain('"Belum ada misi aktif"');
  });

  it("keeps the static index.html default in sync with the id table", () => {
    expect(html).toContain('data-i18n="quest.none">Misi muncul saat sensorku merasakan perubahan<');
  });
});
