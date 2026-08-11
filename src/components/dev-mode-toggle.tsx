"use client";

// The door to developer mode, directly under the cheat-mode entry so the two
// sandboxes sit together — but they are opposites, and the copy says so: the
// cheat sandbox throws its changes away, this one keeps them.
//
// The password is a speed bump, not a boundary. It keeps a curious student out
// of the panel; it does not protect the data, because anyone can type
// /settings?dev=1 directly. What actually protects the data is that every
// action in the panel re-checks the code on the server. Passing the verified
// code along in sessionStorage only saves typing it a second time.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { verifyDevCode } from "@/app/settings/dev-actions";
import type { AppLocale } from "@/lib/i18n";

export const DEV_CODE_STORAGE_KEY = "pm_dev_code";

const COPY = {
  id: {
    title: "🛠️ Mode Pengembang",
    body: "Untuk tim yang membangun aplikasi: ubah level, XP, misi, koleksi, dan toko secara langsung. Berbeda dengan Mode Curang — perubahan di sini MENGUBAH DATA ASLI dan tetap tersimpan. Nilai sensor tidak bisa diubah di sini.",
    placeholder: "Kata sandi pengembang",
    enter: "🛠️ Masuk Mode Pengembang",
    wrong: "Kata sandi salah.",
  },
  en: {
    title: "🛠️ Developer Mode",
    body: "For the team building the app: change level, XP, quests, collection and shop directly. Unlike Cheat Mode, changes here WRITE REAL DATA and stay. Sensor values are not editable here.",
    placeholder: "Developer password",
    enter: "🛠️ Enter Developer Mode",
    wrong: "Wrong password.",
  },
} as const;

export default function DevModeToggle({ locale }: { locale: AppLocale }) {
  const t = COPY[locale] ?? COPY.en;
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function enter(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError(false);
    const ok = await verifyDevCode(code);
    setChecking(false);
    if (!ok) {
      setError(true);
      return;
    }
    // Hand the verified code to the panel so it is not typed twice. Session
    // storage, so closing the tab closes the door again.
    try { sessionStorage.setItem(DEV_CODE_STORAGE_KEY, code); } catch {}
    router.push("/settings?dev=1");
  }

  return (
    <section
      className="pm-panel mt-4 flex flex-col gap-2"
      style={{ borderColor: "#6B7280", background: "linear-gradient(135deg,#EEF1F5,var(--color-surface))" }}
    >
      <h2 className="pm-heading text-xs" style={{ color: "#374151" }}>{t.title}</h2>
      <p className="text-[11px] leading-4" style={{ color: "#4B5563" }}>{t.body}</p>
      <form onSubmit={enter} className="mt-1 flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={code}
          onChange={(event) => { setCode(event.target.value); setError(false); }}
          placeholder={t.placeholder}
          autoComplete="off"
          maxLength={128}
          className="min-w-0 flex-1 rounded-[10px] border-2 px-3 py-2 text-sm outline-none"
          style={{ borderColor: "#9CA3AF", background: "#fff", color: "#111827" }}
        />
        <button
          type="submit"
          disabled={checking || code.length === 0}
          className="pm-btn self-start"
          style={{ borderColor: "#374151", background: "#D1D5DB", color: "#111827" }}
        >
          {t.enter}
        </button>
      </form>
      {error && <p className="text-[11px] font-semibold" style={{ color: "#B91C1C" }}>{t.wrong}</p>}
    </section>
  );
}
