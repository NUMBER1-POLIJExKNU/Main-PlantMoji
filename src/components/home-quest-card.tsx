// Current-quest home-screen widget (handoff §33 home mock).
//
// Purely presentational — the client parent resolves the active quest (and
// its human-facing labels) and passes it down, or null when no quest is
// active. Both states link through to the full /quests screen.

import Link from "next/link";

export interface HomeQuestInfo {
  emoji: string;
  title: string;
  /** Human-facing status, e.g. "Active" or "Verifying". */
  statusLabel: string;
  /** Human-facing progress, e.g. "23 / 30 min". */
  progressLabel: string;
}

export interface HomeQuestCardProps {
  quest: HomeQuestInfo | null;
}

export default function HomeQuestCard({ quest }: HomeQuestCardProps) {
  if (!quest) {
    return (
      <Link
        href="/quests"
        className="pm-home-quest block w-full max-w-sm rounded-2xl bg-white/50 px-5 py-4 text-center text-sm text-zinc-500 shadow-sm backdrop-blur transition-colors hover:bg-white/70 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-900/60"
      >
        No active quest — keep caring 🌿
      </Link>
    );
  }

  return (
    <Link
      href="/quests"
      className="pm-home-quest block w-full max-w-sm rounded-2xl bg-white/70 p-5 shadow-sm backdrop-blur transition-colors hover:bg-white/90 dark:bg-zinc-900/60 dark:hover:bg-zinc-900/80"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500">
          CURRENT QUEST
        </span>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-900/60 dark:text-green-200">
          {quest.statusLabel}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <span className="text-3xl" role="img" aria-hidden="true">
          {quest.emoji}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{quest.title}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{quest.progressLabel}</p>
        </div>
      </div>
    </Link>
  );
}
