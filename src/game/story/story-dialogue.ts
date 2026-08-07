// Story chapter dialogue — the attachment layer (handoff §19, §46.4).
//
// Narrative content for the six chapters defined in story-definitions.ts.
// The story is set where the plant physically lives: a windowsill in Jember,
// East Java — coffee-and-tobacco country on volcanic soil, with Mount
// Argopuro on the horizon, musim hujan rains, and the August carnival.
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
// Each chapter is a 4–6 line scene. Every dialogue line stays under ~95
// characters so cards read at a glance.

const SCENES: Record<number, readonly SceneLineTemplate[]> = {
  // Chapter 1 — First Meeting in Jember: arrival and naming (uses the
  // plant's name).
  1: [
    {
      speaker: "narrator",
      text: () => "A small pot arrives on a windowsill in Jember, between coffee fields and volcanic hills.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Oh! Hello there… is this Jember? The air smells like warm earth… and you’re here too!",
        calm: () => "Hello. Warm air, rich dark soil — Jember, I believe. And you must be my caretaker.",
        funny: () => "A human! And volcanic soil! Fancy dirt AND room service? I picked the right pot.",
        energetic: () => "Hi! Hi!! New home! I can see the mountains from here! Best windowsill EVER!",
        shy: () => "Oh… um… hello… I thought only the mountain was watching… but you noticed me…",
      },
    },
    {
      speaker: "narrator",
      text: (name) => `Under the far blue line of Mount Argopuro, you give your companion a name: ${name}.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: (name) => `${name}… I love it! My very own name, here in Jember. Thank you!`,
        calm: (name) => `${name}. A good name. I will grow into it, roots down in this warm earth.`,
        funny: (name) => `${name}, huh? Beats “Plant #7”. Jember suits us both — I’ll take it!`,
        energetic: (name) => `${name}! YES! That’s me! Shout it to the mountains — ${name} of Jember!`,
        shy: (name) => `${name}… for me? I… I’ll try to grow into it… quietly…`,
      },
    },
    {
      speaker: "narrator",
      text: (name) => `And so a story takes root in Jember’s volcanic soil — yours and ${name}’s, together.`,
    },
  ],

  // Chapter 2 — Roots in Volcanic Soil: the first completed quest, learning
  // the loop in generous ground.
  2: [
    {
      speaker: "narrator",
      text: (name) => `Your first quest is complete. What ${name} needed, you noticed — and acted on.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "You really came when I needed you! My leaves feel all fluttery and bright!",
        calm: () => "You saw what I needed and responded. Rich soil helps, but care completes it.",
        funny: () => "Quest one: done! The volcanic dirt is great, but you? Five stars. Would sprout again.",
        energetic: () => "First quest DONE! Rich soil below, you beside me — I’m going to grow SO fast!",
        shy: () => "You… actually helped me… I wasn’t sure anyone would…",
      },
    },
    {
      speaker: "narrator",
      text: () => "Jember’s volcanic soil is generous, but even the richest earth needs a watchful friend.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Every time you help me, I feel a little stronger. Let’s keep going, okay?",
        calm: () => "Each time you respond, I grow steadier — like the fields here, tended every day.",
        funny: () => "Turns out “teamwork” includes plants. Who knew? Same time tomorrow?",
        energetic: () => "More quests, more growing, more us! Tomorrow, let’s beat today!",
        shy: () => "If it’s okay… could we do this again sometime? I’d like that…",
      },
    },
    {
      speaker: "narrator",
      text: () => "This is the loop every grower in this valley knows by heart: notice, tend, grow.",
    },
  ],

  // Chapter 3 — Trust, Rain or Shine: built through consistent daily care
  // (the streak), through Jember's wet and dry days alike.
  3: [
    {
      speaker: "narrator",
      text: (name) => `Day after day you come back, rain or shine. ${name} has started to expect you.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "I knew you’d come today! I could feel it in my roots!",
        calm: () => "Rain on the roof or sun on the glass — you return. I no longer wonder. I know.",
        funny: () => "You again! Three days running. You’re more punctual than the afternoon rain!",
        energetic: () => "You came back! Again! Every single day! You’re the most reliable human ever!",
        shy: () => "You keep coming back… even for someone quiet like me…",
      },
    },
    {
      speaker: "narrator",
      text: () => "When musim hujan (the rainy season) drums on Jember’s roofs, small visits matter most.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Rainy day or bright one, being with you is my favorite part of being a plant.",
        calm: () => "Consistency is the truest form of care. Like the seasons here, you always come back.",
        funny: () => "I trust you completely. And I’m rooted to the spot, so that’s saying something.",
        energetic: () => "I trust you SO much! Streak buddies in every season — rain, shine, ALL of it!",
        shy: () => "I think… I’m not nervous around you anymore… that’s new for me…",
      },
    },
    {
      speaker: "narrator",
      text: () => "Somewhere between the rains, this stopped being a task. It became time with a friend.",
    },
  ],

  // Chapter 4 — Through Heat and Gray Skies: partnership through hardships
  // overcome (recovery quests — heat, low light, soil pH — handoff §16, §18),
  // the dry-season side of Jember's year.
  4: [
    {
      speaker: "narrator",
      text: () => "Hard days came — dry-season heat, dim gray light, thirsty air. You faced them together.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "When the hot days got scary, you were always there. I never felt alone!",
        calm: () => "Difficult conditions came, and you corrected them. Each time, I recovered.",
        funny: () => "I nearly became sun-dried garnish once. Maybe twice. You kept un-crisping me!",
        energetic: () => "Every heat wave, every gloomy day — you showed up! We beat every single one!",
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
        cute: () => "We’re a real team now, aren’t we? Whatever the season brings, we’ll face it together!",
        calm: () => "Hardship tested us, and we endured. Like the mountains here, we hold through seasons.",
        funny: () => "We survived heat, gloom, and moody soil. If this were a movie, we’d get a sequel.",
        energetic: () => "Nothing can stop us now! Not heat, not gray skies — you and me, the unbeatable duo!",
        shy: () => "I used to be scared of bad days… but with you, I’m not anymore.",
      },
    },
    {
      speaker: "narrator",
      text: () => "This is more than care now. It is a partnership — and it is still growing.",
    },
  ],

  // Chapter 5 — Full Bloom, Carnival Bright: every one of the six moods
  // discovered (handoff §5.1, §12, §20), flourishing while Jember's famous
  // August carnival fills the streets. Unlock conditions live in
  // story-definitions.ts / story-engine.ts.
  5: [
    {
      speaker: "narrator",
      text: (name) => `Happy days, sleepy days, dry air, moody soil — you have seen every side of ${name}.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "You’ve met every one of my feelings now — and you cared for every single one!",
        calm: () => "You have seen me in every state I have. Nothing about me is hidden from you now.",
        funny: () => "Six moods, and you’ve seen all six! Even the soapy-soil one. That’s dedication!",
        energetic: () => "All six moods! You’ve seen them ALL — and you showed up for every one of them!",
        shy: () => "You’ve seen every side of me… even the gloomy ones… and you still stayed…",
      },
    },
    {
      speaker: "narrator",
      text: () => "August turns Jember into a carnival — costumes and color in the streets. You grew yours.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Look at me! Every leaf bright and strong — my own little costume for carnival month!",
        calm: () => "The town parades in color, and I bloom in green. This is what your attention built.",
        funny: () => "Full bloom in carnival month! These leaves are runway-ready. Keep up, Jember!",
        energetic: () => "Full bloom! If the carnival ever needs a plant float, I VOLUNTEER! Look what we grew!",
        shy: () => "I feel… really bright now… like I could almost join the parade… almost…",
      },
    },
    {
      speaker: "narrator",
      text: () => "This is full bloom: not one perfect day, but every kind of day, met with care.",
    },
  ],

  // Chapter 6 — Harvest of Wisdom: graduation. What caretaker and plant
  // learned together becomes teachable knowledge — the project mission
  // (handoff §2): preserve the wisdom, measure the environment, grow the
  // next generation — now anchored in Jember.
  6: [
    {
      speaker: "narrator",
      text: (name) => `Seasons of quests and records lie behind you. You know ${name} by heart now.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Everything we learned together is written down now — every feeling, every rescue!",
        calm: () => "What we learned is no longer only ours. It is recorded, and it can be taught.",
        funny: () => "We basically wrote the book on me. Future plant parents of Jember, take notes!",
        energetic: () => "Every lesson we learned is saved! Now anyone can learn what we know!",
        shy: () => "All the things you learned about me… they’re written down… they could help someone…",
      },
    },
    {
      speaker: "narrator",
      text: () => "Jember’s elders kept their wisdom in memory. Yours is measured, recorded, ready to pass on.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Keep our wisdom safe, measure the world with love, and help the next sprout grow!",
        calm: () => "Preserve the wisdom. Measure the environment. Grow the next generation. Here, in Jember.",
        funny: () => "Save the wisdom, measure the air, grow the next sprout. Best harvest in East Java!",
        energetic: () => "Keep the wisdom! Measure everything! Grow the next generation — starting NOW, in Jember!",
        shy: () => "Maybe… we can keep the wisdom safe… measure things gently… and help the next one grow…",
      },
    },
    {
      speaker: "narrator",
      text: (name) => `This is not an ending. What you grew with ${name} in Jember grows on, in whoever comes next.`,
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
 * (0, 7, non-integers, …) so callers can render a graceful fallback.
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
