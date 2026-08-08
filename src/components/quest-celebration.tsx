"use client";

// Quest celebration island (dopamine spec §3 reward loop) — fills the gap
// where quest completion on /quests was a silent re-render. Subscribes to the
// quests table (realtime UPDATE, same browser-client pattern as
// collection-tabs.tsx) and shows a compact banner when a quest transitions
// into COMPLETED.
//
// Ethics guardrails (spec §4): presentation only — zero writes, zero XP logic
// (XP already landed in the server ledger before the row flipped). The first
// snapshot primes silently and only live transitions celebrate (mirrors
// live.js trackQuest), so opening the page never celebrates old history.
// Degrades to a no-op when Supabase env is missing.

import { useEffect, useRef, useState } from "react";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { QUEST_COPY_ID, type AppLocale } from "@/lib/i18n";
import type { QuestKey, QuestStatus } from "@/types/game";

export interface QuestCelebrationProps {
  plantId: string;
  locale: AppLocale;
  /** Server-render snapshot of quest statuses — primes the tracker so rows
   *  already COMPLETED at load never re-celebrate. */
  initialStatuses: { id: string; status: QuestStatus }[];
}

interface Banner {
  id: string;
  title: string;
  xp: number;
}

/** ≤12 confetti squares even at the 2-banner concurrency cap (6 each). */
const CONFETTI_PER_BANNER = 6;
// Farm palette (public/farm/style.css tokens): grass, yellow, water, cheek.
const CONFETTI_COLORS = ["#5FAE45", "#FFDE6A", "#4DA1ED", "#FF9E9E"];
const BANNER_MS = 4000;
const MAX_BANNERS = 2;

export default function QuestCelebration({
  plantId,
  locale,
  initialStatuses,
}: QuestCelebrationProps) {
  const [banners, setBanners] = useState<Banner[]>([]);
  // quest id → last seen status. Primed exactly once from the server
  // snapshot; afterwards realtime payloads keep it current. Deliberately NOT
  // re-primed on prop change: a post-completion router.refresh() must not
  // mark a row COMPLETED before its realtime event has celebrated it.
  const statusesRef = useRef<Map<string, string> | null>(null);
  if (statusesRef.current === null) {
    statusesRef.current = new Map(initialStatuses.map((row) => [row.id, row.status]));
  }
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Graceful no-op when Supabase is unconfigured — the page stays static.
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`quest-celebrations-${plantId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quests", filter: `plant_id=eq.${plantId}` },
        (payload) => {
          const row = payload.new as {
            id?: string;
            quest_key?: QuestKey;
            status?: string;
            xp_reward?: number;
            completed_at?: string | null;
          } | null;
          if (!row?.id || !row.status) return;
          const statuses = statusesRef.current!;
          const prev = statuses.get(row.id);
          statuses.set(row.id, row.status);
          // Celebrate only a real transition INTO COMPLETED (live.js pattern).
          if (row.status !== "COMPLETED" || prev === "COMPLETED") return;
          // Row never seen before (e.g. created after mount): celebrate only a
          // completion that just happened — edits to old history stay silent.
          if (prev === undefined) {
            const finishedAt = Date.parse(row.completed_at ?? "");
            if (!Number.isFinite(finishedAt) || Date.now() - finishedAt > 5 * 60_000) return;
          }

          const def = row.quest_key ? QUEST_DEFINITIONS[row.quest_key] : undefined;
          const title =
            (locale === "id" && row.quest_key
              ? QUEST_COPY_ID[row.quest_key]?.title
              : def?.title) ?? (locale === "id" ? "Misi selesai" : "Quest complete");

          // Sound is optional and self-gated (mute + rate limit in sfx.js).
          window.PMSfx?.play("coin");
          const bannerId = `${row.id}:${Date.now()}`;
          setBanners((prevBanners) =>
            // Concurrency cap: a third celebration evicts the oldest banner.
            [...prevBanners, { id: bannerId, title, xp: row.xp_reward ?? 0 }].slice(-MAX_BANNERS),
          );
          timersRef.current.push(
            setTimeout(() => {
              setBanners((prevBanners) => prevBanners.filter((b) => b.id !== bannerId));
            }, BANNER_MS),
          );
        },
      )
      .subscribe();

    const timers = timersRef.current;
    return () => {
      supabase.removeChannel(channel);
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
  }, [plantId, locale]);

  // The aria-live region stays mounted (even while empty) so screen readers
  // announce banner insertions politely.
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {/* Confetti-lite: squares are opacity:0 by default and only animate
          under prefers-reduced-motion: no-preference — reduced-motion users
          get the plain text banner (which itself skips its pop-in). */}
      <style>{`
        .pm-qc-piece { position: absolute; top: -8px; width: 6px; height: 6px; opacity: 0; image-rendering: pixelated; will-change: transform, opacity; }
        @media (prefers-reduced-motion: no-preference) {
          .pm-qc-banner { animation: pm-qc-pop 0.35s ease-out both; }
          .pm-qc-piece { animation: pm-qc-fall 1.5s ease-in forwards; }
          @keyframes pm-qc-pop {
            0% { transform: translateY(-12px) scale(0.92); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes pm-qc-fall {
            0% { opacity: 1; transform: translateY(0) rotate(0deg); }
            100% { opacity: 0; transform: translateY(52px) rotate(240deg); }
          }
        }
      `}</style>
      {banners.map((banner) => (
        // Farm celebration chrome: solid white surface, chunky grass border,
        // pixel drop shadow — the same panel family as the quest cards, with
        // the pixel-font title and the yellow XP chip the farm uses for
        // rewards. Inline styles so the look never fights the pm-* cascade.
        <div
          key={banner.id}
          className="pm-qc-banner relative flex items-center gap-2.5 overflow-hidden"
          style={{
            background: "var(--color-surface)",
            border: "3px solid var(--color-grass)",
            borderRadius: "var(--pm-radius)",
            boxShadow: "var(--pm-shadow)",
            padding: "10px 16px",
          }}
        >
          {Array.from({ length: CONFETTI_PER_BANNER }, (_, i) => (
            <span
              key={i}
              className="pm-qc-piece"
              aria-hidden="true"
              style={{
                left: `${8 + i * (84 / CONFETTI_PER_BANNER)}%`,
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${0.1 + (i % 3) * 0.12}s`,
              }}
            />
          ))}
          <span className="text-xl leading-none" role="img" aria-hidden="true">
            🎉
          </span>
          <span className="sr-only">
            {locale === "id" ? "Misi selesai:" : "Quest complete:"}
          </span>
          <p className="font-pixel text-[11px] leading-relaxed" style={{ color: "var(--color-text)" }}>
            {banner.title}
          </p>
          <span
            className="pm-chip shrink-0"
            style={{ background: "var(--color-yellow)", borderColor: "#E8C46B", color: "#6B4F10" }}
          >
            +{banner.xp} XP
          </span>
        </div>
      ))}
    </div>
  );
}
