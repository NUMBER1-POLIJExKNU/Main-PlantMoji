import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("/camera Live Guardian route", () => {
  it("uses the shared header and exposes AI availability without a storage dependency", () => {
    const page = source("src/app/camera/page.tsx");
    expect(page).toContain("<PageHeader");
    expect(page).toContain("aiEnabled={Boolean(process.env.GEMINI_API_KEY)}");
    expect(page).not.toContain("plant-photos");
  });

  it("watches the environment camera and samples deterministic local frames", () => {
    const capture = source("src/components/camera-capture.tsx");
    expect(capture).toContain('"use client"');
    expect(capture).toContain("navigator.mediaDevices.getUserMedia");
    expect(capture).toContain('facingMode: { ideal: "environment" }');
    expect(capture).toContain("nextMotionState");
    expect(capture).toContain("MOTION_SAMPLE_WIDTH");
  });

  it("shows privacy and works in motion-only mode", () => {
    const capture = source("src/components/camera-capture.tsx");
    expect(capture).toContain("privacyPlantOnly");
    expect(capture).toContain("motionOnly");
    expect(capture).toContain('fetch("/api/camera-events"');
  });
});
