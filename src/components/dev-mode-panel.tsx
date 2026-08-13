"use client";

// Developer mode panel. Every control here writes REAL data that stays after
// the page closes — that is the difference from the classroom cheat sandbox,
// and the reason the code field sits at the top of the whole panel.
//
// Deliberately plain. Legibility across a classroom, pacing, meaning: none of
// that applies to a tool for the three people building the app. Number fields
// and lock/unlock switches, grouped by the screen they affect.
//
// Sensors are absent on purpose. They belong to the hardware and to the cheat
// sandbox; a developer editing them here would be writing fake readings into
// the real history.
//
// One control breaks the "writes real data" rule and says so on screen: the
// WIB clock override, which is client-only (localStorage, this device) and
// exists so the night-gated half of the app can be tested from a timezone
// where WIB night falls in the middle of the working day.

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  devSetBadge,
  devSetChapter,
  devSetMood,
  devSetProgress,
  devSetQuest,
  devSetQuiz,
  devSetShopItem,
  type DevActionState,
} from "@/app/settings/dev-actions";
import { DEV_CODE_STORAGE_KEY } from "@/components/dev-mode-toggle";
import { xpForLevel } from "@/game/progression/level-bands";
import { levelForXp } from "@/types/game";
import "@/lib/pm-cheat"; // window.PMCheat global typing
import { useDevClock } from "@/lib/pm-clock";
import { GUARDIAN_SUSPEND_END_HOUR, GUARDIAN_SUSPEND_START_HOUR } from "@/lib/motion-detect";
import type { AppLocale } from "@/lib/i18n";

const INITIAL: DevActionState = { status: "idle", message: "" };

export interface DevSnapshot {
  level: number;
  totalXp: number;
  streak: number;
  seeds: number;
  chapter: number;
  levelForXp: number;
  badges: string[];
  moods: string[];
  ownedItems: string[];
  heroQuest: string | null;
  heroStatus: string | null;
  allBadges: readonly string[];
  allMoods: readonly string[];
  totalChapters: number;
}

export interface DevShopItem { key: string; category: string; name: string }

const FIELD = "w-full rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900";
const BTN = "rounded-lg border-2 px-2 py-1 text-[11px] font-bold";

function Result({ state }: { state: DevActionState }) {
  if (!state.message) return null;
  return (
    <p
      aria-live="polite"
      className={`mt-1 font-mono text-[11px] ${state.status === "success" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
    >
      {state.status === "success" ? "✓ " : "✗ "}{state.message}
    </p>
  );
}

/** One lock/unlock pair. Two submit buttons in one form so the row reads as a
 *  single switch rather than two unrelated controls. */
function ToggleRow({
  action,
  code,
  locale,
  field,
  value,
  label,
  on,
  onName,
}: {
  action: (formData: FormData) => void;
  code: string;
  locale: AppLocale;
  field: string;
  value: string;
  label: string;
  on: boolean;
  onName: string;
}) {
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="devCode" value={code} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name={field} value={value} />
      <span className={`min-w-0 flex-1 truncate text-[12px] ${on ? "font-bold" : "opacity-60"}`}>
        {on ? "🔓" : "🔒"} {label}
      </span>
      <button type="submit" name={onName} value="1" className={`${BTN} border-green-600 text-green-700`} disabled={!code}>ON</button>
      <button type="submit" name={onName} value="0" className={`${BTN} border-zinc-400 text-zinc-600`} disabled={!code}>OFF</button>
    </form>
  );
}

/**
 * WIB clock override (window.PMClock, public/farm/devclock.js).
 *
 * The odd one out in this panel, and labelled as such: every other control
 * here writes real rows through a server action, while this one is a single
 * integer in localStorage on THIS DEVICE. It exists because the night-only
 * half of the app (Jamkachu asleep, the guardian camera suspending its
 * sampling, live.js dropping camera_events, the dusk sky) is unreachable
 * from Korea at a sane hour: WIB 06:00–18:00 is KST 08:00–20:00.
 *
 * Being per-device is the sharp edge worth repeating on screen — a
 * tablet/desktop fan-out test needs the override set on both, or the tablet
 * will happily post touches that the desktop then drops for being "night".
 */
function ClockSection() {
  const { api, active } = useDevClock();
  // Rendered blank until mounted: window.PMClock does not exist during the
  // server render, so painting real times on the first pass would hand React
  // two different trees to reconcile.
  const [mounted, setMounted] = useState(false);
  const [hhmm, setHhmm] = useState("10:00");
  // Deferred out of the effect body, the same convention the panel below
  // follows — a synchronous setState here cascades an extra render pass and
  // trips react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMounted(true);
    });
    return () => { cancelled = true; };
  }, []);

  const wib = mounted ? api?.wib() ?? null : null;
  const realWib = mounted ? api?.realWib() ?? null : null;
  const offsetHours = mounted && api ? api.offsetMs() / 3_600_000 : 0;
  const asleep =
    wib === null
      ? null
      : wib.hour >= GUARDIAN_SUSPEND_START_HOUR || wib.hour < GUARDIAN_SUSPEND_END_HOUR;

  function applyHhmm() {
    const [hour, minute] = hhmm.split(":").map(Number);
    if (!Number.isFinite(hour)) return;
    api?.setWibTime(hour, Number.isFinite(minute) ? minute : 0);
  }

  return (
    <>
      <h3 className="pm-heading mt-5 text-[10px]">CLOCK · WIB OVERRIDE</h3>
      <p className="font-mono text-[10px] leading-4 text-zinc-500">
        client-only — one integer in localStorage, <b>this device only</b>. Writes nothing, and does
        NOT patch Date.now(): cooldowns, rate limits and the 10-min scan gate all stay real.
        Shifts only what reads the Jember wall clock — sleep, dusk sky, and the
        {" "}{GUARDIAN_SUSPEND_START_HOUR}:00–0{GUARDIAN_SUSPEND_END_HOUR}:00 WIB gate on both the
        guardian camera and the camera_events fan-out.
        <br />
        Testing tablet → desktop? Set it on <b>both devices</b> — the tablet posts, the desktop
        decides whether to react.
      </p>

      <div className="mt-2 rounded-lg border-2 border-zinc-300 bg-white p-2 font-mono text-[11px] dark:border-zinc-700 dark:bg-zinc-900">
        {!mounted ? (
          <span className="text-zinc-500">reading clock…</span>
        ) : !api ? (
          <span className="text-red-700 dark:text-red-400">
            window.PMClock missing — /farm/devclock.js did not load. Hard-reload this page.
          </span>
        ) : (
          <>
            <div>
              app WIB <b className="text-base">{api.label()}</b>
              {active && <span className="ml-1 text-blue-700 dark:text-blue-400">(shifted {offsetHours > 0 ? "+" : ""}{offsetHours.toFixed(2).replace(/\.?0+$/, "")}h)</span>}
            </div>
            <div className="text-zinc-500">
              real WIB {api.realLabel()}
              {realWib ? ` · ${realWib.date}` : ""}
              {wib && realWib && wib.date !== realWib.date ? ` → app date ${wib.date}` : ""}
            </div>
            <div className={asleep ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
              {asleep
                ? "🌙 NIGHT — guardian suspended, farm drops camera events"
                : "☀️ DAY — guardian samples, farm reacts to camera events"}
            </div>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <button type="button" onClick={() => api?.setWibTime(10, 0)} className={`${BTN} border-amber-600 text-amber-700`} disabled={!api}>☀️ Day 10:00</button>
        <button type="button" onClick={() => api?.setWibTime(21, 0)} className={`${BTN} border-indigo-600 text-indigo-700`} disabled={!api}>🌙 Night 21:00</button>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase">set WIB to</span>
          <input type="time" value={hhmm} onChange={(event) => setHhmm(event.target.value)} className={FIELD} />
        </label>
        <button type="button" onClick={applyHhmm} className={`${BTN} border-zinc-700`} disabled={!api}>Apply</button>
        <button type="button" onClick={() => api?.clear()} className={`${BTN} border-zinc-400 text-zinc-600`} disabled={!api || !active}>Reset to real time</button>
      </div>
      <p className="mt-1 font-mono text-[10px] text-zinc-500">
        the clock keeps running at 1× from whatever you set — it is shifted, not frozen. While
        shifted, a blue badge sits bottom-left on every page so it cannot be forgotten.
      </p>
    </>
  );
}

export default function DevModePanel({
  locale,
  snapshot,
  quests,
  shopItems,
}: {
  locale: AppLocale;
  snapshot: DevSnapshot;
  quests: readonly { key: string; title: string }[];
  shopItems: readonly DevShopItem[];
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  // Level and XP are controlled so typing a level can carry XP with it. Setting
  // a level alone used to leave total_xp behind, and the two disagreeing is not
  // a state the game can reach on its own — the bond bar would show a level the
  // XP does not back. Typing XP directly is still free-form: the exact XP
  // inside a level matters for testing the bar, so it must stay editable after
  // the level snaps it to that level's entry value.
  const [level, setLevel] = useState(snapshot.level);
  const [totalXp, setTotalXp] = useState(snapshot.totalXp);
  // Carried over from the door on the Settings page so it is not typed twice.
  // Every action still sends it back for a server-side check — arriving here
  // with an empty box (by typing the URL) buys nothing.
  // Deferred out of the effect body rather than set synchronously, the same
  // convention monitoring-live.tsx follows — and a lazy initializer is not an
  // option here, since sessionStorage does not exist during the server render.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = sessionStorage.getItem(DEV_CODE_STORAGE_KEY);
        if (saved) setCode(saved);
      } catch {}
      // One mode at a time, enforced here too and not only at the door — this
      // panel is reachable by typing the URL, and the cheat sandbox would sit
      // on top of it showing numbers that disagree with the rows below.
      try { window.PMCheat?.deactivate(); } catch {}
    });
    return () => { cancelled = true; };
  }, []);

  function leave() {
    try { sessionStorage.removeItem(DEV_CODE_STORAGE_KEY); } catch {}
    router.push("/settings");
  }
  const [progressState, progressAction] = useActionState(devSetProgress, INITIAL);
  const [questState, questAction] = useActionState(devSetQuest, INITIAL);
  const [moodState, moodAction] = useActionState(devSetMood, INITIAL);
  const [badgeState, badgeAction] = useActionState(devSetBadge, INITIAL);
  const [chapterState, chapterAction] = useActionState(devSetChapter, INITIAL);
  const [quizState, quizAction] = useActionState(devSetQuiz, INITIAL);
  const [shopState, shopAction] = useActionState(devSetShopItem, INITIAL);

  const shopByCategory = ["pot", "decor", "accessory"].map((category) => ({
    category,
    items: shopItems.filter((item) => item.category === category),
  }));

  return (
    <section className="mt-5 rounded-[16px] border-[3px] border-zinc-700 bg-zinc-50 p-5 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <h2 className="pm-heading text-xs">🛠️ DEVELOPER MODE</h2>
        {/* The way out. Clears the session code and drops back to plain
            Settings — without it the only exit was editing the URL. */}
        <button type="button" onClick={leave} className={`${BTN} shrink-0 border-zinc-700`}>
          {locale === "id" ? "Keluar ✕" : "Exit ✕"}
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-red-700 dark:text-red-400">
        Writes real data. Changes persist into normal mode. Sensor values are not editable here.
        Cheat Mode is switched off while this is open — one mode at a time.
        The one exception is the WIB clock below: it is local to this device and stores nothing
        server-side.
      </p>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide">Developer code</span>
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" maxLength={128} className={FIELD} />
      </label>

      {/* First, and above the code field's reach on purpose: it is the only
          control here that needs no code because it writes nothing, and it
          is the one you come looking for when the app insists it is night. */}
      <ClockSection />

      {/* ── My Garden ─────────────────────────────────────────────── */}
      <h3 className="pm-heading mt-5 text-[10px]">MY GARDEN</h3>
      <form action={progressAction} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input type="hidden" name="devCode" value={code} />
        <input type="hidden" name="locale" value={locale} />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase">level</span>
          <input
            type="number"
            name="level"
            value={level}
            onChange={(event) => {
              const next = Number(event.target.value);
              setLevel(Number.isNaN(next) ? 0 : next);
              // Entry XP for that level. Blank/NaN is left alone so clearing the
              // box to retype does not wipe the XP field on the way through.
              if (!Number.isNaN(next) && event.target.value !== "") setTotalXp(xpForLevel(next));
            }}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase">totalXp</span>
          <input
            type="number"
            name="totalXp"
            value={totalXp}
            onChange={(event) => setTotalXp(Number.isNaN(Number(event.target.value)) ? 0 : Number(event.target.value))}
            className={FIELD}
          />
        </label>
        {([["streak", snapshot.streak], ["seeds", snapshot.seeds]] as const).map(([name, value]) => (
          <label key={name} className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase">{name}</span>
            <input type="number" name={name} defaultValue={value} className={FIELD} />
          </label>
        ))}
        <button type="submit" disabled={!code} className={`${BTN} col-span-2 border-zinc-700 sm:col-span-4`}>Save</button>
      </form>
      <p className="mt-1 font-mono text-[10px] text-zinc-500">
        level implied by XP: {levelForXp(totalXp)} · stored snapshot: Lv.{snapshot.level} / {snapshot.totalXp} XP.
        Typing a level fills XP with that level&apos;s entry value ({xpForLevel(level)}); XP stays editable after.
      </p>
      <Result state={progressState} />

      {/* ── Quests ────────────────────────────────────────────────── */}
      <h3 className="pm-heading mt-5 text-[10px]">QUESTS</h3>
      <p className="font-mono text-[10px] text-zinc-500">hero now: {snapshot.heroQuest ?? "—"} {snapshot.heroStatus ? `(${snapshot.heroStatus})` : ""}</p>
      <form action={questAction} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="devCode" value={code} />
        <input type="hidden" name="locale" value={locale} />
        <label className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="text-[10px] font-bold uppercase">hero mission</span>
          <select name="questKey" defaultValue={snapshot.heroQuest ?? quests[0]?.key} className={FIELD}>
            {quests.map((quest) => <option key={quest.key} value={quest.key}>{quest.title}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase">stage</span>
          <select name="stage" defaultValue="1" className={FIELD}>
            <option value="1">1 SENSE</option>
            <option value="2">2 ACT</option>
            <option value="3">3 VERIFY</option>
            <option value="4">4 REWARD (completes)</option>
          </select>
        </label>
        <button type="submit" disabled={!code} className={`${BTN} border-zinc-700`}>Apply</button>
      </form>
      <Result state={questState} />

      {/* ── Collection ────────────────────────────────────────────── */}
      <h3 className="pm-heading mt-5 text-[10px]">COLLECTION · MOODS</h3>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        {snapshot.allMoods.map((mood) => (
          <ToggleRow key={mood} action={moodAction} code={code} locale={locale} field="mood" value={mood} label={mood} on={snapshot.moods.includes(mood)} onName="unlock" />
        ))}
      </div>
      <Result state={moodState} />

      <h3 className="pm-heading mt-5 text-[10px]">COLLECTION · BADGES</h3>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        {snapshot.allBadges.map((badge) => (
          <ToggleRow key={badge} action={badgeAction} code={code} locale={locale} field="badge" value={badge} label={badge} on={snapshot.badges.includes(badge)} onName="unlock" />
        ))}
      </div>
      <Result state={badgeState} />

      <h3 className="pm-heading mt-5 text-[10px]">COLLECTION · STORY</h3>
      <form action={chapterAction} className="mt-2 flex items-end gap-2">
        <input type="hidden" name="devCode" value={code} />
        <input type="hidden" name="locale" value={locale} />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase">unlocked through chapter</span>
          <input type="number" name="chapter" min={0} max={snapshot.totalChapters} defaultValue={snapshot.chapter} className={FIELD} />
        </label>
        <span className="pb-1 font-mono text-[10px] text-zinc-500">/ {snapshot.totalChapters} (0 locks all)</span>
        <button type="submit" disabled={!code} className={`${BTN} border-zinc-700`}>Apply</button>
      </form>
      <Result state={chapterState} />

      {/* ── Today's quiz ──────────────────────────────────────────── */}
      <h3 className="pm-heading mt-5 text-[10px]">MY GARDEN · TODAY&apos;S QUIZ</h3>
      <p className="font-mono text-[10px] text-zinc-500">
        marks the first N of today&apos;s three questions answered, on the WIB date · xp_awarded stays 0
        (the real RPC owns quiz XP — set XP above if you want it moved)
      </p>
      <form action={quizAction} className="mt-2 flex items-end gap-2">
        <input type="hidden" name="devCode" value={code} />
        <input type="hidden" name="locale" value={locale} />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase">solved today</span>
          <input type="number" name="solved" min={0} max={3} defaultValue={0} className={FIELD} />
        </label>
        <span className="pb-1 font-mono text-[10px] text-zinc-500">/ 3 (0 resets the chip)</span>
        <button type="submit" disabled={!code} className={`${BTN} border-zinc-700`}>Apply</button>
      </form>
      <Result state={quizState} />

      {/* ── Shop ──────────────────────────────────────────────────── */}
      <h3 className="pm-heading mt-5 text-[10px]">SHOP · OWNED ITEMS</h3>
      <p className="font-mono text-[10px] text-zinc-500">granted and removed outright — no Seed cost (set Seeds above)</p>
      {shopByCategory.map(({ category, items }) => (
        <div key={category} className="mt-2">
          <p className="text-[10px] font-bold uppercase text-zinc-500">{category}</p>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {items.map((item) => (
              <ToggleRow key={item.key} action={shopAction} code={code} locale={locale} field="itemKey" value={item.key} label={item.name} on={snapshot.ownedItems.includes(item.key)} onName="own" />
            ))}
          </div>
        </div>
      ))}
      <Result state={shopState} />
    </section>
  );
}
