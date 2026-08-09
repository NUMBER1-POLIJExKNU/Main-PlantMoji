import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync("src/components/camera-capture.tsx", "utf8");
const scan = readFileSync("src/app/api/camera-scan/route.ts", "utf8");
const events = readFileSync("src/app/api/camera-events/route.ts", "utf8");
const migration = readFileSync("supabase/milestone19-camera-guardian.sql", "utf8");
const farm = readFileSync("public/farm/live.js", "utf8");

describe("Camera AI Live Guardian wiring", () => {
  it("uses a local video stream and deterministic frame sampling", () => {
    expect(component).toContain("navigator.mediaDevices.getUserMedia");
    expect(component).toContain("nextMotionState");
    expect(component).toContain("125");
  });
  it("never creates camera storage or rewards", () => {
    expect(migration).toContain("camera_events");
    expect(migration).not.toContain("storage.buckets");
    expect(scan + events + migration).not.toMatch(/award_xp|award_seeds|quest_instances/);
  });
  it("keeps keys server-side and validates a small JPEG", () => {
    expect(scan).toContain("process.env.GEMINI_API_KEY");
    expect(scan).toContain("MAX_BASE64_CHARS");
    expect(component).not.toContain("GEMINI_API_KEY");
  });
  it("fans presentation events out to the farm without game writes", () => {
    expect(farm).toContain("onCameraGuardianEvent");
    expect(farm).toContain('table: "camera_events"');
    expect(farm).toContain("quickPetResponse()");
  });
});
