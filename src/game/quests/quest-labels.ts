// One place that answers "what do I call this quest on screen".
//
// BALANCE_SOIL_ACIDIC and BALANCE_SOIL_ALKALINE deliberately share the title
// "Balance My Soil": a player only ever meets the one their soil triggered, and
// naming it after the chemistry would be worse copy for a classroom. But two
// screens DO show them side by side — the cheat board lists every quest at
// once, and the hero card can be swapped between them — and there the two rows
// were indistinguishable.
//
// The separator is the trigger mood, which already has a translated label in
// MOOD_COPY, so no new copy table is needed and nothing can be left
// untranslated. It is emitted only when the title is genuinely ambiguous:
// "Cool Me Down · Too Hot" on every row would be noise, and any future pair of
// same-titled quests gets the same treatment for free.

import { MOOD_COPY, type AppLocale, QUEST_COPY_ID } from "@/lib/i18n";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import type { QuestKey } from "@/types/game";

export function questTitle(key: QuestKey, locale: AppLocale): string {
  return locale === "id" ? QUEST_COPY_ID[key].title : QUEST_DEFINITIONS[key].title;
}

/** Titles used by more than one quest, per locale — Indonesian and English can
 *  collide on different keys, so each locale is counted on its own. */
function ambiguousTitles(locale: AppLocale): Set<string> {
  const seen = new Map<string, number>();
  for (const key of Object.keys(QUEST_DEFINITIONS) as QuestKey[]) {
    const title = questTitle(key, locale);
    seen.set(title, (seen.get(title) ?? 0) + 1);
  }
  return new Set([...seen].filter(([, count]) => count > 1).map(([title]) => title));
}

/** The distinguishing line, or null when the title already stands alone. */
export function questSubtitle(key: QuestKey, locale: AppLocale): string | null {
  const title = questTitle(key, locale);
  if (!ambiguousTitles(locale).has(title)) return null;
  return MOOD_COPY[locale][QUEST_DEFINITIONS[key].triggerMood];
}

/** Title with the subtitle appended, for single-line contexts like the board. */
export function questLabel(key: QuestKey, locale: AppLocale): string {
  const title = questTitle(key, locale);
  const subtitle = questSubtitle(key, locale);
  return subtitle ? `${title} · ${subtitle}` : title;
}
