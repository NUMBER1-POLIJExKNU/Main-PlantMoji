// Source-contract pins for the simplified Wisdom tab (Collection page).
// User complaint: the tab's UI was dense — too much competed for attention
// on every card at once, and internal engineering notes leaked into player
// copy. This file pins the "one clear thing per card, depth behind a tap"
// structure so a future edit can't quietly re-densify it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const collectionTabs = readFileSync("src/components/collection-tabs.tsx", "utf8");
const globalsCss = readFileSync("src/app/globals.css", "utf8");

// The wisdom tab is the last tab section in the file, so slicing from its
// marker to end-of-file isolates it from the Moods/Badges/Story sections
// that other agents own concurrently.
const wisdomStart = collectionTabs.indexOf('{tab === "wisdom" && (');
if (wisdomStart === -1) throw new Error("wisdom tab section not found in collection-tabs.tsx");
const wisdomSection = collectionTabs.slice(wisdomStart);

describe("Wisdom tab — simplified card face", () => {
  it("keeps the always-visible card face to one glance: an id/mastered badge, a single decorative metric glyph, the saying, and one action", () => {
    // Numbered badge doubles as the "collected" signal instead of a second
    // separate indicator.
    expect(wisdomSection).toContain(
      'wisdomMastered.has(entry.id) ? "✓" : String(index + 1).padStart(2, "0")',
    );
    expect(wisdomSection).toContain('is-mastered');
    // The jargon-heavy metric string ("air temperature (°C) + air humidity
    // (%)") no longer sits on the card face as readable text — it collapses
    // to one decorative glyph.
    expect(wisdomSection).toContain('wisdomMetricIcon(entry.metric)');
    expect(wisdomSection).toMatch(/pm-wisdom-metric" role="img" aria-hidden="true"/);
    expect(wisdomSection).not.toMatch(/pm-wisdom-metric">\s*📡\s*\{entry\.metric\}/);
    // Exactly one primary action on the face: the prediction challenge.
    expect(wisdomSection).toContain("🎯 {copy.challenge}");
  });

  it("moves the technical clue and the science translation behind the existing tap-to-expand, instead of always showing them inline", () => {
    const detailsStart = wisdomSection.indexOf("<details");
    const detailsEnd = wisdomSection.indexOf("</details>") + "</details>".length;
    expect(detailsStart).toBeGreaterThan(-1);
    const cardFace = wisdomSection.slice(0, detailsStart);
    const detailBlock = wisdomSection.slice(detailsStart, detailsEnd);

    // Card face: no always-visible clue box and no raw sensor example string.
    expect(cardFace).not.toContain("pm-wisdom-clue");
    expect(cardFace).not.toContain("{entry.example}");

    // Detail view: the clue box and the plain-language translation both live
    // here now — nothing was deleted, it just waits behind a tap (the WFK
    // "glanceable, not gone" rule).
    expect(detailBlock).toContain("pm-wisdom-clue");
    expect(detailBlock).toContain("{entry.example}");
    expect(detailBlock).toContain("{entry.translation}");
  });

  it("never renders the raw internal placeholder-source marker to players (no engineering vocabulary in player copy)", () => {
    // entry.source carries an internal integrity marker (handoff §43 /
    // "to be replaced" tracking) meant for engineers, not players — it must
    // never be interpolated directly into the DOM.
    expect(collectionTabs).not.toContain("{entry.source}");
    expect(wisdomSection).toContain("{copy.wisdomSource}");
  });

  it("gives the honest replacement caption exact en/id parity with no leaked engineering jargon", () => {
    const idMatch = collectionTabs.match(/wisdomSource:\s*"([^"]+)"/g);
    expect(idMatch).not.toBeNull();
    expect(idMatch!.length).toBe(2); // one per locale branch
    const values = idMatch!.map((entry) => entry.replace(/wisdomSource:\s*"/, "").replace(/"$/, ""));
    for (const value of values) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(value).not.toMatch(/handoff|§|TODO|milestone|Supabase/i);
    }
    // The two locale values must actually differ (real translation, not a
    // copy-paste placeholder).
    expect(values[0]).not.toBe(values[1]);
  });
});

describe("Wisdom tab — single shared progress meter", () => {
  it("reuses the file's existing ProgressCounter/.pm-bar and OneMorePill instead of a bespoke counter", () => {
    expect(wisdomSection).toContain(
      "<ProgressCounter value={wisdomMastered.size} total={wisdom.length} label={copy.learned} />",
    );
    expect(wisdomSection).toContain(
      "{wisdomMastered.size === wisdom.length - 1 && <OneMorePill label={copy.oneMore} />}",
    );
    // No second, wisdom-only progress widget in the shell CSS.
    expect(globalsCss).not.toContain(".pm-wisdom-progress");
    expect(globalsCss).not.toContain(".pm-wisdom-counter");
  });

  it("advances mastery only from a correct trial answer (client-side presentation, not an engine write)", () => {
    const trialButtonLine = wisdomSection.split("\n").find((line) => line.includes("setWisdomMastered")) ?? "";
    expect(trialButtonLine).toContain("if (correct) setWisdomMastered(");
    expect(trialButtonLine).toContain("prev.has(entry.id)");
    // Presentation-only signal: no Supabase/table write rides along.
    expect(trialButtonLine).not.toMatch(/supabase|\.from\(/i);
  });

  it("remembers the tally in this browser so a reload does not read as lost progress", () => {
    expect(collectionTabs).toContain('const WISDOM_MASTERED_STORAGE_KEY = "pm-wisdom-mastered";');
    expect(collectionTabs).toContain("function persistWisdomMastered");
    // Restored on mount, written on every new correct answer, and a storage
    // failure (private mode / quota) must never break the tab.
    expect(collectionTabs).toContain("localStorage.getItem(WISDOM_MASTERED_STORAGE_KEY)");
    expect(wisdomSection).toContain("persistWisdomMastered(next)");
    expect(collectionTabs).toMatch(/persistWisdomMastered[\s\S]{0,320}catch \{/);
  });
});

describe("Wisdom tab — accessibility and mobile", () => {
  it("gives every trial choice and the challenge button a >=44px tap target", () => {
    expect(wisdomSection).toMatch(/pm-btn pm-btn-primary mt-3 w-full min-h-11 cursor-pointer/);
    expect(wisdomSection).toMatch(/className="min-h-11 cursor-pointer rounded-xl border-2/);
  });

  it("gives the 'See the why' disclosure a >=44px tap target", () => {
    expect(globalsCss).toMatch(/\.pm-wisdom-details summary\{[^}]*min-height:44px/);
  });

  it("keeps the grid single-column under 640px so nothing overflows a 360-430px phone", () => {
    expect(globalsCss).toMatch(/@media\(max-width:640px\)\{\.pm-wisdom-grid\{grid-template-columns:1fr\}/);
  });

  it("keeps decorative glyphs aria-hidden with real text as the accessible signal", () => {
    expect(wisdomSection).toMatch(/pm-wisdom-hero-icon" aria-hidden="true"/);
    expect(wisdomSection).toMatch(/pm-wisdom-metric" role="img" aria-hidden="true"/);
  });
});
