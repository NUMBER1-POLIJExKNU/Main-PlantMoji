import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Source-contract test (same style as the Growth snapshot postcards block in
// tests/jamkachu-memory.test.ts): addGrowthRecord is a "use server" action
// whose imports (next/cache, server-only cookies) can't run under plain
// vitest, so the wiring is asserted against the source text instead.
const ACTIONS = readFileSync(resolve(process.cwd(), "src/app/settings/actions.ts"), "utf8");

describe("addGrowthRecord photo-comment wiring", () => {
  it("imports and calls generatePhotoComment", () => {
    expect(ACTIONS).toMatch(/import \{ generatePhotoComment \} from "@\/lib\/photo-comment"/);
    expect(ACTIONS).toMatch(/await generatePhotoComment\(\{/);
  });

  it("persists the reply to growth_records.ai_comment keyed by the record id", () => {
    expect(ACTIONS).toMatch(
      /\.from\("growth_records"\)\s*\.update\(\{ ai_comment: comment \}\)\s*\.eq\("id", recordId\)/,
    );
  });

  it("tolerates a database without the milestone19 ai_comment column", () => {
    expect(ACTIONS).toContain("isMissingAiCommentColumn");
    expect(ACTIONS).toContain('"42703"');
    expect(ACTIONS).toContain('"PGRST204"');
    // The update error is only logged when it is NOT the missing column.
    expect(ACTIONS).toMatch(/commentError && !isMissingAiCommentColumn\(commentError\)/);
  });

  it("reads the photo bytes exactly once for upload + base64", () => {
    const reads = ACTIONS.match(/acceptedPhoto\.arrayBuffer\(\)/g) ?? [];
    expect(reads).toHaveLength(1);
    expect(ACTIONS).toContain('Buffer.from(photoBytes).toString("base64")');
  });

  it("generates the reply before the /diary revalidate so it shows on submit", () => {
    const commentAt = ACTIONS.indexOf("await generatePhotoComment(");
    const revalidateAt = ACTIONS.indexOf('revalidatePath("/diary")');
    expect(commentAt).toBeGreaterThan(-1);
    expect(revalidateAt).toBeGreaterThan(-1);
    expect(commentAt).toBeLessThan(revalidateAt);
  });

  it("grounds the reply in the record's verified context", () => {
    // recordId (variation seed), stage/note/height/leaves (verified facts),
    // and recent replies must all be passed IN THE CALL ITSELF; locale and
    // snapshot come from the request cookie and the latest sensor reading.
    const callStart = ACTIONS.indexOf("await generatePhotoComment({");
    expect(callStart).toBeGreaterThan(-1);
    const callBlock = ACTIONS.slice(callStart, ACTIONS.indexOf("});", callStart));
    for (const needle of ["recordId,", "stage,", "note,", "heightCm,", "leafCount,", "recentComments,", "snapshot,", "locale,"]) {
      expect(callBlock).toContain(needle);
    }
    expect(ACTIONS).toContain("getRequestLocale()");
    expect(ACTIONS).toContain("getLatestSensorSnapshot(supabase, plantId)");
  });
});
