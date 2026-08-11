import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clear, markSeen, reset, seen } from "@/lib/seen";

// Cross-task contract pinned by Tasks 2/3 of
// docs/superpowers/plans/2026-08-11-kid-guide-dare-coach.md:
//   - src/lib/seen.ts: the shared pm_seen_v3 store (key name, blob shape,
//     legacy-flag migration, SSR/private-mode safety).
//   - src/components/coach-mark.tsx: the reusable dim+spotlight+emoji+one
//     -sentence coach host (final card is always an action dare; completing
//     it marks `id` seen and nothing else — zero reward writes).
// Real behavior for seen.ts (imported and exercised against a stubbed
// localStorage, vitest's "node" environment gives us a real ReferenceError
// for the "no localStorage at all" / SSR case for free). Source-text pinning
// for coach-mark.tsx, matching the rest of this suite's style for React
// components (no jsdom/RTL wired up — see tests/app-guide.test.ts).

const SEEN_KEY = "pm_seen_v3";

function makeLocalStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("src/lib/seen.ts — shared pm_seen_v3 store", () => {
  it("stores under the exact key name, as {v:3,seen:{<id>:1}}", () => {
    const storage = makeLocalStorage();
    vi.stubGlobal("localStorage", storage);
    markSeen("hatch");
    const raw = storage.getItem(SEEN_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed).toEqual({ v: 3, seen: { hatch: 1 } });
  });

  it("seen()/markSeen()/clear() round-trip a single id without disturbing others", () => {
    vi.stubGlobal("localStorage", makeLocalStorage());
    expect(seen("guide.home")).toBe(false);
    markSeen("guide.home");
    markSeen("tour");
    expect(seen("guide.home")).toBe(true);
    expect(seen("tour")).toBe(true);
    clear("guide.home");
    expect(seen("guide.home")).toBe(false);
    expect(seen("tour")).toBe(true); // untouched by clearing a different id
  });

  it("reset() wipes every id back to unseen", () => {
    vi.stubGlobal("localStorage", makeLocalStorage());
    markSeen("hatch");
    markSeen("tour");
    reset();
    expect(seen("hatch")).toBe(false);
    expect(seen("tour")).toBe(false);
  });

  it("migrates every legacy flag on first read, mapped to the documented ids", () => {
    const storage = makeLocalStorage({
      pm_hatched: "1",
      pm_tour_seen_v1: "1",
      plantmoji_guide_seen_v1: "1",
      plantmoji_guide_seen_v2: "1",
    });
    vi.stubGlobal("localStorage", storage);
    expect(seen("hatch")).toBe(true);
    expect(seen("tour")).toBe(true);
    expect(seen("guide.farm")).toBe(true);
    expect(seen("guide.home")).toBe(true);
    // Legacy keys are left in place, not deleted.
    expect(storage.getItem("pm_hatched")).toBe("1");
    expect(storage.getItem("plantmoji_guide_seen_v2")).toBe("1");
  });

  it("only migrates ids whose legacy flag was actually set", () => {
    vi.stubGlobal("localStorage", makeLocalStorage({ pm_hatched: "1" }));
    expect(seen("hatch")).toBe(true);
    expect(seen("tour")).toBe(false);
    expect(seen("guide.farm")).toBe(false);
    expect(seen("guide.home")).toBe(false);
  });

  it("never re-reads legacy keys once pm_seen_v3 exists (migrates once)", () => {
    const storage = makeLocalStorage({ pm_hatched: "1" });
    vi.stubGlobal("localStorage", storage);
    expect(seen("hatch")).toBe(true); // triggers the one-time migration
    // A legacy flag disappearing afterward must not un-migrate the id: if
    // the legacy key were still being read on every call, this would flip
    // seen("hatch") back to false.
    storage.removeItem("pm_hatched");
    expect(seen("hatch")).toBe(true);
  });

  it("is SSR-safe: every read returns false, every write no-ops, nothing throws", () => {
    // No localStorage stubbed at all — vitest's node environment has no
    // such global, matching an actual server render.
    expect(() => {
      expect(seen("hatch")).toBe(false);
      expect(seen("guide.home")).toBe(false);
      markSeen("hatch");
      clear("hatch");
      reset();
    }).not.toThrow();
  });

  it("is private-mode-safe: a throwing setItem still leaves seen() honest and never throws", () => {
    const storage = makeLocalStorage();
    const throwingStorage: Storage = {
      ...storage,
      setItem: () => { throw new DOMException("QuotaExceededError"); },
    };
    vi.stubGlobal("localStorage", throwingStorage);
    expect(() => markSeen("hatch")).not.toThrow();
    expect(seen("hatch")).toBe(false); // the write silently failed
  });
});

describe("src/components/coach-mark.tsx — shared coach contract", () => {
  const coach = readFileSync("src/components/coach-mark.tsx", "utf8");

  it("is a client component built on the seen.ts store, not a private flag", () => {
    expect(coach).toContain('"use client"');
    expect(coach).toContain('from "@/lib/seen"');
    expect(coach).not.toMatch(/localStorage\.(get|set)Item/);
  });

  it("renders dim + spotlight + one emoji + one sentence per card, never a wall of text", () => {
    expect(coach).toContain("pm-tutorial-shade");
    expect(coach).toContain("pm-tutorial-spotlight");
    expect(coach).toContain("pm-tutorial-icon");
    expect(coach).toContain("card.emoji");
    // Exactly one paragraph element carries the sentence body — no second
    // prose block that would turn a card into a wall of text.
    expect(coach.match(/<p[ >]/g)?.length).toBe(1);
  });

  it("always renders the final card as an action dare, and only completing it marks the id seen", () => {
    expect(coach).toContain("isLast");
    expect(coach).toMatch(/isLast\s*\?\s*FALLBACK_LABEL\.done/);
    // The primary button's label always falls back to the dare, never a
    // read-only "Close"/"Done" wording baked in as the only option.
    expect(coach).toContain("card.dare?.label");
    // markSeen only ever fires through the `markAsSeen` branch of close(),
    // and advance() only passes `true` (marks seen) once index === isLast.
    expect(coach).toMatch(/if \(markAsSeen\) markSeen\(id\)/);
    expect(coach).toMatch(/if \(!isLast\)[\s\S]{0,80}return;[\s\S]{0,40}closeRef\.current\(true\)/);
  });

  it("Later and Escape close without marking seen; only the dare and Skip do", () => {
    expect(coach).toMatch(/const later = \(\) => closeRef\.current\(false\)/);
    expect(coach).toMatch(/closeRef\.current\(false\);[\s\S]{0,20}return;/); // Escape handler
    expect(coach).toMatch(/const skip = \(\) => closeRef\.current\(true\)/);
  });

  it("makes zero reward writes: no XP/seeds/quest/FX/network calls anywhere in the file", () => {
    expect(coach).not.toMatch(/fetch\s*\(/);
    expect(coach).not.toMatch(/supabase/i);
    // Code-shaped patterns (calls, property/variable access) rather than
    // bare prose words — this file's own doc comments legitimately discuss
    // "no XP" / "no seeds" in the negative, which bare-word matching would
    // wrongly flag.
    expect(coach).not.toMatch(/fxEnqueue\s*\(|orbCascade\s*\(|fxXpGain\s*\(|spawnConfetti\s*\(/);
    expect(coach).not.toMatch(/total_xp|\.seeds\b|\bseeds\s*[+\-]?=|\bxp\s*[+\-]?=/i);
  });

  it("keeps focus/escape handling and prefers-reduced-motion patterns", () => {
    expect(coach).toContain("keepFocusInside");
    expect(coach).toContain('event.key === "Escape"');
    expect(coach).toContain("scrollIntoView");
    expect(coach).toContain("prefers-reduced-motion: reduce");
    expect(coach).toContain("returnFocusTo?.focus()");
  });
});
