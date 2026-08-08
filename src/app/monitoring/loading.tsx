// Skeleton for /monitoring — mirrors the header, the three sensor gauges,
// and the light chart panel so the live dashboard doesn't freeze the tab
// while the force-dynamic route resolves.

export default function Loading() {
  return (
    <main className="mx-auto w-full" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <header className="pm-page-header" aria-hidden="true">
        <div className="pm-skel h-[52px] w-[52px]" />
        <div className="min-w-0">
          <div className="pm-skel h-2.5 w-24" />
          <div className="pm-skel mt-2 h-5 w-56 max-w-full" />
          <div className="pm-skel mt-2 h-4 w-72 max-w-full" />
        </div>
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
