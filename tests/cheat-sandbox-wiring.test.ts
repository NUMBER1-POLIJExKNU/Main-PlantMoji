import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { XP_PER_LEVEL, levelForXp } from "@/types/game";
import { SENSOR_LIMITS, parseRawSensorReading } from "@/types/raw-sensors";

// The classroom-demo sandbox is a plain browser script (window.PMCheat) plus a
// branch inside public/farm/live.js, so it can't be imported and exercised in
// Node — these are source-contract assertions on the raw text, mirroring
// tests/farm-offline-home.test.ts.
//
// What these pin down is the wiring, not the sandbox logic: the sandbox
// shipped once with every piece written correctly but nothing loading it on
// the one screen the demo is given from, which no unit test noticed and only
// clicking through the deployed site did.

const farmHtml = readFileSync("public/farm/index.html", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const live = readFileSync("public/farm/live.js", "utf8");
const css = readFileSync("public/farm/style.css", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");
const monitoringLive = readFileSync("src/components/monitoring-live.tsx", "utf8");
const activityBar = readFileSync("src/components/live-activity-bar.tsx", "utf8");
const questsPage = readFileSync("src/app/quests/page.tsx", "utf8");

describe("classroom cheat sandbox wiring", () => {
  it("loads cheat.js on the farm home, which does not run the React layout", () => {
    // next.config.ts rewrites "/" to the static shell, so src/app/layout.tsx —
    // and the <Script src="/farm/cheat.js"> in it — never runs on the main
    // demo screen. The shell must carry its own tag.
    expect(nextConfig).toContain('{ source: "/", destination: "/farm/index.html" }');
    // defer (boot-resilience fix, tests/farm-boot-resilience.test.ts): fetches
    // in parallel with the other classic scripts instead of blocking parsing
    // one at a time; still executes before live.js (see the test below).
    expect(farmHtml).toContain('<script defer src="/farm/cheat.js"></script>');
  });

  it("loads cheat.js before live.js so main() can see window.PMCheat", () => {
    // live.js reads PMCheat.isActive() once at bootstrap; a tag placed after
    // the module would resolve too late and silently fall through to Supabase.
    const cheatAt = farmHtml.indexOf('src="/farm/cheat.js"');
    const liveAt = farmHtml.indexOf('src="/farm/live.js"');
    expect(cheatAt).toBeGreaterThanOrEqual(0);
    expect(liveAt).toBeGreaterThanOrEqual(0);
    expect(cheatAt).toBeLessThan(liveAt);
  });

  it("still loads cheat.js on the React routes so the banner follows the presenter", () => {
    expect(layout).toContain('<Script src="/farm/cheat.js" strategy="beforeInteractive" />');
  });

  it("keeps the sandbox branch off every Supabase read and write", () => {
    const start = live.indexOf("async function main()");
    expect(start).toBeGreaterThanOrEqual(0);
    const branch = live.slice(start, start + 600);
    expect(branch).toContain("window.PMCheat && window.PMCheat.isActive()");
    expect(branch).toContain("window.__pmSupabaseConfigured = false");
    expect(branch).toContain("initCheatFarm()");
    // The early return is what guarantees no client is ever created below.
    expect(branch).toMatch(/initCheatFarm\(\);\s*\n\s*return;/);
  });
});

describe("the sandbox never shows demo and real numbers at once", () => {
  // A presenter editing sensors saw the sandbox value in the editor and the
  // real hardware reading in the cards right below it, both on screen.
  it("drives the Monitoring reading cards from the sandbox while it is active", () => {
    expect(monitoringLive).toContain('import { useCheat } from "@/lib/pm-cheat"');
    expect(monitoringLive).toContain("const demo = cheatActive && cheatState ? cheatState.vitals : null");
    for (const line of [
      "const temperature = demo ? demo.temperature : num(latest?.temperature)",
      "const humidity = demo ? demo.humidity : num(latest?.humidity)",
      "const soilPh = demo ? demo.soilPh : num(latest?.soil_ph)",
      "const light = demo ? demo.light : num(latest?.light)",
    ]) {
      expect(monitoringLive).toContain(line);
    }
    // ...and stops calling them live readings.
    expect(monitoringLive).toContain("const readingNote = demo ? c.demoNote : undefined");
    expect(monitoringLive).toContain("const statusLabel = demo");
  });

  it("mirrors the sandbox in the activity strip above every React route", () => {
    expect(activityBar).toContain('import { useCheat } from "@/lib/pm-cheat"');
    expect(activityBar).toContain("const demo = cheatActive && cheatState ? cheatState.vitals : null");
    expect(activityBar).toContain('demo ? demo.temperature : latest?.temperature');
    expect(activityBar).toContain('demo ? demo.soilPh : latest?.soil_ph');
    expect(activityBar).toMatch(/const label = demo\s*\n\s*\?\s*\(locale === "id" \? "MODE CURANG" : "CHEAT MODE"\)/);
  });

  it("moves Jamkachu's speech bubble with the cheated mood", () => {
    // Otherwise an Overheating face kept the stale pre-sandbox line, and in
    // whatever locale that fetch had used.
    const start = live.indexOf("function applyCheatFarm()");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = live.slice(start, start + 1400);
    expect(body).toContain("const mood = cheatMoodFor(s.vitals, cropProfile)");
    expect(body).toContain("bubble.innerHTML = moodBubble(MOODS[mood] ?? MOODS.Happy)");
    expect(body).toContain("!sleepShown");
  });
});

describe("the sandbox panel stays clear of what it is demonstrating", () => {
  it("docks the editor beside Jamkachu, next to the tiles it moves", () => {
    // It must not cover the status card or the vitals tiles (those live in the
    // right-hand .home-stack and are the whole point of watching), but parked
    // on the far left the answer to a press was a screen away. So it docks at
    // the inner edge of the character column — measured, because that column
    // is a grid track that resizes.
    const start = css.indexOf("#pm-cheat-panel {");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = css.slice(start, css.indexOf("}", start));
    expect(block).not.toContain("right:");
    expect(live).toContain("function positionCheatPanel()");
    expect(live).toContain("panel.style.left = `${Math.round(rect.right - width - 12)}px`;");
    // Too narrow a stage would put the panel on top of the plant; there the
    // stylesheet's own dock stands.
    expect(live).toContain("if (rect.width < width + 250)");
    expect(live).toContain('window.addEventListener("resize", positionCheatPanel)');
  });

  it("can be collapsed out of the way mid-demo", () => {
    expect(live).toContain("data-cheat-collapse");
    expect(live).toContain('panel.classList.toggle("is-collapsed")');
    expect(css).toContain("#pm-cheat-panel.is-collapsed .pm-cheat-body { display: none; }");
  });

  it("becomes a bottom sheet once the sidebar column is gone", () => {
    expect(css).toMatch(/@media \(max-width: 900px\) \{\s*\n\s*#pm-cheat-panel \{[^}]*bottom: 6px/);
  });
});

describe("cheat panel XP is confined to its level's band", () => {
  /** Mirror of cheatXpBounds() in public/farm/live.js. */
  function bounds(level: number) {
    const min = (Math.max(1, level) - 1) * XP_PER_LEVEL;
    return { min, max: min + XP_PER_LEVEL - 1 };
  }

  it("keeps live.js's XP_PER_LEVEL in step with the game module", () => {
    // The farm shell is a plain script and cannot import the constant, so the
    // band math silently goes wrong if only one side is retuned.
    expect(live).toContain(`const XP_PER_LEVEL = ${XP_PER_LEVEL};`);
  });

  it("offers exactly the XP that maps back to the chosen level", () => {
    for (let level = 1; level <= 12; level += 1) {
      const { min, max } = bounds(level);
      expect(levelForXp(min)).toBe(level);
      expect(levelForXp(max)).toBe(level);
      expect(levelForXp(max + 1)).toBe(level + 1);
      if (level > 1) expect(levelForXp(min - 1)).toBe(level - 1);
    }
  });

  it("derives the bounds from the level rather than hard-coding them", () => {
    expect(live).toContain("function cheatXpBounds(level)");
    expect(live).toContain("const min = (safe - 1) * XP_PER_LEVEL;");
    expect(live).toContain("return { min, max: min + XP_PER_LEVEL - 1 };");
  });

  it("lays the bounds either side of the XP field, like the level's -/+ row", () => {
    const start = live.indexOf('<div class="pm-cheat-xp">');
    expect(start).toBeGreaterThanOrEqual(0);
    const row = live.slice(start, start + 700);
    const minAt = row.indexOf('data-cheat-out="xpMin"');
    const inputAt = row.indexOf('data-cheat="totalXp"');
    const maxAt = row.indexOf('data-cheat-out="xpMax"');
    expect(minAt).toBeGreaterThanOrEqual(0);
    expect(inputAt).toBeGreaterThan(minAt);
    expect(maxAt).toBeGreaterThan(inputAt);
    // Same flex skeleton as .pm-cheat-level so the two rows read alike.
    expect(css).toMatch(/#pm-cheat-panel \.pm-cheat-xp \{[\s\S]*?display: flex/);
    // Readouts, not controls.
    expect(css).toMatch(/#pm-cheat-panel \.pm-cheat-bound \{[\s\S]*?border: 2px dashed/);
  });

  it("clamps the stored XP without fighting a half-typed number", () => {
    // Rewriting the input on every keystroke makes 105 unreachable at Lv.4,
    // whose band starts at 90 — the leading "1" would snap straight to it.
    expect(live).toContain("window.PMCheat.set({ status: { totalXp: clampXp(num) } })");
    expect(live).toMatch(/input\.addEventListener\("change", \(\) => \{\s*\n\s*input\.value = String\(Number\(window\.PMCheat\.get\("status\.totalXp", 0\)\)/);
  });

  it("carries XP with the level so stepping it keeps progress inside the bar", () => {
    expect(live).toContain('const within = (Number(window.PMCheat.get("status.totalXp", 0)) || 0) % XP_PER_LEVEL;');
    expect(live).toContain("window.PMCheat.set({ status: { level: next, totalXp: nextXp } })");
  });
});

describe("cheat sensor edits stay physically possible", () => {
  const sensorPanel = readFileSync("src/components/cheat-sensor-panel.tsx", "utf8");

  it("holds the sandbox to the same range the ingest endpoint accepts", () => {
    // The point of one shared constant: a value the demo lets you type must be
    // a value the real hardware path would have stored.
    const at = (temperature: number, humidity: number, soilPH: number, light: number) =>
      parseRawSensorReading({ plantId: "plant-01", temperature, humidity, soilPH, light });
    const L = SENSOR_LIMITS;
    expect(at(L.temperature.min, L.humidity.min, L.soilPH.min, L.light.min).ok).toBe(true);
    expect(at(L.temperature.max, L.humidity.max, L.soilPH.max, L.light.max).ok).toBe(true);
    // One step outside any edge and ingest refuses it.
    expect(at(L.temperature.max + 1, 50, 7, 50).ok).toBe(false);
    expect(at(25, L.humidity.max + 1, 7, 50).ok).toBe(false);
    expect(at(25, 50, L.soilPH.max + 1, 50).ok).toBe(false);
    expect(at(25, 50, 7, L.light.max + 1).ok).toBe(false);
    expect(at(25, -1, 7, 50).ok).toBe(false);
  });

  it("states the ranges the user called out", () => {
    expect(SENSOR_LIMITS.humidity).toEqual({ min: 0, max: 100 });
    expect(SENSOR_LIMITS.light).toEqual({ min: 0, max: 100 });
    expect(SENSOR_LIMITS.soilPH).toEqual({ min: 0, max: 14 });
  });

  it("keeps the farm shell's mirrored limits in step with SENSOR_LIMITS", () => {
    // public/farm/live.js is a plain script and cannot import the constant, so
    // without this the two silently drift.
    const start = live.indexOf("const CHEAT_VITAL_LIMITS = {");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = live.slice(start, live.indexOf("};", start));
    for (const [key, limit] of [
      ["temperature", SENSOR_LIMITS.temperature],
      ["humidity", SENSOR_LIMITS.humidity],
      ["light", SENSOR_LIMITS.light],
      ["soilPh", SENSOR_LIMITS.soilPH], // the store spells pH with a lowercase h
    ] as const) {
      expect(block).toContain(`${key}: { min: ${limit.min}, max: ${limit.max} }`);
    }
  });

  it("clamps in both editors, not just the Monitoring one", () => {
    // Both panels write the same store, so leaving either unclamped would put
    // the impossible value on screen anyway.
    expect(sensorPanel).toContain('import { SENSOR_LIMITS } from "@/types/raw-sensors"');
    expect(sensorPanel).toContain("api.set({ vitals: { [key]: Math.min(max, Math.max(min, num)) } })");
    expect(live).toContain("const value = limit ? Math.min(limit.max, Math.max(limit.min, num)) : num;");
  });

  it("takes each field's min/max from the limits rather than the call site", () => {
    expect(sensorPanel).toContain("const { min, max } = LIMITS[key];");
    expect(sensorPanel).toMatch(/\{field\("humidity", t\.hum, 1\)\}/);
    expect(live).toContain("const limit = CHEAT_VITAL_LIMITS[key];");
    expect(live).toContain('vitalField("soilPh", L.ph, s.vitals.soilPh, 0.1)');
  });

  it("settles the field onto the stored value once editing ends", () => {
    expect(sensorPanel).toContain("onBlur={(e) => { e.target.value = String(v[key]); }}");
    expect(live).toContain("input.value = String(window.PMCheat.get(`vitals.${key}`, 0));");
  });
});

describe("cheat quest board", () => {
  it("separates the two quests that share the Balance My Soil title", () => {
    // BALANCE_SOIL_ACIDIC and BALANCE_SOIL_ALKALINE both render at once on the
    // board, and the hero card can be swapped between them — unlike the
    // player-facing cards, where only the triggered one ever shows. The rule
    // lives in quest-labels so the board and the hero card cannot disagree.
    expect(questsPage).toContain("questLabel(key, locale)");
    expect(questsPage).toContain("subtitle: questSubtitle(key, locale)");
    // The old inline version pasted the raw enum ("· SoilAcidic"), which is
    // untranslated and is a name no visitor should have to read.
    expect(questsPage).not.toContain("cheatTitleCounts");
    expect(questsPage).not.toContain("QUEST_DEFINITIONS[key].triggerMood}`");
  });
});
