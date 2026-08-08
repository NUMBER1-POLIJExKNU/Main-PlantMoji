// Skeleton for /collection — mirrors the header, the four-tab pill bar, and
// a grid of discovery cards so switching into the collection book doesn't
// freeze the tab while the force-dynamic route resolves.

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
        <div className="pm-skel h-5 w-40" />
        <div className="pm-skel mt-2 h-4 w-64 max-w-full" />
      </header>

      <div className="grid grid-cols-4 gap-1.5 rounded-2xl border-2 border-[#BCD3B4] p-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="pm-skel h-10" style={{ background: i === 0 ? "#BCD3B4" : "#F4FAF1" }} />
        ))}
      </div>

      <ul className="mt-5 grid grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="pm-panel flex flex-col items-center gap-1.5 text-center">
            <div className="pm-skel h-8 w-8 rounded-full" />
            <div className="pm-skel h-2.5 w-full" />
            <div className="pm-skel h-2 w-3/4" />
          </li>
        ))}
      </ul>
    </main>
  );
}
