"use client";

import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/i18n";

export default function NetworkStatus({ locale }: { locale: AppLocale }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    const timer = window.setTimeout(sync, 0);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return <div className="pm-network-status" role="status" aria-live="polite">
    <span aria-hidden="true">📴</span>
    <div><strong>{locale === "id" ? "KAMU SEDANG OFFLINE" : "YOU’RE OFFLINE"}</strong><small>{locale === "id" ? "Data tersimpan tetap aman. Fitur langsung dan AI akan kembali saat koneksi pulih." : "Saved progress stays safe. Live and AI features return when the connection recovers."}</small></div>
  </div>;
}
