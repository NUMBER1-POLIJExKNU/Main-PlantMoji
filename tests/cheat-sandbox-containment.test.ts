import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The sandbox's one promise: a classroom demo can put ANY reading on screen
// without a single byte reaching Supabase, the game API, or the hardware —
// and normal mode must be untouched the moment it is switched off.
//
// The sandbox has grown a lot (status, vitals, quest board, quest stages,
// monitoring, activity strip), and every addition is another chance to
// casually persist something. These tests are the guard rail: they read the
// cheat modules as text and fail if a write path ever appears in one.

const CHEAT_MODULES = [
  "public/farm/cheat.js",
  "src/lib/pm-cheat.ts",
  "src/components/cheat-mode-toggle.tsx",
  "src/components/cheat-sensor-panel.tsx",
  "src/components/cheat-quest-panel.tsx",
  "src/game/quests/cheat-quest-stage.ts",
] as const;

/** Strips // line comments and /* block comments *\/ so a doc comment saying
 *  "never writes Supabase" cannot satisfy — or trip — a search for real code. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/([^:])\/\/.*$/gm, "$1");
}

describe("the cheat sandbox cannot touch real data", () => {
  it.each(CHEAT_MODULES)("%s has no network or database call", (path) => {
    const source = code(path);
    for (const forbidden of [
      "fetch(",
      "XMLHttpRequest",
      "sendBeacon",
      "WebSocket",
      "createClient",
      "getBrowserSupabase",
      "getServerSupabase",
      "@supabase/supabase-js",
      "/api/",
    ]) {
      expect(source, `${path} must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("persists only to localStorage and the demo cookie", () => {
    const store = readFileSync("public/farm/cheat.js", "utf8");
    expect(store).toContain('var KEY = "plantmoji_cheat_v1";');
    // The one cookie exists so server-rendered pages can reveal locked content
    // for the demo. It gates a fuller VIEW; it is never read as a write token.
    expect(store).toContain('"pm_cheat=1;path=/;max-age=86400;samesite=lax"');
    expect(store).toContain("window.localStorage.setItem(KEY, JSON.stringify(state));");
  });

  it("wipes itself on exit, leaving nothing for normal mode to inherit", () => {
    const store = readFileSync("public/farm/cheat.js", "utf8");
    expect(store).toContain("window.localStorage.removeItem(KEY);");
    expect(store).toContain('"pm_cheat=;path=/;max-age=0;samesite=lax"');
  });

  it("keeps the farm shell off every Supabase path while the sandbox is on", () => {
    // main() returns before a client is ever created, so no read, no write,
    // and no realtime subscription exists to fire.
    const live = readFileSync("public/farm/live.js", "utf8");
    const start = live.indexOf("async function main()");
    const branch = live.slice(start, start + 600);
    expect(branch).toContain("window.PMCheat && window.PMCheat.isActive()");
    expect(branch).toMatch(/initCheatFarm\(\);\s*\n\s*return;/);
  });

  it("falls straight back to the real feed when the sandbox is off", () => {
    // Every surface that mirrors the sandbox reads it through the same guard
    // and keeps its own fetch loop running underneath, so switching the
    // sandbox off restores live data without a reload.
    for (const path of ["src/components/monitoring-live.tsx", "src/components/live-activity-bar.tsx"]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("const demo = cheatActive && cheatState ? cheatState.vitals : null;");
    }
    // The quest hero card asks the sandbox for a stage ONLY while it is active;
    // otherwise it echoes the Supabase row, so a stale board cannot leak in.
    const hero = readFileSync("src/components/quest-hero-stages.tsx", "utf8");
    expect(hero).toMatch(/active && state\s*\n?\s*\?\s*cheatQuestStage\(/);
    expect(hero).toContain(": stageFromQuestStatus(questStatus);");
  });

  it("writes sandbox sensor values nowhere but the sandbox store", () => {
    // The quest board moves the readings too. That must go through the same
    // client-only store as a hand edit, never to an ingest endpoint.
    const panel = readFileSync("src/components/cheat-quest-panel.tsx", "utf8");
    expect(panel).toContain("vitals: sensorsForStage(key as QuestKey, step, cropProfile ?? undefined)");
    expect(code("src/components/cheat-quest-panel.tsx")).not.toContain("sensor-readings");
  });
});
