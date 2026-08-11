// Jamkachu mascot — the team designer's pixel sprite is the character art.
//
// Purely presentational: game state (mood, companion stage, bond level) maps
// to one PNG from public/farm/assets/jamkachu/ via src/lib/jamkachu-sprite.ts
// (the parity-tested mirror of the farm layer's mapping). The 10 companion
// stages bucket into the pack's 4 drawn phases; accessory tiers (head bow →
// prize ribbon) are automatic bond rewards. Moods that share the "plain" body
// stay visually distinguishable through an emoji status chip; the accessible
// signal is the aria-label. No hooks, no state; the gentle breath animation
// is CSS-only (pm-mascot in globals.css, motion-safe gated there).

import { MOOD_LABELS, type PlantMood } from "@/types/events";
import type { CompanionStage } from "@/types/game";
import { MOOD_STATUS_CHIP, spriteSrc } from "@/lib/jamkachu-sprite";

export default function Mascot({
  mood,
  stage,
  bondLevel,
  sleeping,
}: {
  mood: PlantMood;
  stage?: CompanionStage;
  bondLevel?: number;
  sleeping?: boolean;
}) {
  const chip = sleeping ? undefined : MOOD_STATUS_CHIP[mood];
  return (
    <div
      className={`pm-mascot${stage ? ` pm-mascot-stage pm-stage-${stage.toLowerCase()}` : ""}`}
      role="img"
      aria-label={`${MOOD_LABELS[mood] ?? mood}${stage ? ` · ${stage}` : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
      <img
        className="pm-mascot-sprite"
        src={spriteSrc({ stage, mood, bondLevel, sleeping })}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      {chip && (
        <span className="pm-mascot-chip" aria-hidden="true">
          {chip}
        </span>
      )}
    </div>
  );
}
