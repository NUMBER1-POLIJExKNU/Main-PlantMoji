"use client";

// Quest Done-Pill Stamp (dopamine spec §3 micro-interaction) — the "✓
// Done"/"Selesai" history pill stamps in like an ink stamp exactly once, the
// moment a quest's completion actually lands on /quests.
//
// Handshake with quest-progress.tsx: its completion sweep writes a one-shot
// sessionStorage flag (`pm-just-completed:<questId>`) right before the
// router.refresh() that renders this pill as COMPLETED. This component reads
// and clears that flag on mount — present → animate once and never again
// (even across future refreshes of the same row); absent (ordinary visit to
// old history) → render the pill exactly as it always has, no animation.
// Presentation only: the flag never influences quest status or XP, and a
// missing/denied sessionStorage (private mode) just means no stamp, never a
// crash — see quest-progress.tsx's matching try/catch.

import { useEffect, useState, type CSSProperties } from "react";

export interface QuestDonePillProps {
  /** quests.id — matches the flag key quest-progress.tsx's sweep() writes. */
  questId: string;
  label: string;
  style: CSSProperties;
}

export default function QuestDonePill({ questId, label, style }: QuestDonePillProps) {
  const [stamp, setStamp] = useState(false);

  useEffect(() => {
    const key = `pm-just-completed:${questId}`;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      if (sessionStorage.getItem(key) == null) return;
      sessionStorage.removeItem(key);
      // Schedule the presentation update after the effect finishes. This
      // avoids a cascading synchronous render while preserving the one-shot
      // sessionStorage handshake and next-frame stamp animation.
      timer = setTimeout(() => setStamp(true), 0);
    } catch {
      /* sessionStorage unavailable — no stamp, pill still renders normally */
    }
    return () => { if (timer !== null) clearTimeout(timer); };
  }, [questId]);

  return (
    <span
      className={`pm-chip shrink-0${stamp ? " pm-done-pill-stamp" : ""}`}
      style={style}
    >
      {label}
    </span>
  );
}
