"use client";

// Settings entry point for Trial Mode — the student onboarding game.
//
// Trial mode shares its store and its containment with the cheat sandbox
// (public/farm/cheat.js): localStorage only, never Supabase and never
// hardware. What differs is where it starts and what it asks of the player.
// The cheat sandbox CLONES real progress so a presenter can carry on from
// where the plant is; a trial run starts from nothing on purpose, because a
// student who inherits somebody else's Lv.14 garden has no first level-up to
// feel and nothing left to earn.

import { useSyncExternalStore } from "react";
import type { AppLocale } from "@/lib/i18n";
import { TRIAL_GATE_LEVEL } from "@/game/dev/trial-constants";
import "@/lib/pm-cheat"; // window.PMCheat / window.PMTrial global typing

// cheat.js is a plain external store, so subscribe to it directly rather than
// mirroring it into state. getServerSnapshot returns false: the sandbox lives
// in localStorage and cannot exist during SSR.
const subscribeCheat = (onChange: () => void) => window.PMCheat?.onChange(onChange) ?? (() => {});
const trialIsActive = () => window.PMCheat?.getMode?.() === "trial";

const COPY = {
  id: {
    title: "Mode Coba (Game Perkenalan)",
    body: `Mulai dari nol: Level 1, tanpa benih, tanpa koleksi. Rawat Jamkachu dengan tombol perawatan, atasi cuaca yang datang tiba-tiba, dan setelah Level ${TRIAL_GATE_LEVEL} Mode Curang terbuka. Semua hanya di browser ini — data & sensor asli tidak tersentuh.`,
    activate: "🎮 Mulai Mode Coba",
    deactivate: "✕ Hentikan Mode Coba",
    active: "Mode Coba sedang berjalan.",
  },
  en: {
    title: "Trial Mode (Intro Game)",
    body: `Start from nothing: Level 1, no Seeds, no collection. Care for Jamkachu with the care buttons, solve the weather that hits, and at Level ${TRIAL_GATE_LEVEL} Cheat Mode unlocks. Everything stays in this browser — real data & sensors are untouched.`,
    activate: "🎮 Start Trial Mode",
    deactivate: "✕ Stop Trial Mode",
    active: "Trial Mode is running.",
  },
} as const;

export default function TrialModeToggle({ locale }: { locale: AppLocale }) {
  const t = COPY[locale] ?? COPY.en;
  const active = useSyncExternalStore(subscribeCheat, trialIsActive, () => false);

  function handleActivate() {
    if (!window.PMCheat || !window.PMTrial) return;
    // One mode at a time: developer mode writes the real rows this sandbox
    // only pretends to change, so entering closes that door (same as cheat).
    try { sessionStorage.removeItem("pm_dev_code"); } catch {}
    window.PMTrial.start();
    // Land on My Garden, and by a full document load rather than router.push:
    // main() in public/farm/live.js reads the sandbox mode once at bootstrap,
    // so a client-side transition would leave the farm still wired to Supabase
    // and the trial panel unbuilt. Same reasoning as CheatModeToggle.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload is load-bearing here (see above)
    window.location.href = "/";
  }

  function handleDeactivate() {
    window.PMCheat?.deactivate();
    window.location.reload();
  }

  return (
    <section
      className="pm-panel mt-6 flex flex-col gap-2"
      style={{ borderColor: "#2F7A1E", background: "linear-gradient(135deg,#EAFBDD,var(--color-surface))" }}
    >
      <h2 className="pm-heading text-xs" style={{ color: "#1E5E12" }}>
        {t.title}
      </h2>
      <p className="text-[11px] leading-4" style={{ color: "#2C5218" }}>
        {t.body}
      </p>
      {active ? (
        <>
          <p className="text-[11px] font-semibold" style={{ color: "#1E5E12" }}>
            {t.active}
          </p>
          <button
            type="button"
            onClick={handleDeactivate}
            className="pm-btn mt-1 self-start"
            style={{ borderColor: "#1E5E12", background: "#fff", color: "#1E5E12" }}
          >
            {t.deactivate}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleActivate}
          className="pm-btn mt-1 self-start"
          style={{ borderColor: "#1E5E12", background: "#A8E063", color: "#123a1c" }}
        >
          {t.activate}
        </button>
      )}
    </section>
  );
}
