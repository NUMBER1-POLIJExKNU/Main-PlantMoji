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
import { COMPANION_STAGES, type CompanionStage } from "@/types/game";

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

/** TooCold — shivering squint eyes, pale-blue cheeks, chattering mouth, breath puff. */
function TooColdFace() {
  const COLD = "#8FD3F4";
  return (
    <g>
      {/* Tense squinting eyes */}
      <rect x="108" y="48" width="16" height="7" fill={OUTLINE} />
      <rect x="156" y="48" width="16" height="7" fill={OUTLINE} />
      {/* Cold pale-blue cheeks */}
      <rect x="93" y="64" width="18" height="11" fill={COLD} opacity="0.7" />
      <rect x="169" y="64" width="18" height="11" fill={COLD} opacity="0.7" />
      {/* Chattering (blocky teeth) mouth */}
      <rect x="122" y="70" width="36" height="12" fill={OUTLINE} />
      <rect x="127" y="72" width="6" height="8" fill="#FFF" />
      <rect x="137" y="72" width="6" height="8" fill="#FFF" />
      <rect x="147" y="72" width="6" height="8" fill="#FFF" />
      {/* Frosty breath puff */}
      <rect x="196" y="60" width="14" height="10" fill="#FFF" opacity="0.85" />
      <rect x="210" y="56" width="10" height="8" fill="#FFF" opacity="0.6" />
      <rect x="218" y="52" width="6" height="6" fill="#FFF" opacity="0.4" />
      {/* Snowflake sparks */}
      <rect x="74" y="40" width="6" height="6" fill={COLD} />
      <rect x="222" y="36" width="6" height="6" fill={COLD} />
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

/** HumidAir — heavy-lidded eyes, glistening cheeks, small mouth, hanging droplets. */
function HumidAirFace() {
  return (
    <g>
      {/* Heavy-lidded eyes (half closed under the damp) */}
      <rect x="108" y="47" width="17" height="5" fill={OUTLINE} />
      <rect x="110" y="52" width="13" height="8" fill={OUTLINE} />
      <rect x="155" y="47" width="17" height="5" fill={OUTLINE} />
      <rect x="157" y="52" width="13" height="8" fill={OUTLINE} />
      {/* Glistening (over-moist) cheeks */}
      <rect x="95" y="66" width="15" height="10" fill={WATER} opacity="0.45" />
      <rect x="170" y="66" width="15" height="10" fill={WATER} opacity="0.45" />
      {/* Small unbothered mouth */}
      <rect x="130" y="72" width="20" height="7" fill={OUTLINE} />
      {/* Hanging humidity droplets around the head */}
      <rect x="118" y="24" width="8" height="11" fill={WATER} />
      <rect x="120" y="20" width="4" height="5" fill={WATER} />
      <rect x="154" y="26" width="8" height="11" fill={WATER} />
      <rect x="156" y="22" width="4" height="5" fill={WATER} />
      <rect x="86" y="52" width="7" height="10" fill={WATER} opacity="0.8" />
      <rect x="207" y="52" width="7" height="10" fill={WATER} opacity="0.8" />
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
  TooCold: TooColdFace,
  DryAir: DryAirFace,
  HumidAir: HumidAirFace,
  Sleepy: SleepyFace,
  SoilAcidic: SoilAcidicFace,
  SoilAlkaline: SoilAlkalineFace,
};

/** Short-lived face layers add personality inside a deterministic mood.
 * They only cover facial pixels; mood truth, props and game logic stay put. */
function MicroExpressions({ mood }: { mood: PlantMood }) {
  const head = "var(--color-grass-light)";
  return (
    <g className={`pm-micro-expressions pm-expression-${mood.toLowerCase()}`}>
      {mood !== "Sleepy" && (
        <g className="pm-expression-frame pm-expression-blink">
          <rect x="102" y="39" width="76" height="25" fill={head} />
          <rect x="108" y="51" width="18" height="5" fill={OUTLINE} />
          <rect x="154" y="51" width="18" height="5" fill={OUTLINE} />
        </g>
      )}
      <g className="pm-expression-frame pm-expression-look">
        <rect x="102" y="39" width="76" height="25" fill={head} />
        {mood === "Sleepy" ? (
          <><rect x="108" y="51" width="18" height="5" fill={OUTLINE} /><rect x="154" y="49" width="18" height="5" fill={OUTLINE} /></>
        ) : (
          <><rect x="108" y="44" width="17" height="17" fill={OUTLINE} /><rect x="116" y="47" width="5" height="5" fill="#FFF" /><rect x="155" y="44" width="17" height="17" fill={OUTLINE} /><rect x="163" y="47" width="5" height="5" fill="#FFF" /></>
        )}
      </g>
      <g className="pm-expression-frame pm-expression-mouth">
        <rect x="114" y="61" width="52" height="24" fill={head} />
        {mood === "Happy" && <><rect x="131" y="67" width="18" height="16" fill={OUTLINE} /><rect x="136" y="72" width="8" height="6" fill="#FFF" /></>}
        {mood === "Overheating" && <><rect x="124" y="69" width="32" height="12" fill={OUTLINE} /><rect x="130" y="76" width="20" height="8" fill={CHEEK} /></>}
        {mood === "TooCold" && <><rect x="124" y="70" width="32" height="10" fill={OUTLINE} /><rect x="129" y="72" width="5" height="6" fill="#FFF" /><rect x="146" y="72" width="5" height="6" fill="#FFF" /></>}
        {mood === "DryAir" && <><rect x="126" y="71" width="28" height="6" fill={OUTLINE} /><rect x="134" y="77" width="12" height="4" fill={OUTLINE} /></>}
        {mood === "HumidAir" && <><rect x="130" y="72" width="20" height="7" fill={OUTLINE} /></>}
        {mood === "Sleepy" && <><rect x="130" y="68" width="20" height="14" fill={OUTLINE} /><rect x="135" y="72" width="10" height="7" fill={head} /></>}
        {(mood === "SoilAcidic" || mood === "SoilAlkaline") && <><rect x="127" y="70" width="10" height="6" fill={OUTLINE} /><rect x="143" y="70" width="10" height="6" fill={OUTLINE} /></>}
      </g>
      <g className="pm-expression-frame pm-expression-accent" fill="#FFF7A8">
        {mood === "Happy" ? <><rect x="74" y="33" width="7" height="20" /><rect x="67" y="39" width="21" height="7" /><rect x="219" y="44" width="6" height="17" /><rect x="214" y="49" width="17" height="6" /></> :
         mood === "Sleepy" ? <><rect x="214" y="26" width="18" height="5" /><rect x="223" y="31" width="5" height="5" /><rect x="214" y="36" width="18" height="5" /></> :
         <><rect x="218" y="34" width="6" height="18" fill={mood === "Overheating" ? WATER : "#FFF7A8"} /><rect x="212" y="53" width="18" height="5" fill={mood === "Overheating" ? WATER : "#FFF7A8"} /></>}
      </g>
    </g>
  );
}

function StageAccents({ stage }: { stage: CompanionStage }) {
  const rank = COMPANION_STAGES.indexOf(stage);
  return <g className="pm-stage-accents" aria-hidden="true">
    {rank >= 2 && <g><rect x="112" y="150" width="26" height="12" rx="6" fill="var(--color-forest)" stroke={OUTLINE} strokeWidth="5"/><rect x="162" y="150" width="26" height="12" rx="6" fill="var(--color-forest)" stroke={OUTLINE} strokeWidth="5"/></g>}
    {rank === 3 && <circle cx="112" cy="12" r="11" fill="#FFB1C8" stroke={OUTLINE} strokeWidth="5"/>}
    {rank >= 4 && <g><circle cx="112" cy="8" r="9" fill="#FFF" stroke={OUTLINE} strokeWidth="4"/><circle cx="99" cy="15" r="8" fill="#F7A6C1" stroke={OUTLINE} strokeWidth="4"/><circle cx="125" cy="15" r="8" fill="#F7A6C1" stroke={OUTLINE} strokeWidth="4"/><circle cx="112" cy="23" r="8" fill="#FFDE6A" stroke={OUTLINE} strokeWidth="4"/></g>}
    {rank >= 5 && <g><circle cx="126" cy="132" r="10" fill="#E4572E" stroke={OUTLINE} strokeWidth="4"/><circle cx="176" cy="135" r="10" fill="#E4572E" stroke={OUTLINE} strokeWidth="4"/><rect x="124" y="117" width="5" height="9" fill="var(--color-forest)"/><rect x="174" y="120" width="5" height="9" fill="var(--color-forest)"/></g>}
    {rank >= 6 && <g fill="none" stroke="#FFDE6A" strokeWidth="5"><path d="M64 90H35V55"/><path d="M236 90h29V55"/><path d="M48 42l-13 13 13 13"/><path d="M252 42l13 13-13 13"/></g>}
    {rank >= 7 && <g><rect x="128" y="104" width="14" height="65" rx="6" fill="#6E8F46" stroke={OUTLINE} strokeWidth="4"/><rect x="158" y="96" width="14" height="73" rx="6" fill="#6E8F46" stroke={OUTLINE} strokeWidth="4"/><rect x="105" y="92" width="38" height="11" rx="5" fill="#6E8F46" stroke={OUTLINE} strokeWidth="4"/><rect x="159" y="82" width="38" height="11" rx="5" fill="#6E8F46" stroke={OUTLINE} strokeWidth="4"/></g>}
    {rank >= 8 && <g fill="none" stroke="#FFF2A8" strokeWidth="6" opacity=".9"><circle cx="150" cy="70" r="88"/><path d="M150-35v24M150 151v24M45 70H21M279 70h-24"/></g>}
    {rank >= 9 && <g><polygon points="112,14 128,-10 150,10 172,-10 188,14 182,34 118,34" fill="#FFDE6A" stroke={OUTLINE} strokeWidth="6"/><circle cx="128" cy="6" r="5" fill="#E4572E"/><circle cx="150" cy="20" r="5" fill="#4DA1ED"/><circle cx="172" cy="6" r="5" fill="#E4572E"/></g>}
  </g>;
}

export default function Mascot({ mood, stage }: { mood: PlantMood; stage?: CompanionStage }) {
  const Face = FACES[mood] ?? HappyFace;
  const rank = stage ? COMPANION_STAGES.indexOf(stage) : 6;
  return (
    <div className={`pm-mascot${stage ? ` pm-mascot-stage pm-stage-${stage.toLowerCase()}` : ""}`} role="img" aria-label={`${MOOD_LABELS[mood] ?? mood}${stage ? ` · ${stage}` : ""}`}>
      <svg viewBox="0 0 300 350" className="h-auto w-full" aria-hidden="true">
        {/* Pot (clay) */}
        <rect x="75" y="220" width="150" height="110" fill="var(--color-soil)" stroke={OUTLINE} strokeWidth="8" />
        <rect x="60" y="190" width="180" height="30" fill="var(--color-soil-light)" stroke={OUTLINE} strokeWidth="8" />
        <rect x="100" y="240" width="100" height="10" fill="var(--color-soil-dark)" opacity="0.3" />

        {/* Stem */}
        <rect x="140" y={rank === 0 ? 168 : rank === 1 ? 140 : "100"} width="20" height={rank === 0 ? 22 : rank === 1 ? 50 : 90} fill="var(--color-forest)" stroke={OUTLINE} strokeWidth="8" />

        {/* Leaves (sway via globals.css, motion-safe only) */}
        <g className="pm-leaves" opacity={rank === 0 ? 0 : 1}>
          <rect x={rank === 1 ? 103 : 70} y={rank === 1 ? 151 : 140} width={rank === 1 ? 42 : 70} height="25" fill="var(--color-grass)" stroke={OUTLINE} strokeWidth="8" />
          {rank >= 2 && <rect x="160" y="120" width="70" height="25" fill="var(--color-grass)" stroke={OUTLINE} strokeWidth="8" />}
        </g>

        {/* Head */}
        <rect x={rank === 0 ? 128 : rank === 1 ? 112 : 90} y={rank === 0 ? 145 : rank === 1 ? 92 : 20} width={rank === 0 ? 44 : rank === 1 ? 76 : 120} height={rank === 0 ? 42 : rank === 1 ? 64 : 100} rx={rank < 2 ? 16 : 0} fill="var(--color-grass-light)" stroke={OUTLINE} strokeWidth="8" />

        {stage && rank >= 2 && <StageAccents stage={stage} />}

        {/* Per-mood pixel face */}
        {rank >= 2 && <><Face /><MicroExpressions mood={mood} /></>}

        {/* Soil-pH trouble: a potion bottle appears beside the pot */}
        {mood === "SoilAcidic" && <Potion side="left" color={ACID_POTION} />}
        {mood === "SoilAlkaline" && <Potion side="right" color={ALKALINE_POTION} />}
      </svg>
    </div>
  );
}
