"use client";

// Settings entry point for the classroom-demo cheat sandbox. Toggles
// window.PMCheat (public/farm/cheat.js) — a client-only sandbox that never
// writes Supabase or hardware. Activating clones the current real progress as
// the starting point and sends the presenter to My Garden; deactivating wipes
// the sandbox and reloads back to untouched normal mode.

import { useSyncExternalStore } from "react";
import type { AppLocale } from "@/lib/i18n";
import { TRIAL_GATE_LEVEL } from "@/game/dev/trial-constants";
import "@/lib/pm-cheat"; // window.PMCheat global typing

// cheat.js is a plain external store, so subscribe to it directly instead of
// mirroring it into state from an effect. getServerSnapshot returns false:
// the sandbox lives in localStorage and cannot exist during SSR.
const subscribeCheat = (onChange: () => void) => window.PMCheat?.onChange(onChange) ?? (() => {});
const cheatIsActive = () => window.PMCheat?.getMode?.() === "cheat";
/** Serialised so useSyncExternalStore compares a primitive: returning a fresh
 *  object each call would re-render on every one of the drift tick's events. */
const trialSnapshot = () =>
  window.PMCheat?.getMode?.() === "trial" ? String(window.PMTrial?.xpToGate() ?? 0) : "";

export interface CheatSeed {
  level?: number;
  totalXp?: number;
  days?: number;
  seeds?: number;
}

const COPY = {
  id: {
    title: "Mode Curang (Demo Kelas)",
    body: "Untuk demo di kelas: ubah status, sensor, misi, toko, dan koleksi secara instan — TANPA menyentuh perangkat asli atau data asli. Semua perubahan hanya di browser ini dan hilang saat keluar.",
    activate: "🎛️ Aktifkan Mode Curang",
    deactivate: "✕ Matikan Mode Curang",
    active: "Mode Curang sedang aktif.",
    fromTrial: "🎛️ Lanjut ke Mode Curang",
    toGate: (xp: number) =>
      `Masih ${xp} XP lagi menuju Level ${TRIAL_GATE_LEVEL} — kamu juga bisa membukanya dengan merawat Jamkachu. Progres Mode Coba akan tetap tersimpan.`,
    gateOpen: `Level ${TRIAL_GATE_LEVEL} sudah tercapai. Progres Mode Coba akan tetap tersimpan.`,
  },
  en: {
    title: "Cheat Mode (Classroom Demo)",
    body: "For classroom demos: change status, sensors, quests, shop, and collection instantly — WITHOUT touching real hardware or real data. Every change lives only in this browser and is wiped on exit.",
    activate: "🎛️ Activate Cheat Mode",
    deactivate: "✕ Deactivate Cheat Mode",
    active: "Cheat Mode is currently active.",
    fromTrial: "🎛️ Continue to Cheat Mode",
    toGate: (xp: number) =>
      `${xp} XP to go before Level ${TRIAL_GATE_LEVEL} — you can also unlock this by caring for Jamkachu. Your Trial Mode progress is kept either way.`,
    gateOpen: `Level ${TRIAL_GATE_LEVEL} reached. Your Trial Mode progress is kept.`,
  },
} as const;

export default function CheatModeToggle({
  locale,
  seed,
}: {
  locale: AppLocale;
  seed?: CheatSeed;
}) {
  const t = COPY[locale] ?? COPY.en;
  const active = useSyncExternalStore(subscribeCheat, cheatIsActive, () => false);
  // Non-empty while a trial run is going: the XP still owed before its gate.
  const trialXpToGate = useSyncExternalStore(subscribeCheat, trialSnapshot, () => "");
  const inTrial = trialXpToGate !== "";

  function handleActivate() {
    const api = window.PMCheat;
    if (!api) return;
    // One mode at a time: developer mode writes the real rows this sandbox
    // only pretends to change, so entering the sandbox closes that door.
    try { sessionStorage.removeItem("pm_dev_code"); } catch {}
    // THE CLASSROOM ESCAPE HATCH. A trial run is promoted in place, keeping
    // the level, XP, Seeds and readings the student earned — and it works
    // whether or not they reached the gate. A school demo goes wrong in a hundred
    // ways (the period runs short, a student gets stuck, the projector dies),
    // so the presenter must always be able to take the wheel. The gate is a
    // celebration, not a lock.
    if (api.getMode?.() === "trial") {
      api.switchToCheat();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload is load-bearing here (see below)
      window.location.href = "/";
      return;
    }
    api.activate({ status: { ...(seed ?? {}) } }, "cheat");
    // Land on My Garden so the class immediately sees the sandbox. This has to
    // be a full document load, not router.push: main() in public/farm/live.js
    // checks PMCheat.isActive() once at bootstrap, so a client-side transition
    // would leave the farm shell still wired to Supabase.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload is load-bearing here (see above)
    window.location.href = "/";
  }

  function handleDeactivate() {
    const api = window.PMCheat;
    if (!api) return;
    api.deactivate();
    window.location.reload();
  }

  return (
    <section
      className="pm-panel mt-6 flex flex-col gap-2"
      style={{ borderColor: "#C2618A", background: "linear-gradient(135deg,#FFF1D6,var(--color-surface))" }}
    >
      <h2 className="pm-heading text-xs" style={{ color: "#8A2B5B" }}>
        {t.title}
      </h2>
      <p className="text-[11px] leading-4" style={{ color: "#7A5B12" }}>
        {t.body}
      </p>
      {active ? (
        <>
          <p className="text-[11px] font-semibold" style={{ color: "#8A2B5B" }}>
            {t.active}
          </p>
          <button
            type="button"
            onClick={handleDeactivate}
            className="pm-btn mt-1 self-start"
            style={{ borderColor: "#8A2B5B", background: "#fff", color: "#8A2B5B" }}
          >
            {t.deactivate}
          </button>
        </>
      ) : (
        <>
          {inTrial ? (
            <p className="text-[11px] leading-4" style={{ color: "#7A5B12" }}>
              {Number(trialXpToGate) > 0 ? t.toGate(Number(trialXpToGate)) : t.gateOpen}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleActivate}
            className="pm-btn mt-1 self-start"
            style={{ borderColor: "#8A2B5B", background: "#FFD86B", color: "#3a2600" }}
          >
            {inTrial ? t.fromTrial : t.activate}
          </button>
        </>
      )}
    </section>
  );
}
