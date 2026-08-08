import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Guards against en/id key-set drift in the central UI string table while
// multiple agents may be editing public/farm/strings.js in parallel. A
// mismatch here means an Indonesian student would silently see an English
// fallback (or `undefined`) for some UI string. This test never edits
// strings.js itself — it only reads and reports.

const here = path.dirname(fileURLToPath(import.meta.url));
const stringsPath = path.resolve(here, "../public/farm/strings.js");
const source = readFileSync(stringsPath, "utf8");

type StubWindow = {
  PM_STRINGS?: unknown;
  document?: { cookie: string };
  localStorage?: { getItem(key: string): string | null };
};

/** localStorage stub holding a single plantmoji_locale value (or nothing). */
function storageWith(value: string | null): NonNullable<StubWindow["localStorage"]> {
  return { getItem: (key) => (key === "plantmoji_locale" ? value : null) };
}

/**
 * Runs strings.js in a node:vm sandbox whose ONLY global is `window`. Reading
 * the file confirms detectLocale() touches exactly three things:
 * window.document.cookie, window.localStorage.getItem(...), and the
 * window.PM_STRINGS assignment itself — both wrapped in try/catch inside the
 * script, so even a `window` with no document/localStorage cannot throw.
 * That single stub is therefore enough to guarantee evaluation succeeds.
 *
 * The IIFE only ever exposes the ONE locale picked by detectLocale() as
 * window.PM_STRINGS — the full two-locale STRINGS object stays private to
 * the closure. To recover both full trees we run the (side-effect-free)
 * script twice: once with stubs that force the cookie path to "en", once
 * forcing the localStorage path to "id" — mirroring live.js's
 * initialLocale() precedence (cookie checked before localStorage).
 */
function loadStrings(stubWindow: StubWindow): Record<string, unknown> {
  const context = vm.createContext({ window: stubWindow });
  vm.runInContext(source, context, { filename: stringsPath });
  if (!stubWindow.PM_STRINGS) {
    throw new Error("strings.js did not assign window.PM_STRINGS");
  }
  return stubWindow.PM_STRINGS as Record<string, unknown>;
}

const EN = loadStrings({
  document: { cookie: "plantmoji_locale=en" },
  localStorage: storageWith(null),
});

const ID = loadStrings({
  document: { cookie: "" },
  localStorage: storageWith("id"),
});

// ---- Structural walk -------------------------------------------------
//
// Every leaf in the STRINGS tree is one of:
//   - a plain string                          e.g. moods.Happy
//   - an array of prose-variant strings        currently only `petting`
//   - a template function returning a string   e.g. streakKeeper.active(d)
// Everything else (moods, care, hatch.sensors, ...) is pure structure and
// is walked recursively, never treated as a leaf.

type LeafValue = string | unknown[] | ((...args: unknown[]) => unknown);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Recursively collects `dotted.path -> leaf value` for every leaf in `node`. */
function collectLeaves(node: unknown, prefix: string, out: Map<string, LeafValue>): void {
  if (isPlainObject(node)) {
    for (const key of Object.keys(node)) {
      collectLeaves(node[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.set(prefix, node as LeafValue);
}

const enLeaves = new Map<string, LeafValue>();
const idLeaves = new Map<string, LeafValue>();
collectLeaves(EN, "", enLeaves);
collectLeaves(ID, "", idLeaves);

// public/farm/live.js petMascot() indexes the petting array with
// `lines[petLineIndex % lines.length]` — a modulo CYCLE, not a positional
// lookup by index — so en and id are free to carry a different NUMBER of
// petting lines without breaking anything. Every other array-shaped leaf
// (there are none today besides `petting`) would need positional parity;
// this set is what makes that distinction explicit and future-proof.
const LENGTH_EXEMPT_PATHS = new Set(["petting"]);

/** Resolves a leaf to the string(s) it actually renders, for content checks. */
function resolveToStrings(value: LeafValue, path: string): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "function") {
    // Every template leaf in strings.js takes exactly one interpolated
    // value (a day count, level, delta, or name). A bare number safely
    // stands in for both numeric and string interpolation without
    // throwing, e.g. `${d + 1}` or `${name}`.
    const result = (value as (arg: unknown) => unknown)(1);
    if (typeof result !== "string") {
      throw new Error(`${path} template function did not return a string (got ${typeof result})`);
    }
    return [result];
  }
  throw new Error(`${path} is neither a string, array, nor function (got ${typeof value})`);
}

describe("strings.js locale parity (en vs id)", () => {
  it("loaded a non-trivial tree for both locales", () => {
    expect(enLeaves.size, "en tree should not be empty").toBeGreaterThan(0);
    expect(idLeaves.size, "id tree should not be empty").toBeGreaterThan(0);
  });

  it("every key path in en exists in id, and vice versa", () => {
    const enPaths = new Set(enLeaves.keys());
    const idPaths = new Set(idLeaves.keys());

    const missingInId = [...enPaths].filter((p) => !idPaths.has(p)).sort();
    const missingInEn = [...idPaths].filter((p) => !enPaths.has(p)).sort();

    const message = [
      missingInId.length > 0 ? `Present in en, MISSING in id:\n  ${missingInId.join("\n  ")}` : null,
      missingInEn.length > 0 ? `Present in id, MISSING in en:\n  ${missingInEn.join("\n  ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    expect(missingInId, message).toEqual([]);
    expect(missingInEn, message).toEqual([]);
  });

  it("shared leaves agree on shape (string vs array vs function) between locales", () => {
    const mismatches: string[] = [];
    for (const [leafPath, enValue] of enLeaves) {
      const idValue = idLeaves.get(leafPath);
      if (idValue === undefined) continue; // already reported by the key-parity test above
      const enKind = Array.isArray(enValue) ? "array" : typeof enValue;
      const idKind = Array.isArray(idValue) ? "array" : typeof idValue;
      if (enKind !== idKind) {
        mismatches.push(`${leafPath}: en is ${enKind}, id is ${idKind}`);
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  it("positional (non-exempt) arrays match length across locales", () => {
    const mismatches: string[] = [];
    for (const [leafPath, enValue] of enLeaves) {
      if (!Array.isArray(enValue) || LENGTH_EXEMPT_PATHS.has(leafPath)) continue;
      const idValue = idLeaves.get(leafPath);
      if (!Array.isArray(idValue)) continue; // already reported by the shape test above
      if (idValue.length !== enValue.length) {
        mismatches.push(`${leafPath}: en has ${enValue.length} entries, id has ${idValue.length}`);
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  it("every leaf resolves to a non-empty string (or array of non-empty strings)", () => {
    const problems: string[] = [];
    for (const [locale, leaves] of [
      ["en", enLeaves],
      ["id", idLeaves],
    ] as const) {
      for (const [leafPath, value] of leaves) {
        let strings: string[];
        try {
          strings = resolveToStrings(value, leafPath);
        } catch (err) {
          problems.push(`[${locale}] ${(err as Error).message}`);
          continue;
        }
        if (strings.length === 0) {
          problems.push(`[${locale}] ${leafPath} is an empty array`);
          continue;
        }
        strings.forEach((s, i) => {
          const entryLabel = Array.isArray(value) ? `${leafPath}[${i}]` : leafPath;
          if (typeof s !== "string" || s.trim().length === 0) {
            problems.push(`[${locale}] ${entryLabel} is empty or not a string`);
          }
        });
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
