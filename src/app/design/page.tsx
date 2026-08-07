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
  DryAir: { emoji: "💨", card: "bg-amber-50 dark:bg-amber-950", badge: "bg-amber-200 text-amber-900" },
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
        🎨 이 페이지는 <strong>디자이너 놀이터</strong>입니다. Supabase나 게임 엔진 연결 없이
        목(mock) props로만 프레젠테이셔널 컴포넌트를 렌더링합니다. 여기서 확인한 스타일을
        실제 컴포넌트(<code>src/components/</code>)에 반영하면, 실제 페이지에도 그대로
        적용됩니다.
      </div>

      <section>
        <SectionHeading title="BondPanel" hint="bondLevel=3, 40 / 100 XP, 5일 스트릭" />
        <BondPanel bondLevel={3} totalXp={240} xpInLevel={40} xpRequired={100} streakDays={5} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="HomeQuestCard"
          hint="Verifying 상태 예시 (static quest 객체) + 활성 퀘스트 없음(null) 예시"
        />
        <HomeQuestCard quest={VERIFYING_QUEST} />
        <HomeQuestCard quest={null} />
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading
          title="QuestProgress"
          hint="maintain(카운트업) / verifying(카운트다운) — client component, 고정 ISO 타임스탬프 사용"
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
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="LevelUpOverlay"
          hint="토글 버튼으로 확인 — 자동으로 2.5초 후 dismiss되거나 탭하면 즉시 닫힘"
        />
        <button
          type="button"
          onClick={() => setShowLevelUp(true)}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          레벨업 오버레이 보기
        </button>
        <LevelUpOverlay level={4} show={showLevelUp} onDone={() => setShowLevelUp(false)} />
      </section>

      <section>
        <SectionHeading
          title="Notice"
          hint="설정 안내 / 에러 상태에 쓰이는 공용 풀스크린 안내 (src/app/page.tsx 등에서 사용)"
        />
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <Notice
            title="Connecting..."
            lines={[
              "Supabase 환경 변수가 아직 설정되지 않았습니다.",
              ".env.local.example을 .env.local로 복사한 뒤 값을 채우고 dev 서버를 재시작하세요.",
            ]}
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Mood chips"
          hint="MOOD_LABELS는 @/types/events에서 import, 이모지/색상 메타는 목(mock) 값"
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
