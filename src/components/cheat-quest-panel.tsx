"use client";

// Cheat quest board (feature 4): a self-contained demo control that lets a
// presenter jump any quest to any stage instantly. Client-only — it stores the
// chosen stage in the shared cheat store (localStorage) and never touches the
// real quest state machine in Supabase. Renders nothing unless the sandbox is
// active, so it sits harmlessly on the normal Quests page.

import type { AppLocale } from "@/lib/i18n";
import type { CropProfile } from "@/lib/crop-profiles";
import { useCheat } from "@/lib/pm-cheat";
import { sensorsForStage } from "@/game/quests/cheat-quest-stage";
import type { QuestKey } from "@/types/game";

export interface CheatQuestItem {
  key: string;
  title: string;
  emoji: string;
  xp: number;
}

const COPY = {
  id: {
    title: "🎛️ Papan Misi (Mode Curang)",
    note: "Klik sebuah tahap untuk melompat ke sana — nilai sensor ikut menyesuaikan. Klik lagi untuk mengembalikannya ke editor sensor. Hanya tampilan demo; misi asli dan perangkat tidak berubah.",
    steps: ["RASAKAN", "BERTINDAK", "VERIFIKASI", "HADIAH"],
  },
  en: {
    title: "🎛️ Quest Board (Cheat Mode)",
    note: "Click a stage to jump there — the sensors move to match. Click it again to hand the quest back to the sensor editor. Demo view only; real quests and hardware stay untouched.",
    steps: ["SENSE", "ACT", "VERIFY", "REWARD"],
  },
} as const;

export default function CheatQuestPanel({
  locale,
  quests,
  cropProfile = null,
}: {
  locale: AppLocale;
  quests: CheatQuestItem[];
  /** Active crop profile, so a stage jump writes the thresholds this plant is
   *  actually judged against. Null falls back to the default profile. */
  cropProfile?: CropProfile | null;
}) {
  const { active, api, state } = useCheat();

  if (!active || !api) return null;
  const t = COPY[locale] ?? COPY.en;

  // The sandbox store is the only source of truth here: api.set() emits its
  // change event synchronously, so useCheat re-renders us with the new stage.
  // Mirroring it into local state bought nothing and let the two drift.
  const stages: Record<string, number> = {};
  for (const [key, value] of Object.entries(state?.quests ?? {})) {
    const step = Number(value);
    if (Number.isFinite(step)) stages[key] = step;
  }

  // A stage jump moves the world, not just the card: it also writes the sensor
  // readings that make that stage true, so the mascot's face, the vitals tiles
  // and the Monitoring cards all agree with the stage being shown. Values come
  // from the crop profile, so they match what the engine verifies against.
  //
  // Clicking the stage a quest is already pinned to releases the pin (stage 0
  // = "no opinion") and leaves the sensors where they are, handing that quest
  // back to the sensor editor — otherwise pinning one quest for a beat would
  // lock it out of the "watch it move when I fix the soil" demo.
  const jump = (key: string, step: number) => {
    if (stages[key] === step) {
      api.set({ quests: { [key]: 0 } });
      return;
    }
    api.set({
      quests: { [key]: step },
      vitals: sensorsForStage(key as QuestKey, step, cropProfile ?? undefined),
    });
  };

  return (
    <section
      className="pm-panel mb-4 flex flex-col gap-3"
      style={{ borderColor: "#C2618A", background: "linear-gradient(135deg,#FFF1D6,var(--color-surface))" }}
    >
      <h2 className="pm-heading text-xs" style={{ color: "#8A2B5B" }}>
        {t.title}
      </h2>
      <ul className="flex flex-col gap-2">
        {quests.map((quest) => {
          const current = stages[quest.key] ?? 0;
          return (
            <li key={quest.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xl leading-none" role="img" aria-hidden="true">
                {quest.emoji}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{quest.title}</span>
              <span className="pm-chip shrink-0" style={{ background: "var(--color-yellow)", borderColor: "#E8C46B", color: "#6B4F10" }}>
                +{quest.xp} XP
              </span>
              <span className="flex gap-1" role="group" aria-label={quest.title}>
                {t.steps.map((label, index) => {
                  const step = index + 1;
                  const reached = current >= step;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => jump(quest.key, step)}
                      className="rounded-md border-2 px-1.5 py-0.5 text-[9px] font-bold"
                      style={
                        reached
                          ? { borderColor: "#8A2B5B", background: "#8A2B5B", color: "#fff" }
                          : { borderColor: "#E0B0C6", background: "#fff", color: "#8A2B5B" }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] leading-4" style={{ color: "#7A5B12" }}>
        {t.note}
      </p>
    </section>
  );
}
