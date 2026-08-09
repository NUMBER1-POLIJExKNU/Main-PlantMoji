import { describe, expect, it } from "vitest";
import { FARM_SKIN_CATALOG, FARM_SKINS, normalizeFarmSkin, normalizeTheme, resolveTheme } from "@/lib/appearance";

describe("appearance preferences", () => {
  it("normalizes unknown values to safe defaults", () => {
    expect(normalizeTheme("unknown")).toBe("auto");
    expect(normalizeFarmSkin("unknown")).toBe("jember-farm");
  });

  it("resolves auto mode using the WIB day and night boundary", () => {
    expect(resolveTheme("auto", new Date("2026-08-08T10:59:00Z"))).toBe("day");
    expect(resolveTheme("auto", new Date("2026-08-08T11:00:00Z"))).toBe("night");
    expect(resolveTheme("auto", new Date("2026-08-08T23:00:00Z"))).toBe("day");
  });

  it("honors explicit modes regardless of time", () => {
    expect(resolveTheme("day", new Date("2026-08-08T15:00:00Z"))).toBe("day");
    expect(resolveTheme("night", new Date("2026-08-08T03:00:00Z"))).toBe("night");
  });

  it("exposes eight unique, localized farm skins", () => {
    expect(FARM_SKINS).toHaveLength(8);
    expect(new Set(FARM_SKINS).size).toBe(8);
    expect(FARM_SKIN_CATALOG.map((skin) => skin.key)).toEqual([...FARM_SKINS]);
    for (const skin of FARM_SKIN_CATALOG) {
      expect(skin.name.id.length).toBeGreaterThan(0);
      expect(skin.name.en.length).toBeGreaterThan(0);
      expect(skin.description.id.length).toBeGreaterThan(0);
      expect(skin.description.en.length).toBeGreaterThan(0);
      expect(normalizeFarmSkin(skin.key)).toBe(skin.key);
    }
  });
});
