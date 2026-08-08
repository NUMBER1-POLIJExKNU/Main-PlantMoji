import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Contract test for the central UI string table (dopamine plan, Task 4).
// public/farm/strings.js is a plain browser script that assigns
// window.PM_STRINGS, so we read it off disk and execute it against a stub
// window object — exactly what a <script> tag does, no DOM required.

const here = path.dirname(fileURLToPath(import.meta.url));
const stringsPath = path.resolve(here, "../public/farm/strings.js");

type StringTable = {
  moods: Record<string, unknown>;
  moodEmoji: Record<string, unknown>;
  reasons: Record<string, unknown>;
  ritual: { water?: unknown; fertilize?: unknown };
  streakKeeper: { active?: unknown; broken?: unknown };
  luckyOdds: unknown;
  petting: unknown;
  pettingYawn: unknown;
  vitals: Record<string, unknown>;
  fx: Record<string, unknown>;
  demoTag: unknown;
};

function loadStrings(): StringTable {
  const source = readFileSync(stringsPath, "utf8");
  const stubWindow: { PM_STRINGS?: StringTable } = {};
  // Executing our own checked-in plain script against a stub window is the
  // point of this test — it mirrors what a browser <script> tag does.
  new Function("window", source)(stubWindow);
  if (!stubWindow.PM_STRINGS) {
    throw new Error("strings.js did not assign window.PM_STRINGS");
  }
  return stubWindow.PM_STRINGS;
}

const S = loadStrings();

/** Non-empty English copy (spec D7): contains Latin letters and no
 *  Hangul / CJK / kana characters. Emoji are allowed alongside. */
function expectEnglish(value: unknown, label: string) {
  expect(typeof value, `${label} should be a string`).toBe("string");
  const text = value as string;
  expect(text.trim().length, `${label} should be non-empty`).toBeGreaterThan(0);
  expect(text, `${label} should contain English letters`).toMatch(/[A-Za-z]/);
  expect(text, `${label} should contain no Korean/CJK/kana`).not.toMatch(
    // Hangul Jamo, kana, Hangul compat Jamo, CJK ideographs, Hangul syllables
    /[ᄀ-ᇿ぀-ヿ㄰-㆏一-鿿가-힯]/,
  );
}

const MOOD_KEYS = ["Happy", "Overheating", "DryAir", "Sleepy", "SoilAcidic", "SoilAlkaline"];

describe("PM_STRINGS.moods", () => {
  it("covers all six mood states with non-empty English words", () => {
    for (const key of MOOD_KEYS) expectEnglish(S.moods[key], `moods.${key}`);
  });

  it("pairs every mood state with an emoji", () => {
    for (const key of MOOD_KEYS) {
      const emoji = S.moodEmoji[key];
      expect(typeof emoji, `moodEmoji.${key} should be a string`).toBe("string");
      expect((emoji as string).length, `moodEmoji.${key} should be non-empty`).toBeGreaterThan(0);
    }
  });
});

describe("PM_STRINGS.reasons", () => {
  it("covers all eight reward reasons with non-empty English labels", () => {
    const REASON_KEYS = ["quest", "lucky", "badge", "chapter", "streak", "mood", "daily", "growth"];
    for (const key of REASON_KEYS) expectEnglish(S.reasons[key], `reasons.${key}`);
  });
});

describe("PM_STRINGS.ritual", () => {
  const SENSORS_SENTENCE = "Real care = real XP. The sensors will notice.";

  it("water copy ends with the exact honesty sentence", () => {
    expectEnglish(S.ritual.water, "ritual.water");
    expect((S.ritual.water as string).endsWith(SENSORS_SENTENCE)).toBe(true);
  });

  it("fertilize copy ends with the exact honesty sentence", () => {
    expectEnglish(S.ritual.fertilize, "ritual.fertilize");
    expect((S.ritual.fertilize as string).endsWith(SENSORS_SENTENCE)).toBe(true);
  });
});

describe("PM_STRINGS.petting", () => {
  it("has at least five rotating English lines", () => {
    expect(Array.isArray(S.petting), "petting should be an array").toBe(true);
    const lines = S.petting as unknown[];
    expect(lines.length).toBeGreaterThanOrEqual(5);
    lines.forEach((line, i) => expectEnglish(line, `petting[${i}]`));
  });

  it("has a single satiation yawn line", () => {
    expectEnglish(S.pettingYawn, "pettingYawn");
  });
});

describe("PM_STRINGS.streakKeeper", () => {
  it("active accepts a day count (function or {days} template)", () => {
    const active = S.streakKeeper.active;
    if (typeof active === "function") {
      const line = active(3);
      expectEnglish(line, "streakKeeper.active(3)");
      expect(line).toContain("3");
    } else {
      expectEnglish(active, "streakKeeper.active");
      expect(active as string).toContain("{days}");
    }
  });

  it("broken-streak copy is a warm English restart line", () => {
    expectEnglish(S.streakKeeper.broken, "streakKeeper.broken");
  });
});

describe("PM_STRINGS.vitals", () => {
  it("covers all eight threshold-true comments", () => {
    const VITAL_KEYS = [
      "tempHot",
      "tempGood",
      "humDry",
      "humGood",
      "lightDark",
      "lightGood",
      "phGood",
      "phOff",
    ];
    for (const key of VITAL_KEYS) expectEnglish(S.vitals[key], `vitals.${key}`);
  });
});

describe("PM_STRINGS.fx", () => {
  it("provides every celebration string live.js consumes", () => {
    expectEnglish(S.fx.levelUpTitle, "fx.levelUpTitle");
    expectEnglish(S.fx.questComplete, "fx.questComplete");
    for (const key of ["levelUpSub", "xpGain", "streakUp"]) {
      const raw = S.fx[key];
      const value = typeof raw === "function" ? raw(3) : raw;
      expectEnglish(value, `fx.${key}`);
    }
  });
});

describe("PM_STRINGS honest-disclosure copy", () => {
  it("discloses the exact lucky odds line", () => {
    expect(S.luckyOdds).toBe("1 in 8 quests sprouts a lucky bonus!");
  });

  it("carries the DEMO tag for offline/presenter mode", () => {
    expect(S.demoTag).toBe("DEMO");
  });
});
