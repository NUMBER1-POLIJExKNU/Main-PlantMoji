"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";

export default function BroadcastOverlay({ locale }: { locale: AppLocale }) {
  const pathname = usePathname(); const search = useSearchParams(); const router = useRouter();
  const active = search.has("demo") || search.has("presentation");
  const [boot, setBoot] = useState(false); const [ending, setEnding] = useState(false); const [online, setOnline] = useState(true);
  const [held, setHeld] = useState(false); const [muted, setMuted] = useState(false); const [cameraReady, setCameraReady] = useState(false);
  const scene = Math.max(1, Math.min(6, Number(search.get("scene")) || (pathname === "/plants" ? 2 : pathname === "/quests" ? 4 : pathname === "/camera" ? 5 : 1)));
  const source = search.get("source") === "live" ? "live" : "demo";
  const scenes = ["/?presentation=1&scene=1&source=demo", "/plants?demo=hot&presentation=1&scene=2&source=demo", "/plants?demo=hot&presentation=1&scene=3&source=demo", "/quests?presentation=1&scene=4&source=demo", "/camera?presentation=1&scene=5&source=demo", "/?presentation=1&scene=6&source=demo"];
  const sceneMeta = [
    ["LIVE GARDEN", "Real sensors shape Jamkachu’s world"],
    ["ENVIRONMENT SCAN", "Lock · validate · compare Jember crops"],
    ["CROP MATCH", "Rules decide · AI helps students understand"],
    ["ACT & VERIFY", "Change one condition · sensors verify recovery"],
    ["LOCAL VISION", "On-device classification · no video upload"],
    ["GROWTH UPDATED", "Sense · understand · act · verify · reward"],
  ][scene - 1];
  useEffect(() => { const syncId = window.setTimeout(() => setOnline(navigator.onLine), 0); const on = () => setOnline(true); const off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.clearTimeout(syncId); window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  useEffect(() => { if (!active || sessionStorage.getItem("pm-broadcast-boot")) return; const startId = window.setTimeout(() => setBoot(true), 0); sessionStorage.setItem("pm-broadcast-boot", "1"); const id = window.setTimeout(() => setBoot(false), 2400); return () => { window.clearTimeout(startId); window.clearTimeout(id); }; }, [active]);
  useEffect(() => { const show = () => setEnding(true); window.addEventListener("pm:broadcast-ending", show); return () => window.removeEventListener("pm:broadcast-ending", show); }, []);
  useEffect(() => { document.documentElement.classList.toggle("pm-demo-held", held); document.documentElement.classList.toggle("pm-camera-ready", cameraReady); return () => { document.documentElement.classList.remove("pm-demo-held", "pm-camera-ready"); }; }, [held, cameraReady]);
  useEffect(() => { const id = window.setTimeout(() => setMuted(window.PMSfx?.muted() ?? true), 0); return () => window.clearTimeout(id); }, []);
  if (!active) return null;
  const id = locale === "id";
  const go = (next: number) => router.push(scenes[Math.max(0, Math.min(5, next - 1))]);
  const toggleMute = () => setMuted(window.PMSfx?.toggle() ?? !muted);
  const toggleSource = () => { const params = new URLSearchParams(search.toString()); const next = source === "live" ? "demo" : "live"; params.set("source", next); params.set("presentation", "1"); if (pathname === "/plants" && next === "demo") params.set("demo", "healthy"); else if (pathname === "/plants") params.delete("demo"); router.push(`${pathname}?${params}`); };
  const replay = () => { setHeld(false); window.dispatchEvent(new CustomEvent("pm:demo-replay", { detail: { scene } })); setBoot(true); window.setTimeout(() => setBoot(false), 2400); };
  return <>
    <section className="pm-demo-scene-card" aria-live="polite">
      <span>SCENE {scene} / 6</span><div><strong>{sceneMeta[0]}</strong><small>{sceneMeta[1]}</small></div><i aria-hidden="true" style={{ width: `${scene / 6 * 100}%` }} />
    </section>
    <div className="pm-broadcast-status" aria-label="Presentation status"><b>● {source === "live" ? "LIVE SENSOR" : "DEMO SENSOR"}</b><span>SCENE {scene}/6</span><span>NETWORK {online ? "ONLINE" : "OFFLINE"}</span><span>RULE ENGINE READY</span></div>
    <div className="pm-demo-director" role="toolbar" aria-label="Presentation controls"><div className="pm-director-primary"><button type="button" aria-label="START DEMO" onClick={() => go(1)}><span>↺</span> START</button><button type="button" className="is-next" onClick={() => go(scene + 1)} disabled={scene === 6}>NEXT SCENE <span>→</span></button></div><div className="pm-director-secondary"><button type="button" aria-pressed={held} onClick={() => setHeld((value) => !value)}>{held ? "▶ RESUME" : "Ⅱ HOLD"}</button><button type="button" aria-label="REPLAY EFFECT" onClick={replay}>↻ REPLAY</button><button type="button" aria-label={source === "live" ? "LIVE SOURCE" : "DEMO SOURCE"} onClick={toggleSource}><span className="pm-source-dot" />{source === "live" ? "LIVE" : "DEMO"}</button><button type="button" aria-pressed={muted} onClick={toggleMute}>{muted ? "🔇" : "🔊"}<span className="pm-director-long-label"> {muted ? "UNMUTE" : "MUTE"}</span></button><button type="button" aria-pressed={cameraReady} onClick={() => setCameraReady((value) => !value)}>▣ <span className="pm-director-long-label">CAMERA READY</span></button></div></div>
    {cameraReady && <button type="button" className="pm-camera-ready-exit" onClick={() => setCameraReady(false)}>EXIT CAMERA READY</button>}
    {boot && <div className="pm-broadcast-boot" role="status"><div><small>PLANTMOJI ENVIRONMENT INTELLIGENCE</small><h1>BOOTING SYSTEM...</h1>{["SENSOR GATEWAY CLIENT", "ENVIRONMENT ANALYZER", "JEMBER CROP REFERENCES", "QUEST VERIFICATION ENGINE", "LOCAL CAMERA MODEL", "SAFE AI FALLBACK"].map((line, index) => <p key={line} style={{ animationDelay: `${index * 160}ms` }}><span>[✓]</span> {line}</p>)}<strong>APPLICATION CORE READY · LIVE LINKS CHECK ON EACH SCREEN</strong></div></div>}
    {ending && <button type="button" className="pm-broadcast-ending" onClick={() => setEnding(false)}><div><p>&gt; environment sensed</p><p>&gt; meaning understood</p><p>&gt; action verified</p><h2>SENSE · UNDERSTAND · ACT<br />VERIFY · REWARD · GROW</h2><strong>{id ? "Pengetahuan lokal + Sensor nyata + AI bertanggung jawab" : "Local knowledge + Real sensors + Responsible AI"}</strong><small>PLANTMOJI · JEMBER</small></div></button>}
  </>;
}
