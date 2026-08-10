// Shared Gemini generateContent text helpers.
//
// One home for the defensive response walk and the prompt-hygiene sanitizers
// that src/lib/ai.ts, src/lib/photo-comment.ts, and src/lib/pest-advisory.ts
// each used to carry a private copy of. PURE on purpose: no "server-only",
// no Supabase, no I/O — plain vitest must be able to import this file
// directly (same reasoning as src/lib/growth.ts's header). The caller
// decides server-only-ness; this module must never import src/lib/ai.ts
// (or any other server-only module) back.
//
// Two sanitizers, two contracts — deliberately NOT merged, callers depend
// on the different empty-case behavior:
//   - cleanFragment(value?, max) → string | null: null when the input is
//     missing or effectively empty (callers branch on the null), collapses
//     whitespace, and appends "…" when it truncates.
//   - stripControlChars(value)   → string: always returns a string, one
//     space substituted per control character, nothing else touched —
//     callers compose their own collapse/trim/cap on top.

/** Extracts the first non-empty text part from a Gemini generateContent
 *  response, tolerating any malformed shape by returning null. */
export function extractText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;
  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (typeof part === "object" && part !== null && typeof (part as { text?: unknown }).text === "string") {
      const text = (part as { text: string }).text.replace(/\s+/g, " ").trim();
      if (text) return text;
    }
  }
  return null;
}

/** Trims, strips control characters, and caps length so a stored string can
 *  never bloat or derail the prompt. Returns null when effectively empty. */
export function cleanFragment(value: string | undefined, maxLength = 120): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

/** Strips ASCII control characters, substituting one space each (character-
 *  code comparison, not a regex escape literal, so this source file never
 *  embeds raw control bytes). Unlike cleanFragment it always returns a
 *  string and performs no collapsing, trimming, or capping. */
export function stripControlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 32 || code === 127 ? " " : ch;
  }
  return out;
}
