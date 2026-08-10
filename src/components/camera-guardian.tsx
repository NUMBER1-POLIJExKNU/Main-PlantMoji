"use client";

// Camera Live Guardian client island (spec:
// docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
//
// PRIVACY CONTRACT: the video feed never leaves this component. Frames are
// downscaled into an in-memory 64×48 canvas for the deterministic frame-diff
// engine (src/lib/motion-detect — math, never AI), and at most ONE ≤200KB
// JPEG snapshot per scan window is POSTed for advisory analysis — nothing
// is kept anywhere, and this island talks ONLY to the two camera API routes.
//
// REWARDS CONTRACT: nothing here grants anything, ever. Touch events drive
// presentation (mini Jamkachu + the farm fan-out) and a camera_events log
// row — no XP, no Seeds, no quests. Network failure queues nothing: events
// are ephemeral by design (a missed giggle is not data loss).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import IntelligenceConsole, { type IntelligenceLine } from "@/components/intelligence-console";
import { CAMERA_COPY } from "@/app/camera/copy";
import {
  MOTION_CONFIG,
  createMotionDetector,
  isGuardianSuspendedWIB,
  toGrayscale,
  type MotionEvent,
} from "@/lib/motion-detect";
import type { AppLocale } from "@/lib/i18n";

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

interface WakeLockSentinel {
  release: () => Promise<void>;
}

export default function CameraGuardian({
  locale,
  plantId,
  guardianReady,
  scanConfigured,
  initialEvents,
}: {
  locale: AppLocale;
  plantId: string;
  guardianReady: boolean;
  scanConfigured: boolean;
  initialEvents: GuardianFeedItem[];
}) {
  const copy = CAMERA_COPY[locale];
  const mirrorCopy = CAMERA_COPY[locale === "id" ? "en" : "id"]; // bilingual banner

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
  const [localClassification, setLocalClassification] = useState<"Safe Environment" | "Foreign Environment" | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null); // transient non-pest line

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
      if (isGuardianSuspendedWIB()) {
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
        setStatus(isGuardianSuspendedWIB() ? "suspended" : "watching");
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
          : isGuardianSuspendedWIB()
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
  // in this browser; no frame is uploaded. It is an advisory label only.
  useEffect(() => {
    let cancelled = false;
    let running = false;
    const classify = async () => {
      const video = videoRef.current;
      if (running || document.hidden || isGuardianSuspendedWIB() || !video || video.readyState < 2) return;
      running = true;
      try {
        const { classifyCameraFrame } = await import("@/lib/local-camera-model");
        const result = await classifyCameraFrame(video);
        if (!cancelled) { setLocalClassification(result.label); setLocalModelState("ready"); }
      } catch {
        if (!cancelled) setLocalModelState("failed");
      } finally { running = false; }
    };
    const id = window.setInterval(() => void classify(), 2_500);
    void classify();
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  // Periodic pest check (spec: motion-triggered + periodic 10 min).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden || isGuardianSuspendedWIB()) return;
      void runScanRef.current();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

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
  const visionLines = useMemo<IntelligenceLine[]>(() => [
    { label: "CAMERA STREAM", value: status === "watching" || status === "motion" || status === "checking" ? "LOCAL / ACTIVE" : status.toUpperCase(), tone: status === "denied" || status === "nocamera" ? "warn" : "ok" },
    { label: "MOTION ENGINE", value: "DETERMINISTIC FRAME DIFF", tone: "ok" },
    { label: "MODEL RUNTIME", value: "TENSORFLOW.JS / ON DEVICE", tone: localModelState === "failed" ? "warn" : "ok" },
    { label: "MODEL INPUT", value: "224 × 224" },
    { label: "LOCAL CLASSIFICATION", value: localClassification ?? localModelState.toUpperCase(), tone: localClassification === "Foreign Environment" ? "warn" : "ok" },
    { label: "LIVE VIDEO UPLOAD", value: "DISABLED", tone: "ok" },
    { label: "SENSOR AUTHORITY", value: "NONE", tone: "warn" },
    { label: "REWARD CONTROL", value: "DISABLED", tone: "ok" },
  ], [localClassification, localModelState, status]);

  return (
    <section className="pm-cam">
      {/* Prominent bilingual privacy banner (spec §/camera page). */}
      <div className="pm-panel pm-cam-privacy" role="note">
        <strong>{copy.privacyTitle}</strong>
        <p>
          {copy.privacyLine1} {copy.privacyLine2}
        </p>
        <p className="pm-cam-privacy-alt">
          {mirrorCopy.privacyLine1} {mirrorCopy.privacyLine2}
        </p>
      </div>

      <div className={`pm-cam-chip is-${status}`} role="status" aria-live="polite">
        {statusLabel[status]}
      </div>
      <IntelligenceConsole title="LOCAL VISION CORE" lines={visionLines} running={status === "starting" || status === "checking"} compact />

      {status === "denied" || status === "nocamera" ? (
        <div className="pm-panel pm-cam-blocked">
          <h2>{status === "denied" ? copy.deniedTitle : copy.noCameraTitle}</h2>
          <p>{status === "denied" ? copy.deniedBody : copy.noCameraBody}</p>
        </div>
      ) : (
        <div className="pm-cam-stage">
          <video ref={videoRef} className="pm-cam-video" muted playsInline aria-label={copy.title} />
          <div
            key={tickle}
            className={`pm-cam-jamkachu${tickle > 0 ? " is-tickled" : ""}`}
            aria-hidden="true"
          >
            <span>{tickle > 0 ? "😆" : "🌱"}</span>
          </div>
        </div>
      )}

      {!guardianReady && <p className="pm-cam-note">{copy.guardianOfflineNote}</p>}
      {scanDisabled && <p className="pm-cam-note">{copy.motionOnlyLabel}</p>}
      <div className={`pm-cam-model is-${localClassification === "Foreign Environment" ? "foreign" : "safe"}`} role="status">
        <span aria-hidden="true">{localClassification === "Foreign Environment" ? "⚠️" : "🧠"}</span>
        <div>
          <strong>{locale === "id" ? "MODEL AI LOKAL" : "LOCAL AI MODEL"}</strong>
          <p>{localModelState === "loading" ? (locale === "id" ? "Memuat model Teachable Machine…" : "Loading Teachable Machine model…") : localModelState === "failed" ? (locale === "id" ? "Model tidak tersedia · deteksi gerakan tetap aktif" : "Model unavailable · motion detection still works") : localClassification}</p>
          <small>{locale === "id" ? "Klasifikasi model saja · bukan fakta sensor" : "Model classification only · not sensor truth"}</small>
        </div>
      </div>
      {scanNote && (
        <p className="pm-cam-note" role="status">
          {scanNote}
        </p>
      )}

      <section aria-label={copy.eventsTitle}>
        <h2 className="pm-heading text-sm">{copy.eventsTitle}</h2>
        {feed.length === 0 ? (
          <p className="pm-cam-empty">{copy.eventsEmpty}</p>
        ) : (
          <ul className="pm-cam-feed">
            {feed.map((item, index) => (
              <li key={`${item.at}-${index}`} className={`pm-panel pm-cam-event is-${item.kind}`}>
                <span aria-hidden="true">{item.kind === "touch" ? "✋" : "🐛"}</span>
                <span>{item.kind === "touch" ? copy.eventTouch : (item.message ?? copy.eventPest)}</span>
                <time dateTime={item.at}>{new Date(item.at).toLocaleTimeString()}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Off-DOM work canvases: the 64×48 diff input and the one scan snapshot. */}
      <canvas ref={sampleCanvasRef} width={MOTION_CONFIG.width} height={MOTION_CONFIG.height} hidden />
      <canvas ref={snapCanvasRef} hidden />
    </section>
  );
}
