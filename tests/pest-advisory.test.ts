import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NO_PEST_SENTINEL,
  NO_PLANT_SENTINEL,
  analyzePestSnapshot,
} from "@/lib/pest-advisory";

// Every failure path collapses to { status: "disabled" } (motion-only mode)
// and a person in frame collapses to { status: "discarded" } — the module
// must never throw and never leak an advisory built from a person.

const INPUT = { imageBase64: "aGVsbG8=", mimeType: "image/jpeg", locale: "en" as const };

function geminiReply(text: string) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("analyzePestSnapshot", () => {
  it("is disabled without GEMINI_API_KEY — and never calls the network", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps the NONE sentinel to clear (nothing shown, nothing persisted)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply(NO_PEST_SENTINEL)));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "clear" });
  });

  it("maps the NO_PLANT sentinel to discarded (person in frame)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply(NO_PLANT_SENTINEL)));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "discarded" });
  });

  it("returns the advisory line verbatim on a pest verdict", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const line = "Something tickles! Can you check my leaves? 🐛";
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply(line)));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "pest", advisory: line });
  });

  it("treats overlong replies as disabled (malformed contract)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply("x".repeat(500))));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "disabled" });
  });

  it("treats non-2xx, malformed JSON, and network throws as disabled", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "disabled" });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ nope: 1 }) })));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "disabled" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "disabled" });
  });

  it("is disabled on an empty image (never calls the network with nothing)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(
      await analyzePestSnapshot({ ...INPUT, imageBase64: "" }),
    ).toEqual({ status: "disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("catches a sentinel even when the model wraps it in chatter", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply("Sorry — NO_PLANT")));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "discarded" });
  });
});
