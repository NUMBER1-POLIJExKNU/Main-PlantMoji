// Skeleton for /quests — mirrors the header, daily-event banner, active
// quest cards, and history list so tab navigation feels instant while the
// force-dynamic Supabase page streams in behind it.

export default function Loading() {
  return (
    <main className="mx-auto w-full flex-1" style={{ maxWidth: 700 }} aria-busy="true">
      <span className="sr-only">Loading…</span>
      <style>{`
        .pm-skel { background: #DCEAD5; border-radius: 10px; }
        @media (prefers-reduced-motion: no-preference) {
          .pm-skel { animation: pm-skel-pulse 1.6s ease-in-out infinite; }
        }
        @keyframes pm-skel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
      `}</style>

      <header className="mb-6 flex flex-col gap-2">
        <div className="pm-skel h-9 w-9" />
        <div className="pm-skel h-5 w-32" />
        <div className="pm-skel h-4 w-64 max-w-full" />
      </header>

      <section className="pm-panel mb-4" style={{ background: "#F4FAF1" }}>
        <div className="flex items-start gap-3">
          <div className="pm-skel h-9 w-9 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="pm-skel h-3 w-24" />
            <div className="pm-skel h-3 w-40 max-w-full" />
          </div>
        </div>
      </section>

      <section aria-label="Active quests" className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="pm-panel flex items-start gap-4">
            <div className="pm-skel h-10 w-10 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="pm-skel h-4 w-2/3" />
              <div className="pm-skel h-3 w-full" />
              <div className="pm-skel h-3 w-5/6" />
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <div className="pm-skel mb-3 h-3 w-20" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pm-panel flex items-center gap-3" style={{ padding: "12px 16px" }}>
              <div className="pm-skel h-7 w-7 shrink-0" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="pm-skel h-3 w-1/2" />
                <div className="pm-skel h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
