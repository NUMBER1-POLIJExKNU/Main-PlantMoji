import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P, VT323 } from "next/font/google";
import Script from "next/script";
import RenoAppShell from "@/components/reno-app-shell";
import { getRequestLocale } from "@/lib/i18n-server";
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

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlantMoji",
  description: "Sensor-verified plant companion — real plant care as a game",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getRequestLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart2P.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <RenoAppShell locale={locale}>{children}</RenoAppShell>
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
