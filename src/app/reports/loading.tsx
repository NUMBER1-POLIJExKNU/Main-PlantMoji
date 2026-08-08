// Skeleton for /reports — mirrors the header chip, the plant's-note quote
// panel, and the 2x2 stat tile grid so opening the weekly report doesn't
// freeze the tab while the force-dynamic route computes.

export default function Loading() {
  return (
    <main className="mx-auto w-full" style={{ maxWidth: 640 }} aria-busy="true">
      <span className="sr-only">Loading…</span>
      <style>{`
        .pm-skel { background: #DCEAD5; border-radius: 10px; }
        @media (prefers-reduced-motion: no-preference) {
          .pm-skel { animation: pm-skel-pulse 1.6s ease-in-out infinite; }
        }
        @keyframes pm-skel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
      `}</style>

      <header className="mb-6">
        <div className="pm-skel h-5 w-44" />
        <div className="pm-skel mt-3 h-7 w-32 rounded-full" style={{ background: "#F4FAF1", border: "2px solid #BCD3B4" }} />
      </header>

      <section className="pm-panel mb-6 flex flex-col items-center gap-2 text-center">
        <div className="pm-skel h-2.5 w-28" />
        <div className="pm-skel h-3 w-full" />
        <div className="pm-skel h-3 w-5/6" />
      </section>

      <div className="mb-6 flex items-center justify-around gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="pm-skel h-10 w-14" />
        ))}
      </div>

      <section aria-label="Weekly stats" className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="pm-panel flex flex-col gap-2">
            <div className="pm-skel h-6 w-6 rounded-full" />
            <div className="pm-skel h-4 w-16" />
            <div className="pm-skel h-2.5 w-20" />
          </div>
        ))}
      </section>

      <div className="pm-skel mt-4 h-12 w-full rounded-[12px]" style={{ background: "#F4FAF1", border: "2px solid #BCD3B4" }} />
    </main>
  );
}
