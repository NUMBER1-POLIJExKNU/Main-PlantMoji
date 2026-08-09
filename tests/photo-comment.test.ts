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
});
