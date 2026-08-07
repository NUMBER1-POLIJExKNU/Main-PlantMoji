// Settings screen (handoff §33) — plant name, species, personality (§13),
// and manual growth stage (§14: sensors cannot infer real growth in MVP).

import Notice from "@/components/notice";
import { getPlant, GROWTH_STAGES, normalizeGrowthStage } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import { normalizePersonality, PERSONALITIES, type PersonalityId } from "@/types/game";
import { updatePlantSettings } from "./actions";

// Always reflect the latest saved values.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

const PERSONALITY_LABELS: Record<PersonalityId, string> = {
  cute: "🎀 Cute",
  calm: "🧘 Calm",
  funny: "🤡 Funny",
  energetic: "⚡ Energetic",
  shy: "😳 Shy",
};

const fieldLabelClass =
  "text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500";
const fieldInputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-green-600 dark:focus:ring-green-900";

export default async function SettingsPage() {
  const supabase = getServerSupabase();

  if (!supabase) {
    return (
      <Notice
        title="Connecting..."
        lines={[
          "Supabase 환경 변수가 아직 설정되지 않았습니다.",
          ".env.local.example을 .env.local로 복사한 뒤 값을 채우고 dev 서버를 재시작하세요.",
          "자세한 순서: docs/SETUP-milestone1-2.md",
        ]}
      />
    );
  }

  const result = await getPlant(supabase, PLANT_ID);

  if (result.status === "no-schema") {
    return (
      <Notice
        title="Supabase 테이블이 아직 없습니다"
        lines={[
          "환경 변수 연결은 정상이지만 스키마가 실행되지 않았습니다.",
          "Supabase Dashboard → SQL Editor에서 아래 두 파일을 순서대로 실행하세요:",
          "1) supabase/milestone1.sql   2) supabase/milestone3.sql",
          "실행 후 이 페이지를 새로고침해 주세요.",
        ]}
      />
    );
  }

  if (result.status === "error") {
    return (
      <Notice
        title="Supabase 연결 오류"
        lines={[result.message, "URL과 키 값을 다시 확인해 주세요."]}
      />
    );
  }

  if (result.status === "not-found") {
    return (
      <Notice
        title={`${PLANT_ID} 데이터가 없습니다`}
        lines={[
          "Supabase SQL Editor에서 supabase/milestone1.sql을 실행해",
          "plants 테이블과 Jin(plant-01) 시드 데이터를 만들어 주세요.",
        ]}
      />
    );
  }

  const plant = result.plant;
  const currentPersonality = normalizePersonality(plant.personality);
  // Seed data uses lowercase stages ("growing") — map to the canonical label.
  const currentStage = normalizeGrowthStage(plant.growth_stage) ?? "New Plant";

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-24 pt-10">
      <header className="mb-6 flex flex-col items-center gap-1 text-center">
        <span className="text-4xl" role="img" aria-hidden="true">
          ⚙️
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Who your plant is, and how it talks to you.
        </p>
      </header>

      <section className="mb-5 flex items-center gap-3 rounded-2xl border border-zinc-200/70 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-3xl leading-none" role="img" aria-hidden="true">
          🪴
        </span>
        <div>
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{plant.name}</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {plant.species ?? "Unknown species"} · {PLANT_ID}
          </p>
        </div>
      </section>

      <form
        action={updatePlantSettings}
        className="flex flex-col gap-5 rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input type="hidden" name="plantId" value={plant.id} />

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClass}>Name</span>
          <input
            type="text"
            name="name"
            defaultValue={plant.name}
            required
            minLength={1}
            maxLength={40}
            autoComplete="off"
            className={fieldInputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClass}>Personality</span>
          <select name="personality" defaultValue={currentPersonality} className={fieldInputClass}>
            {PERSONALITIES.map((personality) => (
              <option key={personality} value={personality}>
                {PERSONALITY_LABELS[personality]}
              </option>
            ))}
          </select>
          <span className="text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
            Changes how your plant talks — never the diagnosis itself.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClass}>Growth stage</span>
          <select name="growthStage" defaultValue={currentStage} className={fieldInputClass}>
            {GROWTH_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
          <span className="text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
            Tracked manually in the MVP — sensors can&apos;t measure real growth.
            Separate from Bond Level, which never decreases.
          </span>
        </label>

        <button
          type="submit"
          className="mt-1 rounded-2xl bg-green-600 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800 dark:bg-green-500 dark:text-green-950 dark:hover:bg-green-400"
        >
          Save changes
        </button>
      </form>
    </main>
  );
}
