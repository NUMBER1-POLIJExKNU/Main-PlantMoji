import PixelLoadingToy from "@/components/pixel-loading-toy";

export type PixelLoadingVariant = "home" | "quests" | "plants" | "monitoring" | "collection" | "reports" | "settings" | "diary" | "shop" | "camera";

/**
 * PARKED — nothing renders this today. Kept so the skeleton can come back the
 * moment the framework bug below is fixed; do NOT re-add a `loading.tsx`
 * without re-testing it.
 *
 * On Next 16.3.0, a route with a `loading.tsx` whose segment actually streams
 * (any page doing real Supabase work) never completes its Suspense boundary:
 * React emits the skeleton, parks the real content in a hidden div, and the
 * completion script no-ops. The placeholder stays on screen and NEITHER tree
 * hydrates, so the whole page is dead to clicks. It reproduced on a bare route
 * with a plain-markup fallback, under both Turbopack and webpack, with the app
 * shell and every script stripped out — and disappeared the instant the
 * `loading.tsx` was removed.
 *
 * It hid for so long because it needs a slow segment: without Supabase env
 * these pages return early, the boundary never goes pending, and local runs
 * look perfect while production is entirely non-interactive.
 *
 * This file is also now synchronous. A Suspense fallback may not suspend, and
 * this one used to `await getRequestLocale()` — not the cause above, but wrong
 * on its own. Both languages render and `html[lang]` picks one in CSS (see
 * .pm-i18n-* in globals.css).
 */
function T({ id, en }: { id: string; en: string }) {
  return (
    <>
      <span className="pm-i18n-id">{id}</span>
      <span className="pm-i18n-en">{en}</span>
    </>
  );
}

export default function PixelLoading({ variant = "home" }: { variant?: PixelLoadingVariant }) {
  return (
    <main className="pm-pixel-loading" aria-busy="true" aria-live="polite">
      <PixelLoadingToy variant={variant} />
      <div className="pm-loading-copy">
        <p className="pm-heading text-xs"><T id="Tunggu sebentar…" en="Just a sprout second…" /></p>
        <p className="mt-2 text-sm text-[#57684F]"><T id="Jamkachu sedang menyiapkan kebun." en="Jamkachu is getting the garden ready." /></p>
        <p className="mt-1 text-xs text-[#71806B]"><T id="Ketuk aku! ♡" en="Tap me! ♡" /></p>
      </div>
      <span className="sr-only"><T id="Memuat halaman" en="Loading page" /></span>
    </main>
  );
}
