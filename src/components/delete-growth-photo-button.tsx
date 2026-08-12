"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGrowthPhoto } from "@/app/settings/actions";

export default function DeleteGrowthPhotoButton({
  recordId,
  plantId,
  locale,
}: {
  recordId: string;
  plantId: string;
  locale: "id" | "en";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label = locale === "id" ? "Hapus foto" : "Delete photo";

  function removePhoto() {
    if (pending || !window.confirm(locale === "id" ? "Hapus foto dari catatan ini?" : "Delete this photo from the diary entry?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteGrowthPhoto(recordId, plantId);
      if (result.ok) router.refresh();
      else setError(result.error ?? (locale === "id" ? "Foto belum terhapus." : "The photo was not deleted."));
    });
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button type="button" className="pm-btn pm-btn-secondary text-[10px]" onClick={removePhoto} disabled={pending}>
        {pending ? (locale === "id" ? "Menghapus…" : "Deleting…") : label}
      </button>
      {error && <span role="alert" className="text-[10px] text-[#A33A32]">{error}</span>}
    </div>
  );
}
