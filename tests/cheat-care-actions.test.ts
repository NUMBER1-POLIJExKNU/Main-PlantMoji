import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SENSOR_LIMITS } from "@/types/raw-sensors";

// The sandbox drives sensors by what a child can DO to a pot, not by typing
// numbers — that is the whole reason the demo exists. These pin the shape of
// that system: which actions are held vs one-shot, that both panels render one
// list, and that soil pH is never allowed to pretend it moves like heat.

const store = readFileSync("public/farm/cheat.js", "utf8");
const live = readFileSync("public/farm/live.js", "utf8");
const css = readFileSync("public/farm/style.css", "utf8");
const panel = readFileSync("src/components/cheat-sensor-panel.tsx", "utf8");

/** The classification signed off before implementation. */
const TOGGLES: Record<string, string> = {
  sun: "place", shade: "place", cold: "place", warm: "place",
  hands: "cover", box: "cover", bag: "cover",
  vent: "vent", lamp: "lamp",
};
const DELTAS = ["mist", "fan", "ash", "leafmould", "rinse", "freshsoil"];
/** Soil pH takes days in a real pot; these carry the time badge. */
const SLOW = ["ash", "leafmould", "rinse", "freshsoil"];

describe("care action catalogue", () => {
  it("classifies every action as the agreed toggle or delta", () => {
    for (const [id, slot] of Object.entries(TOGGLES)) {
      expect(store, `${id} must be a toggle in slot ${slot}`).toContain(
        `{ id: "${id}", kind: "toggle", slot: "${slot}"`,
      );
    }
    for (const id of DELTAS) {
      expect(store, `${id} must be a delta`).toMatch(
        new RegExp(`\\{ id: "${id}", kind: "delta"`),
      );
    }
  });

  it("marks only the soil-pH actions as slow", () => {
    for (const id of SLOW) {
      expect(store).toMatch(new RegExp(`\\{ id: "${id}", kind: "delta", slow: true`));
    }
    for (const id of DELTAS.filter((d) => !SLOW.includes(d))) {
      expect(store).not.toMatch(new RegExp(`\\{ id: "${id}"[^}]*slow: true`));
    }
    // ...and both panels actually show that badge.
    expect(panel).toContain("⏳ {t.slow}");
    expect(live).toContain("`<em>⏳ ${L.slow}</em>`");
  });

  it("keeps toggles exclusive within their slot, and re-press releases", () => {
    // "Held until you press its opposite" only works if a slot holds one id.
    expect(store).toContain('state.actions[action.slot] = state.actions[action.slot] === id ? null : id;');
  });

  it("eases toward a target instead of ramping without end", () => {
    // Newton's law of cooling: the target is also the ceiling, so nothing can
    // run away, and reaching a mood takes a few seconds of holding.
    expect(store).toContain("function toggleTargets(id)");
    // Paced by the real clock, not by tick count — browsers throttle
    // setInterval, and counting ticks ran ~3x slow on the deployed page.
    expect(store).toContain("var ease = 1 - Math.exp(-dt / TAU_MS);");
    expect(store).toContain("var dt = Math.min(MAX_STEP_MS, Math.max(0, now - lastTickAt));");
  });

  it("freezes the readings when every toggle is released", () => {
    // Decision (a): released toggles stop the clock rather than drifting back
    // on their own, so nothing moves during a demo unless it was pressed.
    expect(store).toMatch(/if \(axes\.length === 0\) return;.*freeze/);
    expect(store).toContain("function syncTicker()");
  });

  it("runs the simulation in the store, not in either panel", () => {
    // Otherwise the readings would stop the moment the presenter navigates
    // away from Monitoring, and the mascot would never react live.
    expect(store).toContain("ticker = window.setInterval(tick, TICK_MS);");
    expect(panel).not.toContain("setInterval");
    expect(live).not.toContain("setInterval(tick");
  });

  it("aims the targets at the live crop's own thresholds", () => {
    expect(store).toContain("setBands: function (next)");
    expect(store).toContain("case \"sun\": return { temperature: t.overheatEnter + 6, light: 95 };");
    // Both sides feed it: the farm shell from /api/crop-profile, React from the page prop.
    expect(live).toContain("function pushCheatBands(profile)");
    expect(panel).toContain("window.PMCheat?.setBands({");
  });
});

describe("both panels render one list", () => {
  it("reads the actions from the store rather than repeating them", () => {
    expect(panel).toContain("api.ACTIONS.filter((a) => a.kind === \"toggle\")");
    expect(panel).toContain("api.ACTIONS.filter((a) => a.kind === \"delta\")");
    expect(live).toContain("api.ACTIONS.filter((a) => a.kind === kind)");
    // Neither panel may hard-code an action id.
    for (const id of [...Object.keys(TOGGLES), ...DELTAS]) {
      expect(panel, `panel must not hard-code "${id}"`).not.toContain(`"${id}"`);
      expect(live, `live.js must not hard-code "${id}"`).not.toContain(`data-cheat-action="${id}"`);
    }
  });

  it("presses through the store's single entry point", () => {
    expect(panel).toContain("onClick={() => api.press(a.id)}");
    expect(live).toContain('window.PMCheat?.press(btn.getAttribute("data-cheat-action"))');
  });

  it("folds the raw number fields behind edit-by-value in both", () => {
    expect(panel).toContain("{byValue ? \"▾\" : \"▸\"} {t.byValue}");
    expect(live).toContain("data-cheat-byvalue");
    expect(css).toContain("#pm-cheat-panel .pm-cheat-byvalue-body[hidden] { display: none; }");
  });
});

describe("care actions stay physically possible", () => {
  it("clamps to the same range the real ingest endpoint accepts", () => {
    const start = store.indexOf("var VITAL_LIMITS = {");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = store.slice(start, store.indexOf("};", start));
    for (const [key, limit] of [
      ["temperature", SENSOR_LIMITS.temperature],
      ["humidity", SENSOR_LIMITS.humidity],
      ["light", SENSOR_LIMITS.light],
      ["soilPh", SENSOR_LIMITS.soilPH], // the store spells pH with a lowercase h
    ] as const) {
      expect(block).toContain(`${key}: { min: ${limit.min}, max: ${limit.max} }`);
    }
    expect(store).toContain("function fit(key, value)");
  });
});

describe("quest coaching matches the actions the sandbox offers", () => {
  const quests = readFileSync("src/game/quests/quest-definitions.ts", "utf8");
  const copyId = readFileSync("src/lib/i18n.ts", "utf8");

  it("teaches wood ash and leaf mould, the two the demo now hands out", () => {
    // A demo must not coach a remedy the product never mentions.
    expect(quests).toContain("Sprinkle a little wood ash");
    expect(quests).toContain("mix in some leaf mould");
    expect(copyId).toContain("Taburkan sedikit abu kayu");
    expect(copyId).toContain("campur humus daun");
  });

  it("still refuses chemical dosing", () => {
    expect(copyId).toContain("hindari bahan kimia kuat");
    expect(quests).toContain("NEVER chemical dosing");
  });
});
