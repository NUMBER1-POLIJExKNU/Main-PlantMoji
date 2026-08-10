"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  activateDemoMaxMode,
  evolveDemoCompanion,
  grantDemoXp,
  prepareDemoLevelUp,
  resetDemoMode,
  type DemoActionState,
} from "@/app/settings/actions";
import type { AppLocale } from "@/lib/i18n";
import GrowthShowcase from "@/components/growth-showcase";

const INITIAL_STATE: DemoActionState = { status: "idle", message: "" };

export interface DemoProgressSnapshot {
  level: number;
  totalXp: number;
  streak: number;
  badges: number;
  totalBadges: number;
  chapter: number;
  totalChapters: number;
  companionStage: string;
}
const COPY = {
  id: {
    code: "Kode demo",
    placeholder: "Masukkan kode presentasi",
    level: "Level",
    xp: "XP",
    streak: "Hari beruntun",
    badges: "Lencana",
    story: "Bab cerita",
    unlock: "🔓 Buka semuanya",
    unlocking: "Membuka...",
    reset: "↺ Kembali ke awal",
    resetting: "Mengatur ulang...",
    confirm: "Atur ulang XP, misi, lencana, dan cerita ke awal? Data sensor dan catatan pertumbuhan tetap aman.",
    collection: "Buka Koleksi",
    home: "Ke Beranda",
    prepare: "🎯 Siapkan level-up",
    preparing: "Menyiapkan...",
    addXp: "✨ +1 XP sekarang",
    addingXp: "Memberi XP...",
    evolve: "🌱 Evolusi berikutnya",
    evolving: "Berevolusi...",
    scenes: "ADEGAN LINGKUNGAN VIRTUAL",
    director: "PENGARAH SIARAN",
    presentation: "⛶ Mode presentasi",
    ending: "Tampilkan penutup",
  },
  en: {
    code: "Demo code",
    placeholder: "Enter the presentation code",
    level: "Level",
    xp: "XP",
    streak: "Day streak",
    badges: "Badges",
    story: "Story chapter",
    unlock: "🔓 Unlock everything",
    unlocking: "Unlocking...",
    reset: "↺ Reset to start",
    resetting: "Resetting...",
    confirm: "Reset XP, quests, badges, and stories to the beginning? Sensor data and growth records stay safe.",
    collection: "Open Collection",
    home: "Go to Home",
    prepare: "🎯 Prepare level-up",
    preparing: "Preparing...",
    addXp: "✨ Add +1 XP now",
    addingXp: "Adding XP...",
    evolve: "🌱 Next evolution",
    evolving: "Evolving...",
    scenes: "VIRTUAL ENVIRONMENT SCENES",
    director: "BROADCAST DIRECTOR",
    presentation: "⛶ Presentation mode",
    ending: "Show ending",
  },
} as const;

function ResultMessage({ state, locale }: { state: DemoActionState; locale: AppLocale }) {
  if (!state.message) return null;
  const copy = COPY[locale];
  return (
    <div
      aria-live="polite"
      className={`rounded-xl px-3 py-2 text-xs font-medium leading-5 ${
        state.status === "success"
          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      }`}
    >
      <p>{state.message}</p>
      {state.status === "success" && (
        <p className="mt-1">
          <Link className="underline" href="/collection">{copy.collection}</Link>{" · "}
          <Link className="underline" href="/">{copy.home}</Link>
        </p>
      )}
    </div>
  );
}

export default function DemoControlCenter({
  locale,
  progress,
}: {
  locale: AppLocale;
  progress: DemoProgressSnapshot;
}) {
  const copy = COPY[locale];
  const [code, setCode] = useState("");
  const [showGrowth, setShowGrowth] = useState(false);
  const [maxState, maxAction, maxPending] = useActionState(activateDemoMaxMode, INITIAL_STATE);
  const [resetState, resetAction, resetPending] = useActionState(resetDemoMode, INITIAL_STATE);
  const [prepareState, prepareAction, preparePending] = useActionState(prepareDemoLevelUp, INITIAL_STATE);
  const [xpState, xpAction, xpPending] = useActionState(grantDemoXp, INITIAL_STATE);
  const [evolveState, evolveAction, evolvePending] = useActionState(evolveDemoCompanion, INITIAL_STATE);
  const busy = maxPending || resetPending || preparePending || xpPending || evolvePending;

  const stats = [
    [copy.level, progress.level],
    [copy.xp, progress.totalXp],
    [copy.streak, progress.streak],
    [copy.badges, `${progress.badges}/${progress.totalBadges}`],
    [copy.story, `${progress.chapter}/${progress.totalChapters}`],
    [locale === "id" ? "Evolusi" : "Evolution", progress.companionStage],
  ];
  const openPresentation = async () => {
    try { await document.documentElement.requestFullscreen(); } catch { /* browser may require a different presentation window */ }
  };
  const showEnding = () => window.dispatchEvent(new CustomEvent("pm:broadcast-ending"));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-amber-200/70 bg-white/80 px-2 py-2 text-center dark:border-amber-900 dark:bg-zinc-900/70">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
            <p className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          {copy.code}
        </span>
        <input
          type="password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          maxLength={128}
          autoComplete="off"
          placeholder={copy.placeholder}
          className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:border-amber-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-600 dark:focus:ring-amber-900"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          [prepareAction, preparePending ? copy.preparing : copy.prepare, "pm-btn"],
          [xpAction, xpPending ? copy.addingXp : copy.addXp, "pm-btn pm-btn-primary"],
          [evolveAction, evolvePending ? copy.evolving : copy.evolve, "pm-btn pm-btn-primary"],
        ].map(([action, label, className]) => (
          <form action={action as (formData: FormData) => void} key={label as string}>
            <input type="hidden" name="demoCode" value={code} /><input type="hidden" name="locale" value={locale} />
            <button type="submit" disabled={busy || code.length === 0} className={`${className} w-full px-2 text-[9px]`}>{label as string}</button>
          </form>
        ))}
      </div>

      <div>
        <p className="pm-heading mb-2 text-[8px] text-amber-700">{copy.scenes}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link className="pm-btn px-2 text-[8px]" href="/plants?demo=healthy">🌿 {locale === "id" ? "Normal" : "Healthy"}</Link>
          <Link className="pm-btn px-2 text-[8px]" href="/plants?demo=hot">🔥 {locale === "id" ? "Panas" : "Hot"}</Link>
          <Link className="pm-btn px-2 text-[8px]" href="/plants?demo=dry">💨 {locale === "id" ? "Kering" : "Dry air"}</Link>
          <Link className="pm-btn px-2 text-[8px]" href="/plants?demo=dark">🌙 {locale === "id" ? "Gelap" : "Low light"}</Link>
        </div>
      </div>

      <section className="rounded-2xl border-2 border-emerald-700 bg-[#10251a] p-3 text-emerald-100 shadow-[0_5px_0_#07120c]">
        <p className="pm-heading text-[8px] text-emerald-300">{copy.director}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link className="pm-btn px-2 text-[8px]" href="/?presentation=1&amp;scene=1&amp;source=demo">START DEMO</Link>
          <Link className="pm-btn px-2 text-[8px]" href="/plants?demo=hot">2 · EXPLAIN</Link>
          <Link className="pm-btn px-2 text-[8px]" href="/camera?demo=1">3 · CAMERA</Link>
          <Link className="pm-btn px-2 text-[8px]" href="/diary?demo=1">4 · MEMORY</Link>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className="pm-btn pm-btn-primary w-full text-[8px]" onClick={openPresentation}>{copy.presentation}</button>
          <button type="button" className="pm-btn w-full text-[8px]" onClick={showEnding}>{copy.ending}</button>
        </div>
        <button type="button" className="pm-btn mt-2 w-full text-[9px]" onClick={() => setShowGrowth(true)}>🌱 {locale === "id" ? "LIHAT 10 TAHAP PERTUMBUHAN" : "SHOW ALL 10 GROWTH STAGES"}</button>
        <p className="mt-2 font-mono text-[9px] text-emerald-300">SENSOR → UNDERSTAND → ACT → VERIFY → REWARD → GROW</p>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <form action={maxAction}>
          <input type="hidden" name="demoCode" value={code} />
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            disabled={busy || code.length === 0}
            className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-bold text-amber-950 shadow-sm transition-colors hover:bg-amber-400 active:bg-amber-600 disabled:cursor-wait disabled:opacity-60"
          >
            {maxPending ? copy.unlocking : copy.unlock}
          </button>
        </form>
        <form
          action={resetAction}
          onSubmit={(event) => {
            if (!window.confirm(copy.confirm)) event.preventDefault();
          }}
        >
          <input type="hidden" name="demoCode" value={code} />
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            disabled={busy || code.length === 0}
            className="w-full rounded-2xl border-2 border-amber-500 bg-white py-2.5 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-900 dark:text-amber-300"
          >
            {resetPending ? copy.resetting : copy.reset}
          </button>
        </form>
      </div>

      <ResultMessage state={maxState} locale={locale} />
      <ResultMessage state={resetState} locale={locale} />
      <ResultMessage state={prepareState} locale={locale} />
      <ResultMessage state={xpState} locale={locale} />
      <ResultMessage state={evolveState} locale={locale} />
      {showGrowth && <GrowthShowcase locale={locale} onClose={() => setShowGrowth(false)} />}
    </div>
  );
}
