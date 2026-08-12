import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const actions = readFileSync(resolve(process.cwd(), "src/app/settings/actions.ts"), "utf8");
const diary = readFileSync(resolve(process.cwd(), "src/app/diary/page.tsx"), "utf8");
const button = readFileSync(resolve(process.cwd(), "src/components/delete-growth-photo-button.tsx"), "utf8");

describe("Growth Diary photo deletion", () => {
  it("checks both record id and plant id before deleting", () => {
    expect(actions).toContain("export async function deleteGrowthPhoto(");
    expect(actions).toMatch(/\.eq\("id", recordId\)\s*\.eq\("plant_id", plantId\)/);
  });

  it("removes the private snapshot before clearing its database reference", () => {
    const storage = actions.indexOf('.from("growth-snapshots")');
    const cleanup = actions.indexOf("update({ photo_path: null })");
    expect(storage).toBeGreaterThan(-1);
    expect(actions.slice(storage)).toContain(".remove([record.photo_path])");
    expect(cleanup).toBeGreaterThan(storage);
  });

  it("clears legacy photo URL and photo-derived comment without deleting the note", () => {
    expect(actions).toContain('clearOptionalGrowthPhotoColumn(supabase, recordId, plantId, "photo_url")');
    expect(actions).toContain('clearOptionalGrowthPhotoColumn(supabase, recordId, plantId, "ai_comment")');
    expect(actions).not.toContain('.from("growth_records").delete()');
  });

  it("shows a confirmed, pending delete control only for records with photos", () => {
    expect(diary).toContain("DeleteGrowthPhotoButton");
    expect(diary).toContain("(snapshotUrl || record.photo_url)");
    expect(button).toContain("window.confirm");
    expect(button).toContain("router.refresh()");
    expect(button).toContain("disabled={pending}");
  });
});
