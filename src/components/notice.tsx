// Shared full-screen notice (setup hints, missing data, connection errors).
// Server-compatible: purely presentational, mirrors the local Notice used by
// src/app/page.tsx so every screen fails in the same friendly voice.

export interface NoticeProps {
  title: string;
  lines: string[];
}

export default function Notice({ title, lines }: NoticeProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 pb-24 text-center">
      <span className="text-6xl" role="img" aria-hidden="true">
        🌱
      </span>
      <h1 className="text-2xl font-bold">LeafTalk</h1>
      <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">{title}</p>
      <div className="max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </main>
  );
}
