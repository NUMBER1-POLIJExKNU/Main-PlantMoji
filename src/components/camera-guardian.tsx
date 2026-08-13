"use client";

// Camera Live Guardian client island (spec:
// docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
//
// PRIVACY CONTRACT: the video feed never leaves this component. Frames are
// downscaled into an in-memory 64×48 canvas for the deterministic frame-diff
// engine (src/lib/motion-detect — math, never AI), and at most ONE ≤200KB
// JPEG snapshot per scan window is POSTed for advisory analysis and then
// discarded. A separate, explicit "save to diary" button is the only path
// that persists a frame; automatic guardian scans are never stored.
//
// REWARDS CONTRACT: nothing here grants anything, ever. Touch events drive
// presentation (mini Jamkachu + the farm fan-out) and a camera_events log
// row — no XP, no Seeds, no quests. Network failure queues nothing: events
// are ephemeral by design (a missed giggle is not data loss).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addGrowthRecord } from "@/app/settings/actions";
import CameraSparkles from "@/components/camera-sparkles";
import ProcessRail, { type ProcessStep } from "@/components/process-rail";
import { CAMERA_COPY } from "@/app/camera/copy";
// Type-only: erased at compile time, so tfjs stays behind the dynamic import.
import type { CameraModelLabel } from "@/lib/local-camera-model";
import {
  MOTION_CONFIG,
  createMotionDetector,
  isGuardianSuspendedWIB,
  toGrayscale,
  type MotionEvent,
} from "@/lib/motion-detect";
import { devNow } from "@/lib/pm-clock";
import { npcNameLabel, type AppLocale } from "@/lib/i18n";
import type { SensorSnapshot } from "@/lib/crop-profiles";

export interface GuardianFeedItem {
  kind: "touch" | "pest_advice";
  at: string; // ISO timestamp
  message: string | null;
}

type GuardianStatus =
  | "starting"
  | "watching"
  | "motion"
  | "checking"
  | "suspended"
  | "hidden"
  | "denied"
  | "nocamera";

type LocalModelState = "loading" | "ready" | "failed";

const SAMPLE_MS = Math.round(1000 / MOTION_CONFIG.sampleFps); // ≈125ms — ~8fps
const SCAN_MIN_GAP_MS = 10 * 60_000; // one analyzed snapshot per 10 min, motion or timer
const TOUCH_POST_GAP_MS = 10_000; // client-side mirror of the server rate limit
const SNAPSHOT_WIDTH = 640;
const MAX_SNAPSHOT_BYTES = 200 * 1024;
const MOTION_CHIP_MS = 2_500;
const FEED_LIMIT = 12;
// Below this the two-class softmax is not saying anything worth showing, so the
// panel reports "analyzing" rather than committing to either label.
const CONFIDENCE_FLOOR = 0.7;

/**
 * The 18:00–06:00 WIB night gate, honouring the developer clock override.
 *
 * isGuardianSuspendedWIB stays a pure function of a Date — motion-detect.ts
 * has zero imports and zero DOM by contract, and reading localStorage from
 * inside it would end that. So the override is injected HERE, at the only
 * place in this component that asks what time of day it is. Everything else
 * in this file (the 10s touch gap, the 10min scan gate, the motion cooldown)
 * measures elapsed time and keeps calling Date.now(), which the override
 * deliberately never touches.
 */
const guardianAsleep = () => isGuardianSuspendedWIB(devNow());

interface WakeLockSentinel {
  release: () => Promise<void>;
}

export default function CameraGuardian({
  locale,
  plantId,
  growthStage,
  guardianReady,
  scanConfigured,
  initialEvents,
}: {
  locale: AppLocale;
  plantId: string;
  growthStage: string;
  guardianReady: boolean;
  scanConfigured: boolean;
  initialEvents: GuardianFeedItem[];
  // Accepted for prop-type compatibility with src/app/camera/page.tsx (owned
  // by a different workstream), which already fetches and passes this.
  // Intentionally unused here: a third status readout (sensor HUD) would
  // reintroduce the redundant-overlay problem this file's fix (single
  // pm-cam-result status + compact chip dot) is removing.
  initialSnapshot?: SensorSnapshot | null;
}) {
  const copy = CAMERA_COPY[locale];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef(createMotionDetector());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastTouchPostRef = useRef(0);
  const lastScanRef = useRef(0);
  const scanInFlightRef = useRef(false);
  const motionChipTimerRef = useRef<number | null>(null);
  const scanNoteTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<GuardianStatus>("starting");
  const [scanDisabled, setScanDisabled] = useState(!scanConfigured);
  const [feed, setFeed] = useState<GuardianFeedItem[]>(initialEvents);
  const [tickle, setTickle] = useState(0); // increments to replay the reaction
  const [localModelState, setLocalModelState] = useState<LocalModelState>("loading");
  // Two scalars rather than one object: a steady scene resolves to the same
  // label every tick, and React bails out of the re-render only when the next
  // state is Object.is-equal. A fresh object literal every 2.5s would re-render
  // the whole feed on top of the frame-diff loop for nothing.
  const [localLabel, setLocalLabel] = useState<CameraModelLabel | null>(null);
  const [localConfidence, setLocalConfidence] = useState(0);
  const [scanNote, setScanNote] = useState<string | null>(null); // transient non-pest line
  const [diarySave, setDiarySave] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const pushFeed = useCallback((item: GuardianFeedItem) => {
    setFeed((prev) => [item, ...prev].slice(0, FEED_LIMIT));
  }, []);

  /** A discarded (person-in-frame) scan is NOT a pest event: show the
   *  generic line as a plain transient note — no tickle, no bug feed row. */
  const showScanNote = useCallback((message: string) => {
    setScanNote(message);
    if (scanNoteTimerRef.current !== null) window.clearTimeout(scanNoteTimerRef.current);
    scanNoteTimerRef.current = window.setTimeout(() => {
      scanNoteTimerRef.current = null;
      setScanNote(null);
    }, 8_000);
  }, []);
  useEffect(
    () => () => {
      if (scanNoteTimerRef.current !== null) window.clearTimeout(scanNoteTimerRef.current);
    },
    [],
  );

  /** Deterministic touch fan-out — fire and forget (ephemeral by design). */
  const postTouch = useCallback(() => {
    if (!guardianReady) return; // milestone19 missing: local-only mode
    const now = Date.now();
    if (now - lastTouchPostRef.current < TOUCH_POST_GAP_MS) return;
    lastTouchPostRef.current = now;
    fetch("/api/camera-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId, kind: "touch", occurredAt: new Date().toISOString() }),
    }).catch(() => {
      // A missed giggle is not data loss — nothing queues, nothing retries.
    });
  }, [guardianReady, plantId]);

  /** ONE ≤200KB JPEG → /api/camera-scan. Shared 10-min gate for both the
   *  motion trigger and the periodic timer. Silent degrade on any failure. */
  const runScan = useCallback(async () => {
    if (scanDisabled) return;
    const video = videoRef.current;
    const canvas = snapCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    if (scanInFlightRef.current) return;
    if (Date.now() - lastScanRef.current < SCAN_MIN_GAP_MS) return;
    // The 10-min gate is consumed only AFTER a successful round trip (below):
    // a failed capture or a dropped request must not silence the pest watch
    // for a whole window. Re-entrancy is held off by scanInFlightRef instead.
    scanInFlightRef.current = true;
    setStatus((prev) => (prev === "watching" || prev === "motion" ? "checking" : prev));
    try {
      const sourceWidth = video.videoWidth || SNAPSHOT_WIDTH;
      const scale = SNAPSHOT_WIDTH / sourceWidth;
      canvas.width = SNAPSHOT_WIDTH;
      canvas.height = Math.max(1, Math.round((video.videoHeight || 480) * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      // ≤200KB contract: step JPEG quality down until the payload fits.
      let base64 = "";
      for (const quality of [0.7, 0.5, 0.35]) {
        base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "";
        if ((base64.length * 3) / 4 <= MAX_SNAPSHOT_BYTES) break;
      }
      if (!base64 || (base64.length * 3) / 4 > MAX_SNAPSHOT_BYTES) return;
      const response = await fetch("/api/camera-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, imageBase64: base64, mimeType: "image/jpeg", locale }),
      });
      if (!response.ok) return; // scan failures silently degrade (spec)
      lastScanRef.current = Date.now(); // a real scan happened — burn the gate
      const body = (await response.json()) as {
        disabled?: boolean;
        verdict?: string;
        advisory?: string | null;
      };
      if (body.disabled) {
        setScanDisabled(true); // labeled motion-only mode from here on
        return;
      }
      if (typeof body.advisory !== "string" || !body.advisory) return;
      if (body.verdict === "pest") {
        setTickle((n) => n + 1);
        pushFeed({ kind: "pest_advice", at: new Date().toISOString(), message: body.advisory });
      } else {
        // NO_PLANT / person-in-frame: generic line only, nothing else (spec).
        showScanNote(body.advisory);
      }
    } catch {
      // Network failure → advisory is skipped; motion mode continues.
    } finally {
      scanInFlightRef.current = false;
      setStatus((prev) => (prev === "checking" ? "watching" : prev));
    }
  }, [locale, plantId, pushFeed, scanDisabled, showScanNote]);

  /** User-authorized capture only: take the current live frame, attach it
   *  to the existing Growth Diary action, and require Storage to succeed so
   *  a failed upload cannot create another photo-less postcard. */
  const saveCurrentFrameToDiary = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || diarySave === "saving") return;
    setDiarySave("saving");
    try {
      const canvas = document.createElement("canvas");
      const sourceWidth = video.videoWidth || 1280;
      const scale = Math.min(1, 1280 / sourceWidth);
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round((video.videoHeight || 720) * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (!blob) throw new Error("snapshot unavailable");
      const formData = new FormData();
      formData.set("plantId", plantId);
      formData.set("stage", growthStage);
      formData.set("heightCm", "");
      formData.set("leafCount", "");
      formData.set("note", locale === "id" ? "Foto dari Kamera AI" : "Photo from Camera AI");
      formData.set("photoRequired", "true");
      formData.set("photo", new File([blob], `plant-${Date.now()}.jpg`, { type: "image/jpeg" }));
      const result = await addGrowthRecord(formData);
      setDiarySave(result.ok && result.photoSaved ? "saved" : "error");
    } catch {
      setDiarySave("error");
    }
  }, [diarySave, growthStage, locale, plantId]);

  const handleMotionEvent = (event: MotionEvent) => {
    if (event.kind !== "MOTION_START") return;
    // INSTANT and local: the mini Jamkachu giggles with zero network.
    setTickle((n) => n + 1);
    setStatus((prev) => (prev === "watching" ? "motion" : prev));
    if (motionChipTimerRef.current !== null) window.clearTimeout(motionChipTimerRef.current);
    motionChipTimerRef.current = window.setTimeout(() => {
      motionChipTimerRef.current = null;
      setStatus((prev) => (prev === "motion" ? "watching" : prev));
    }, MOTION_CHIP_MS);
    pushFeed({ kind: "touch", at: new Date().toISOString(), message: null });
    postTouch();
    void runScan(); // motion-triggered scan (shared 10-min gate inside)
  };

  // Latest-handler refs keep the mount-once effects below closure-safe.
  const motionHandlerRef = useRef(handleMotionEvent);
  useEffect(() => {
    motionHandlerRef.current = handleMotionEvent;
  });
  const runScanRef = useRef(runScan);
  useEffect(() => {
    runScanRef.current = runScan;
  });

  // Camera + sampling loop + wake lock + visibility (mount once).
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;
    let wasSuspended = false;
    let activeStream: MediaStream | null = null;
    let activeVideo: HTMLVideoElement | null = null;

    const acquireWakeLock = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
        };
        const sentinel = await nav.wakeLock?.request("screen");
        if (sentinel) wakeLockRef.current = sentinel;
      } catch {
        // Best-effort: re-tried on visibility and interaction.
      }
    };

    const sample = () => {
      if (document.hidden) return;
      if (guardianAsleep()) {
        // Night window (18:00–06:00 WIB): dark frames are noise; Jamkachu sleeps.
        wasSuspended = true;
        setStatus((prev) =>
          prev === "watching" || prev === "motion" || prev === "checking" ? "suspended" : prev,
        );
        return;
      }
      if (wasSuspended) {
        // Dawn exit: the baseline froze at the ~18:00 scene ~12h ago —
        // re-prime so the first frames after 06:00 teach the scene instead
        // of firing a guaranteed false MOTION_START against a stale room.
        wasSuspended = false;
        detectorRef.current.rePrime();
      }
      const video = videoRef.current;
      const canvas = sampleCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, MOTION_CONFIG.width, MOTION_CONFIG.height);
      const rgba = context.getImageData(0, 0, MOTION_CONFIG.width, MOTION_CONFIG.height).data;
      const event = detectorRef.current.pushFrame(toGrayscale(rgba), Date.now());
      setStatus((prev) => (prev === "suspended" ? "watching" : prev)); // dawn auto-resume
      if (event) motionHandlerRef.current(event);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("nocamera");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        activeStream = stream;
        activeVideo = video;
        video.srcObject = stream;
        await video.play();
        await acquireWakeLock();
        setStatus(guardianAsleep() ? "suspended" : "watching");
        intervalId = window.setInterval(sample, SAMPLE_MS);
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : "";
        setStatus(name === "NotFoundError" || name === "OverconstrainedError" ? "nocamera" : "denied");
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        setStatus((prev) => (prev === "denied" || prev === "nocamera" ? prev : "hidden"));
        return;
      }
      void acquireWakeLock(); // wake locks release on hide — re-acquire
      // rePrime, not reset: the stale baseline is relearned, but the 10s
      // motion cooldown survives — hide/re-show must not shortcut it.
      detectorRef.current.rePrime();
      setStatus((prev) =>
        prev === "denied" || prev === "nocamera"
          ? prev
          : guardianAsleep()
            ? "suspended"
            : "watching",
      );
    };
    const onInteract = () => {
      void acquireWakeLock(); // wake-lock loss re-acquired on interaction
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onInteract);
    void start();

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onInteract);
      void wakeLockRef.current?.release().catch(() => undefined);
      activeStream?.getTracks().forEach((track) => track.stop());
      if (activeVideo) activeVideo.srcObject = null;
    };
    // Mount-once by design: all changing values are read through refs.
  }, []);

  // Existing Teachable Machine model from PROGRAM/CAMERA AI. Runs entirely
  // in this browser; no frame is uploaded. Authority contract:
  // Model classification only · not sensor truth.
  useEffect(() => {
    let cancelled = false;
    let running = false;
    const classify = async () => {
      const video = videoRef.current;
      if (running || document.hidden || guardianAsleep() || !video || video.readyState < 2) return;
      running = true;
      try {
        const { classifyCameraFrame } = await import("@/lib/local-camera-model");
        const result = await classifyCameraFrame(video);
        if (!cancelled) {
          setLocalLabel(result.label);
          setLocalConfidence(result.confidence);
          setLocalModelState("ready");
        }
      } catch {
        if (!cancelled) setLocalModelState("failed");
      } finally {
        running = false;
      }
    };
    const id = window.setInterval(() => void classify(), 2_500);
    void classify();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Periodic pest check (spec: motion-triggered + periodic 10 min).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden || guardianAsleep()) return;
      void runScanRef.current();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // ONE display state feeds the panel, the mascot, the rail and Jamkachu's
  // line. Deriving each of them from the raw label separately let an uncertain
  // frame paint a full-strength red alert while the headline underneath still
  // read "Analyzing…", and let a failed load keep the previous frame's alert
  // colour and 😮 under the words "model failed to load".
  const resultView: "loading" | "failed" | "uncertain" | "safe" | "foreign" =
    localModelState === "loading"
      ? "loading"
      : localModelState === "failed"
        ? "failed"
        : localLabel === null || localConfidence < CONFIDENCE_FLOOR
          ? "uncertain"
          : localLabel === "Foreign Environment"
            ? "foreign"
            : "safe";
  const isForeign = resultView === "foreign";
  // How sure the two-class softmax is, as a percent. Shown for every state
  // that HAS a reading — including "uncertain", where the number IS the
  // explanation for why no verdict is committed. Without it a confident
  // "Foreign Environment" (a model trained on one specific scene rejecting
  // every other scene) looks identical to a 71% coin-flip, and the two need
  // completely different fixes. Display only: nothing reads it back.
  const confidencePercent =
    localModelState === "ready" && localLabel !== null ? Math.round(localConfidence * 100) : null;
  const statusLabel: Record<GuardianStatus, string> = {
    starting: copy.statusStarting,
    watching: copy.statusWatching,
    motion: copy.statusMotion,
    checking: copy.statusChecking,
    suspended: copy.statusSuspended,
    hidden: copy.statusHidden,
    denied: copy.deniedTitle,
    nocamera: copy.noCameraTitle,
  };
  const visionSteps = useMemo<ProcessStep[]>(() => [
    { key: "camera", label: "CAMERA", summary: status === "watching" || status === "motion" || status === "checking" ? "READY" : status.toUpperCase(), state: status === "denied" || status === "nocamera" ? "error" : status === "starting" ? "running" : "complete" },
    { key: "model", label: "LOCAL MODEL", summary: localModelState === "ready" ? "READY" : localModelState.toUpperCase(), state: localModelState === "ready" ? "complete" : localModelState === "failed" ? "fallback" : "running" },
    // The percent rides along here too: the rail is the diagnostic strip, and
    // "ANALYZING" alone never said whether the model was at 68% or 20%.
    { key: "result", label: "RESULT", summary: resultView === "failed" ? "ERROR" : resultView === "loading" ? "WAITING" : `${resultView === "uncertain" ? "ANALYZING" : localLabel ?? "WAITING"}${confidencePercent === null ? "" : ` · ${confidencePercent}%`}`, state: resultView === "failed" ? "error" : resultView === "loading" ? "waiting" : resultView === "uncertain" ? "running" : "complete" },
  ], [confidencePercent, localLabel, localModelState, resultView, status]);

  // The real plant in the video is Jamkachu on this screen. Keep its voice
  // in the same short, friendly speech-bubble language as the farm view;
  // status chips and the result card remain secondary diagnostics.
  const cameraBubble = scanNote ?? (
    status === "motion"
      ? (locale === "id" ? "Hei! Aku merasakan gerakan di dekatku 👋" : "Hey! I felt a little movement near me 👋")
      : status === "checking"
        ? (locale === "id" ? "Aku sedang melihat lebih dekat…" : "I’m taking a closer look…")
        : status === "suspended"
          ? (locale === "id" ? "Aku tidur dulu ya. Tanaman juga perlu istirahat 🌙" : "I’m resting now. Plants need sleep too 🌙")
          : status === "hidden"
            ? (locale === "id" ? "Aku menunggumu kembali ke layar ini." : "I’m waiting for you to come back.")
            : resultView === "loading"
              ? (locale === "id" ? "Sebentar, aku sedang membuka mataku…" : "One moment, I’m opening my eyes…")
              : resultView === "failed"
                ? (locale === "id" ? "Aku masih mengawasi gerakan saja — model gagal dimuat." : "I’m watching motion only — the model failed to load.")
                : resultView === "foreign"
                  ? (locale === "id" ? "Hmm… ada sesuatu yang belum kukenal di sini." : "Hmm… I see something I don’t recognize here.")
                  : resultView === "safe"
                    ? (locale === "id" ? "Lingkungan terlihat aman." : "The environment looks safe.")
                    : (locale === "id" ? "Aku di sini! Temani aku menjaga tanaman ini 🌱" : "I’m here! Let’s take care of this plant together 🌱")
  );

  return (
    <section className="pm-cam">
      {status === "denied" || status === "nocamera" ? (
        <div className="pm-panel pm-cam-blocked">
          <h2>{status === "denied" ? copy.deniedTitle : copy.noCameraTitle}</h2>
          <p>{status === "denied" ? copy.deniedBody : copy.noCameraBody}</p>
          <button type="button" className="pm-btn pm-btn-primary mt-4" onClick={() => window.location.reload()}>{locale === "id" ? "COBA LAGI" : "TRY AGAIN"}</button>
        </div>
      ) : (
        <div className="pm-cam-stage">
          <video ref={videoRef} className="pm-cam-video" muted playsInline aria-label={copy.title} />
          <div
            key={cameraBubble}
            className={`pm-cam-speech${isForeign ? " is-alert" : ""}${tickle > 0 ? " is-tickled" : ""}`}
            role="status"
            aria-live="polite"
          >
            <span className="pm-cam-speech-name">JAMKACHU</span>
            <span>{cameraBubble}</span>
          </div>
          {/* Single verbal status lives in pm-cam-result below; this chip is
              now a compact color-coded state dot (no repeated text) — the
              full label survives for assistive tech via aria-label. */}
          <div className={`pm-cam-chip is-${status}`} role="status" aria-live="polite" aria-label={statusLabel[status]} />
          <div className={`pm-cam-result is-${isForeign ? "foreign" : "safe"}`}>
            <small>{locale === "id" ? "PENJAGA KEBUN" : "GARDEN GUARDIAN"}</small>
            <strong>
              {resultView === "loading"
                ? (locale === "id" ? "Jamkachu sedang melihat…" : "Jamkachu is looking…")
                : resultView === "failed"
                  ? (locale === "id" ? "AI model gagal dimuat" : "AI model failed to load")
                  : resultView === "uncertain"
                    ? (locale === "id" ? "Sedang dianalisis…" : "Analyzing…")
                    : isForeign
                      ? (locale === "id" ? "Lingkungan asing" : "Foreign Environment")
                      : (locale === "id" ? "Lingkungan aman" : "Safe Environment")}
            </strong>
            {/* aria-hidden: the bar is a redraw of the number beside it, and
                this card sits between two live regions that already talk. */}
            {confidencePercent !== null && (
              <span className="pm-cam-confidence">
                <small>{locale === "id" ? "YAKIN" : "CONFIDENCE"}</small>
                <span className="pm-cam-confidence-bar" aria-hidden="true">
                  <i style={{ width: `${confidencePercent}%` }} />
                </span>
                <b>{confidencePercent}%</b>
              </span>
            )}
            {/* No role="status" here: the hint mounts and unmounts as confidence
                crosses the floor, and this stage already carries two live regions
                (the speech bubble and the status dot). Announcing a third one every
                2.5s would talk over both. */}
            {resultView === "uncertain" && (
              <p className="pm-cam-note">
                {locale === "id"
                  ? "Kepercayaan rendah — arahkan kamera ke tanamannya."
                  : "Low confidence — point the camera toward the plant/environment."}
              </p>
            )}
          </div>
          <div
            key={tickle}
            className={`pm-cam-jamkachu${tickle > 0 ? " is-tickled" : ""}${isForeign ? " is-alert" : ""}`}
            aria-hidden="true"
          >
            <span>{tickle > 0 ? "😆" : isForeign ? "😮" : "🌱"}</span>
          </div>
          <CameraSparkles locale={locale} />
        </div>
      )}

      {status !== "denied" && status !== "nocamera" && (
        <div className="pm-cam-diary-save">
          <button
            type="button"
            className="pm-btn pm-btn-primary"
            onClick={() => void saveCurrentFrameToDiary()}
            disabled={status === "starting" || diarySave === "saving"}
          >
            {diarySave === "saving"
              ? (locale === "id" ? "MENYIMPAN…" : "SAVING…")
              : (locale === "id" ? "📸 SIMPAN KE DIARI" : "📸 SAVE TO DIARY")}
          </button>
          <p role="status" aria-live="polite">
            {diarySave === "saved"
              ? (locale === "id" ? "Foto sudah masuk ke Diari Tumbuh." : "The photo is now in Growth Diary.")
              : diarySave === "error"
                ? (locale === "id" ? "Foto belum tersimpan. Coba lagi." : "The photo was not saved. Try again.")
                : (locale === "id" ? "Hanya foto yang kamu simpan yang masuk ke diari." : "Only photos you choose to save enter the diary.")}
          </p>
        </div>
      )}

      {/* The rail and these two notes were presenter-only. They report what
          the local model is actually doing and why a scan is unavailable, so
          with the presentation mode gone they always render. */}
      <ProcessRail steps={visionSteps} label="Camera AI status" />
      {!guardianReady && <p className="pm-cam-note">{copy.guardianOfflineNote}</p>}
      {scanDisabled && <p className="pm-cam-note">{copy.motionOnlyLabel}</p>}
      <details className="pm-cam-privacy" role="note"><summary>🔒 {copy.privacyTitle}</summary><div><p>{copy.privacyLine1} {copy.privacyLine2}</p></div></details>
      {scanNote && (
        <p className="pm-cam-note" role="status">
          {scanNote}
        </p>
      )}

      <details className="pm-cam-moments">
        <summary><span>🕘 {copy.eventsTitle}</span><b>{feed.length}</b></summary>
        {feed.length === 0 ? (
          <p className="pm-cam-empty">{copy.eventsEmpty}</p>
        ) : (
          <ul className="pm-cam-feed">
            {feed.map((item, index) => (
              <li key={`${item.at}-${index}`} className={`pm-panel pm-cam-event is-${item.kind}`}>
                {item.kind === "touch" ? (
                  <span aria-hidden="true">✋</span>
                ) : (
                  // Moji-Bot (designer NPC cast) is the face of the AI
                  // advisory line — its name is the alt, so screen readers
                  // hear who is speaking before the advisory text.
                  // eslint-disable-next-line @next/next/no-img-element -- static pixel-art sprite; next/image resampling would blur it
                  <img
                    className="pm-npc-avatar"
                    src="/farm/assets/npc/2x/npc-05-moji-bot.png"
                    srcSet="/farm/assets/npc/1x/npc-05-moji-bot.png 32w, /farm/assets/npc/2x/npc-05-moji-bot.png 64w, /farm/assets/npc/4x/npc-05-moji-bot.png 128w"
                    sizes="32px"
                    alt={npcNameLabel(locale, "moji-bot")}
                    width={32}
                    height={32}
                  />
                )}
                <span>{item.kind === "touch" ? copy.eventTouch : (item.message ?? copy.eventPest)}</span>
                <time dateTime={item.at}>{new Date(item.at).toLocaleTimeString()}</time>
              </li>
            ))}
          </ul>
        )}
      </details>

      {/* Off-DOM work canvases: the 64×48 diff input and the one scan snapshot. */}
      <canvas ref={sampleCanvasRef} width={MOTION_CONFIG.width} height={MOTION_CONFIG.height} hidden />
      <canvas ref={snapCanvasRef} hidden />
    </section>
  );
}
