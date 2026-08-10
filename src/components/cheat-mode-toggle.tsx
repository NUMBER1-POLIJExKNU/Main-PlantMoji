"use client";

// Settings entry point for the classroom-demo cheat sandbox. Toggles
// window.PMCheat (public/farm/cheat.js) — a client-only sandbox that never
// writes Supabase or hardware. Activating clones the current real progress as
// the starting point and sends the presenter to My Garden; deactivating wipes
// the sandbox and reloads back to untouched normal mode.

import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/i18n";
import "@/lib/pm-cheat"; // window.PMCheat global typing

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
  },
  en: {
    title: "Cheat Mode (Classroom Demo)",
    body: "For classroom demos: change status, sensors, quests, shop, and collection instantly — WITHOUT touching real hardware or real data. Every change lives only in this browser and is wiped on exit.",
    activate: "🎛️ Activate Cheat Mode",
    deactivate: "✕ Deactivate Cheat Mode",
    active: "Cheat Mode is currently active.",
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
  const [active, setActive] = useState(false);

  useEffect(() => {
    const api = window.PMCheat;
    if (!api) return;
    setActive(api.isActive());
    return api.onChange(() => setActive(api.isActive()));
  }, []);

  function handleActivate() {
    const api = window.PMCheat;
    if (!api) return;
    api.activate({ status: { ...(seed ?? {}) } });
    // Land on My Garden so the class immediately sees the sandbox.
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
        <button
          type="button"
          onClick={handleActivate}
          className="pm-btn mt-1 self-start"
          style={{ borderColor: "#8A2B5B", background: "#FFD86B", color: "#3a2600" }}
        >
          {t.activate}
        </button>
      )}
    </section>
  );
}
