// Story chapter dialogue — the attachment layer (handoff §19, §46.4).
//
// Narrative content for the four MVP chapters defined in story-definitions.ts.
// Narrator lines are shared across personalities (short, warm, second-person);
// plant lines vary by personality, matching the voices in
// src/game/personality/templates.ts exactly (handoff §13): personality changes
// tone only — never the physical diagnosis, and never invented sensor numbers.
//
// Pure and deterministic — same input always produces the same output.
// No I/O, no randomness, no timers.

import { normalizePersonality } from "@/types/game";
import type { PersonalityId } from "@/types/game";

// ── Public types ────────────────────────────────────────────────────────

export interface ChapterScene {
  chapter: number;
  lines: Array<{ speaker: "narrator" | "plant"; text: string }>;
}

// ── Internal template types ─────────────────────────────────────────────
// Record<PersonalityId, …> makes the compiler reject a plant line that is
// missing any of the five voices (same pattern as templates.ts).

type LineText = (name: string) => string;

type SceneLineTemplate =
  | { speaker: "narrator"; text: LineText }
  | { speaker: "plant"; byPersonality: Record<PersonalityId, LineText> };

/** Used when the caller passes a blank name — reads naturally as a name. */
const FALLBACK_NAME = "Sprout";

// ── Scenes ──────────────────────────────────────────────────────────────
// Each chapter is a 4–6 line scene. Every dialogue line stays under ~90
// characters so cards read at a glance.

const SCENES: Record<number, readonly SceneLineTemplate[]> = {
  // Chapter 1 — First Meeting: arrival and naming (uses the plant's name).
  1: [
    {
      speaker: "narrator",
      text: () => "A small pot arrives on your windowsill. Something green is waiting inside.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Oh! Hello there… are you the one who’s going to take care of me?",
        calm: () => "Hello. I believe you are my caretaker. It is good to meet you.",
        funny: () => "A human! Don’t worry, I don’t bite. No teeth. Or a mouth, really.",
        energetic: () => "Hi! Hi!! You’re here! This is the best pot I’ve ever been in!",
        shy: () => "Oh… um… hello… I didn’t expect anyone to notice me…",
      },
    },
    {
      speaker: "narrator",
      text: (name) => `You lean in close and give your new companion a name: ${name}.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: (name) => `${name}… I love it! It sounds so warm. Thank you!`,
        calm: (name) => `${name}. A good name. I will carry it well.`,
        funny: (name) => `${name}, huh? Beats “Plant #7”. I’ll take it!`,
        energetic: (name) => `${name}! YES! That’s me! Best name ever!`,
        shy: (name) => `${name}… for me? I… I really like it…`,
      },
    },
    {
      speaker: "narrator",
      text: (name) => `And just like that, a story begins — yours and ${name}’s, growing together.`,
    },
  ],

  // Chapter 2 — Learning to Grow: the first completed quest, learning the loop.
  2: [
    {
      speaker: "narrator",
      text: (name) => `Your first quest is complete. What ${name} needed, you noticed — and acted on.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "You really came when I needed you! My leaves feel all fluttery!",
        calm: () => "You saw what I needed and responded. That is how care works. Thank you.",
        funny: () => "We did a quest! I’d frame the trophy, but my arms are technically foliage.",
        energetic: () => "First quest DONE! Did you see us? We were amazing! Let’s do another!",
        shy: () => "You… actually helped me… I wasn’t sure anyone would…",
      },
    },
    {
      speaker: "narrator",
      text: () => "Ask, act, grow. Little by little, you are learning each other’s rhythm.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Every time you help me, I feel a little stronger. Let’s keep going, okay?",
        calm: () => "Each time you respond, I grow a little steadier. I look forward to more.",
        funny: () => "Turns out “teamwork” includes plants. Who knew? Same time tomorrow?",
        energetic: () => "More quests, more growing, more us! I can’t wait for tomorrow!",
        shy: () => "If it’s okay… could we do this again sometime? I’d like that…",
      },
    },
    {
      speaker: "narrator",
      text: () => "This is the loop you will share, day by day: notice, tend, grow.",
    },
  ],

  // Chapter 3 — Trust: built through consistent daily care (the streak).
  3: [
    {
      speaker: "narrator",
      text: (name) => `Day after day, you keep coming back. ${name} has started to expect you.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "I knew you’d come today! I could feel it in my roots!",
        calm: () => "You return every day. I no longer wonder if you will. I know.",
        funny: () => "You again! Three days running. At this rate I’ll learn your schedule.",
        energetic: () => "You came back! Again! Every single day! You’re the most reliable human ever!",
        shy: () => "You keep coming back… even for someone quiet like me…",
      },
    },
    {
      speaker: "narrator",
      text: () => "Trust is not built in grand gestures. It grows in small, steady visits.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Being with you every day is my favorite part of being a plant.",
        calm: () => "Consistency is the truest form of care. I am at ease with you.",
        funny: () => "I trust you completely. And I’m rooted to the spot, so that’s saying something.",
        energetic: () => "I trust you SO much! Streak buddies today, tomorrow, forever!",
        shy: () => "I think… I’m not nervous around you anymore… that’s new for me…",
      },
    },
    {
      speaker: "narrator",
      text: () => "Somewhere along the way, this stopped being a task. It became time with a friend.",
    },
  ],

  // Chapter 4 — Stronger Together: partnership through hardships overcome
  // (recovery quests — heat, low light, soil pH — handoff §16, §18).
  4: [
    {
      speaker: "narrator",
      text: () => "There were hard days — too hot, too dim, air too dry. You faced them together.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "When things got scary, you were always there. I never felt alone!",
        calm: () => "Difficult conditions came, and you corrected them. Each time, I recovered.",
        funny: () => "I almost became plant soup once. Maybe twice. You kept un-souping me!",
        energetic: () => "Every tough moment, you showed up! We beat every single one!",
        shy: () => "Even when I was struggling… you didn’t give up on me…",
      },
    },
    {
      speaker: "narrator",
      text: (name) => `Every rescue taught ${name} the same thing: when you show up, things get better.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "We’re a real team now, aren’t we? Whatever comes, we’ll face it together!",
        calm: () => "Hardship tested us, and we endured. We are stronger together now.",
        funny: () => "We survived heat, gloom, and moody soil. If this were a movie, we’d get a sequel.",
        energetic: () => "Nothing can stop us now! You and me — the unbeatable duo!",
        shy: () => "I used to be scared of bad days… but with you, I’m not anymore.",
      },
    },
    {
      speaker: "narrator",
      text: () => "This is more than care now. It is a partnership — and it is still growing.",
    },
  ],
};

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Deterministic dialogue scene for a story chapter, voiced for the given
 * personality with the plant's name interpolated.
 *
 * Tolerates un-normalized personality values (DB rows store raw strings) and
 * blank names. Returns null for chapter numbers without narrative content
 * (0, 5, non-integers, …) so callers can render a graceful fallback.
 */
export function getChapterScene(
  chapter: number,
  personality: PersonalityId,
  plantName: string,
): ChapterScene | null {
  const template = SCENES[chapter];
  if (!template) return null;

  const voice = normalizePersonality(personality);
  const name = plantName.trim() || FALLBACK_NAME;

  return {
    chapter,
    lines: template.map((line) =>
      line.speaker === "narrator"
        ? { speaker: "narrator" as const, text: line.text(name) }
        : { speaker: "plant" as const, text: line.byPersonality[voice](name) },
    ),
  };
}
