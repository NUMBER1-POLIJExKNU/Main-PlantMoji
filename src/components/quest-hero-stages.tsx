"use client";

// The HERO MISSION's stage row, companion line and action well.
//
// These are a client island purely so the classroom sandbox can move them: the
// quest row itself comes from Supabase, and in a demo it never changes, which
// left the hero mission stuck on ACT no matter what the presenter did. With
// the sandbox off this renders exactly what the server would have — the real
// quest status and nothing else.

import type { AppLocale } from "@/lib/i18n";
import type { CropProfile } from "@/lib/crop-profiles";
import { useCheat } from "@/lib/pm-cheat";
import {
  cheatQuestStage,
  stageFromQuestStatus,
  STAGE_VERIFY,
} from "@/game/quests/cheat-quest-stage";
import type { QuestKey } from "@/types/game";

export default function QuestHeroStages({
  questKey,
  questStatus,
  locale,
  description,
  target,
  cropProfile = null,
}: {
  questKey: QuestKey;
  /** Live status of the quest row (ACTIVE / VERIFYING / …). */
  questStatus: string | null;
  locale: AppLocale;
  /** Localized "what to do" copy for this quest. */
  description: string;
  /** Localized target line (e.g. "pH 5.5–6.5"). */
  target: string;
  /** Active crop profile, so the sandbox verifies against the same thresholds
   *  the engine would. Null falls back to the default profile. */
  cropProfile?: CropProfile | null;
}) {
  const { active, state } = useCheat();

  const stage = active && state
    ? cheatQuestStage({
        key: questKey,
        questStatus,
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
      <div className="pm-quest-companion">
        <div className={`pm-quest-jam${verifying ? " is-watching" : ""}`} aria-hidden="true"><i /><i /></div>
        <p>
          {verifying
            ? (locale === "id"
              ? "Aku sedang melihat sensornya… pertahankan sebentar lagi!"
              : "I'm watching the sensors… keep it steady a little longer!")
            : (locale === "id"
              ? "Kita lakukan bersama, ya! Setelah itu sensor akan memeriksanya."
              : "Let's do this together! Then the sensors will check our work.")}
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
              : description}
          </strong>
        </div>
        <div className="pm-quest-target"><small>TARGET</small><strong>{target}</strong></div>
      </div>
    </>
  );
}
