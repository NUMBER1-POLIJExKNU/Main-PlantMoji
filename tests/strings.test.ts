import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Contract test for the central UI string table (dopamine plan, Task 4;
// locale-aware since the Bahasa Indonesia pass). public/farm/strings.js is a
// plain browser script that assigns window.PM_STRINGS — already resolved to
// ONE locale — so we read it off disk and execute it against stub window
// objects, exactly what a <script> tag does, no DOM required.
//
// The script is executed once per locale: EN forced through the cookie path,
// ID forced through the localStorage path, so both detection reads are
// exercised. The full key contract is then asserted for BOTH trees.

const here = path.dirname(fileURLToPath(import.meta.url));
const stringsPath = path.resolve(here, "../public/farm/strings.js");
const source = readFileSync(stringsPath, "utf8");

type StringTable = {
  moods: Record<string, unknown>;
  moodEmoji: Record<string, unknown>;
  reasons: Record<string, unknown>;
  ritual: { water?: unknown; fertilize?: unknown };
  streakKeeper: { active?: unknown; broken?: unknown; flame?: unknown };
  luckyOdds: unknown;
  petting: unknown;
  pettingYawn: unknown;
  vitals: Record<string, unknown>;
  echo: Record<string, unknown>;
  verifying: Record<string, unknown>;
  fx: Record<string, unknown>;
  demoTag: unknown;
};

type StubWindow = {
  PM_STRINGS?: StringTable;
  document?: { cookie: string };
  localStorage?: { getItem(key: string): string | null };
};

/** localStorage stub holding a single plantmoji_locale value (or nothing). */
function storageWith(value: string | null): NonNullable<StubWindow["localStorage"]> {
  return { getItem: (key) => (key === "plantmoji_locale" ? value : null) };
}

function loadStrings(stubWindow: StubWindow = {}): StringTable {
  // Executing our own checked-in plain script against a stub window is the
  // point of this test — it mirrors what a browser <script> tag does.
  new Function("window", source)(stubWindow);
  if (!stubWindow.PM_STRINGS) {
    throw new Error("strings.js did not assign window.PM_STRINGS");
  }
  return stubWindow.PM_STRINGS;
}

const EN = loadStrings({
  document: { cookie: "pm_sound=1; plantmoji_locale=en" },
  localStorage: storageWith(null),
});
const ID = loadStrings({
  document: { cookie: "" },
  localStorage: storageWith("id"),
});

/** Non-empty Latin-script copy with no Hangul / CJK / kana characters —
 *  holds for English AND Bahasa Indonesia. Emoji are allowed alongside. */
function expectLatinCopy(value: unknown, label: string) {
  expect(typeof value, `${label} should be a string`).toBe("string");
  const text = value as string;
  expect(text.trim().length, `${label} should be non-empty`).toBeGreaterThan(0);
  expect(text, `${label} should contain Latin letters`).toMatch(/[A-Za-z]/);
  expect(text, `${label} should contain no Korean/CJK/kana`).not.toMatch(
    // Hangul Jamo, kana, Hangul compat Jamo, CJK ideographs, Hangul syllables
    /[ᄀ-ᇿ぀-ヿ㄰-㆏一-鿿가-힯]/,
  );
}

const MOOD_KEYS = ["Happy", "Overheating", "DryAir", "Sleepy", "SoilAcidic", "SoilAlkaline"];
const REASON_KEYS = ["quest", "lucky", "badge", "chapter", "streak", "mood", "daily", "growth"];
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

// The honesty sentence must end both ritual lines, with its exact meaning
// preserved per locale (spec §4: taps never grant XP; real care does).
const HONESTY_ENDING = {
  en: "Real care = real XP. The sensors will notice.",
  id: "Perawatan nyata = XP nyata. Sensor akan tahu.",
} as const;

describe("locale detection", () => {
  it("pure stub (no document, no localStorage) falls back to English", () => {
    const S = loadStrings({});
    expect(S.moods.Happy).toBe("Happy");
    expect(S.ritual.water).toBe(EN.ritual.water);
  });

  it("readable-but-empty storage defaults to Bahasa Indonesia (farm-page default)", () => {
    const S = loadStrings({ document: { cookie: "" }, localStorage: storageWith(null) });
    expect(S.moods.Happy).toBe(ID.moods.Happy);
    expect(S.ritual.water).toBe(ID.ritual.water);
  });

  it("cookie wins over localStorage (mirrors live.js initialLocale)", () => {
    const S = loadStrings({
      document: { cookie: "plantmoji_locale=en" },
      localStorage: storageWith("id"),
    });
    expect(S.moods.Happy).toBe("Happy");
  });
});

for (const [locale, S] of [
  ["en", EN],
  ["id", ID],
] as const) {
  describe(`PM_STRINGS contract [${locale}]`, () => {
    it("covers all six mood states with non-empty words", () => {
      for (const key of MOOD_KEYS) expectLatinCopy(S.moods[key], `moods.${key}`);
    });

    it("pairs every mood state with an emoji", () => {
      for (const key of MOOD_KEYS) {
        const emoji = S.moodEmoji[key];
        expect(typeof emoji, `moodEmoji.${key} should be a string`).toBe("string");
        expect((emoji as string).length, `moodEmoji.${key} should be non-empty`).toBeGreaterThan(0);
      }
    });

    it("covers all eight reward reasons", () => {
      for (const key of REASON_KEYS) expectLatinCopy(S.reasons[key], `reasons.${key}`);
    });

    it("both ritual lines end with the exact honesty sentence", () => {
      for (const key of ["water", "fertilize"] as const) {
        expectLatinCopy(S.ritual[key], `ritual.${key}`);
        expect(
          (S.ritual[key] as string).endsWith(HONESTY_ENDING[locale]),
          `ritual.${key} should end with the ${locale} honesty sentence`,
        ).toBe(true);
      }
    });

    it("has at least five rotating petting lines plus a yawn", () => {
      expect(Array.isArray(S.petting), "petting should be an array").toBe(true);
      const lines = S.petting as unknown[];
      expect(lines.length).toBeGreaterThanOrEqual(5);
      lines.forEach((line, i) => expectLatinCopy(line, `petting[${i}]`));
      expectLatinCopy(S.pettingYawn, "pettingYawn");
    });

    it("streakKeeper active/broken/flame carry the day count warmly", () => {
      const { active, broken, flame } = S.streakKeeper;
      if (typeof active === "function") {
        const line = active(3) as string;
        expectLatinCopy(line, "streakKeeper.active(3)");
        expect(line).toContain("3");
      } else {
        expectLatinCopy(active, "streakKeeper.active");
        expect(active as string).toContain("{days}");
      }
      expectLatinCopy(broken, "streakKeeper.broken");
      if (typeof flame === "function") {
        const line = flame(3) as string;
        expectLatinCopy(line, "streakKeeper.flame(3)");
        expect(line).toContain("3");
        expect(line).toContain("4"); // "care today makes N+1"
      } else {
        expectLatinCopy(flame, "streakKeeper.flame");
        expect(flame as string).toContain("{days}");
      }
    });

    it("covers all eight threshold-true vital comments", () => {
      for (const key of VITAL_KEYS) expectLatinCopy(S.vitals[key], `vitals.${key}`);
    });

    it("provides every causal-echo chip", () => {
      const humidityUp = S.echo.humidityUp;
      const line = typeof humidityUp === "function" ? (humidityUp(8) as string) : humidityUp;
      expectLatinCopy(line, "echo.humidityUp(8)");
      expect(line).toContain("8");
      for (const key of ["tempComfy", "lightOn", "verifying"]) {
        expectLatinCopy(S.echo[key], `echo.${key}`);
      }
    });

    it("provides the verifying-shimmer label", () => {
      expectLatinCopy(S.verifying.checking, "verifying.checking");
    });

    it("provides every celebration string live.js consumes", () => {
      expectLatinCopy(S.fx.levelUpTitle, "fx.levelUpTitle");
      expectLatinCopy(S.fx.questComplete, "fx.questComplete");
      for (const key of ["levelUpSub", "xpGain", "streakUp"]) {
        const raw = S.fx[key];
        const value = typeof raw === "function" ? raw(3) : raw;
        expectLatinCopy(value, `fx.${key}`);
      }
    });

    it("discloses lucky odds and carries the DEMO tag", () => {
      expectLatinCopy(S.luckyOdds, "luckyOdds");
      expect(S.demoTag).toBe("DEMO");
    });
  });
}

describe("English tree exact copy", () => {
  it("discloses the exact lucky odds line", () => {
    expect(EN.luckyOdds).toBe("1 in 8 quests sprouts a lucky bonus!");
  });
});

describe("Bahasa Indonesia tree is a real translation", () => {
  it("every mood word differs from English", () => {
    for (const key of MOOD_KEYS) {
      expect(ID.moods[key], `moods.${key} should be translated`).not.toBe(EN.moods[key]);
    }
  });

  it("mood emoji are identical across locales", () => {
    for (const key of MOOD_KEYS) {
      expect(ID.moodEmoji[key], `moodEmoji.${key} should not change`).toBe(EN.moodEmoji[key]);
    }
  });

  it("both ritual lines differ from English", () => {
    expect(ID.ritual.water).not.toBe(EN.ritual.water);
    expect(ID.ritual.fertilize).not.toBe(EN.ritual.fertilize);
  });

  it("id luckyOdds matches the /collection disclosure wording", () => {
    expect(ID.luckyOdds).toBe("1 dari 8 misi menumbuhkan bonus keberuntungan!");
  });
});
