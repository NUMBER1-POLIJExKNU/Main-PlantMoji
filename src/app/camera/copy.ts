import type { AppLocale } from "@/lib/i18n";

export const CAMERA_COPY = {
  en: {
    title: "Camera AI · Live Guardian",
    description: "Watch the real plant continuously. Motion is detected on this device; AI only adds optional pest advice.",
    privacy: "Video stays on this device. Only one small snapshot may be checked by AI, never stored.",
    privacyPlantOnly: "Keep the camera pointed at the plant only — no friends or faces.",
    start: "Start watching", stop: "Stop camera", watching: "Watching", motion: "Something moved!", checking: "Checking one frame…",
    sleeping: "Guardian rests from 18:00–06:00 WIB.", denied: "Camera access is unavailable. Allow camera permission and try again.",
    motionOnly: "Motion-only mode · works without AI", aiReady: "AI advice available", recent: "Recent guardian events", empty: "No movement yet.",
    tickle: "Hehe! That tickles! Was someone touching my leaf?", pest: "Something may be on a leaf. Please look closely with a teacher.",
  },
  id: {
    title: "Kamera AI · Penjaga Langsung",
    description: "Mengawasi tanaman asli terus-menerus. Gerakan dideteksi di perangkat ini; AI hanya memberi saran hama opsional.",
    privacy: "Video tetap di perangkat ini. Hanya satu gambar kecil yang dapat diperiksa AI, tidak pernah disimpan.",
    privacyPlantOnly: "Arahkan kamera hanya ke tanaman — tanpa teman atau wajah.",
    start: "Mulai mengawasi", stop: "Matikan kamera", watching: "Sedang mengawasi", motion: "Ada yang bergerak!", checking: "Memeriksa satu gambar…",
    sleeping: "Penjaga beristirahat pukul 18.00–06.00 WIB.", denied: "Kamera tidak tersedia. Izinkan akses kamera lalu coba lagi.",
    motionOnly: "Mode gerakan saja · tetap bekerja tanpa AI", aiReady: "Saran AI tersedia", recent: "Kejadian terbaru", empty: "Belum ada gerakan.",
    tickle: "Hihi! Geli! Ada yang menyentuh daunku, ya?", pest: "Mungkin ada sesuatu di daun. Yuk periksa bersama guru.",
  },
} satisfies Record<AppLocale, Record<string, string>>;
