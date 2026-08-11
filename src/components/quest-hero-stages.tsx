"use client";

// The whole body of the HERO MISSION card: which quest it is, its stage row,
// companion line, action well, and the teaching notes under it.
//
// It is a client island for the classroom sandbox. The quest row comes from
// Supabase and cannot move during a demo, so without this the hero card sat
// frozen on one quest at one stage no matter what the presenter did. Here the
// sandbox can both jump the stage AND swap which quest is being shown, from
// the board on the same page.
//
// With the sandbox off it renders exactly what the server would have: the real
// active quest, at the stage its real status says.

import type { AppLocale } from "@/lib/i18n";
import type { CropProfile } from "@/lib/crop-profiles";
import { useCheat } from "@/lib/pm-cheat";
import QuestProgress from "@/components/quest-progress";
import {
  cheatQuestStage,
  stageFromQuestStatus,
  STAGE_VERIFY,
} from "@/game/quests/cheat-quest-stage";
import type { QuestKey } from "@/types/game";

/** Everything the card needs to draw one quest, localized on the server so no
 *  copy table has to cross into the browser. */
export interface HeroQuestEntry {
  key: QuestKey;
  emoji: string;
  title: string;
  /** What separates this quest from another wearing the same title — the
   *  translated trigger mood, e.g. "Soil Too Acidic". Null when the title is
   *  unique, which is every quest except the two soil ones. */
  subtitle?: string | null;
  description: string;
  /** Localized target line, e.g. "pH 5.5–6.5". */
  target: string;
  xp: number;
  why: string;
  /** Extra teaching line (en only, from WHY_CARDS). */
  whyExtra?: string;
  /** "Still Overheating — once I feel better…", for recovery quests. */
  recoveryLine?: string;
}

const XP_CHIP_STYLE = { background: "var(--color-yellow)", borderColor: "#E8C46B", color: "#6B4F10" };
const WELL_STYLE = { background: "var(--color-bg)", border: "2px dashed var(--color-border)", color: "#555555" };

export default function QuestHeroStages({
  defaultKey,
  questStatus,
  locale,
  catalogue,
  cropProfile = null,
  progress = null,
}: {
  /** The quest Supabase actually made the hero. */
  defaultKey: QuestKey;
  /** Live status of that row (ACTIVE / VERIFYING). */
  questStatus: string | null;
  locale: AppLocale;
  /** Every quest the board can promote, keyed for instant swapping. */
  catalogue: Record<string, HeroQuestEntry>;
  /** Active crop, so a sandbox sensor edit is judged by this plant's real
   *  thresholds rather than a default profile. */
  cropProfile?: CropProfile | null;
  /** The real row's live timer, shown only while the real quest is the hero —
   *  a promoted quest has no row behind it to count. */
  progress?: { mode: "maintain" | "verifying"; sinceIso: string; requiredSeconds: number; plantId: string; questId: string } | null;
}) {
  const { active, state } = useCheat();

  const heroKey = (active && state?.heroQuest && catalogue[state.heroQuest] ? state.heroQuest : defaultKey) as QuestKey;
  const quest = catalogue[heroKey] ?? catalogue[defaultKey];
  const promoted = heroKey !== defaultKey;

  const stage = active && state
    ? cheatQuestStage({
        key: heroKey,
        // A promoted quest has no real row, so only the sandbox may speak for it.
        questStatus: promoted ? "ACTIVE" : questStatus,
        quests: state.quests,
        vitals: state.vitals,
        profile: cropProfile ?? undefined,
      })
    : stageFromQuestStatus(questStatus);

  // Index of the current step; everything before it is done.
  const currentStep = stage - 1;
  const verifying = stage >= STAGE_VERIFY;
  const steps = locale === "id"
    ? ["RASAKAN", "BERTINDAK", "VERIFIKASI", "HADIAH"]
    : ["SENSE", "ACT", "VERIFY", "REWARD"];

  return (
    <>
      <div className="flex items-start gap-4">
        <span className="text-4xl leading-none" role="img" aria-hidden="true">{quest.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="pm-heading text-xs">{quest.title}</h2>
            <span className="pm-chip shrink-0" style={XP_CHIP_STYLE}>+{quest.xp} XP</span>
          </div>
          {/* "Balance My Soil" is two different quests. Without this line the
              card gave no clue which one it was showing — and the pH target
              is the same 5.5–6.5 for both, so nothing else disambiguated it. */}
          {quest.subtitle && (
            <p className="pm-quest-subtitle">{quest.subtitle}</p>
          )}
        </div>
      </div>

      <div className="pm-quest-companion">
        <div className={`pm-quest-jam${verifying ? " is-watching" : ""}`} aria-hidden="true"><i /><i /></div>
        <p>
          {locale === "id"
            ? "Kita lakukan bersama, ya! Setelah itu sensor akan memeriksanya."
            : "Let's do this together! Then the sensors will check our work."}
        </p>
      </div>

      <ol className="pm-quest-steps" aria-label={locale === "id" ? "Tahap misi" : "Quest stages"}>
        {steps.map((step, index) => (
          <li
            key={step}
            className={index < currentStep ? "is-done" : index === currentStep ? "is-current" : ""}
          >
            <span>{index < currentStep ? "✓" : index + 1}</span>
            <small>{step}</small>
          </li>
        ))}
      </ol>

      <div className="pm-quest-action-well">
        <div>
          <small>
            {verifying
              ? (locale === "id" ? "SENSOR SEDANG MEMERIKSA" : "SENSOR CHECK")
              : (locale === "id" ? "YANG HARUS DILAKUKAN" : "WHAT TO DO")}
          </small>
          <strong>
            {verifying
              ? (locale === "id" ? "Pertahankan kondisi ini" : "Keep this condition steady")
              : quest.description}
          </strong>
        </div>
        <div className="pm-quest-target"><small>TARGET</small><strong>{quest.target}</strong></div>
      </div>

      {/* The real row's countdown only means anything for the real quest. */}
      {progress && !promoted && (
        <QuestProgress
          mode={progress.mode}
          sinceIso={progress.sinceIso}
          requiredSeconds={progress.requiredSeconds}
          plantId={progress.plantId}
          questId={progress.questId}
          locale={locale}
        />
      )}

      {quest.recoveryLine && !verifying && (
        <p className="mt-3 rounded-xl px-3 py-2 text-xs font-medium leading-5" style={WELL_STYLE}>
          {quest.recoveryLine}
        </p>
      )}

      <details className="pm-quest-why mt-3">
        <summary
          className="font-pixel cursor-pointer select-none text-[10px] leading-relaxed hover:underline"
          style={{ color: "var(--color-forest)" }}
        >
          {locale === "id" ? "Mengapa ini penting" : "Why this matters"}
        </summary>
        <div className="mt-2 rounded-xl px-3 py-2 text-xs leading-5" style={WELL_STYLE}>
          <p>{quest.why}</p>
          {quest.whyExtra && <p className="mt-1.5">{quest.whyExtra}</p>}
        </div>
      </details>
    </>
  );
}
