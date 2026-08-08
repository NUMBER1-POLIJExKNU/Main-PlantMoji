// Settings screen (handoff §33) — plant name, species, personality (§13),
// and manual growth stage (§14: sensors cannot infer real growth in MVP).

import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
import DemoControlCenter from "@/components/demo-control-center";
import { BADGE_KEYS } from "@/types/game";
import { CHAPTER_DEFINITIONS } from "@/game/story/story-definitions";
import { getBondState } from "@/game/progression/xp-engine";
import { fetchGrowthRecords } from "@/lib/growth";
import { getPlant, getUnlockedBadges, GROWTH_STAGES, normalizeGrowthStage } from "@/lib/queries";
import { getRequestLocale } from "@/lib/i18n-server";
import { getServerSupabase } from "@/lib/supabase/server";
import type { AppLocale } from "@/lib/i18n";
import { normalizePersonality, PERSONALITIES, STREAK_TIMEZONE, type PersonalityId } from "@/types/game";
import { addGrowthRecord, updatePlantSettings } from "./actions";

// Always reflect the latest saved values.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

// Personality VALUES stay English (stored/db enum, normalizePersonality
// contract) — only the displayed word is localized, same pattern as every
// other id/en copy pair on this page.
const PERSONALITY_LABELS: Record<AppLocale, Record<PersonalityId, string>> = {
  en: {
    cute: "🎀 Cute",
    calm: "🧘 Calm",
    funny: "🤡 Funny",
    energetic: "⚡ Energetic",
    shy: "😳 Shy",
  },
  id: {
    cute: "🎀 Imut",
    calm: "🧘 Tenang",
    funny: "🤡 Lucu",
    energetic: "⚡ Enerjik",
    shy: "😳 Pemalu",
  },
};

// Farm form chrome (public/farm design language): tiny pixel labels and
// sprout-green bordered inputs on the solid white surface.
const fieldLabelClass = "pm-heading text-[10px] uppercase opacity-80";
const fieldInputClass =
  "w-full rounded-[10px] border-2 border-[#BCD3B4] bg-white px-4 py-2.5 text-sm text-[#243421] outline-none focus:ring-2 focus:ring-[#89D974]";
const fieldHelpClass = "text-[11px] leading-4 text-[#57684F]";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Presentation tooling stays out of the normal student UX (spec §2.3):
  // the Demo Control Center only renders on /settings?demo=1.
  const showDemo = (await searchParams).demo === "1";
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
  const currentPersonality = normalizePersonality(plant.personality);
  // Seed data uses lowercase stages ("growing") — map to the canonical label.
  const currentStage = normalizeGrowthStage(plant.growth_stage) ?? "New Plant";

  // Manual growth log (handoff §14, §35). Empty when milestone5 hasn't been
  // run yet — fetchGrowthRecords tolerates the missing table on its own.
  const growthRecords = await growthRecordsPromise;
  let demoProgress = {
    level: 1,
    totalXp: 0,
    streak: 0,
    badges: 0,
    totalBadges: BADGE_KEYS.length,
    chapter: 1,
    totalChapters: CHAPTER_DEFINITIONS.length,
  };
  if (showDemo) {
    try {
      const [bond, badges] = await Promise.all([
        getBondState(supabase, plant.id),
        getUnlockedBadges(supabase, plant.id),
      ]);
      demoProgress = {
        ...demoProgress,
        level: bond?.bond_level ?? 1,
        totalXp: bond?.total_xp ?? 0,
        streak: bond?.current_streak ?? 0,
        chapter: bond?.current_chapter ?? 1,
        badges: badges.length,
      };
    } catch (cause) {
      console.error("SettingsPage demo progress failed:", cause);
    }
  }

  // Farm column: cards cap at 640px like the farm home stack (.pm-card);
  // the inline max-width outranks the shell's default 720px reading measure.
  return (
    <main className="mx-auto w-full">
      <PageHeader
        icon="⚙️"
        eyebrow={locale === "id" ? "Profil teman tanaman" : "Plant companion profile"}
        title={locale === "id" ? "Pengaturan" : "Settings"}
        description={locale === "id"
          ? "Atur siapa tanamanmu, cara ia berbicara, dan catatan pertumbuhannya."
          : "Manage who your plant is, how it talks, and its growth diary."}
      />

      <div className="mx-auto w-full max-w-[680px]">

      <section className="pm-panel mb-5 flex items-center gap-3">
        <span className="text-3xl leading-none" role="img" aria-hidden="true">
          🪴
        </span>
        <div>
          <p className="text-sm font-bold text-[#243421]">{plant.name}</p>
          <p className="text-xs text-[#57684F]">
            {plant.species ?? (locale === "id" ? "Spesies tidak diketahui" : "Unknown species")} · {PLANT_ID}
          </p>
        </div>
      </section>

      <form action={updatePlantSettings} className="pm-panel flex flex-col gap-5">
        <input type="hidden" name="plantId" value={plant.id} />

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClass}>{locale === "id" ? "Nama" : "Name"}</span>
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
          <span className={fieldLabelClass}>{locale === "id" ? "Kepribadian" : "Personality"}</span>
          <select name="personality" defaultValue={currentPersonality} className={fieldInputClass}>
            {PERSONALITIES.map((personality) => (
              <option key={personality} value={personality}>
                {PERSONALITY_LABELS[locale][personality]}
              </option>
            ))}
          </select>
          <span className={fieldHelpClass}>
            {locale === "id"
              ? "Mengubah cara tanamanmu bicara — bukan diagnosis kondisinya."
              : "Changes how your plant talks — never the diagnosis itself."}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClass}>{locale === "id" ? "Tahap pertumbuhan" : "Growth stage"}</span>
          <select name="growthStage" defaultValue={currentStage} className={fieldInputClass}>
            {GROWTH_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
          <span className={fieldHelpClass}>
            {locale === "id"
              ? "Dicatat manual di versi MVP ini — sensor belum bisa mengukur pertumbuhan asli. Terpisah dari Bond Level, yang tidak pernah turun."
              : "Tracked manually in the MVP — sensors can't measure real growth. Separate from Bond Level, which never decreases."}
          </span>
        </label>

        <button type="submit" className="pm-btn pm-btn-primary mt-1 w-full">
          {locale === "id" ? "Simpan perubahan" : "Save changes"}
        </button>
      </form>

      <section className="pm-panel mt-5 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="pm-heading text-xs">{locale === "id" ? "Catatan Pertumbuhan" : "Growth Records"}</h2>
          <p className={fieldHelpClass}>
            {locale === "id"
              ? "Tahap pertumbuhan hanya diperbarui lewat catatan ini — bukan oleh sensor. Menambah catatan baru juga memperbarui nilai Tahap pertumbuhan di atas."
              : "Growth stage is updated only through these records — never by sensors. Adding a new record also updates the Growth stage value above."}
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
              <span className={fieldLabelClass}>{locale === "id" ? "Tinggi (cm)" : "Height (cm)"}</span>
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

      {/* Presenter tooling keeps its amber tint but wears the same pixel
          frame as every farm card (3px border + chunky shadow ledge). */}
      {showDemo && (
      <section className="mt-5 rounded-[16px] border-[3px] border-[#E8C46B] bg-[#FFF7DF] p-5 shadow-[0_4px_0_rgba(36,52,33,0.15)]">
        <div className="mb-4 flex items-start gap-3">
          <span className="text-3xl leading-none" role="img" aria-hidden="true">
            🎬
          </span>
          <div>
            <h2 className="pm-heading text-xs">
              {locale === "id" ? "Pusat Kontrol Demo" : "Demo Control Center"}
            </h2>
            <p className="mt-1 text-[11px] leading-4 text-[#7A5B12]">
              {locale === "id"
                ? "Untuk presentasi: periksa status, kembali ke awal, atau buka Lv.10 beserta semua koleksi. Data sensor, catatan pertumbuhan, dan aturan keselamatan tidak berubah."
                : "For presentations: check status, reset to the beginning, or unlock Lv.10 and every collection item. Sensor data, growth records, and safety rules do not change."}
            </p>
          </div>
        </div>
        <DemoControlCenter locale={locale} progress={demoProgress} />
      </section>
      )}
      </div>
    </main>
  );
}
