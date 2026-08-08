// Bond / XP home-screen widget (handoff §33 home mock).
//
// Purely presentational — the client parent owns all data fetching and
// realtime subscriptions and passes derived values down as props. No hooks,
// so this renders fine inside any client component tree.

export interface BondPanelProps {
  bondLevel: number;
  totalXp: number;
  /** XP earned inside the current level (0..xpRequired). */
  xpInLevel: number;
  /** XP needed to finish the current level (XP_PER_LEVEL = 30). */
  xpRequired: number;
  /** Current streak in days; the streak row is hidden when 0. */
  streakDays: number;
}

export default function BondPanel({
  bondLevel,
  totalXp,
  xpInLevel,
  xpRequired,
  streakDays,
}: BondPanelProps) {
  const safeXpInLevel = Math.max(0, Math.min(xpInLevel, xpRequired));
  const percent = xpRequired > 0 ? (safeXpInLevel / xpRequired) * 100 : 0;

  return (
    <section
      aria-label={`Bond Level ${bondLevel}`}
      className="w-full max-w-sm rounded-2xl bg-white/70 p-5 shadow-sm backdrop-blur dark:bg-zinc-900/60"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Bond Level {bondLevel}
        </h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{totalXp} XP total</span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={xpRequired}
        aria-valuenow={safeXpInLevel}
        aria-label={`${safeXpInLevel} of ${xpRequired} XP toward Bond Level ${bondLevel + 1}`}
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-700/60"
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-green-400 to-emerald-500 transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {safeXpInLevel} / {xpRequired} XP
      </p>

      {streakDays > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
          <span role="img" aria-hidden="true">
            🔥
          </span>
          {streakDays} Day Streak
        </p>
      )}
    </section>
  );
}
