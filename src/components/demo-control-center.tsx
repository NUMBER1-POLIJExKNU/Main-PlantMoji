"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  activateDemoMaxMode,
  resetDemoMode,
  type DemoActionState,
} from "@/app/settings/actions";
import type { AppLocale } from "@/lib/i18n";

const INITIAL_STATE: DemoActionState = { status: "idle", message: "" };

export interface DemoProgressSnapshot {
  level: number;
  totalXp: number;
  streak: number;
  badges: number;
  totalBadges: number;
  chapter: number;
  totalChapters: number;
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
  const [maxState, maxAction, maxPending] = useActionState(activateDemoMaxMode, INITIAL_STATE);
  const [resetState, resetAction, resetPending] = useActionState(resetDemoMode, INITIAL_STATE);
  const busy = maxPending || resetPending;

  const stats = [
    [copy.level, progress.level],
    [copy.xp, progress.totalXp],
    [copy.streak, progress.streak],
    [copy.badges, `${progress.badges}/${progress.totalBadges}`],
    [copy.story, `${progress.chapter}/${progress.totalChapters}`],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
    </div>
  );
}
