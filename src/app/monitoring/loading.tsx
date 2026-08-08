// Skeleton for /monitoring — mirrors the header, the three sensor gauges,
// and the light chart panel so the live dashboard doesn't freeze the tab
// while the force-dynamic route resolves.

export default function Loading() {
  return (
    <main className="mx-auto w-full" style={{ maxWidth: 700 }} aria-busy="true">
      <span className="sr-only">Loading…</span>
      <style>{`
        .pm-skel { background: #DCEAD5; border-radius: 10px; }
        @media (prefers-reduced-motion: no-preference) {
          .pm-skel { animation: pm-skel-pulse 1.6s ease-in-out infinite; }
        }
        @keyframes pm-skel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
      `}</style>

      <header className="mb-6">
        <div className="pm-skel h-5 w-56 max-w-full" />
        <div className="pm-skel mt-2 h-4 w-72 max-w-full" />
      </header>

      <div className="pm-skel mb-2 ml-auto h-3 w-32" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="pm-panel flex flex-col items-center gap-3">
            <div className="pm-skel h-24 w-24 rounded-full" style={{ background: "#F4FAF1", border: "2px solid #BCD3B4" }} />
            <div className="pm-skel h-3 w-28" />
          </div>
        ))}
      </div>

      <section className="pm-panel mt-4">
        <div className="pm-skel mx-auto mb-3 h-3 w-40" />
        <div className="pm-skel h-[260px] w-full" style={{ background: "#F4FAF1", border: "2px solid #BCD3B4" }} />
      </section>

      <div className="pm-skel mx-auto mt-6 h-3 w-4/5" />
    </main>
  );
}
