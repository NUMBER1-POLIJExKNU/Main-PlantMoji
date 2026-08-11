import { describe, expect, it } from "vitest";
import { questLabel, questSubtitle, questTitle } from "@/game/quests/quest-labels";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { MOOD_COPY } from "@/lib/i18n";
import type { QuestKey } from "@/types/game";

const KEYS = Object.keys(QUEST_DEFINITIONS) as QuestKey[];
const LOCALES = ["en", "id"] as const;

describe("quest labels", () => {
  it("separates the two quests that share the Balance My Soil title", () => {
    for (const locale of LOCALES) {
      expect(questTitle("BALANCE_SOIL_ACIDIC", locale)).toBe(questTitle("BALANCE_SOIL_ALKALINE", locale));
      const acidic = questLabel("BALANCE_SOIL_ACIDIC", locale);
      const alkaline = questLabel("BALANCE_SOIL_ALKALINE", locale);
      expect(acidic).not.toBe(alkaline);
      expect(acidic).toContain(MOOD_COPY[locale].SoilAcidic);
      expect(alkaline).toContain(MOOD_COPY[locale].SoilAlkaline);
    }
  });

  it("stays quiet for every quest whose title already stands alone", () => {
    // "Cool Me Down · Too Hot" on every row would be noise. Only ambiguity
    // earns a subtitle.
    for (const locale of LOCALES) {
      for (const key of KEYS) {
        const shared = key === "BALANCE_SOIL_ACIDIC" || key === "BALANCE_SOIL_ALKALINE";
        expect(questSubtitle(key, locale), `${key}/${locale}`).toBe(
          shared ? MOOD_COPY[locale][QUEST_DEFINITIONS[key].triggerMood] : null,
        );
        if (!shared) expect(questLabel(key, locale)).toBe(questTitle(key, locale));
      }
    }
  });

  it("leaves no two quests looking alike on the board, in either language", () => {
    // The board is the one screen showing all of them at once; a duplicate
    // there is a presenter clicking the wrong row on stage.
    for (const locale of LOCALES) {
      const labels = KEYS.map((key) => questLabel(key, locale));
      expect(new Set(labels).size, `duplicate label in ${locale}`).toBe(KEYS.length);
    }
  });

  it("never leaves the separator untranslated", () => {
    // The previous version appended the raw PlantMood enum, so Indonesian
    // visitors got "Seimbangkan Tanahku · SoilAcidic".
    for (const key of KEYS) {
      expect(questLabel(key, "id")).not.toContain(QUEST_DEFINITIONS[key].triggerMood);
    }
  });
});
