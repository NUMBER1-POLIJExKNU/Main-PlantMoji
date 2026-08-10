import { describe, expect, it } from "vitest";
import { memoryReflectionAngle, memoryTimeAgo, REFLECTION_ANGLES, selectFeaturedMemory, toJamkachuMemory, validMemoryReflection, type MemoryEventRow } from "@/lib/jamkachu-memory";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function row(type: string, data: Record<string, unknown> = {}, id = type): MemoryEventRow {
  return { event_id: id, type, data, occurred_at: "2026-08-09T08:00:00Z" };
}

describe("Jamkachu memories", () => {
  it("builds bilingual grounded fallbacks for supported saved events", () => {
    const en = toJamkachuMemory(row("QUEST_COMPLETED", { title: "Cool Down" }), "en");
    const id = toJamkachuMemory(row("QUEST_COMPLETED", { title: "Sejukkan Aku" }), "id");
    expect(en?.verifiedSummary).toContain("Cool Down");
    expect(en?.fallback).toContain("Cool Down");
    expect(id?.fallback).toContain("Sejukkan Aku");
    expect(toJamkachuMemory(row("UNKNOWN"), "en")).toBeNull();
  });

  it("gives different memories different diary voices, deterministically", () => {
    const ids = ["evt-a", "evt-b", "evt-c", "evt-d", "evt-e", "evt-f", "evt-g", "evt-h"];
    const lines = new Set(
      ids.map((eventId) => toJamkachuMemory(row("QUEST_COMPLETED", { title: "Cool Down" }, eventId), "en")!.fallback),
    );
    // Eight memories must not collapse into one template.
    expect(lines.size).toBeGreaterThanOrEqual(3);
    // Same memory always writes the same line (SSR/client/test stability)...
    const first = toJamkachuMemory(row("LEVEL_UP", { levelAfter: 4 }, "evt-a"), "en")!.fallback;
    expect(toJamkachuMemory(row("LEVEL_UP", { levelAfter: 4 }, "evt-a"), "en")!.fallback).toBe(first);
    // ...and en/id stay grounded on the same facts for the same memory.
    expect(toJamkachuMemory(row("LEVEL_UP", { levelAfter: 4 }, "evt-a"), "id")!.fallback).toContain("4");
  });

  it("varies AI writing angles per memory and keeps time-ago phrases digit-free", () => {
    const angles = new Set(["evt-a", "evt-b", "evt-c", "evt-d", "evt-e", "evt-f", "evt-g", "evt-h"].map(memoryReflectionAngle));
    expect(angles.size).toBeGreaterThanOrEqual(3);
    for (const angle of angles) expect(REFLECTION_ANGLES).toContain(angle);
    const now = new Date("2026-08-10T08:00:00Z");
    expect(memoryTimeAgo("2026-08-10T06:00:00Z", "en", now)).toBe("just today");
    expect(memoryTimeAgo("2026-08-09T06:00:00Z", "id", now)).toBe("kemarin");
    expect(memoryTimeAgo("2026-07-20T06:00:00Z", "en", now)).toBe("a few weeks ago");
    expect(memoryTimeAgo("not-a-date", "en", now)).toBeNull();
    // Digits would fail validMemoryReflection, so every bucket must be word-only.
    for (const iso of ["2026-08-10T06:00:00Z", "2026-08-08T06:00:00Z", "2026-08-01T06:00:00Z", "2026-07-20T06:00:00Z", "2026-06-20T06:00:00Z", "2025-01-01T06:00:00Z"]) {
      for (const locale of ["en", "id"] as const) {
        expect(memoryTimeAgo(iso, locale, now)).not.toMatch(/\d/);
      }
    }
  });

  it("features the newest special memory before ordinary care", () => {
    const quest = toJamkachuMemory(row("QUEST_COMPLETED", {}, "q"), "en")!;
    const badge = toJamkachuMemory(row("BADGE_UNLOCKED", { name: "Light Keeper" }, "b"), "en")!;
    expect(selectFeaturedMemory([quest, badge])?.id).toBe("b");
    expect(selectFeaturedMemory([quest])?.id).toBe("q");
    expect(selectFeaturedMemory([])).toBeNull();
  });

  it("rejects AI-like copy and numbers absent from the saved memory", () => {
    const memory = toJamkachuMemory(row("LEVEL_UP", { levelAfter: 4 }), "en")!;
    expect(validMemoryReflection("I still remember reaching Level 4 with you.", memory)).toBe(true);
    expect(validMemoryReflection("As an AI, I remember Level 4.", memory)).toBe(false);
    expect(validMemoryReflection("We reached Level 91!", memory)).toBe(false);
  });
});

describe("Growth snapshot postcards", () => {
  it("keeps photos optional, private, and rendered from signed URLs", () => {
    const diary = readFileSync(resolve(process.cwd(), "src/app/diary/page.tsx"), "utf8");
    const action = readFileSync(resolve(process.cwd(), "src/app/settings/actions.ts"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "supabase/milestone18-growth-snapshots.sql"), "utf8");
    expect(diary).toContain('capture="environment"');
    expect(diary).toContain("createSignedUrl");
    expect(action).toContain("5 * 1024 * 1024");
    expect(migration).toContain("false,");
  });
});
