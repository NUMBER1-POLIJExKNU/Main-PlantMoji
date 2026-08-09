import { describe, expect, it } from "vitest";
import { selectFeaturedMemory, toJamkachuMemory, validMemoryReflection, type MemoryEventRow } from "@/lib/jamkachu-memory";
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
    expect(en?.fallback).toContain("I still remember");
    expect(id?.fallback).toContain("Aku masih ingat");
    expect(toJamkachuMemory(row("UNKNOWN"), "en")).toBeNull();
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
