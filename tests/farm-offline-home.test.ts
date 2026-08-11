import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// public/farm/live.js is a plain browser script (document/window/fetch
// globals, no module exports) so it can't be imported and exercised in
// Node — these are source-contract assertions on the raw text instead,
// mirroring the pattern used by tests/farm-clock-ui.test.ts.
const script = readFileSync("public/farm/live.js", "utf8");

/** Isolates one of main()'s offline early-return blocks (or the
 *  defense-in-depth catch at the bottom of the file) by the sentinel
 *  comment/line that immediately precedes it, so each assertion below is
 *  scoped to the actual branch instead of matching anywhere in the file. */
function offlineBlock(anchor: string, span = 500): string {
  const start = script.indexOf(anchor);
  expect(start, `expected to find anchor: ${anchor}`).toBeGreaterThanOrEqual(0);
  return script.slice(start, start + span);
}

/** Slices out the full renderOfflineHome() function body by matching its
 *  brace depth, so window-size drift can never truncate an assertion. */
function offlineHomeBody(): string {
  const start = script.indexOf("function renderOfflineHome()");
  expect(start).toBeGreaterThanOrEqual(0);
  const openBrace = script.indexOf("{", start);
  let depth = 0;
  for (let i = openBrace; i < script.length; i++) {
    if (script[i] === "{") depth++;
    else if (script[i] === "}") {
      depth--;
      if (depth === 0) return script.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced braces while scanning renderOfflineHome()");
}

describe("farm home offline/unreachable-Supabase presentation", () => {
  it("defines a single shared offline-home renderer instead of duplicating fixes per branch", () => {
    expect(script).toContain("function renderOfflineHome()");
  });

  it("the offline renderer sets Jamkachu's mood to Happy, never leaves it blank", () => {
    expect(offlineHomeBody()).toContain('setMascotMood("Happy")');
  });

  it("the offline renderer hides the XP/streak/seeds badges instead of leaving their dev placeholders up", () => {
    const body = offlineHomeBody();
    expect(body).toContain('["coin", "streak", "seeds"]');
    expect(body).toContain("badge.hidden = true");
  });

  it("the offline renderer repaints HP, the speech bubble, the companion stage line, and the sensor tiles", () => {
    const body = offlineHomeBody();
    expect(body).toContain('renderHp("Happy")');
    expect(body).toContain("moodBubble(MOODS.Happy)");
    expect(body).toContain('renderCompanion({ stage: "Seed" })');
    expect(body).toContain("renderSensorsWaiting()");
  });

  it("every offline early-return path in main() calls the shared renderer before scheduling the hatch", () => {
    // The config-fetch failure branch. fetchPublicConfig() (boot-resilience
    // fix, tests/farm-boot-resilience.test.ts) wraps the raw fetch with a
    // timeout + retries, but still funnels every exhausted attempt into
    // this same catch → offline path.
    expect(offlineBlock("config = await fetchPublicConfig();"))
      .toMatch(/catch\s*{\s*window\.__pmSupabaseConfigured = false;[^]*?renderOfflineHome\(\);[^]*?scheduleHatch\(null\);/);

    // The missing/invalid config branch.
    expect(offlineBlock("if (!config?.url || !config?.key) {"))
      .toMatch(/window\.__pmSupabaseConfigured = false;[^]*?renderOfflineHome\(\);[^]*?scheduleHatch\(null\);/);

    // The null-Supabase-client branch (vendored bundle + CDN fallback both failed).
    const nullClientBlock = script.slice(
      script.indexOf("const supabase = await loadSupabaseClient(config.url, config.key);"),
      script.indexOf("window.__pmSupabaseConfigured = true;"),
    );
    expect(nullClientBlock)
      .toMatch(/if \(!supabase\) {[^]*?renderOfflineHome\(\);[^]*?scheduleHatch\(null\);/);

    // The defense-in-depth catch at the bottom of the file: it renders the
    // offline defaults ONLY when the first online paint never happened —
    // repainting over real data would mask a live distressed plant
    // (adversarial-review fix), so the guard must come first.
    const catchBlock = offlineBlock("main().catch((error) => {", 900);
    expect(catchBlock).toMatch(/if \(firstOnlinePaint\) {[^]*?return;/);
    expect(catchBlock).toMatch(/renderOfflineHome\(\);[^]*?scheduleHatch\(null\);/);
  });

  it('never leaves a raw "--" placeholder as the rendered mood', () => {
    // #char-mood's static markup default is "--"; renderOfflineHome must
    // repaint it via setMascotMood rather than writing the dash itself.
    const body = offlineHomeBody();
    expect(body).not.toMatch(/moodEl\.textContent\s*=\s*["'`]--["'`]/);
    expect(body).not.toContain('textContent = "--"');
  });
});
