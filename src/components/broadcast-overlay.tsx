"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";

export default function BroadcastOverlay({ locale }: { locale: AppLocale }) {
  const pathname = usePathname(); const search = useSearchParams();
  const active = search.has("demo");
  const [boot, setBoot] = useState(false); const [ending, setEnding] = useState(false); const [online, setOnline] = useState(true);
  useEffect(() => { const syncId = window.setTimeout(() => setOnline(navigator.onLine), 0); const on = () => setOnline(true); const off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.clearTimeout(syncId); window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  useEffect(() => { if (!active || sessionStorage.getItem("pm-broadcast-boot")) return; const startId = window.setTimeout(() => setBoot(true), 0); sessionStorage.setItem("pm-broadcast-boot", "1"); const id = window.setTimeout(() => setBoot(false), 2400); return () => { window.clearTimeout(startId); window.clearTimeout(id); }; }, [active]);
  useEffect(() => { const show = () => setEnding(true); window.addEventListener("pm:broadcast-ending", show); return () => window.removeEventListener("pm:broadcast-ending", show); }, []);
  if (!active) return null;
  const id = locale === "id";
  return <>
    <div className="pm-broadcast-status" aria-label="Broadcast demo status"><b>● {pathname === "/plants" && search.has("demo") ? "VIRTUAL DEMO" : "PRESENTATION"}</b><span>NETWORK {online ? "ONLINE" : "OFFLINE"}</span><span>RULE ENGINE READY</span><span>AI SAFE FALLBACK READY</span></div>
    {boot && <div className="pm-broadcast-boot" role="status"><div><small>PLANTMOJI ENVIRONMENT INTELLIGENCE</small><h1>BOOTING SYSTEM...</h1>{["SENSOR GATEWAY CLIENT", "ENVIRONMENT ANALYZER", "JEMBER CROP REFERENCES", "QUEST VERIFICATION ENGINE", "LOCAL CAMERA MODEL", "SAFE AI FALLBACK"].map((line, index) => <p key={line} style={{ animationDelay: `${index * 160}ms` }}><span>[✓]</span> {line}</p>)}<strong>APPLICATION CORE READY · LIVE LINKS CHECK ON EACH SCREEN</strong></div></div>}
    {ending && <button type="button" className="pm-broadcast-ending" onClick={() => setEnding(false)}><div><p>&gt; environment sensed</p><p>&gt; meaning understood</p><p>&gt; action verified</p><h2>SENSE · UNDERSTAND · ACT<br />VERIFY · REWARD · GROW</h2><strong>{id ? "Pengetahuan lokal + Sensor nyata + AI bertanggung jawab" : "Local knowledge + Real sensors + Responsible AI"}</strong><small>PLANTMOJI · JEMBER</small></div></button>}
  </>;
}
