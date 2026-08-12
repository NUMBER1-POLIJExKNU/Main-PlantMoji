import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source-contract guard for the coach engine + first-day tour + honest
// empty states. Same read-the-source style as tests/farm-mobile-nav.test.ts
// — the farm layer is plain JS/HTML with nothing to import.
//
// The tour is a display-only follow-up to the one-time hatch intro, now
// hosted by the generalized pmCoach engine (kid-guide plan Task 3): five
// coach cards — dim + spotlight + emoji + ONE short sentence — pointing at
// the senses HUD → care button → daily quiz → quest link → Grandpa's
// sticker-book handoff, whose ACTION DARE is the only way a coach
// celebrates (cosmetic FX, zero reward writes). One-time state lives in
// the unified pm_seen_v3 store (window.PMSeen, public/farm/seen.js):
// PMSeen "tour", write-first like "hatch", fail-closed when storage is
// unreadable. Alongside it, two honesty fixes: a "waiting…" state for a
// connected-but-silent sensor board, and expectation-setting quest-empty
// copy.

const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");
const stringsSource = readFileSync(resolve(process.cwd(), "public/farm/strings.js"), "utf8");

/** The whole coach section: pmCoach + tour constants + scheduleTour +
 *  runFirstDayTour. It sits between the hatch intro and the Supabase
 *  loader, so slicing to the loader doc-comment keeps the block free of
 *  any client code. */
function tourSection(): string {
  const start = live.indexOf("const COACH_STEP_MS");
  const end = live.indexOf("/** Build the Supabase client.");
  expect(start, "live.js lost its COACH_STEP_MS constant").toBeGreaterThan(-1);
  expect(end, "live.js lost the Supabase loader landmark").toBeGreaterThan(start);
  return live.slice(start, end);
}

/** Just the generic pmCoach engine (shared by the tour and future dares). */
function coachEngine(): string {
  const section = tourSection();
  const start = section.indexOf("function pmCoach");
  const end = section.indexOf("// ── First-day tour");
  expect(start, "coach section lost pmCoach").toBeGreaterThan(-1);
  expect(end, "coach section lost the first-day tour block").toBeGreaterThan(start);
  return section.slice(start, end);
}

/** Just the runFirstDayTour consumer (to the end of the section). */
function tourRunner(): string {
  const section = tourSection();
  const start = section.indexOf("function runFirstDayTour");
  expect(start, "tour section lost runFirstDayTour").toBeGreaterThan(-1);
  return section.slice(start);
}

// strings.js executed against stub windows, exactly like tests/strings.test.ts:
// EN forced through the cookie path, ID through the localStorage path.
type TourCard = { line: string; waiting?: string; title?: string };
type StubStrings = {
  tour: {
    skip: string;
    senses: TourCard;
    care: TourCard;
    quiz: TourCard;
    quest: TourCard;
    grandpa: TourCard & { dare: string };
  };
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

describe("first-day tour (pmCoach consumer, display-only, one-time)", () => {
  it('gates on PMSeen "tour" and marks it seen FIRST (write-first, like the hatch)', () => {
    const section = tourSection();
    expect(section).toContain('const TOUR_SEEN_ID = "tour"');
    const runner = tourRunner();
    // Double-schedule protection: the flag is re-read at the runner's door.
    expect(runner).toContain("if (pmSeenFlag(TOUR_SEEN_ID)) return;");
    // Write-first: the seen flag lands before the cards are even built, so
    // a mid-tour reload can never replay it.
    expect(runner.indexOf("pmMarkSeen(TOUR_SEEN_ID)")).toBeGreaterThan(-1);
    expect(runner.indexOf("pmMarkSeen(TOUR_SEEN_ID)")).toBeLessThan(runner.indexOf("pmCoach(TOUR_SEEN_ID"));
  });

  it("stays silent when the seen-store is unavailable (fail-closed, never replays forever)", () => {
    // pmSeenFlag treats a missing PMSeen script or a throwing store as
    // SEEN, so scheduleTour's gate below keeps the old fail-closed silence.
    expect(live).toMatch(
      /function pmSeenFlag\(id\) \{\s*\n\s*try \{\s*\n\s*return window\.PMSeen \? window\.PMSeen\.seen\(id\) === true : true;\s*\n\s*\} catch \{\s*\n\s*return true;\s*\n\s*\}\s*\n\}/,
    );
    expect(tourSection()).toContain("if (pmSeenFlag(TOUR_SEEN_ID) || tourActive) return;");
  });

  it("never runs while the hatch intro is pending or active, and chains after finish()", () => {
    expect(tourSection()).toMatch(/function scheduleTour\(\) \{\s*\n\s*if \(hatchPendingOrActive\(\)\) return;/);
    // The hatch finish() hands over to the tour for brand-new players.
    const hatchIntro = live.slice(live.indexOf("function runHatchIntro"), live.indexOf("const COACH_STEP_MS"));
    expect(hatchIntro).toContain("scheduleTour()");
    // The hatch intro rides the same unified store (PMSeen "hatch").
    expect(live).toContain('const HATCH_SEEN_ID = "hatch"');
    expect(hatchIntro).toContain("pmMarkSeen(HATCH_SEEN_ID)");
    // Already-hatched players (pre-update installs) get it on page load.
    const scheduleHatch = live.slice(live.indexOf("function scheduleHatch"), live.indexOf("function runHatchIntro"));
    expect(scheduleHatch).toContain("pmSeenFlag(HATCH_SEEN_ID)");
    expect(scheduleHatch).toMatch(/if \(seen \|\| hatchActive\) \{[\s\S]{0,300}?scheduleTour\(\);/);
  });

  it("is presentation-only: no fetch, no supabase, no reward writes in the coach block", () => {
    const section = tourSection();
    expect(section).not.toMatch(/\bfetch\s*\(/);
    expect(section).not.toMatch(/supabase/i);
    // No reward surfaces — a coach can never grant or pay out.
    expect(section).not.toMatch(/orbCascade|fxXpGain|total_xp|seeds/);
    // The ONE celebration a coach may fire is the dare-completion confetti,
    // cosmetic and routed through the existing FX queue — and it exists
    // exactly once, inside completeDare.
    expect(section.match(/fxEnqueue\(/g)).toHaveLength(1);
    expect(section.match(/spawnConfetti\(/g)).toHaveLength(1);
    expect(coachEngine()).toMatch(/const completeDare = [\s\S]{0,400}?fxEnqueue\(\s*2,/);
  });

  it("spotlights the four remaining card targets with the shared .hatch-highlight class", () => {
    const engine = coachEngine();
    for (const target of ["#env-strip", "#daily-quiz-open", "#current-quest", "#farm-guide-open"]) {
      expect(tourSection(), `tour lost its ${target} spotlight target`).toContain(`"${target}"`);
      expect(html).toContain(`id="${target.slice(1)}"`);
    }
    expect(tourSection()).not.toContain('target: "#care-action"');
    expect(engine).toContain('classList.add("hatch-highlight")');
    // finish() sweeps every spotlight it may have left behind.
    expect(engine).toContain('classList.remove("hatch-highlight")');
    expect(engine).toMatch(/const finish = \(\) => \{[\s\S]{0,400}?clearSpotlights\(\);/);
  });

  it("quiets the same systems the hatch intro quiets via the shared tourActive flag", () => {
    // Declared beside hatchActive…
    expect(live).toMatch(/let hatchActive = false;[\s\S]{0,300}?let tourActive = false;/);
    // …flipped by the generic engine for EVERY coach…
    const engine = coachEngine();
    expect(engine).toContain("tourActive = true;");
    expect(engine).toMatch(/const finish = \(\) => \{[\s\S]{0,300}?tourActive = false;/);
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
    // the tour's final card points at the ? FAB, so nothing is lost.
    expect(live).toMatch(
      /if \(!pmSeenFlag\("tour"\)\) \{\s*\n\s*pmMarkSeen\("guide\.farm"\);\s*\n\s*\} else if \(!pmSeenFlag\("guide\.farm"\)\) \{\s*\n\s*openFarmGuide\(\);/,
    );
    // The tour's own write-first block sets the guide flag alongside its own.
    expect(tourRunner()).toContain('pmMarkSeen("guide.farm")');
  });

  it("ends on an ACTION dare: Grandpa's sticker-book card (never a read-only close)", () => {
    const runner = tourRunner();
    // Final card: #farm-guide-open spotlight + a dare whose event the page
    // catches to open the sticker book.
    expect(runner).toMatch(/target: "#farm-guide-open",[\s\S]{0,300}?dare: \{ label: [\s\S]{0,160}?event: "pm-open-guide" \}/);
    expect(live).toContain('window.addEventListener("pm-open-guide"');
    const engine = coachEngine();
    // The dare is a real button with the strings.js verb label…
    expect(engine).toContain('dareBtn.className = "pixel-btn coach-dare"');
    // …completing marks the coach seen (finish() owns the flag, Skip included)…
    expect(engine).toMatch(/const finish = \(\) => \{[\s\S]{0,600}?pmMarkSeen\(id\);/);
    expect(engine).toMatch(/const completeDare = [\s\S]{0,300}?finish\(\);/);
    // …and dare cards wait for the kid instead of auto-advancing away.
    expect(engine).toContain("stepTimer = entry.dare ? null : setTimeout(advance, COACH_STEP_MS);");
  });

  it("carries full tour copy in BOTH locales plus the live.js English fallback", () => {
    for (const [locale, S] of [["en", EN], ["id", ID]] as const) {
      expectCopy(S.tour?.skip, `[${locale}] tour.skip`);
      for (const step of ["senses", "care", "quiz", "quest", "grandpa"] as const) {
        expectCopy(S.tour?.[step]?.line, `[${locale}] tour.${step}.line`);
        // Text-diet: pixel titles were cut — the card emoji is the anchor now.
        expect(S.tour?.[step]?.title, `[${locale}] tour.${step}.title was cut`).toBeUndefined();
      }
      expectCopy(S.tour?.senses?.waiting, `[${locale}] tour.senses.waiting`);
      expectCopy(S.tour?.grandpa?.dare, `[${locale}] tour.grandpa.dare`);
    }
    // Real translation, not a copy of English.
    expect(ID.tour.senses.line).not.toBe(EN.tour.senses.line);
    expect(ID.tour.quest.line).not.toBe(EN.tour.quest.line);
    expect(ID.tour.grandpa.dare).not.toBe(EN.tour.grandpa.dare);
    expect(live).toContain("const TOUR_FALLBACK");
  });

  it("hands off to the sticker book with the exact Grandpa line (Task 5)", () => {
    expect(EN.tour.grandpa.line).toBe("Lost? Tap me — or fill my sticker book here →");
    expect(ID.tour.grandpa.line).toBe("Bingung? Ketuk aku, atau isi buku stikerku di sini →");
  });

  it('speaks kid language: "senses"/"indra", never "sensors", in every tour line', () => {
    for (const step of ["senses", "care", "quiz", "quest", "grandpa"] as const) {
      const enLines = [EN.tour[step].line, EN.tour[step].waiting ?? ""];
      const idLines = [ID.tour[step].line, ID.tour[step].waiting ?? ""];
      for (const line of enLines) expect(line, `en tour.${step} says "sensors"`).not.toMatch(/\bsensors?\b/i);
      for (const line of idLines) expect(line, `id tour.${step} says "sensor"`).not.toMatch(/sensor/i);
    }
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
