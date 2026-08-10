"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";

const SEEN_KEY = "plantmoji_guide_seen_v2";
const steps = {
  en: [
    { icon: "🌱", title: "MEET JAMKACHU", text: "The real environment changes how Jamkachu feels.", action: "Tap Jamkachu", target: ".pm-mascot" },
    { icon: "📡", title: "READ THE SENSORS", text: "Temperature, air, soil pH, and light come from the plant area.", action: "Show the four readings", target: ".pm-home-environment" },
    { icon: "😊", title: "WATCH THE MOOD", text: "Jamkachu turns sensor clues into an expression you can understand.", action: "Check the mood", target: ".pm-home-mood-badge" },
    { icon: "🎯", title: "OPEN A MISSION", text: "Change the real environment. Buttons alone cannot finish a mission.", action: "Open today’s mission", target: ".pm-home-quest" },
    { icon: "⭐", title: "VERIFY AND GROW", text: "The sensor confirms recovery before XP and growth are awarded.", action: "Start playing", target: null },
  ],
  id: [
    { icon: "🌱", title: "KENALI JAMKACHU", text: "Lingkungan asli mengubah perasaan Jamkachu.", action: "Ketuk Jamkachu", target: ".pm-mascot" },
    { icon: "📡", title: "BACA SENSOR", text: "Suhu, udara, pH tanah, dan cahaya berasal dari area tanaman.", action: "Lihat empat pengukuran", target: ".pm-home-environment" },
    { icon: "😊", title: "LIHAT SUASANA", text: "Jamkachu mengubah petunjuk sensor menjadi ekspresi yang mudah dipahami.", action: "Periksa suasana", target: ".pm-home-mood-badge" },
    { icon: "🎯", title: "BUKA MISI", text: "Ubah lingkungan asli. Tombol saja tidak bisa menyelesaikan misi.", action: "Buka misi hari ini", target: ".pm-home-quest" },
    { icon: "⭐", title: "VERIFIKASI & TUMBUH", text: "Sensor memastikan pemulihan sebelum XP dan pertumbuhan diberikan.", action: "Mulai bermain", target: null },
  ],
} as const;

export default function AppGuide({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const guideButtonRef = useRef<HTMLButtonElement>(null);
  const coachRef = useRef<HTMLElement>(null);
  const copy = steps[locale];
  const step = copy[index];

  const start = useCallback(() => {
    if (pathname !== "/") { router.push("/"); window.setTimeout(() => { setIndex(0); setOpen(true); }, 250); return; }
    setIndex(0); setOpen(true);
  }, [pathname, router]);

  useEffect(() => {
    let shouldOpen = false;
    try { shouldOpen = pathname === "/" && !localStorage.getItem(SEEN_KEY); } catch {}
    const timer = shouldOpen ? window.setTimeout(() => setOpen(true), 0) : null;
    return () => { if (timer !== null) window.clearTimeout(timer); };
  }, [pathname]);
  useEffect(() => {
    const listener = () => start();
    window.addEventListener("plantmoji:open-guide", listener);
    return () => window.removeEventListener("plantmoji:open-guide", listener);
  }, [start]);
  useEffect(() => {
    if (!open || !step.target) { const clear = window.setTimeout(() => setRect(null), 0); return () => window.clearTimeout(clear); }
    const target = document.querySelector(step.target);
    const update = () => setRect(target?.getBoundingClientRect() ?? null);
    if (target) {
      const targetRect = target.getBoundingClientRect();
      if (targetRect.top < 76 || targetRect.bottom > window.innerHeight - 220) {
        target.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    }
    const frame = window.requestAnimationFrame(update);
    const settleTimer = window.setTimeout(update, 350);
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(settleTimer); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, step.target]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocusTo = guideButtonRef.current;
    document.body.style.overflow = "hidden";
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(coachRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],[tabindex]:not([tabindex='-1'])") ?? []);
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keepFocusInside);
    return () => {
      window.removeEventListener("keydown", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => returnFocusTo?.focus(), 0);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => nextButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open, index]);

  const next = () => {
    if (index < copy.length - 1) { setIndex((value) => value + 1); return; }
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
    setOpen(false);
  };
  const skip = () => { try { localStorage.setItem(SEEN_KEY, "1"); } catch {} setOpen(false); };

  return <div className="app-guide-root">
    <button ref={guideButtonRef} type="button" className="pm-guide-button" aria-label={locale === "id" ? "Buka panduan" : "Open guide"} onClick={start}>?</button>
    {open && <div className="pm-tutorial" role="dialog" aria-modal="true" aria-labelledby="pm-tutorial-title">
      <div className="pm-tutorial-shade" />
      {rect && <div className="pm-tutorial-spotlight" style={{ "--spot-x": `${rect.left - 8}px`, "--spot-y": `${rect.top - 8}px`, "--spot-w": `${rect.width + 16}px`, "--spot-h": `${rect.height + 16}px` } as CSSProperties} />}
      <section ref={coachRef} className={`pm-tutorial-coach${rect && rect.top > window.innerHeight / 2 ? " is-top" : ""}`}>
        <div className="pm-tutorial-progress">{copy.map((_, item) => <i key={item} className={item <= index ? "is-done" : ""} />)}</div>
        <span className="pm-tutorial-icon" aria-hidden="true">{step.icon}</span>
        <small>{index + 1} / {copy.length}</small>
        <h2 id="pm-tutorial-title">{step.title}</h2>
        <p>{step.text}</p>
        <button ref={nextButtonRef} type="button" className="pm-btn pm-btn-primary" onClick={next}>{step.action} →</button>
        <div className="pm-tutorial-secondary">
          {index > 0 ? <button type="button" onClick={() => setIndex((value) => value - 1)}>← {locale === "id" ? "Kembali" : "Back"}</button> : <span />}
          <button type="button" onClick={() => setOpen(false)}>{locale === "id" ? "Nanti" : "Later"}</button>
          <button type="button" onClick={skip}>{locale === "id" ? "Lewati" : "Skip"}</button>
        </div>
      </section>
    </div>}
  </div>;
}
