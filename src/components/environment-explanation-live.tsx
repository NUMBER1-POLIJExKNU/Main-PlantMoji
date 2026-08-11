"use client";

// /plants must render instantly (handoff fix 2026-08-11): the profile
// "Environment explanation" panel used to `await explainEnvironment()`
// (live Gemini, up to TIMEOUT_MS=4s in src/lib/ai.ts) during server render,
// blocking navigation. The server now renders the deterministic template
// text immediately; this island quietly upgrades it to the Gemini-flavored
// explanation after mount, reusing the same /api/environment-explanation
// route crop-explorer's "What should I change?" button already calls.
// Any failure (no match, network error, disabled AI) just leaves the
// deterministic text on screen — never a loading flicker, never blank.

import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/i18n";
import type { EnvironmentDemoPreset } from "@/lib/environment-demo";

export default function EnvironmentExplanationLive({
  cropKey,
  locale,
  demo,
  demoPreset,
  fallback,
}: {
  cropKey: string;
  locale: AppLocale;
  demo: boolean;
  demoPreset: EnvironmentDemoPreset | null;
  fallback: string;
}) {
  // The upgraded text is remembered together with the inputs it answered
  // (requestKey), so a prop change falls back to the deterministic text by
  // derivation — no synchronous setState inside the effect body.
  const requestKey = JSON.stringify([cropKey, locale, demo, demoPreset]);
  const [upgraded, setUpgraded] = useState<{ key: string; text: string } | null>(null);
  const text = upgraded && upgraded.key === requestKey ? upgraded.text : fallback;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/environment-explanation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cropKey, locale, demo, demoPreset: demoPreset ?? undefined }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { ok?: boolean; explanation?: string } | null) => {
        if (!cancelled && result?.ok && typeof result.explanation === "string" && result.explanation) {
          setUpgraded({ key: requestKey, text: result.explanation });
        }
      })
      .catch(() => {
        // Network failure: the deterministic text already on screen stays.
      });
    return () => {
      cancelled = true;
    };
    // requestKey encodes every fetch input (cropKey/locale/demo/demoPreset).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  return <p className="mt-3 text-sm leading-6">{text}</p>;
}
