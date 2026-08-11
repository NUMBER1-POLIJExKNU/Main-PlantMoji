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
const nextConfig = readFileSync("next.config.ts", "utf8");

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
