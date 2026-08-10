"use client";

// Cheat quest board (feature 4): a self-contained demo control that lets a
// presenter jump any quest to any stage instantly. Client-only — it stores the
// chosen stage in the shared cheat store (localStorage) and never touches the
// real quest state machine in Supabase. Renders nothing unless the sandbox is
// active, so it sits harmlessly on the normal Quests page.

import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/i18n";
import { useCheat } from "@/lib/pm-cheat";

export interface CheatQuestItem {
  key: string;
  title: string;
  emoji: string;
  xp: number;
}

const COPY = {
  id: {
    title: "🎛️ Papan Misi (Mode Curang)",
    note: "Klik sebuah tahap untuk melompat ke sana — hanya tampilan demo, misi asli tidak berubah.",
    steps: ["RASAKAN", "BERTINDAK", "VERIFIKASI", "HADIAH"],
  },
  en: {
    title: "🎛️ Quest Board (Cheat Mode)",
    note: "Click a stage to jump there — demo view only; real quests stay untouched.",
    steps: ["SENSE", "ACT", "VERIFY", "REWARD"],
  },
} as const;

export default function CheatQuestPanel({
  locale,
  quests,
}: {
  locale: AppLocale;
  quests: CheatQuestItem[];
}) {
  const { active, api } = useCheat();
  const [stages, setStages] = useState<Record<string, number>>({});

  // Load persisted stage choices once the sandbox is readable.
  useEffect(() => {
    if (!api) return;
    const state = api.getState();
    const saved = (state?.quests ?? {}) as Record<string, unknown>;
    const next: Record<string, number> = {};
    for (const key of Object.keys(saved)) {
      const n = Number(saved[key]);
      if (Number.isFinite(n)) next[key] = n;
    }
    setStages(next);
  }, [api, active]);

  if (!active || !api) return null;
  const t = COPY[locale] ?? COPY.en;

  const jump = (key: string, step: number) => {
    setStages((prev) => ({ ...prev, [key]: step }));
    api.set({ quests: { [key]: step } });
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
