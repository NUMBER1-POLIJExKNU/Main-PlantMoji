// Camera photo diary — bilingual page copy (spec §Privacy & safety).
// Typed Record keeps en/id key parity at compile time; tests/camera-copy.test.ts
// guards it at runtime in the strings-parity spirit. Pure data — importable
// from both server and client components.

import type { AppLocale } from "@/lib/i18n";

export interface CameraCopy {
  title: string;
  description: string;
  privacyTitle: string;
  privacyPlantOnly: string;
  privacyNoNames: string;
  chooseButton: string;
  retakeButton: string;
  submitButton: string;
  uploading: string;
  successTitle: string;
  seedGranted: string;
  seedAlready: string;
  retryButton: string;
  failedUpload: string;
  tooLarge: string;
  wrongType: string;
  notReadyTitle: string;
  notReadyBody: string;
  commentLabel: string;
  viewDiary: string;
}

export const CAMERA_COPY: Record<AppLocale, CameraCopy> = {
  en: {
    title: "Camera AI",
    description: "Photograph the real plant — the photo joins the growth diary and Jamkachu says what it sees.",
    privacyTitle: "Photo rules",
    privacyPlantOnly: "Photograph the plant only — no friends, no faces!",
    privacyNoNames: "Photos are stored by date on the class plant's shared diary, never under anyone's name.",
    chooseButton: "Take a photo",
    retakeButton: "Retake",
    submitButton: "Save to diary",
    uploading: "Saving your photo…",
    successTitle: "Saved to the growth diary!",
    seedGranted: "First photo today: +1 Seed!",
    seedAlready: "Today's photo Seed was already collected — the diary still grew!",
    retryButton: "Try again",
    failedUpload: "The upload didn't make it (maybe the network napped). Your photo is still here — try again.",
    tooLarge: "That photo is over 5MB. Please take a smaller one.",
    wrongType: "That file isn't a photo. Please choose a JPEG, PNG, or WebP image.",
    notReadyTitle: "Camera is almost ready",
    notReadyBody: "The photo diary storage isn't set up at this school yet. (ops: run supabase/milestone19-photo-diary.sql)",
    commentLabel: "Jamkachu says",
    viewDiary: "Open the growth diary →",
  },
  id: {
    title: "Kamera AI",
    description: "Foto tanaman aslinya — fotonya masuk buku harian pertumbuhan dan Jamkachu bercerita tentang yang dilihatnya.",
    privacyTitle: "Aturan foto",
    privacyPlantOnly: "Foto tanamannya saja, ya — tanpa teman, tanpa wajah!",
    privacyNoNames: "Foto disimpan per tanggal di buku harian bersama tanaman kelas, tidak pernah atas nama siapa pun.",
    chooseButton: "Ambil foto",
    retakeButton: "Foto ulang",
    submitButton: "Simpan ke buku harian",
    uploading: "Menyimpan fotomu…",
    successTitle: "Tersimpan di buku harian pertumbuhan!",
    seedGranted: "Foto pertama hari ini: +1 Benih!",
    seedAlready: "Benih foto hari ini sudah diambil — buku hariannya tetap bertambah!",
    retryButton: "Coba lagi",
    failedUpload: "Unggahan belum berhasil (mungkin jaringannya tidur). Fotomu masih di sini — coba lagi.",
    tooLarge: "Foto itu lebih dari 5MB. Coba ambil foto yang lebih kecil.",
    wrongType: "Berkas itu bukan foto. Pilih gambar JPEG, PNG, atau WebP.",
    notReadyTitle: "Kamera hampir siap",
    notReadyBody: "Penyimpanan buku harian foto belum disiapkan di sekolah ini. (ops: run supabase/milestone19-photo-diary.sql)",
    commentLabel: "Kata Jamkachu",
    viewDiary: "Buka buku harian pertumbuhan →",
  },
};
