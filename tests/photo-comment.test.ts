import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePhotoComment, templatePhotoComment } from "@/lib/photo-comment";
import type { SensorSnapshot } from "@/lib/crop-profiles";

const SNAPSHOT: SensorSnapshot = {
  temperature: 27,
  humidity: 70,
  soilPh: 6.1,
  light: 55,
  recordedAt: "2026-08-09T03:00:00.000Z",
};

function baseInput() {
  return {
    plantName: "Jamkachu",
    personality: "cute" as const,
    snapshot: SNAPSHOT,
    locale: "en" as const,
    imageBase64: "aGVsbG8=",
    imageMimeType: "image/jpeg",
  };
}

/** Minimal Gemini generateContent success payload. */
function geminiResponse(text: string) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("templatePhotoComment", () => {
  it("is localized and non-empty with no snapshot at all", () => {
    const en = templatePhotoComment(null, "en");
    const id = templatePhotoComment(null, "id");
    expect(en.length).toBeGreaterThan(0);
    expect(id.length).toBeGreaterThan(0);
    expect(en).not.toBe(id);
  });

  it("includes real sensor values when a snapshot exists", () => {
    const en = templatePhotoComment(SNAPSHOT, "en");
    expect(en).toContain("27");
    expect(en).toContain("55");
    const id = templatePhotoComment(SNAPSHOT, "id");
    expect(id).toContain("27");
  });

  it("skips missing readings instead of inventing them", () => {
    const partial: SensorSnapshot = { temperature: null, humidity: null, soilPh: null, light: 40 };
    const en = templatePhotoComment(partial, "en");
    expect(en).toContain("40");
    expect(en).not.toMatch(/null|undefined|NaN/);
  });
});

// Precomputed FNV-1a coverage: memorySeed(seed) % 5 hits every pool index
// exactly once across these five seeds (verified offline) — so "iterate the
// coverage seeds" means "visit every variant of a 5-template pool".
const COVERAGE_SEEDS = ["seed-7", "seed-0", "seed-1", "seed-2", "seed-3"];
const EIGHT_RECORD_IDS = ["rec-a", "rec-b", "rec-c", "rec-d", "rec-e", "rec-f", "rec-g", "rec-h"];

describe("templatePhotoComment diary-voice pool", () => {
  it("no seed keeps today's exact default (index 0)", () => {
    // The pre-pool behavior is the pool's first entry; older callers and the
    // fallback-equality tests above depend on this staying byte-identical.
    expect(templatePhotoComment(SNAPSHOT, "en")).toContain("Today's photo is saved in my diary!");
    expect(templatePhotoComment(null, "en")).toContain("Thanks for taking my photo today!");
  });

  it("same seed always picks the same template (determinism)", () => {
    for (const locale of ["en", "id"] as const) {
      expect(templatePhotoComment(SNAPSHOT, locale, "rec-a")).toBe(templatePhotoComment(SNAPSHOT, locale, "rec-a"));
      expect(templatePhotoComment(null, locale, "rec-a")).toBe(templatePhotoComment(null, locale, "rec-a"));
    }
  });

  it("eight distinct record ids spread across at least three diary voices", () => {
    for (const locale of ["en", "id"] as const) {
      const withSensors = new Set(EIGHT_RECORD_IDS.map((id) => templatePhotoComment(SNAPSHOT, locale, id)));
      expect(withSensors.size).toBeGreaterThanOrEqual(3);
      const withoutSnapshot = new Set(EIGHT_RECORD_IDS.map((id) => templatePhotoComment(null, locale, id)));
      expect(withoutSnapshot.size).toBeGreaterThanOrEqual(3);
    }
  });

  it("every sensor-pool variant embeds the real readings and never invents values", () => {
    for (const locale of ["en", "id"] as const) {
      const variants = new Set<string>();
      for (const seed of COVERAGE_SEEDS) {
        const comment = templatePhotoComment(SNAPSHOT, locale, seed);
        expect(comment).toContain("27");
        expect(comment).toContain("55");
        expect(comment).not.toMatch(/null|undefined|NaN/);
        variants.add(comment);
      }
      // The coverage seeds are known to hit all five indices — prove it.
      expect(variants.size).toBe(5);
    }
  });

  it("en and id pools stay pairwise distinct at every index", () => {
    for (const seed of COVERAGE_SEEDS) {
      expect(templatePhotoComment(SNAPSHOT, "en", seed)).not.toBe(templatePhotoComment(SNAPSHOT, "id", seed));
      expect(templatePhotoComment(null, "en", seed)).not.toBe(templatePhotoComment(null, "id", seed));
    }
  });
});

describe("generatePhotoComment fallback selection", () => {
  it("no GEMINI_API_KEY → template, no network call", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
    expect(result.comment).toBe(templatePhotoComment(SNAPSHOT, "en"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("network failure → template, never throws", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
  });

  it("timeout abort → template, never throws", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const abortError = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
  });

  it("non-2xx response → template", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false } as Response));
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
  });

  it("valid Gemini reply → gemini source with the reply text", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("A new leaf on the left side!")));
    const result = await generatePhotoComment(baseInput());
    expect(result).toEqual({ comment: "A new leaf on the left side!", source: "gemini" });
  });

  it("NO_PLANT sentinel (person visible) → template", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("NO_PLANT")));
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
  });

  it("overlong reply → template", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("x".repeat(301))));
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
  });

  it("localizes the template fallback", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const result = await generatePhotoComment({ ...baseInput(), locale: "id" });
    expect(result.comment).toBe(templatePhotoComment(SNAPSHOT, "id"));
  });

  it("seeds the template fallback with the record id", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    // seed-3 picks a non-zero pool index (precomputed), so this proves the
    // recordId reaches templatePhotoComment rather than defaulting to 0.
    const result = await generatePhotoComment({ ...baseInput(), recordId: "seed-3" });
    expect(result.comment).toBe(templatePhotoComment(SNAPSHOT, "en", "seed-3"));
    expect(result.comment).not.toBe(templatePhotoComment(SNAPSHOT, "en"));
  });
});
