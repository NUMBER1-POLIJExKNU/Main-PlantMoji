import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Pixelify_Sans, Press_Start_2P } from "next/font/google";
import Script from "next/script";
import RenoAppShell from "@/components/reno-app-shell";
import { getRequestAppearance, getRequestLocale } from "@/lib/i18n-server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start-2p",
  weight: "400",
  subsets: ["latin"],
});

const pixelifySans = Pixelify_Sans({
  variable: "--font-pixelify-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlantMoji",
  description: "Sensor-verified plant companion — real plant care as a game",
};

// viewport-fit=cover is required for env(safe-area-inset-*) to return
// non-zero on iPhones — the mobile dock/sheet/FAB offsets depend on it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, appearance] = await Promise.all([getRequestLocale(), getRequestAppearance()]);
  return (
    <html
      lang={locale}
      data-theme-preference={appearance.theme}
      data-theme={appearance.resolvedTheme}
      data-farm-skin={appearance.skin}
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart2P.variable} ${pixelifySans.variable} h-full antialiased`}
    >
      {/* pm-page paints the farm sky on the body itself so overscroll and
          short routes never flash a plain white background. */}
      <body className="pm-page min-h-full">
        <RenoAppShell locale={locale} initialTheme={appearance.theme} initialSkin={appearance.skin}>{children}</RenoAppShell>
        {/* Shared farm globals (dopamine plan Task 5): window.PM_STRINGS +
            window.PMSfx for React pages too. Plain sync tags trip the
            no-sync-scripts lint rule, so next/script with beforeInteractive
            keeps the same load-before-hydration semantics. */}
        <Script src="/farm/strings.js" strategy="beforeInteractive" />
        <Script src="/farm/sfx.js" strategy="beforeInteractive" />
        {/* Classroom-demo sandbox (window.PMCheat): client-only, never writes
            Supabase/hardware. Loads on the farm home AND every React route so
            the cheat banner and shared sandbox state follow the presenter. */}
        <Script src="/farm/cheat.js" strategy="beforeInteractive" />
        {/* Trial mode's rules engine (window.PMTrial) — the student onboarding
            game that opens cheat mode at TRIAL_GATE_LEVEL. Must load after cheat.js, whose
            store it drives; loading it on the React routes too keeps the drip
            and the hazard schedule running while a student explores
            Collection or Shop. */}
        <Script src="/farm/trial.js" strategy="beforeInteractive" />
        {/* Developer clock override (window.PMClock): shifts only the WIB
            wall clock the app reads, never Date.now(). Same both-entry-points
            rule as cheat.js — the guardian camera lives on a React route and
            the sleep gate it has to clear lives in the static shell, so a tag
            in one place only would move half the app's clock. */}
        <Script src="/farm/devclock.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
