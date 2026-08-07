// Pixel plant mascot (ported from the teammate's "Cozy Pixel Farm" mockup).
//
// Purely presentational — receives the current mood and renders the mockup's
// blocky rect-based SVG plant (clay pot, stem, leaves, head) with a distinct
// pixel face per mood. No hooks, no state; animation is CSS-only via the
// pm-mascot / pm-leaves classes in globals.css (motion-safe gated there).
//
// Style rule from the mockup: everything is <rect>, structural rects use
// stroke var(--color-outline) at stroke-width 8 — no smooth curves.

import type { ReactElement } from "react";
import { MOOD_LABELS, type PlantMood } from "@/types/events";

const OUTLINE = "var(--color-outline)";
const WATER = "var(--color-water)";
const CHEEK = "var(--color-cheek)";
const ACID_POTION = "#FF8A3D";
const ALKALINE_POTION = "#9B5DE5";

/** Happy — the mockup's face, verbatim coordinates. */
function HappyFace() {
  return (
    <g>
      {/* Eyes */}
      <rect x="110" y="45" width="15" height="15" fill={OUTLINE} />
      <rect x="112" y="47" width="5" height="5" fill="#FFF" />
      <rect x="155" y="45" width="15" height="15" fill={OUTLINE} />
      <rect x="157" y="47" width="5" height="5" fill="#FFF" />
      {/* Cheeks */}
      <rect x="95" y="65" width="15" height="10" fill={CHEEK} />
      <rect x="170" y="65" width="15" height="10" fill={CHEEK} />
      {/* Smile */}
      <rect x="125" y="70" width="30" height="8" fill={OUTLINE} />
      <rect x="120" y="62" width="8" height="8" fill={OUTLINE} />
      <rect x="152" y="62" width="8" height="8" fill={OUTLINE} />
    </g>
  );
}

/** Overheating — strained double-bar eyes, red cheeks, panting mouth, sweat. */
function OverheatingFace() {
  return (
    <g>
      {/* Strained eyes (squeezed shut) */}
      <rect x="106" y="42" width="16" height="6" fill={OUTLINE} />
      <rect x="108" y="52" width="12" height="6" fill={OUTLINE} />
      <rect x="158" y="42" width="16" height="6" fill={OUTLINE} />
      <rect x="160" y="52" width="12" height="6" fill={OUTLINE} />
      {/* Red-tinted cheeks */}
      <rect x="93" y="62" width="18" height="12" fill="#FF7A7A" />
      <rect x="169" y="62" width="18" height="12" fill="#FF7A7A" />
      {/* Open panting mouth with tongue */}
      <rect x="127" y="68" width="26" height="14" fill={OUTLINE} />
      <rect x="131" y="76" width="18" height="6" fill={CHEEK} />
      {/* Sweat drops */}
      <rect x="192" y="30" width="8" height="10" fill={WATER} />
      <rect x="216" y="34" width="10" height="14" fill={WATER} />
      <rect x="219" y="26" width="4" height="6" fill={WATER} />
      <rect x="72" y="48" width="10" height="14" fill={WATER} />
      <rect x="75" y="40" width="4" height="6" fill={WATER} />
    </g>
  );
}

/** DryAir — droopy eyes, faded cheeks, wavy (parched) mouth. */
function DryAirFace() {
  return (
    <g>
      {/* Droopy eyes */}
      <rect x="110" y="50" width="15" height="10" fill={OUTLINE} />
      <rect x="155" y="50" width="15" height="10" fill={OUTLINE} />
      {/* Faded cheeks */}
      <rect x="95" y="66" width="15" height="10" fill={CHEEK} opacity="0.35" />
      <rect x="170" y="66" width="15" height="10" fill={CHEEK} opacity="0.35" />
      {/* Wavy mouth */}
      <rect x="118" y="72" width="11" height="6" fill={OUTLINE} />
      <rect x="129" y="68" width="11" height="6" fill={OUTLINE} />
      <rect x="140" y="72" width="11" height="6" fill={OUTLINE} />
      <rect x="151" y="68" width="11" height="6" fill={OUTLINE} />
    </g>
  );
}

/** Sleepy — closed-line eyes, tiny snore mouth, blocky zzz beside the head. */
function SleepyFace() {
  return (
    <g>
      {/* Closed eyes */}
      <rect x="108" y="52" width="18" height="5" fill={OUTLINE} />
      <rect x="154" y="52" width="18" height="5" fill={OUTLINE} />
      {/* Soft cheeks */}
      <rect x="95" y="64" width="15" height="10" fill={CHEEK} opacity="0.6" />
      <rect x="170" y="64" width="15" height="10" fill={CHEEK} opacity="0.6" />
      {/* Small snore mouth */}
      <rect x="134" y="70" width="12" height="9" fill={OUTLINE} />
      {/* Big blocky Z */}
      <g fill="#FFFFFF" opacity="0.92">
        <rect x="226" y="18" width="26" height="7" />
        <rect x="240" y="25" width="8" height="6" />
        <rect x="232" y="31" width="8" height="6" />
        <rect x="226" y="37" width="26" height="7" />
        {/* Small z */}
        <rect x="258" y="52" width="18" height="5" />
        <rect x="265" y="57" width="7" height="5" />
        <rect x="258" y="62" width="18" height="5" />
      </g>
    </g>
  );
}

/** SoilAcidic — worried stepped brows, puckered mouth, orange acid potion. */
function SoilAcidicFace() {
  return (
    <g>
      {/* Worried brows (inner ends lower) */}
      <rect x="104" y="32" width="10" height="5" fill={OUTLINE} />
      <rect x="112" y="37" width="10" height="5" fill={OUTLINE} />
      <rect x="166" y="32" width="10" height="5" fill={OUTLINE} />
      <rect x="158" y="37" width="10" height="5" fill={OUTLINE} />
      {/* Eyes */}
      <rect x="110" y="45" width="15" height="15" fill={OUTLINE} />
      <rect x="112" y="47" width="5" height="5" fill="#FFF" />
      <rect x="155" y="45" width="15" height="15" fill={OUTLINE} />
      <rect x="157" y="47" width="5" height="5" fill="#FFF" />
      {/* Faint cheeks */}
      <rect x="95" y="66" width="15" height="10" fill={CHEEK} opacity="0.4" />
      <rect x="170" y="66" width="15" height="10" fill={CHEEK} opacity="0.4" />
      {/* Puckered mouth */}
      <rect x="132" y="66" width="16" height="14" fill={OUTLINE} />
      <rect x="137" y="71" width="6" height="4" fill={CHEEK} />
      <rect x="124" y="71" width="5" height="4" fill={OUTLINE} />
      <rect x="151" y="71" width="5" height="4" fill={OUTLINE} />
    </g>
  );
}

/** SoilAlkaline — uneven queasy eyes, wobbly mouth, lavender cheeks. */
function SoilAlkalineFace() {
  return (
    <g>
      {/* Uneven eyes */}
      <rect x="108" y="43" width="17" height="17" fill={OUTLINE} />
      <rect x="111" y="46" width="5" height="5" fill="#FFF" />
      <rect x="157" y="48" width="12" height="12" fill={OUTLINE} />
      <rect x="159" y="50" width="4" height="4" fill="#FFF" />
      {/* Lavender-tinted cheeks */}
      <rect x="95" y="66" width="15" height="10" fill="#C9A8F0" opacity="0.55" />
      <rect x="170" y="66" width="15" height="10" fill="#C9A8F0" opacity="0.55" />
      {/* Wobbly, irregular mouth */}
      <rect x="119" y="72" width="12" height="6" fill={OUTLINE} />
      <rect x="131" y="66" width="9" height="6" fill={OUTLINE} />
      <rect x="140" y="73" width="13" height="5" fill={OUTLINE} />
      <rect x="153" y="68" width="9" height="6" fill={OUTLINE} />
    </g>
  );
}

/** Blocky potion bottle beside the pot — pH trouble indicator. */
function Potion({ side, color }: { side: "left" | "right"; color: string }) {
  // Mirror the left-side coordinates around the viewBox center (x=150).
  const x = (leftX: number, width: number) => (side === "left" ? leftX : 300 - leftX - width);
  return (
    <g>
      <rect x={x(34, 24)} y="248" width="24" height="8" fill={OUTLINE} />
      <rect x={x(38, 16)} y="256" width="16" height="14" fill={color} stroke={OUTLINE} strokeWidth="8" />
      <rect x={x(28, 36)} y="270" width="36" height="52" fill={color} stroke={OUTLINE} strokeWidth="8" />
      <rect x={x(66, 6)} y="240" width="6" height="6" fill={color} />
      <rect x={x(72, 4)} y="228" width="4" height="4" fill={color} />
    </g>
  );
}

const FACES: Record<PlantMood, () => ReactElement> = {
  Happy: HappyFace,
  Overheating: OverheatingFace,
  DryAir: DryAirFace,
  Sleepy: SleepyFace,
  SoilAcidic: SoilAcidicFace,
  SoilAlkaline: SoilAlkalineFace,
};

export default function Mascot({ mood }: { mood: PlantMood }) {
  const Face = FACES[mood] ?? HappyFace;
  return (
    <div className="pm-mascot" role="img" aria-label={MOOD_LABELS[mood] ?? mood}>
      <svg viewBox="0 0 300 350" className="h-auto w-full" aria-hidden="true">
        {/* Pot (clay) */}
        <rect x="75" y="220" width="150" height="110" fill="var(--color-soil)" stroke={OUTLINE} strokeWidth="8" />
        <rect x="60" y="190" width="180" height="30" fill="var(--color-soil-light)" stroke={OUTLINE} strokeWidth="8" />
        <rect x="100" y="240" width="100" height="10" fill="var(--color-soil-dark)" opacity="0.3" />

        {/* Stem */}
        <rect x="140" y="100" width="20" height="90" fill="var(--color-forest)" stroke={OUTLINE} strokeWidth="8" />

        {/* Leaves (sway via globals.css, motion-safe only) */}
        <g className="pm-leaves">
          <rect x="70" y="140" width="70" height="25" fill="var(--color-grass)" stroke={OUTLINE} strokeWidth="8" />
          <rect x="160" y="120" width="70" height="25" fill="var(--color-grass)" stroke={OUTLINE} strokeWidth="8" />
        </g>

        {/* Head */}
        <rect x="90" y="20" width="120" height="100" fill="var(--color-grass-light)" stroke={OUTLINE} strokeWidth="8" />

        {/* Per-mood pixel face */}
        <Face />

        {/* Soil-pH trouble: a potion bottle appears beside the pot */}
        {mood === "SoilAcidic" && <Potion side="left" color={ACID_POTION} />}
        {mood === "SoilAlkaline" && <Potion side="right" color={ALKALINE_POTION} />}
      </svg>
    </div>
  );
}
