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
import JamkachuMemoryReflection from "@/components/jamkachu-memory-reflection";
import { growthStagePhase, spriteAssetPath } from "@/lib/jamkachu-sprite";
import { fetchGrowthRecords } from "@/lib/growth";
import { getPlant, GROWTH_STAGES, normalizeGrowthStage } from "@/lib/queries";
import { companionFormLabel, companionStageLabel, growthStageLabel } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { getServerSupabase } from "@/lib/supabase/server";
import { STREAK_TIMEZONE } from "@/types/game";
import { toJamkachuMemory, type MemoryEventRow } from "@/lib/jamkachu-memory";
import { addGrowthRecordFromForm } from "../settings/actions";
import "./diary.css";

// Always reflect the latest saved values.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

// Farm form chrome (public/farm design language): tiny pixel labels and
// sprout-green bordered inputs on the solid white surface. Kept identical
// to src/app/settings/page.tsx's field classes.
const fieldLabelClass = "pm-heading text-[10px] uppercase opacity-80";
const fieldInputClass =
  "w-full rounded-[10px] border-2 border-[#BCD3B4] bg-white px-4 py-2.5 text-base text-[#243421] outline-none focus:ring-2 focus:ring-[#89D974]";
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
        locale={locale}
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
        locale={locale}
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
        locale={locale}
        title="Supabase connection error"
        lines={[result.message, "Double-check your URL and key values."]}
      />
    );
  }

  if (result.status === "not-found") {
    return (
      <Notice
        locale={locale}
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
  const snapshotUrls = new Map<string, string>();
  await Promise.all(growthRecords.map(async (record) => {
    if (!record.photo_path) return;
    const { data } = await supabase.storage.from("growth-snapshots").createSignedUrl(record.photo_path, 3600);
    if (data?.signedUrl) snapshotUrls.set(record.id, data.signedUrl);
  }));
  const featuredSnapshotRecord = growthRecords.find((record) => snapshotUrls.has(record.id));
  const featuredSnapshot = featuredSnapshotRecord ? {
    url: snapshotUrls.get(featuredSnapshotRecord.id)!,
    date: growthDateFormat.format(new Date(featuredSnapshotRecord.recorded_at)),
    stage: featuredSnapshotRecord.stage,
  } : undefined;
  const [memoryResult, companionResult] = await Promise.all([
    supabase.from("bond_events").select("event_id,type,data,occurred_at").eq("plant_id", PLANT_ID).in("type", ["QUEST_COMPLETED", "COMPANION_EVOLVED", "LEVEL_UP", "BADGE_UNLOCKED", "CHAPTER_UNLOCKED"]).order("occurred_at", { ascending: false }).limit(50),
    supabase.from("companion_state").select("stage,form_key").eq("plant_id", PLANT_ID).maybeSingle(),
  ]);
  const memories = (memoryResult.error ? [] : (memoryResult.data ?? []))
    .map((row) => toJamkachuMemory(row as MemoryEventRow, locale))
    .filter((memory) => memory !== null);
  const companion = companionResult.error ? null : companionResult.data;

  // Farm column: cards cap at 640px like the farm home stack (.pm-card).
  return (
    <main className="mx-auto w-full">
      <PageHeader
        destination="diary"
        eyebrow={locale === "id" ? "KENANGAN TANAMAN" : "PLANT MEMORIES"}
        title={locale === "id" ? "Diari Tumbuh" : "Growth Diary"}
        description={locale === "id" ? "Foto dan catat perubahan kecil agar perjalanan tumbuhnya mudah diingat." : "Photograph and note small changes so the growth journey is easy to remember."}
      />

      <div className="pm-diary-page mx-auto w-full max-w-[640px]">
        <JamkachuMemoryReflection memories={memories} locale={locale} snapshot={featuredSnapshot} />
        {companion && <div className="pm-diary-stage-stamp">{companionStageLabel(locale, String(companion.stage))} · {companionFormLabel(locale, String(companion.form_key))}</div>}
        <section className="pm-diary-notebook flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="pm-heading text-xs">
              {locale === "id" ? "Catatan Pertumbuhan" : "Growth Notes"}
            </h2>
            <p className={fieldHelpClass}>{locale === "id" ? "Foto, ukur, lalu tulis apa yang berubah." : "Photograph, measure, and note what changed."}</p>
          </div>

          <form action={addGrowthRecordFromForm} className="pm-diary-paper-note flex flex-col gap-4">
            <input type="hidden" name="plantId" value={plant.id} />

            <label className="flex flex-col gap-1.5">
              <span className={fieldLabelClass}>{locale === "id" ? "Tahap" : "Stage"}</span>
              <select name="stage" defaultValue={currentStage} className={fieldInputClass}>
                {GROWTH_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {growthStageLabel(locale, stage)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={fieldLabelClass}>{locale === "id" ? "Snapshot tanaman" : "Plant snapshot"}</span>
              <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" capture="environment" className={fieldInputClass} />
              <span className={fieldHelpClass}>{locale === "id" ? "Opsional · JPEG, PNG, atau WebP · maksimal 5 MB" : "Optional · JPEG, PNG, or WebP · up to 5 MB"}</span>
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

          <div className="pm-diary-print-grid">
            {growthRecords.length === 0 ? (
              <p className="pm-panel col-span-full text-xs text-[#57684F]">
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

                const snapshotUrl = snapshotUrls.get(record.id);
                return <article key={record.id} className="pm-growth-postcard">
                  <div className={`pm-growth-photo${snapshotUrl ? " has-photo" : ""}`}>
                    {snapshotUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase Storage URL
                      <img src={snapshotUrl} alt={locale === "id" ? `Snapshot pertumbuhan ${plant.name} pada ${dateLabel}` : `${plant.name} growth snapshot on ${dateLabel}`} />
                    ) : <div className="pm-growth-autoart" aria-label={locale === "id" ? `Potret Jamkachu tahap ${growthStageLabel(locale, record.stage)}` : `Jamkachu portrait at the ${growthStageLabel(locale, record.stage)} stage`}>
                      {/* No manual photo: show the record's growth stage as a
                          Jamkachu portrait automatically. Honest caption — a
                          drawn portrait, never presented as a real photo. */}
                      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static sprite, pixelated rendering */}
                      <img src={spriteAssetPath(growthStagePhase(record.stage), "happy", "", "2x")} alt="" />
                      <small>{locale === "id" ? "POTRET JAMKACHU" : "JAMKACHU PORTRAIT"}</small>
                    </div>}
                    {snapshotUrl && <b>{locale === "id" ? "JEPRET!" : "SNAP!"}</b>}
                  </div>
                  <div className="pm-growth-postcard-copy">
                    <span>{dateLabel} · <strong>{growthStageLabel(locale, record.stage)}</strong></span>
                    {details.length > 0 && <span>{details}</span>}
                    {record.note && <q>{record.note}</q>}
                    {record.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL; next/image would need remotePatterns config
                      <img
                        src={record.photo_url}
                        alt={
                          locale === "id"
                            ? `Foto pertumbuhan ${dateLabel}`
                            : `Growth photo ${dateLabel}`
                        }
                        loading="lazy"
                        className="mt-1 w-full max-w-[240px] rounded-lg border-2 border-[#DCEAD5]"
                      />
                    )}
                    {record.ai_comment && (
                      <span className="italic text-[#57684F]">“{record.ai_comment}”</span>
                    )}
                  </div>
                </article>;
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
