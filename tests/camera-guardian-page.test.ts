import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("/camera route (Live Guardian)", () => {
  it("page probes camera_events (not the superseded photo bucket) server-side", () => {
    const page = source("src/app/camera/page.tsx");
    expect(page).toContain("<PageHeader");
    expect(page).toContain("force-dynamic");
    expect(page).toContain('from("camera_events")');
    expect(page).not.toContain("plant-photos");
    expect(page).toContain("GEMINI_API_KEY"); // scanConfigured flag comes from the server
  });

  it("guardian island watches with getUserMedia + wake lock and handles every state", () => {
    const guardian = source("src/components/camera-guardian.tsx");
    expect(guardian).toContain('"use client"');
    expect(guardian).toContain("getUserMedia");
    expect(guardian).toContain("wakeLock");
    expect(guardian).toContain("visibilitychange");
    expect(guardian).toContain("isGuardianSuspendedWIB");
    expect(guardian).toContain('"/api/camera-events"');
    expect(guardian).toContain('"/api/camera-scan"');
    for (const state of ["denied", "nocamera", "hidden", "suspended"]) {
      expect(guardian).toContain(`"${state}"`);
    }
  });

  it("keeps the privacy contract: no supabase client, no storage, no reward imports", () => {
    const guardian = source("src/components/camera-guardian.tsx");
    expect(guardian).not.toMatch(/supabase/i);
    expect(guardian).not.toMatch(/storage\.|upload\(/);
    expect(guardian).not.toMatch(/awardSeeds|awardXp|seed-engine|bonus-xp|total_xp|bond_level/);
  });

  it("persists only an explicit live-frame capture through the existing Growth Diary action", () => {
    const guardian = source("src/components/camera-guardian.tsx");
    const page = source("src/app/camera/page.tsx");
    expect(guardian).toContain('import { addGrowthRecord } from "@/app/settings/actions"');
    expect(guardian).toContain("const saveCurrentFrameToDiary");
    expect(guardian).toContain('canvas.toBlob(resolve, "image/jpeg", 0.82)');
    expect(guardian).toContain('formData.set("photoRequired", "true")');
    expect(guardian).toContain("result.ok && result.photoSaved");
    expect(page).toContain("growthStage={normalizeGrowthStage(result.plant.growth_stage)");
  });

  it("labels motion-only mode and the local-only (no-migration) mode honestly", () => {
    const guardian = source("src/components/camera-guardian.tsx");
    expect(guardian).toContain("motionOnlyLabel");
    expect(guardian).toContain("guardianOfflineNote");
    expect(guardian).toContain("scanDisabled");
  });

  it("does not resurrect the superseded standalone photo-diary modules", () => {
    expect(() => source("src/app/camera/actions.ts")).toThrow();
    expect(() => source("src/components/camera-capture.tsx")).toThrow();
  });
});
