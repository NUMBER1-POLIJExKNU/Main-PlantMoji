"use client";

// Design sandbox (see CONTRIBUTING.md §4) — renders every presentational
// component with realistic MOCK props so the design teammate can style
// src/components/** without Supabase, the game engine, or any env vars.
//
// Hard rule for this file: no imports from "@/game/**", "@/lib/**", or
// "@/components/plant-home" (that container owns real data fetching). Only
// the presentational components themselves + shared types.
//
// Timestamps below are hardcoded fixed ISO strings on purpose — deriving
// "now" during render (or via a lazy useState initializer) would call
// Date.now() during render and violate React 19 purity rules. A static
// sandbox snapshot is deterministic and good enough for styling work.

import { useState } from "react";
import BondPanel from "@/components/bond-panel";
import HomeQuestCard, { type HomeQuestInfo } from "@/components/home-quest-card";
import QuestProgress from "@/components/quest-progress";
import Notice from "@/components/notice";
import LevelUpOverlay from "@/components/level-up-overlay";
import { MOOD_LABELS, PLANT_MOODS, type PlantMood } from "@/types/events";

// Copied inline from plant-home.tsx's MOOD_META (mock only — this page must
// not import from plant-home, which pulls in Supabase-backed data). Keep in
// sync by hand if the real mood meta ever changes.
const MOOD_META: Record<PlantMood, { emoji: string; card: string; badge: string }> = {
  Happy: { emoji: "😊", card: "bg-green-50 dark:bg-green-950", badge: "bg-green-200 text-green-900" },
  Overheating: { emoji: "🔥", card: "bg-red-50 dark:bg-red-950", badge: "bg-red-200 text-red-900" },
  TooCold: { emoji: "🥶", card: "bg-sky-50 dark:bg-sky-950", badge: "bg-sky-200 text-sky-900" },
  DryAir: { emoji: "💨", card: "bg-amber-50 dark:bg-amber-950", badge: "bg-amber-200 text-amber-900" },
  HumidAir: { emoji: "🌫️", card: "bg-cyan-50 dark:bg-cyan-950", badge: "bg-cyan-200 text-cyan-900" },
  Sleepy: { emoji: "🌙", card: "bg-indigo-50 dark:bg-indigo-950", badge: "bg-indigo-200 text-indigo-900" },
  SoilAcidic: { emoji: "🧪", card: "bg-orange-50 dark:bg-orange-950", badge: "bg-orange-200 text-orange-900" },
  SoilAlkaline: { emoji: "🧪", card: "bg-purple-50 dark:bg-purple-950", badge: "bg-purple-200 text-purple-900" },
};

const VERIFYING_QUEST: HomeQuestInfo = {
  emoji: "💧",
  title: "Keep the soil moist",
  statusLabel: "Verifying",
  progressLabel: "Verifying… 1:45 left",
};

// Fixed points in time — fully deterministic, no Date.now() anywhere.
const MAINTAIN_SINCE_ISO = "2026-08-07T09:00:00+09:00";
const VERIFYING_SINCE_ISO = "2026-08-07T09:25:00+09:00";

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{hint}</p>}
    </div>
  );
}

export default function DesignSandboxPage() {
  const [showLevelUp, setShowLevelUp] = useState(false);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-10 px-6 pt-8 pb-32">
      <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200">
        🎨 This page is the <strong>designer playground</strong>. It renders the presentational
        components with mock props only — no Supabase or game engine connection. Apply the styles
        you settle on here to the real components (<code>src/components/</code>) and they carry
        over to the actual pages as-is.
      </div>

      <section>
        <SectionHeading title="BondPanel" hint="bondLevel=3, 40 / 100 XP, 5-day streak" />
        <BondPanel bondLevel={3} totalXp={240} xpInLevel={40} xpRequired={100} streakDays={5} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="HomeQuestCard"
          hint="Verifying-state example (static quest object) + no-active-quest (null) example"
        />
        <HomeQuestCard quest={VERIFYING_QUEST} />
        <HomeQuestCard quest={null} />
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading
          title="QuestProgress"
          hint="maintain (count-up) / verifying (countdown) — client component, uses fixed ISO timestamps"
        />
        <div>
          <p className="mb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            mode: &quot;maintain&quot;
          </p>
          <QuestProgress
            mode="maintain"
            sinceIso={MAINTAIN_SINCE_ISO}
            requiredSeconds={1800}
            plantId="design-sandbox"
            questId="design-maintain"
            locale="en"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            mode: &quot;verifying&quot;
          </p>
          <QuestProgress
            mode="verifying"
            sinceIso={VERIFYING_SINCE_ISO}
            requiredSeconds={600}
            plantId="design-sandbox"
            questId="design-verifying"
            locale="en"
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="LevelUpOverlay"
          hint="Toggle with the button — auto-dismisses after 2.5s, or tap to close immediately"
        />
        <button
          type="button"
          onClick={() => setShowLevelUp(true)}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Show level-up overlay
        </button>
        <LevelUpOverlay level={4} show={showLevelUp} onDone={() => setShowLevelUp(false)} />
      </section>

      <section>
        <SectionHeading
          title="Notice"
          hint="Shared full-screen notice for setup guidance / error states (used in src/app/page.tsx and elsewhere)"
        />
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <Notice
            title="Connecting..."
            lines={[
              "Supabase environment variables are not set yet.",
              "Copy .env.local.example to .env.local, fill in the values, then restart the dev server.",
            ]}
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Mood chips"
          hint="MOOD_LABELS imported from @/types/events; emoji/color meta are mock values"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PLANT_MOODS.map((mood) => {
            const meta = MOOD_META[mood];
            return (
              <div
                key={mood}
                className={`flex flex-col items-center gap-1.5 rounded-2xl p-4 text-center ${meta.card}`}
              >
                <span className="text-3xl" role="img" aria-hidden="true">
                  {meta.emoji}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}>
                  {MOOD_LABELS[mood]}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
