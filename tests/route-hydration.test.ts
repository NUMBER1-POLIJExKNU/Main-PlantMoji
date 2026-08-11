import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guard for the outage that made every React route non-interactive in
// production: on Next 16.3.0, a route whose segment actually streams never
// completes the Suspense boundary a `loading.tsx` creates. The skeleton stays,
// the real content sits in a hidden div, and neither tree hydrates — so clicks
// do nothing on Settings, Quests, Collection, Monitoring, everywhere.
//
// It was invisible locally because the pages return early without Supabase
// env, so the boundary never goes pending. Reproduced on a bare route with a
// plain-markup fallback under both Turbopack and webpack; removing the
// loading.tsx fixed it every time.
//
// If someone re-adds one, they must first confirm the boundary completes on a
// SLOW route in a production build — not just that it looks right locally.

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe("route hydration", () => {
  it("ships no loading.tsx while the streaming boundary bug is unfixed", () => {
    const offenders = walk("src/app")
      .filter((file) => file.endsWith(`${"loading"}.tsx`))
      .map((file) => file.replace(/\\/g, "/"));
    expect(offenders).toEqual([]);
  });

  it("keeps the parked skeleton synchronous, since a fallback may not suspend", () => {
    // Whenever it does come back, this is the other half of the fix: awaiting
    // the request locale made the fallback itself suspend.
    const source = readFileSync("src/components/pixel-loading.tsx", "utf8");
    // Strip comments first — the note above the component says the word
    // "await" while explaining why there must not be one.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain("export default function PixelLoading");
    expect(code).not.toContain("async function PixelLoading");
    expect(code).not.toMatch(/\bawait\b/);
    expect(source).toContain("PARKED");
  });

  it("localises the parked skeleton through html[lang] instead of a server read", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain('html[lang="id"] .pm-i18n-id { display: inline; }');
    const toy = readFileSync("src/components/pixel-loading-toy.tsx", "utf8");
    // Accessible name comes from hidden-per-locale content, not an awaited prop.
    expect(toy).not.toContain("aria-label={label}");
    expect(toy).toContain('<span className="pm-i18n-en">Tap Jamkachu</span>');
  });
});
