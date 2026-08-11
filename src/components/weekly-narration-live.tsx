"use client";

// /reports must render instantly (speed fix 2026-08-11): getWeeklyReportNarration
// (src/lib/plant-messages.ts) used to be awaited during the server render of
// src/app/reports/page.tsx, making every visit pay for a live Gemini call
// (up to TIMEOUT_MS=4s in src/lib/ai.ts). The server now renders the
// deterministic template narration (getWeeklyReportFallback) immediately;
// this island quietly upgrades it to the Gemini-flavored line after mount,
// via the /api/weekly-report-narration route, which calls
// getWeeklyReportNarration itself and shares its per-report-shape cache.
// Same pattern as src/components/environment-explanation-live.tsx. Any
// failure (no AI key, network error) just leaves the deterministic text on
// screen — never a loading flicker, never blank.

import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/i18n";
import type { WeeklyReport } from "@/types/game";

export default function WeeklyNarrationLive({
  report,
  locale,
  fallback,
}: {
  report: WeeklyReport;
  locale: AppLocale;
  fallback: string;
}) {
  // The upgraded text is remembered together with the inputs it answered
  // (requestKey), so a prop change falls back to the deterministic text by
  // derivation — no synchronous setState inside the effect body.
  const requestKey = JSON.stringify([report, locale]);
  const [upgraded, setUpgraded] = useState<{ key: string; text: string } | null>(null);
  const text = upgraded && upgraded.key === requestKey ? upgraded.text : fallback;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/weekly-report-narration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ report, locale }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { ok?: boolean; narration?: string } | null) => {
        if (!cancelled && result?.ok && typeof result.narration === "string" && result.narration) {
          setUpgraded({ key: requestKey, text: result.narration });
        }
      })
      .catch(() => {
        // Network failure: the deterministic text already on screen stays.
      });
    return () => {
      cancelled = true;
    };
    // requestKey encodes every fetch input (report/locale).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  return <>{text}</>;
}
