// Skeleton for /settings — mirrors the header, the plant summary strip, the
// name/personality/growth-stage form, and the growth records panel so the
// tab doesn't freeze while the force-dynamic Supabase page resolves.

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

      <header className="mb-6 flex flex-col gap-1.5">
        <div className="pm-skel h-9 w-9" />
        <div className="pm-skel h-5 w-28" />
        <div className="pm-skel h-4 w-56 max-w-full" />
      </header>

      <section className="pm-panel mb-5 flex items-center gap-3">
        <div className="pm-skel h-9 w-9 shrink-0" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="pm-skel h-3 w-32" />
          <div className="pm-skel h-2.5 w-24" />
        </div>
      </section>

      <section className="pm-panel flex flex-col gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="pm-skel h-2.5 w-20" />
            <div className="pm-skel h-9 w-full" style={{ background: "#F4FAF1", border: "2px solid #BCD3B4" }} />
          </div>
        ))}
        <div className="pm-skel mt-1 h-11 w-full rounded-[12px]" />
      </section>

      <section className="pm-panel mt-5 flex flex-col gap-3">
        <div className="pm-skel h-3 w-32" />
        {[0, 1].map((i) => (
          <div key={i} className="pm-skel h-10 w-full" style={{ background: "#F4FAF1", border: "2px solid #BCD3B4" }} />
        ))}
      </section>
    </main>
  );
}
