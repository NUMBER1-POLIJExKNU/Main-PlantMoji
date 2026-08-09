import type { Metadata } from "next";
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
      </body>
    </html>
  );
}
