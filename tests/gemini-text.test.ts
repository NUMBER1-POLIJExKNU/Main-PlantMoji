import { describe, expect, it } from "vitest";
import { cleanFragment, extractText, stripControlChars } from "@/lib/gemini-text";

// Control characters are built by char code on purpose: this test file must
// not embed raw control bytes, and escape literals in fixtures would obscure
// exactly which byte each case exercises.
const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const NL = String.fromCharCode(10);
const US = String.fromCharCode(31); // last char of the stripped range
const DEL = String.fromCharCode(127);

/** Minimal Gemini generateContent success payload around the given parts. */
function geminiPayload(parts: unknown[]) {
  return { candidates: [{ content: { parts } }] };
}

describe("extractText", () => {
  it("returns the first non-empty text part", () => {
    expect(extractText(geminiPayload([{ text: "Hello leaf!" }]))).toBe("Hello leaf!");
    expect(extractText(geminiPayload([{ text: "" }, { text: "second" }]))).toBe("second");
  });

  it("collapses internal whitespace and trims the winning part", () => {
    expect(extractText(geminiPayload([{ text: "  hello" + NL + NL + "world  " }]))).toBe("hello world");
    expect(extractText(geminiPayload([{ text: TAB + "a" + TAB + TAB + "b" }]))).toBe("a b");
  });

  it("skips whitespace-only and non-text parts to find a real one", () => {
    expect(
      extractText(geminiPayload([{ text: "   " }, { inline_data: {} }, 7, null, { text: "real" }])),
    ).toBe("real");
  });

  it("returns null when parts exist but none carries usable text", () => {
    expect(extractText(geminiPayload([]))).toBeNull();
    expect(extractText(geminiPayload([{ text: "  " + TAB + " " }]))).toBeNull();
    expect(extractText(geminiPayload([{ text: 5 }, { inline_data: {} }]))).toBeNull();
  });

  it("tolerates every malformed payload shape by returning null", () => {
    expect(extractText(null)).toBeNull();
    expect(extractText(undefined)).toBeNull();
    expect(extractText("nope")).toBeNull();
    expect(extractText(42)).toBeNull();
    expect(extractText({})).toBeNull();
    expect(extractText({ candidates: "nope" })).toBeNull();
    expect(extractText({ candidates: [] })).toBeNull();
    expect(extractText({ candidates: [null] })).toBeNull();
    expect(extractText({ candidates: [{}] })).toBeNull();
    expect(extractText({ candidates: [{ content: null }] })).toBeNull();
    expect(extractText({ candidates: [{ content: {} }] })).toBeNull();
    expect(extractText({ candidates: [{ content: { parts: "nope" } }] })).toBeNull();
  });
});

describe("cleanFragment (string-or-null contract)", () => {
  it("returns null for missing or effectively empty input", () => {
    expect(cleanFragment(undefined)).toBeNull();
    expect(cleanFragment("")).toBeNull();
    expect(cleanFragment("   ")).toBeNull();
    // Control characters only → spaces only → trimmed away → null.
    expect(cleanFragment(NUL + TAB + NL + DEL)).toBeNull();
  });

  it("replaces control characters with spaces and collapses whitespace", () => {
    expect(cleanFragment("a" + NUL + "b" + NL + NL + "c" + DEL + "d")).toBe("a b c d");
    expect(cleanFragment("  hello   world  ")).toBe("hello world");
  });

  it("caps at maxLength with a … suffix, default 120", () => {
    expect(cleanFragment("x".repeat(121))).toBe("x".repeat(120) + "…");
    expect(cleanFragment("x".repeat(120))).toBe("x".repeat(120));
    expect(cleanFragment("abcdef", 3)).toBe("abc…");
    expect(cleanFragment("abc", 3)).toBe("abc");
  });
});

describe("stripControlChars (always-string contract)", () => {
  it("substitutes one space per control character and nothing else", () => {
    expect(stripControlChars("a" + NUL + "b")).toBe("a b");
    expect(stripControlChars(TAB + "x" + DEL)).toBe(" x ");
    // No collapsing, no trimming — that composition belongs to callers.
    expect(stripControlChars(NL + NL)).toBe("  ");
    expect(stripControlChars(US)).toBe(" ");
  });

  it("returns ordinary text unchanged, including the empty string", () => {
    expect(stripControlChars("")).toBe("");
    expect(stripControlChars("hello world!")).toBe("hello world!");
    // Non-ASCII and astral code points pass through untouched.
    expect(stripControlChars("suhu 27°C — cerah 🌱")).toBe("suhu 27°C — cerah 🌱");
  });
});
