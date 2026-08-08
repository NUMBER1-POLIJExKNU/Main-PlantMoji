// Skeleton for /quests — mirrors the header, daily-event banner, active
// quest cards, and history list so tab navigation feels instant while the
// force-dynamic Supabase page streams in behind it.

export default function Loading() {
  return (
    <main className="mx-auto w-full flex-1" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <header className="pm-page-header" aria-hidden="true">
        <div className="pm-skel h-[52px] w-[52px]" />
        <div className="min-w-0">
          <div className="pm-skel h-2.5 w-24" />
          <div className="pm-skel mt-2 h-5 w-32" />
          <div className="pm-skel mt-2 h-4 w-64 max-w-full" />
        </div>
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
