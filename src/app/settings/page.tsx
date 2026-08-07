// Settings screen (handoff §33) — plant name, species, personality (§13),
// and manual growth stage (§14: sensors cannot infer real growth in MVP).

import Notice from "@/components/notice";
import { fetchGrowthRecords } from "@/lib/growth";
import { getPlant, GROWTH_STAGES, normalizeGrowthStage } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import { normalizePersonality, PERSONALITIES, STREAK_TIMEZONE, type PersonalityId } from "@/types/game";
import { addGrowthRecord, updatePlantSettings } from "./actions";

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

const growthDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: STREAK_TIMEZONE,
});

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

  // Manual growth log (handoff §14, §35). Empty when milestone5 hasn't been
  // run yet — fetchGrowthRecords tolerates the missing table on its own.
  const growthRecords = await fetchGrowthRecords(plant.id);

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

      <section className="mt-5 flex flex-col gap-5 rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">성장 기록</h2>
          <p className="text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
            Growth Stage는 센서가 아니라 이 기록으로만 갱신됩니다. 새 기록을 추가하면 위 Growth
            stage 값도 함께 바뀝니다.
          </p>
        </div>

        <form action={addGrowthRecord} className="flex flex-col gap-4">
          <input type="hidden" name="plantId" value={plant.id} />

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClass}>Stage</span>
            <select name="stage" defaultValue={currentStage} className={fieldInputClass}>
              {GROWTH_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabelClass}>Height (cm)</span>
              <input
                type="number"
                name="heightCm"
                min={0}
                max={500}
                step="0.1"
                placeholder="—"
                className={fieldInputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabelClass}>Leaves</span>
              <input
                type="number"
                name="leafCount"
                min={0}
                max={10000}
                step={1}
                placeholder="—"
                className={fieldInputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClass}>Note</span>
            <input
              type="text"
              name="note"
              maxLength={200}
              placeholder="새 잎이 나왔어요"
              autoComplete="off"
              className={fieldInputClass}
            />
          </label>

          <button
            type="submit"
            className="rounded-2xl bg-green-600 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800 dark:bg-green-500 dark:text-green-950 dark:hover:bg-green-400"
          >
            기록 추가
          </button>
        </form>

        <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          {growthRecords.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              아직 기록이 없습니다. 첫 성장 기록을 추가해 보세요.
            </p>
          ) : (
            growthRecords.map((record) => {
              const recordedMs = Date.parse(record.recorded_at);
              const dateLabel = Number.isNaN(recordedMs)
                ? ""
                : growthDateFormat.format(new Date(recordedMs));
              const details = [
                record.height_cm != null ? `${record.height_cm}cm` : null,
                record.leaf_count != null ? `잎 ${record.leaf_count}개` : null,
              ]
                .filter((part): part is string => part != null)
                .join(" · ");

              return (
                <div
                  key={record.id}
                  className="flex flex-col gap-0.5 rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/60"
                >
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {dateLabel} ·{" "}
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                      {record.stage}
                    </span>
                  </span>
                  {details.length > 0 && (
                    <span className="text-zinc-400 dark:text-zinc-500">{details}</span>
                  )}
                  {record.note && (
                    <span className="text-zinc-600 dark:text-zinc-300">{record.note}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
