import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    expect(farmHtml).toContain('<script src="/farm/cheat.js"></script>');
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
  it("docks the editor away from the status card and vitals tiles", () => {
    // Those live in the right-hand .home-stack — the whole point is watching
    // them react, so the editor must not sit on top of them.
    const start = css.indexOf("#pm-cheat-panel {");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = css.slice(start, css.indexOf("}", start));
    expect(block).toContain("left: 268px");
    expect(block).not.toContain("right:");
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

describe("cheat quest board", () => {
  it("separates the two quests that share the Balance My Soil title", () => {
    // BALANCE_SOIL_ACIDIC and BALANCE_SOIL_ALKALINE both render at once on the
    // board, unlike the player-facing cards where only the triggered one shows.
    expect(questsPage).toContain("cheatTitleCounts");
    expect(questsPage).toContain("`${title} · ${QUEST_DEFINITIONS[key].triggerMood}`");
  });
});
