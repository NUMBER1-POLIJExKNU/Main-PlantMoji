import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const strings = readFileSync(resolve(process.cwd(), "public/farm/strings.js"), "utf8");

function handlerBody(): string {
  const start = live.indexOf("function onCameraEventInsert(");
  expect(start).toBeGreaterThan(-1);
  return live.slice(start, start + 1_800);
}

describe("farm camera layer (presentation-only)", () => {
  it("consumes camera_events on its own isolated channel", () => {
    expect(live).toContain('table: "camera_events"');
    expect(live).toContain("farm-camera-");
    expect(live).toContain("onCameraEventInsert(payload.new)");
  });

  it("touch rides the existing pet-response machinery, guarded against sleep/hatch", () => {
    const body = handlerBody();
    expect(body).toContain("quickPetResponse()");
    expect(body).toContain("sleepShown");
    expect(body).toContain("hatchActive");
  });

  it("touch reactions are throttled client-side too (replayed backlog can never spam)", () => {
    expect(live).toContain("CAMERA_TOUCH_GAP_MS");
    expect(handlerBody()).toContain("lastCameraTouchAt");
  });

  it("pest_advice is a T1/T2 advisory (bubble + why-card), never a celebration", () => {
    const body = handlerBody();
    expect(body).toContain("pest_advice");
    expect(body).toContain("floatWhyCard");
    expect(body).not.toMatch(/fxEnqueue\(\s*[345]/);
  });

  it("the handler is display-only: no awards, no counters, no network", () => {
    const body = handlerBody();
    expect(body).not.toMatch(/orbCascade|fxXpGain|fxStreakUp|award|total_xp|bond_level|seeds|fetch\(/);
  });

  it("strings.js carries cameraGuardian copy in BOTH locales", () => {
    expect(strings.match(/cameraGuardian:/g)).toHaveLength(2);
    expect(strings.match(/touchLine:/g)).toHaveLength(2);
    expect(strings.match(/pestWhy:/g)).toHaveLength(2);
  });
});
