import type { PlantMood } from "@/types/events";

const MOOD_EMOJI: Record<PlantMood, readonly string[]> = {
  Happy: ["🌱", "💚", "✨"],
  Overheating: ["🥵", "💨", "☀️"],
  TooCold: ["🥶", "🧣", "❄️"],
  DryAir: ["💧", "☁️", "🌿"],
  HumidAir: ["💦", "🌫️", "🍃"],
  Sleepy: ["🌙", "💤", "⭐"],
  SoilAcidic: ["🧪", "🌱", "🔍"],
  SoilAlkaline: ["🌿", "🧪", "🔍"],
};

function lineHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Adds a stable mood emoji to some Jamkachu lines without changing facts. */
export function sprinkleJamkachuEmoji(line: string, mood: PlantMood, seed = "") {
  if (!line.trim()) return line;
  const hash = lineHash(`${seed}|${mood}|${line}`);
  if (hash % 3 !== 0) return line;
  const emoji = MOOD_EMOJI[mood][hash % MOOD_EMOJI[mood].length];
  return line.includes(emoji) ? line : `${line} ${emoji}`;
}
