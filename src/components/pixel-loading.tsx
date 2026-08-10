import { getRequestLocale } from "@/lib/i18n-server";
import PixelLoadingToy from "@/components/pixel-loading-toy";

export type PixelLoadingVariant = "home" | "quests" | "plants" | "monitoring" | "collection" | "reports" | "settings" | "diary" | "shop" | "camera";

export default async function PixelLoading({ variant = "home" }: { variant?: PixelLoadingVariant }) {
  const locale = await getRequestLocale();
  return (
    <main className="pm-pixel-loading" aria-busy="true" aria-live="polite">
      <PixelLoadingToy variant={variant} label={locale === "id" ? "Ketuk Jamkachu" : "Tap Jamkachu"} />
      <div className="pm-loading-copy">
        <p className="pm-heading text-xs">{locale === "id" ? "Tunggu sebentar…" : "Just a sprout second…"}</p>
        <p className="mt-2 text-sm text-[#57684F]">{locale === "id" ? "Jamkachu sedang menyiapkan kebun." : "Jamkachu is getting the garden ready."}</p>
        <p className="mt-1 text-xs text-[#71806B]">{locale === "id" ? "Ketuk aku! ♡" : "Tap me! ♡"}</p>
      </div>
      <span className="sr-only">{locale === "id" ? "Memuat halaman" : "Loading page"}</span>
    </main>
  );
}
