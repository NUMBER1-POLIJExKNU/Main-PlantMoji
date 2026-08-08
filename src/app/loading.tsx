export default function AppLoading() {
  return (
    <main aria-busy="true">
      <span className="sr-only">Loading…</span>
      <header className="pm-page-header" aria-hidden="true">
        <div className="pm-skel h-[52px] w-[52px]" />
        <div className="min-w-0">
          <div className="pm-skel h-2.5 w-24" />
          <div className="pm-skel mt-2 h-5 w-44 max-w-full" />
          <div className="pm-skel mt-2 h-3 w-72 max-w-full" />
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="pm-panel flex min-h-36 flex-col gap-3">
            <div className="pm-skel h-7 w-7" />
            <div className="pm-skel h-4 w-2/3" />
            <div className="pm-skel h-3 w-full" />
            <div className="pm-skel h-3 w-4/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
