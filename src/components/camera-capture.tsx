"use client";

// Camera capture + compression client component (spec §Flow 1–3).
//
// MVP capture is <input type="file" capture="environment"> — zero
// permissions ceremony on school-managed Androids; a live camera-stream
// viewfinder is roadmap, not MVP. Compression happens on-canvas BEFORE
// upload (max edge 1280px, JPEG q0.8) because school networks are slow
// and Storage is metered. The compressed Blob stays in state so a failed
// upload keeps the photo on-page behind a retry button (spec §Error
// handling) — no record row exists until the upload succeeds.

import Link from "next/link";
import { startTransition, useActionState, useRef, useState, type ChangeEvent } from "react";
import { uploadPlantPhoto, type CameraActionState } from "@/app/camera/actions";
import { CAMERA_COPY } from "@/app/camera/copy";
import type { AppLocale } from "@/lib/i18n";
import { MAX_PHOTO_BYTES } from "@/lib/photo-diary";

const IDLE_STATE: CameraActionState = {
  status: "idle",
  error: null,
  photoUrl: null,
  aiComment: null,
  seedGranted: false,
};

const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 0.8;

/** Downscales to a 1280px max edge JPEG (q0.8). Any failure returns the
 *  original file — the server re-validates size/MIME regardless. */
async function compressPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolveBlob) =>
      canvas.toBlob(resolveBlob, "image/jpeg", JPEG_QUALITY),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export default function CameraCapture({
  locale,
  bucketReady,
}: {
  locale: AppLocale;
  bucketReady: boolean;
}) {
  const copy = CAMERA_COPY[locale];
  const [state, formAction, pending] = useActionState(uploadPlantPhoto, IDLE_STATE);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState<"too_large" | "bad_type" | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setClientError(null);
    if (!file.type.startsWith("image/")) {
      setClientError("bad_type");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setClientError("too_large");
      return;
    }
    const blob = await compressPhoto(file);
    setPhotoBlob(blob);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
  }

  function submit() {
    if (!photoBlob || pending) return;
    const data = new FormData();
    data.append("plantId", "plant-01");
    data.append("locale", locale);
    data.append("photo", new File([photoBlob], "photo.jpg", { type: photoBlob.type || "image/jpeg" }));
    startTransition(() => formAction(data));
  }

  const notReady = !bucketReady || state.status === "not-ready";
  const errorCopy =
    clientError === "too_large" || state.error === "too_large"
      ? copy.tooLarge
      : clientError === "bad_type" || state.error === "bad_type"
        ? copy.wrongType
        : state.status === "error"
          ? copy.failedUpload
          : null;

  return (
    <section className="pm-panel flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="pm-heading text-xs">{copy.privacyTitle}</h2>
        <p className="text-[11px] leading-4 text-[#57684F]">{copy.privacyPlantOnly}</p>
        <p className="text-[11px] leading-4 text-[#57684F]">{copy.privacyNoNames}</p>
      </div>

      {notReady ? (
        <p className="rounded-xl border-2 border-dashed border-[#BCD3B4] bg-[#F4FAF1] px-3 py-2 text-xs text-[#57684F]">
          <strong className="block">{copy.notReadyTitle}</strong>
          {copy.notReadyBody}
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPick}
          />

          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob URL preview; next/image cannot optimize object URLs
            <img
              src={previewUrl}
              alt={copy.chooseButton}
              className="w-full rounded-xl border-2 border-[#DCEAD5]"
            />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="pm-btn flex-1"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {previewUrl ? copy.retakeButton : copy.chooseButton}
            </button>
            {photoBlob && state.status !== "success" && (
              <button
                type="button"
                className="pm-btn pm-btn-primary flex-1"
                disabled={pending}
                onClick={submit}
              >
                {pending ? copy.uploading : state.status === "error" ? copy.retryButton : copy.submitButton}
              </button>
            )}
          </div>

          {errorCopy && <p className="text-xs text-[#A8552F]">{errorCopy}</p>}

          {state.status === "success" && (
            <div className="flex flex-col gap-2 rounded-xl border-2 border-[#DCEAD5] bg-[#F4FAF1] px-3 py-2">
              <p className="pm-heading text-[10px] uppercase">{copy.successTitle}</p>
              {state.aiComment && (
                <p className="text-xs text-[#3A4A34]">
                  <span className="font-semibold">{copy.commentLabel}: </span>
                  &ldquo;{state.aiComment}&rdquo;
                </p>
              )}
              <p className="text-xs text-[#57684F]">
                {state.seedGranted ? copy.seedGranted : copy.seedAlready}
              </p>
              <Link href="/diary" className="text-xs font-semibold text-[#243421] underline">
                {copy.viewDiary}
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
