// Settings screen (handoff §33) — plant name, species, personality (§13),
// and manual growth stage (§14: sensors cannot infer real growth in MVP).

import Link from "next/link";
import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
import DemoControlCenter from "@/components/demo-control-center";
import CheatModeToggle from "@/components/cheat-mode-toggle";
import DevModePanel from "@/components/dev-mode-panel";
import DevModeToggle from "@/components/dev-mode-toggle";
import { readDevSnapshot } from "@/game/dev/dev-mode";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { SHOP_CATALOG } from "@/game/economy/shop-catalog";
import { QUEST_COPY_ID } from "@/lib/i18n";
import type { QuestKey } from "@/types/game";
import HowToPlayMap from "@/components/how-to-play-map";
import { BADGE_KEYS } from "@/types/game";
import { CHAPTER_DEFINITIONS } from "@/game/story/story-definitions";
import { getBondState } from "@/game/progression/xp-engine";
import { getPlant, getUnlockedBadges, GROWTH_STAGES, normalizeGrowthStage } from "@/lib/queries";
import { getRequestLocale } from "@/lib/i18n-server";
import { getServerSupabase } from "@/lib/supabase/server";
import { growthStageLabel, type AppLocale } from "@/lib/i18n";
import { normalizePersonality, PERSONALITIES, type PersonalityId } from "@/types/game";
import { updatePlantSettings } from "./actions";

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
  "w-full rounded-[10px] border-2 border-[#BCD3B4] bg-white px-4 py-2.5 text-base text-[#243421] outline-none focus:ring-2 focus:ring-[#89D974]";
const fieldHelpClass = "text-[11px] leading-4 text-[#57684F]";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Presentation tooling stays out of the normal student UX (spec §2.3):
  // the Demo Control Center only renders on /settings?demo=1.
  const params = await searchParams;
  const showDemo = params.demo === "1";
  // Developer mode is a separate door (/settings?dev=1) behind its own code:
  // the presenter tools only unlock or reset, these write arbitrary values.
  const showDev = params.dev === "1";
  const locale = await getRequestLocale();
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
  const currentPersonality = normalizePersonality(plant.personality);
  // Seed data uses lowercase stages ("growing") — map to the canonical label.
  const currentStage = normalizeGrowthStage(plant.growth_stage) ?? "New Plant";

  let demoProgress = {
    level: 1,
    totalXp: 0,
    streak: 0,
    badges: 0,
    totalBadges: BADGE_KEYS.length,
    chapter: 1,
    totalChapters: CHAPTER_DEFINITIONS.length,
    companionStage: "Seed",
  };
  if (showDemo) {
    try {
      const [bond, badges, companion] = await Promise.all([
        getBondState(supabase, plant.id),
        getUnlockedBadges(supabase, plant.id),
        supabase.from("companion_state").select("stage").eq("plant_id", plant.id).maybeSingle(),
      ]);
      demoProgress = {
        ...demoProgress,
        level: bond?.bond_level ?? 1,
        totalXp: bond?.total_xp ?? 0,
        streak: bond?.current_streak ?? 0,
        chapter: bond?.current_chapter ?? 1,
        badges: badges.length,
        companionStage: typeof companion.data?.stage === "string" ? companion.data.stage : "Seed",
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
            {plant.species ?? (locale === "id" ? "Spesies tidak diketahui" : "Unknown species")}
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
                {growthStageLabel(locale, stage)}
              </option>
            ))}
          </select>
          <span className={fieldHelpClass}>
            {locale === "id" ? "Kamu yang mencatat tahap ini." : "You record this stage yourself."}
          </span>
        </label>

        <button type="submit" className="pm-btn pm-btn-primary mt-1 w-full">
          {locale === "id" ? "Simpan perubahan" : "Save changes"}
        </button>
      </form>

      <Link href="/diary" className="pm-panel mt-5 flex items-center gap-3">
        <span className="text-3xl leading-none" role="img" aria-hidden="true">
          📖
        </span>
        <div>
          <p className="text-sm font-bold text-[#243421]">
            {locale === "id" ? "Diari Tumbuh" : "Growth Diary"}
          </p>
          <p className="text-xs text-[#57684F]">
            {locale === "id" ? "Tulis apa yang berubah hari ini" : "Write down what changed today"}
          </p>
        </div>
      </Link>
      <HowToPlayMap locale={locale} />

      {!showDemo && (
        <Link
          href="/settings?demo=1"
          className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-[14px] border-[3px] border-[#E8C46B] bg-[#FFF7DF] px-5 py-4 text-center shadow-[0_4px_0_rgba(36,52,33,0.15)] transition-transform hover:-translate-y-0.5"
        >
          <span className="text-2xl" aria-hidden="true">🎬</span>
          <span>
            <strong className="pm-heading block text-[10px] text-[#7A5B12]">
              {locale === "id" ? "BUKA MODE PRESENTASI" : "OPEN PRESENTATION MODE"}
            </strong>
            <small className="mt-1 block text-[11px] text-[#7A5B12]">
              {locale === "id" ? "Kontrol demo untuk pengambilan gambar" : "Camera-ready demo controls"}
            </small>
          </span>
        </Link>
      )}

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

      {/* Developer mode (/settings?dev=1) — writes real data, so it lives
          behind DEV_MODE_CODE rather than the presenter's zero-friction gate. */}
      {showDev && (
        <DevModePanel
          locale={locale}
          snapshot={await readDevSnapshot(supabase, PLANT_ID)}
          quests={(Object.keys(QUEST_DEFINITIONS) as QuestKey[]).map((key) => ({
            key,
            title: locale === "id" ? QUEST_COPY_ID[key].title : QUEST_DEFINITIONS[key].title,
          }))}
          shopItems={SHOP_CATALOG.map((item) => ({ key: item.key, category: item.category, name: item.name[locale] }))}
        />
      )}

      {/* Classroom-demo cheat sandbox entry — always at the very bottom.
          Client-only (window.PMCheat); never writes Supabase or hardware. */}
      <CheatModeToggle
        locale={locale}
        seed={{ level: demoProgress.level, totalXp: demoProgress.totalXp, days: demoProgress.streak }}
      />

      {/* Developer mode's door, straight under the cheat sandbox's — the two
          are opposites (that one discards, this one keeps) so they belong
          side by side where the difference is easy to read. */}
      <DevModeToggle locale={locale} />
      </div>
    </main>
  );
}
