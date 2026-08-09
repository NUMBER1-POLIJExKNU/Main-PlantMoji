// Camera Live Guardian — bilingual page copy (spec:
// docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md;
// supersedes the photo-diary copy that lived here). Typed Record keeps
// en/id parity at compile time; tests/camera-copy.test.ts guards content.
// Pure data — importable from server routes and client components alike
// (the scan route reads scanGeneric).

import type { AppLocale } from "@/lib/i18n";

export interface CameraCopy {
  title: string;
  description: string;
  privacyTitle: string;
  /** The load-bearing promise: video never leaves the device. */
  privacyLine1: string;
  /** One snapshot at analysis time, never stored. */
  privacyLine2: string;
  statusStarting: string;
  statusWatching: string;
  statusMotion: string;
  statusChecking: string;
  statusSuspended: string;
  statusHidden: string;
  /** Shown whenever pest scanning is off (no GEMINI_API_KEY / disabled). */
  motionOnlyLabel: string;
  /** milestone19 missing: local-only mode, honest operator note. */
  guardianOfflineNote: string;
  eventsTitle: string;
  eventTouch: string;
  eventPest: string;
  eventsEmpty: string;
  deniedTitle: string;
  deniedBody: string;
  noCameraTitle: string;
  noCameraBody: string;
  /** Shown when a snapshot was discarded (NO_PLANT sentinel — person seen). */
  scanGeneric: string;
}

export const CAMERA_COPY: Record<AppLocale, CameraCopy> = {
  en: {
    title: "Camera AI",
    description:
      "Mount this screen facing the real plant — Jamkachu feels touches instantly and keeps a gentle pest watch.",
    privacyTitle: "Privacy promise",
    privacyLine1: "The video never leaves this device.",
    privacyLine2:
      "Only one small snapshot is checked at the moment of analysis — and it is never stored.",
    statusStarting: "Starting camera…",
    statusWatching: "👀 Watching",
    statusMotion: "✋ Motion!",
    statusChecking: "🔍 Checking…",
    statusSuspended: "🌙 Night rest (18:00–06:00 WIB) — Jamkachu is sleeping",
    statusHidden: "⏸️ Paused — bring this tab back to keep watching",
    motionOnlyLabel: "Motion-only mode — pest checks are off (no GEMINI_API_KEY set)",
    guardianOfflineNote:
      "Reactions stay on this screen only for now. (ops: run supabase/milestone19-camera-guardian.sql to fan the giggle out to the farm)",
    eventsTitle: "Recent moments",
    eventTouch: "Something brushed the plant — Jamkachu giggled!",
    eventPest: "Pest watch",
    eventsEmpty: "All quiet so far — Jamkachu is watching happily.",
    deniedTitle: "Camera permission needed",
    deniedBody:
      "The guardian can't see without the camera. Allow camera access for this site in the browser, then reload this page.",
    noCameraTitle: "No camera found",
    noCameraBody:
      "This device has no usable camera. Open /camera on a device with one and mount it facing the plant.",
    scanGeneric: "I peeked but couldn't check properly this time — let's try again soon!",
  },
  id: {
    title: "Kamera AI",
    description:
      "Pasang layar ini menghadap tanaman asli — Jamkachu merasakan sentuhan seketika dan ikut mengawasi hama.",
    privacyTitle: "Janji privasi",
    privacyLine1: "Video tidak pernah keluar dari perangkat ini.",
    privacyLine2:
      "Hanya satu cuplikan kecil yang diperiksa saat analisis — dan tanpa disimpan.",
    statusStarting: "Menyalakan kamera…",
    statusWatching: "👀 Mengawasi",
    statusMotion: "✋ Ada gerakan!",
    statusChecking: "🔍 Memeriksa…",
    statusSuspended: "🌙 Istirahat malam (18.00–06.00 WIB) — Jamkachu sedang tidur",
    statusHidden: "⏸️ Jeda — buka kembali tab ini untuk terus mengawasi",
    motionOnlyLabel: "Mode gerakan saja — pemeriksaan hama mati (GEMINI_API_KEY belum diatur)",
    guardianOfflineNote:
      "Untuk sekarang reaksinya hanya di layar ini. (ops: run supabase/milestone19-camera-guardian.sql untuk meneruskan kikikan ke layar kebun)",
    eventsTitle: "Momen terbaru",
    eventTouch: "Ada yang menyentuh tanaman — Jamkachu terkikik!",
    eventPest: "Pengawas hama",
    eventsEmpty: "Masih tenang — Jamkachu mengawasi dengan senang.",
    deniedTitle: "Butuh izin kamera",
    deniedBody:
      "Penjaga tidak bisa melihat tanpa kamera. Izinkan akses kamera untuk situs ini di browser, lalu muat ulang halaman.",
    noCameraTitle: "Kamera tidak ditemukan",
    noCameraBody:
      "Perangkat ini tidak punya kamera yang bisa dipakai. Buka /camera di perangkat berkamera dan pasang menghadap tanaman.",
    scanGeneric: "Aku sudah mengintip tapi belum bisa memeriksa kali ini — coba lagi sebentar ya!",
  },
};
