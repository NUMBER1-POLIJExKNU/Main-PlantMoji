"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA_COPY } from "@/app/camera/copy";
import type { AppLocale } from "@/lib/i18n";
import { DEFAULT_MOTION_CONFIG, MOTION_SAMPLE_HEIGHT, MOTION_SAMPLE_WIDTH, isCameraActiveHour, nextMotionState, rgbaToGrayscale, type MotionState } from "@/lib/motion-detect";

type GuardianStatus = "idle" | "watching" | "motion" | "checking" | "sleeping" | "denied";

function hourWib() {
  try { return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date())) % 24; }
  catch { return new Date(Date.now() + 7 * 3_600_000).getUTCHours(); }
}

export default function CameraCapture({ locale, aiEnabled }: { locale: AppLocale; aiEnabled: boolean }) {
  const copy = CAMERA_COPY[locale];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastScanRef = useRef(0);
  const motionRef = useRef<MotionState>({ baseline: null, active: false, consecutive: 0, lastEventAt: -DEFAULT_MOTION_CONFIG.cooldownMs });
  const [status, setStatus] = useState<GuardianStatus>("idle");
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<string[]>([]);

  const stop = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    motionRef.current = { baseline: null, active: false, consecutive: 0, lastEventAt: -DEFAULT_MOTION_CONFIG.cooldownMs };
    setStatus("idle");
  }, []);

  const addEvent = useCallback((line: string) => {
    const time = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    setEvents((current) => [`${time} · ${line}`, ...current].slice(0, 5));
  }, [locale]);

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setStatus("checking");
    const scanCanvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / video.videoWidth);
    scanCanvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    scanCanvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    scanCanvas.getContext("2d")?.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
    const jpeg = await new Promise<Blob | null>((resolve) => scanCanvas.toBlob(resolve, "image/jpeg", 0.58));
    if (!jpeg || jpeg.size > 200_000) { setStatus("watching"); return; }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(jpeg);
      });
      const response = await fetch("/api/camera-scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: dataUrl, locale }) });
      const result = await response.json() as { advice?: string; verdict?: string };
      if (response.ok && result.verdict === "possible_pest" && result.advice) { setMessage(result.advice); addEvent(result.advice); }
    } catch { /* AI is optional; motion watching continues. */ }
    finally { setStatus("watching"); }
  }, [addEvent, locale]);

  const onMotion = useCallback(() => {
    setStatus("motion");
    setMessage(copy.tickle);
    addEvent(copy.motion);
    void fetch("/api/camera-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "touch", occurredAt: new Date().toISOString() }) }).catch(() => {});
    window.setTimeout(() => setStatus("watching"), 1100);
    if (aiEnabled && Date.now() - lastScanRef.current >= 10 * 60_000) { lastScanRef.current = Date.now(); void scanFrame(); }
  }, [addEvent, aiEnabled, copy.motion, copy.tickle, scanFrame]);

  const start = useCallback(async () => {
    if (!isCameraActiveHour(hourWib())) { setStatus("sleeping"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStatus("watching");
      timerRef.current = window.setInterval(() => {
        const video = videoRef.current; const canvas = canvasRef.current;
        if (!video || !canvas || document.hidden || !video.videoWidth) return;
        if (!isCameraActiveHour(hourWib())) { stop(); setStatus("sleeping"); return; }
        const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) return;
        context.drawImage(video, 0, 0, MOTION_SAMPLE_WIDTH, MOTION_SAMPLE_HEIGHT);
        const frame = rgbaToGrayscale(context.getImageData(0, 0, MOTION_SAMPLE_WIDTH, MOTION_SAMPLE_HEIGHT).data);
        const result = nextMotionState(motionRef.current, frame, Date.now()); motionRef.current = result.state;
        if (result.event === "MOTION_START") onMotion();
        if (aiEnabled && Date.now() - lastScanRef.current >= 10 * 60_000) { lastScanRef.current = Date.now(); void scanFrame(); }
      }, 125);
    } catch { setStatus("denied"); }
  }, [aiEnabled, onMotion, scanFrame, stop]);

  useEffect(() => stop, [stop]);

  const label = status === "watching" ? copy.watching : status === "motion" ? copy.motion : status === "checking" ? copy.checking : status === "sleeping" ? copy.sleeping : status === "denied" ? copy.denied : "";
  return (
    <section className="pm-panel flex flex-col gap-4">
      <div className="rounded-xl border-2 border-[#7AAE72] bg-[#EFF8E9] p-3 text-xs leading-5 text-[#31472E]"><p>🔒 {copy.privacy}</p><p>🌿 {copy.privacyPlantOnly}</p></div>
      <div className="relative aspect-video overflow-hidden rounded-2xl border-4 border-[#31472E] bg-[#172318]">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        <canvas ref={canvasRef} width={MOTION_SAMPLE_WIDTH} height={MOTION_SAMPLE_HEIGHT} className="hidden" />
        {status !== "watching" && status !== "motion" && status !== "checking" && <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white">{label || "🌿 CAMERA GUARDIAN"}</div>}
        <div className="absolute left-3 top-3 rounded-lg border-2 border-white/70 bg-[#243421]/85 px-3 py-2 text-[10px] text-white">{status === "motion" ? "✋" : status === "checking" ? "🔍" : "👀"} {label || copy.watching}</div>
        {message && <div className="absolute bottom-3 left-3 right-3 rounded-xl border-2 border-[#31472E] bg-[#FFFBE6] p-3 text-xs text-[#243421]">🌱 “{message}”</div>}
      </div>
      <div className="flex gap-2">
        {status === "watching" || status === "motion" || status === "checking" ? <button type="button" className="pm-btn flex-1" onClick={stop}>{copy.stop}</button> : <button type="button" className="pm-btn pm-btn-primary flex-1" onClick={() => void start()}>{copy.start}</button>}
        <span className="grid flex-1 place-items-center rounded-xl border-2 border-[#BCD3B4] px-2 text-center text-[10px]">{aiEnabled ? `✨ ${copy.aiReady}` : `🛡️ ${copy.motionOnly}`}</span>
      </div>
      <div><h2 className="pm-heading mb-2 text-[10px]">{copy.recent}</h2><div className="space-y-1 text-xs text-[#57684F]">{events.length ? events.map((event) => <p key={event} className="rounded-lg bg-[#F4FAF1] px-3 py-2">{event}</p>) : <p>{copy.empty}</p>}</div></div>
    </section>
  );
}
