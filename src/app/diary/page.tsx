// Growth Diary screen (handoff §14, §35) — the manual growth-records log,
// promoted out of Settings into its own page. There is no dedicated "Diary"
// item in the shared seven-destination nav (src/components/reno-app-shell.tsx);
// this page is reached via the link-card on /settings instead. Sensors
// cannot infer real growth in the MVP: this page is the human-written
// source of truth for growth stage.
//
// The form/list below used to be mirrored 1:1 on src/app/settings/page.tsx
// (same fields, same addGrowthRecord action, same bilingual copy) — that
// section has since been removed from Settings in favor of this page.

import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
import { fetchGrowthRecords } from "@/lib/growth";
import { getPlant, GROWTH_STAGES, normalizeGrowthStage } from "@/lib/queries";
import { getRequestLocale } from "@/lib/i18n-server";
import { getServerSupabase } from "@/lib/supabase/server";
import { STREAK_TIMEZONE } from "@/types/game";
import { addGrowthRecord } from "../settings/actions";

// Always reflect the latest saved values.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

// Farm form chrome (public/farm design language): tiny pixel labels and
// sprout-green bordered inputs on the solid white surface. Kept identical
// to src/app/settings/page.tsx's field classes.
const fieldLabelClass = "pm-heading text-[10px] uppercase opacity-80";
const fieldInputClass =
  "w-full rounded-[10px] border-2 border-[#BCD3B4] bg-white px-4 py-2.5 text-sm text-[#243421] outline-none focus:ring-2 focus:ring-[#89D974]";
const fieldHelpClass = "text-[11px] leading-4 text-[#57684F]";

export default async function DiaryPage() {
  const locale = await getRequestLocale();
  const growthDateFormat = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: STREAK_TIMEZONE,
  });
  const supabase = getServerSupabase();

  if (!supabase) {
    return (
      <Notice
        title="Connecting..."
        lines={[
          "Supabase environment variables are not set yet.",
          "Copy .env.local.example to .env.local, fill in the values, then restart the dev server.",
          "Full steps: docs/SETUP-milestone1-2.md",
        ]}
      />
    );
  }

  // Started alongside getPlant — the growth log is keyed by PLANT_ID (the
  // same id getPlant resolves) and fetchGrowthRecords never rejects (it
  // returns [] on any failure), so kicking it off before the status checks
  // can't change which Notice renders below; it's only awaited once the
  // plant row is confirmed.
  const growthRecordsPromise = fetchGrowthRecords(PLANT_ID);
  const result = await getPlant(supabase, PLANT_ID);

  if (result.status === "no-schema") {
    return (
      <Notice
        title="Supabase tables don't exist yet"
        lines={[
          "Environment variables are connected, but the schema hasn't been run.",
          "In Supabase Dashboard → SQL Editor, run these two files in order:",
          "1) supabase/milestone1.sql   2) supabase/milestone3.sql",
          "Then refresh this page.",
        ]}
      />
    );
  }

  if (result.status === "error") {
    return (
      <Notice
        title="Supabase connection error"
        lines={[result.message, "Double-check your URL and key values."]}
      />
    );
  }

  if (result.status === "not-found") {
    return (
      <Notice
        title={`No data for ${PLANT_ID}`}
        lines={[
          "Run supabase/milestone1.sql in the Supabase SQL Editor",
          "to create the plants table and the Jamkachu (plant-01) seed data.",
        ]}
      />
    );
  }

  const plant = result.plant;
  // Seed data uses lowercase stages ("growing") — map to the canonical label.
  const currentStage = normalizeGrowthStage(plant.growth_stage) ?? "New Plant";

  // Manual growth log (handoff §14, §35). Empty when milestone5 hasn't been
  // run yet — fetchGrowthRecords tolerates the missing table on its own.
  const growthRecords = await growthRecordsPromise;
  const [memoryResult, companionResult] = await Promise.all([
    supabase.from("bond_events").select("event_id,type,data,occurred_at").eq("plant_id", PLANT_ID).in("type", ["QUEST_COMPLETED", "COMPANION_EVOLVED", "LEVEL_UP", "BADGE_UNLOCKED", "CHAPTER_UNLOCKED"]).order("occurred_at", { ascending: false }).limit(50),
    supabase.from("companion_state").select("stage,form_key").eq("plant_id", PLANT_ID).maybeSingle(),
  ]);
  const memories = memoryResult.error ? [] : (memoryResult.data ?? []);
  const companion = companionResult.error ? null : companionResult.data;

  const memoryTitle = (row: { type: string; data: Record<string, unknown> | null }) => {
    const data = row.data ?? {};
    if (row.type === "QUEST_COMPLETED") return locale === "id" ? `Perawatan terverifikasi: ${data.title ?? data.questKey ?? "Quest"}` : `Verified care: ${data.title ?? data.questKey ?? "Quest"}`;
    if (row.type === "COMPANION_EVOLVED") return locale === "id" ? `Companion berevolusi menjadi ${data.stage}` : `Companion evolved into ${data.stage}`;
    if (row.type === "LEVEL_UP") return locale === "id" ? `Bond naik ke Level ${data.levelAfter ?? "?"}` : `Bond reached Level ${data.levelAfter ?? "?"}`;
    if (row.type === "BADGE_UNLOCKED") return locale === "id" ? `Lencana terbuka: ${data.name ?? data.badgeKey}` : `Badge unlocked: ${data.name ?? data.badgeKey}`;
    return locale === "id" ? `Bab cerita terbuka: ${data.title ?? data.chapter}` : `Story chapter unlocked: ${data.title ?? data.chapter}`;
  };

  // Farm column: cards cap at 640px like the farm home stack (.pm-card).
  return (
    <main className="mx-auto w-full">
      <PageHeader
        icon="🌱"
        title={locale === "id" ? "Buku Harian" : "Growth Diary"}
        description={
          locale === "id"
            ? `Catatan pertumbuhan ${plant.name} — ditulis olehmu, bukan sensor.`
            : `${plant.name}'s growth story — written by you, not the sensors.`
        }
      />

      <div className="mx-auto w-full max-w-[640px]">
        <section className="pm-panel mb-5 flex flex-col gap-4">
          <div>
            <h2 className="pm-heading text-xs">{locale === "id" ? "Kenangan Perawatan" : "Care Memories"}</h2>
            <p className={fieldHelpClass}>
              {companion
                ? `${locale === "id" ? "Companion virtual" : "Virtual companion"}: ${companion.stage} · ${companion.form_key}. ${locale === "id" ? "Ini terpisah dari tahap pertumbuhan tanaman asli." : "This is separate from the real plant growth stage."}`
                : locale === "id" ? "Companion masih menggunakan tampilan awal sampai Milestone 11 aktif." : "The companion uses its original look until Milestone 11 is active."}
            </p>
          </div>
          {memories.length === 0 ? (
            <p className="text-xs text-[#57684F]">{locale === "id" ? "Belum ada kenangan perawatan." : "No care memories yet."}</p>
          ) : memories.map((row) => (
            <div key={row.event_id} className="rounded-xl border-2 border-[#DCEAD5] bg-[#F4FAF1] px-3 py-2 text-xs">
              <div className="font-semibold text-[#243421]">{memoryTitle(row as { type: string; data: Record<string, unknown> | null })}</div>
              <div className="text-[#57684F]">{growthDateFormat.format(new Date(row.occurred_at))}</div>
            </div>
          ))}
        </section>
        <section className="pm-panel flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="pm-heading text-xs">
              {locale === "id" ? "Catatan Pertumbuhan" : "Growth Notes"}
            </h2>
            <p className={fieldHelpClass}>
              {locale === "id"
                ? "Tahap pertumbuhan hanya diperbarui lewat catatan ini — bukan oleh sensor. Sensor belum bisa mengukur pertumbuhan asli, dan ini terpisah dari Bond Level, yang tidak pernah turun."
                : "Growth stage is updated only through these records — never by sensors. Sensors can't measure real growth, and this is separate from Bond Level, which never decreases."}
            </p>
          </div>

          <form action={addGrowthRecord} className="flex flex-col gap-4">
            <input type="hidden" name="plantId" value={plant.id} />

            <label className="flex flex-col gap-1.5">
              <span className={fieldLabelClass}>{locale === "id" ? "Tahap" : "Stage"}</span>
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
                <span className={fieldLabelClass}>
                  {locale === "id" ? "Tinggi (cm)" : "Height (cm)"}
                </span>
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
                <span className={fieldLabelClass}>{locale === "id" ? "Jumlah Daun" : "Leaves"}</span>
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
              <span className={fieldLabelClass}>{locale === "id" ? "Catatan" : "Note"}</span>
              <input
                type="text"
                name="note"
                maxLength={200}
                placeholder={locale === "id" ? "Ada daun baru muncul" : "A new leaf appeared"}
                autoComplete="off"
                className={fieldInputClass}
              />
            </label>

            <button type="submit" className="pm-btn pm-btn-primary w-full">
              {locale === "id" ? "Tambah catatan" : "Add record"}
            </button>
          </form>

          <div className="flex flex-col gap-2 border-t-2 border-dashed border-[#BCD3B4] pt-4">
            {growthRecords.length === 0 ? (
              <p className="text-xs text-[#57684F]">
                {locale === "id"
                  ? "Belum ada catatan. Tambahkan catatan pertumbuhan pertamamu."
                  : "No records yet. Add your first growth record."}
              </p>
            ) : (
              growthRecords.map((record) => {
                const recordedMs = Date.parse(record.recorded_at);
                const dateLabel = Number.isNaN(recordedMs)
                  ? ""
                  : growthDateFormat.format(new Date(recordedMs));
                const details = [
                  record.height_cm != null ? `${record.height_cm}cm` : null,
                  record.leaf_count != null
                    ? locale === "id"
                      ? `${record.leaf_count} daun`
                      : `${record.leaf_count} leaves`
                    : null,
                ]
                  .filter((part): part is string => part != null)
                  .join(" · ");

                return (
                  <div
                    key={record.id}
                    className="flex flex-col gap-0.5 rounded-xl border-2 border-[#DCEAD5] bg-[#F4FAF1] px-3 py-2 text-xs"
                  >
                    <span className="text-[#57684F]">
                      {dateLabel} ·{" "}
                      <span className="font-semibold text-[#243421]">{record.stage}</span>
                    </span>
                    {details.length > 0 && <span className="text-[#57684F]">{details}</span>}
                    {record.note && <span className="text-[#3A4A34]">{record.note}</span>}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
