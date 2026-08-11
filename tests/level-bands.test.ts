import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEVEL_BANDS, bandForLevel, bandLastLevel, nextBand, xpForLevel } from "@/game/progression/level-bands";
import { MAX_BOND_LEVEL, MAX_BOND_XP, XP_PER_LEVEL, isMaxBondLevel, levelForXp } from "@/types/game";
import { SPRITE_MOODS, spriteSrc } from "@/lib/jamkachu-sprite";
import type { PlantMood } from "@/types/events";

const farmSprite = readFileSync(resolve(process.cwd(), "public/farm/jamkachu-sprite.js"), "utf8");
const farmLive = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const sql = readFileSync(resolve(process.cwd(), "supabase/milestone21-level-cap.sql"), "utf8");

describe("bond level cap", () => {
  it("stops the level at the cap however much XP arrives", () => {
    expect(levelForXp(MAX_BOND_XP)).toBe(MAX_BOND_LEVEL);
    expect(levelForXp(MAX_BOND_XP + 1)).toBe(MAX_BOND_LEVEL);
    expect(levelForXp(MAX_BOND_XP * 10)).toBe(MAX_BOND_LEVEL);
    expect(isMaxBondLevel(MAX_BOND_LEVEL)).toBe(true);
    expect(isMaxBondLevel(MAX_BOND_LEVEL - 1)).toBe(false);
  });

  it("still counts every level below the cap, and survives junk", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(XP_PER_LEVEL - 1)).toBe(1);
    expect(levelForXp(XP_PER_LEVEL)).toBe(2);
    expect(levelForXp(-500)).toBe(1);
  });

  it("enforces the same cap in SQL, which is what actually writes the column", () => {
    // TypeScript is display. A client that never runs it must still not be
    // able to push bond_level past the cap.
    expect(sql).toContain(`least(${MAX_BOND_LEVEL},floor(greatest(0,total_xp+p_amount)/${XP_PER_LEVEL}.0)::int+1)`);
    // total_xp deliberately keeps climbing — the ledger, the weekly report and
    // the badge rules all read it.
    expect(sql).toContain("total_xp=greatest(0,total_xp+p_amount)");
    expect(sql).not.toMatch(/total_xp\s*=\s*least\(/);
    // Rows levelled under the old curve have to be re-derived once.
    expect(sql).toContain("update public.bond_state");
  });
});

describe("level bands", () => {
  it("starts at Lv.1, never goes backwards, and stays inside the cap", () => {
    expect(LEVEL_BANDS[0].from).toBe(1);
    for (let i = 1; i < LEVEL_BANDS.length; i += 1) {
      expect(LEVEL_BANDS[i].from).toBeGreaterThan(LEVEL_BANDS[i - 1].from);
      expect(LEVEL_BANDS[i].band).toBe(LEVEL_BANDS[i - 1].band + 1);
    }
    expect(LEVEL_BANDS[LEVEL_BANDS.length - 1].from).toBeLessThanOrEqual(MAX_BOND_LEVEL);
  });

  it("covers every level from 1 to the cap with exactly one band", () => {
    for (let level = 1; level <= MAX_BOND_LEVEL; level += 1) {
      const band = bandForLevel(level);
      expect(level).toBeGreaterThanOrEqual(band.from);
      expect(level).toBeLessThanOrEqual(bandLastLevel(band));
    }
  });

  it("clamps nonsense levels instead of throwing", () => {
    expect(bandForLevel(0).band).toBe(1);
    expect(bandForLevel(-9).band).toBe(1);
    expect(bandForLevel(Number.NaN).band).toBe(1);
    expect(bandForLevel(9999).band).toBe(LEVEL_BANDS.length);
    expect(nextBand(MAX_BOND_LEVEL)).toBeNull();
    expect(nextBand(1)?.atLevel).toBe(LEVEL_BANDS[1].from);
  });

  it("gives every band a look the designer actually drew", () => {
    // 35 shipped files = 20 bare + 10 bow (p3, p4) + 5 ribbon (p4). A band
    // asking for bow on p1 would point at a file that does not exist.
    for (const band of LEVEL_BANDS) {
      if (band.phase <= 2) expect(band.tier, `band ${band.band}`).toBe("");
      if (band.phase === 3) expect(band.tier === "" || band.tier === "bow", `band ${band.band}`).toBe(true);
    }
  });

  it("never repeats a look, so every band change is visible", () => {
    const looks = LEVEL_BANDS.map((band) => `${band.phase}/${band.tier}`);
    expect(new Set(looks).size).toBe(LEVEL_BANDS.length);
  });

  it("points at a sprite file that exists, for every band and every mood", () => {
    const MOOD_FOR_SPRITE: Record<string, PlantMood> = {
      happy: "Happy", overheat: "Overheating",
    };
    for (const band of LEVEL_BANDS) {
      for (const mood of SPRITE_MOODS) {
        const src = spriteSrc({ mood: MOOD_FOR_SPRITE[mood], bondLevel: band.from });
        expect(existsSync(resolve(process.cwd(), `public${src}`)), `${src} (band ${band.band})`).toBe(true);
      }
    }
  });

  it("lets the bond level alone decide the look", () => {
    // D2: one visible ladder. The companion stage still shows its own
    // "STAGE n/10" line but must not change the drawing, or two ladders can
    // disagree in front of a class.
    const low = spriteSrc({ mood: "Happy", bondLevel: 1, stage: "Legend" });
    const high = spriteSrc({ mood: "Happy", bondLevel: MAX_BOND_LEVEL, stage: "Seed" });
    expect(low).toContain("p1-seed");
    expect(high).toContain("p4-fruit-happy-ribbon");
  });

  it("keeps the farm shell's copy of the table identical", () => {
    // next.config.ts rewrites "/" to public/farm/index.html, which never runs
    // React — My Garden carries its own copy and can silently drift.
    expect(farmSprite).toContain(`var MAX_BOND_LEVEL = ${MAX_BOND_LEVEL};`);
    for (const band of LEVEL_BANDS) {
      expect(farmSprite, `farm mirror is missing band ${band.band}`).toContain(
        `{ band: ${band.band}, from: ${band.from}, phase: ${band.phase}, tier: "${band.tier}" }`,
      );
    }
    expect(farmSprite.match(/\{ band: \d+, from: \d+/g) ?? []).toHaveLength(LEVEL_BANDS.length);
    // And the level maths the shell uses for the XP bar and the cheat panel.
    expect(farmLive).toContain(`const XP_PER_LEVEL = ${XP_PER_LEVEL};`);
    expect(farmLive).toContain(`const MAX_BOND_LEVEL = ${MAX_BOND_LEVEL};`);
    // The presenter must not be able to step past the cap on stage.
    expect(farmLive).toContain("const next = Math.min(MAX_BOND_LEVEL, Math.max(1, cur + delta));");
  });

  it("shows MAX instead of a bar that can never fill again", () => {
    expect(farmLive).toContain("const atMax = Number(bond.bond_level) >= MAX_BOND_LEVEL;");
    expect(farmLive).toContain("setXpBar(atMax ? 100 :");
  });
});

describe("session pacing", () => {
  it("puts several band changes inside one class period", () => {
    // The design input: ~20-30 minutes of hands-on time is roughly 150-200 XP
    // (a few recovery quests at 20-30, the mood discoveries a student trips
    // while trying the care actions, maybe a badge). If that window does not
    // cross at least three bands the plant never visibly grows during the
    // lesson, which is the whole reason the ladder exists.
    const sessionLow = levelForXp(150);
    const sessionHigh = levelForXp(200);
    expect(bandForLevel(sessionLow).band).toBeGreaterThanOrEqual(3);
    expect(bandForLevel(sessionHigh).band).toBeGreaterThanOrEqual(4);
    // …and not so fast that the cap lands in a single sitting.
    expect(bandForLevel(sessionHigh).band).toBeLessThan(LEVEL_BANDS.length);
  });

  it("keeps the one-time XP pool from maxing the plant on its own", () => {
    // Badges 12x15 + chapters 6x25 + moods 8x5 + streak milestones 4x10.
    const fixedPool = 12 * 15 + 6 * 25 + 8 * 5 + 4 * 10;
    expect(fixedPool).toBe(410);
    expect(levelForXp(fixedPool)).toBeLessThan(MAX_BOND_LEVEL);
    // Quests have to be worth doing after the one-time content runs out.
    expect(xpForLevel(MAX_BOND_LEVEL)).toBeGreaterThan(fixedPool);
  });
});
