"use client";

// Reusable "dim + spotlight + emoji + one sentence" coach overlay, extracted
// from the home tour that used to live entirely inside app-guide.tsx. Any
// surface that wants a first-visit walkthrough mounts one of these — the
// caller owns *when* to mount it (first-visit check via src/lib/seen.ts,
// replay events, route gating); this component owns the mechanics: spotlight
// positioning, the dim shade, keyboard focus trap + Escape-to-close, and
// prefers-reduced-motion-aware scroll-into-view.
//
// Contract: every card is dim + spotlight + one emoji + ONE sentence — never
// a wall of text. The final card in `cards` always renders as an action dare
// (a verb-first button, never a read-only "Close"); completing it marks `id`
// seen via src/lib/seen.ts and nothing else. Coaches only ever grant
// cosmetic rewards *elsewhere* (the sticker book) — this component itself
// never touches the network, a progression currency, or a celebration
// queue of any kind.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { markSeen } from "@/lib/seen";

export interface CoachDare {
  /** Verb-first label for the primary button, e.g. "Tap Jamkachu". */
  label: string;
  /** Optional side effect fired when the dare's button is pressed — never
   *  a reward write (see file header). */
  onDo?: () => void;
}

export interface CoachCard {
  /** CSS selector for the element to spotlight; omit for an untargeted card. */
  target?: string;
  emoji: string;
  /** Optional short label shown above `text` (e.g. "MEET JAMKACHU"). */
  title?: string;
  /** ONE sentence — coaches never show a wall of text. */
  text: string;
  /** Any card may carry a dare; the last card in `cards` always renders as
   *  one regardless (falling back to a generic label if omitted), since a
   *  coach's final card must always be an action, never a read-only close. */
  dare?: CoachDare;
}

export interface CoachMarkProps {
  /** seen.ts id this coach is gated on (e.g. "guide.home", "guide.farm"). */
  id: string;
  cards: CoachCard[];
  /** Fires once the coach stops being shown — dare completed, Skip, Later,
   *  or Escape — always after any seen.ts write the closing action makes.
   *  Callers use this to unmount the CoachMark (it renders nothing on its
   *  own "closed" state; the caller controls mounting). */
  onDone?: () => void;
  /** Secondary-control copy, all optional — a control only renders when its
   *  label is supplied, so a minimal coach can omit Back/Later/Skip. */
  backLabel?: string;
  laterLabel?: string;
  skipLabel?: string;
  /** Element to refocus once the coach closes; defaults to whatever had
   *  focus when the coach mounted. */
  restoreFocusTo?: () => HTMLElement | null;
}

const FALLBACK_LABEL = { next: "Next", done: "Got it" };

export default function CoachMark({
  id,
  cards,
  onDone,
  backLabel,
  laterLabel,
  skipLabel,
  restoreFocusTo,
}: CoachMarkProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const coachRef = useRef<HTMLElement>(null);
  const card = cards[index];
  const isLast = index === cards.length - 1;

  // Latest close() in a ref so the mount-once focus-trap effect below never
  // closes over a stale `id`/`onDone` from its first render.
  const closeRef = useRef<(markAsSeen: boolean) => void>(() => {});
  useEffect(() => {
    closeRef.current = (markAsSeen: boolean) => {
      if (markAsSeen) markSeen(id);
      onDone?.();
    };
  });

  // Spotlight positioning: scroll the target into view (respecting
  // prefers-reduced-motion) if it's hidden behind the coach card, then track
  // its rect across resize/scroll so the spotlight box follows it.
  useEffect(() => {
    if (!card?.target) {
      const clear = window.setTimeout(() => setRect(null), 0);
      return () => window.clearTimeout(clear);
    }
    const target = document.querySelector(card.target);
    const update = () => setRect(target?.getBoundingClientRect() ?? null);
    if (target) {
      const targetRect = target.getBoundingClientRect();
      if (targetRect.top < 76 || targetRect.bottom > window.innerHeight - 220) {
        target.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        });
      }
    }
    const frame = window.requestAnimationFrame(update);
    const settleTimer = window.setTimeout(update, 350);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [card?.target]);

  // Modal chrome: lock body scroll, trap Tab inside the coach card, close on
  // Escape (without marking seen — same as Later), restore focus on unmount.
  // Mount-once by design (this component itself is conditionally mounted by
  // the caller), so `closeRef` above is what keeps `id`/`onDone` fresh.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocusTo = restoreFocusTo?.() ?? (document.activeElement as HTMLElement | null);
    document.body.style.overflow = "hidden";
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        coachRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],[tabindex]:not([tabindex='-1'])") ?? [],
      );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => primaryButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [index]);

  const advance = () => {
    card.dare?.onDo?.();
    if (!isLast) { setIndex((value) => value + 1); return; }
    closeRef.current(true);
  };
  const skip = () => closeRef.current(true);
  const later = () => closeRef.current(false);

  const headingId = card.title ? "pm-coach-title" : "pm-coach-text";

  return (
    <div className="pm-tutorial" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <div className="pm-tutorial-shade" />
      {rect && (
        <div
          className="pm-tutorial-spotlight"
          style={{
            "--spot-x": `${rect.left - 8}px`,
            "--spot-y": `${rect.top - 8}px`,
            "--spot-w": `${rect.width + 16}px`,
            "--spot-h": `${rect.height + 16}px`,
          } as CSSProperties}
        />
      )}
      <section
        ref={coachRef}
        className={`pm-tutorial-coach${rect && rect.top > window.innerHeight / 2 ? " is-top" : ""}`}
      >
        <div className="pm-tutorial-progress">
          {cards.map((_, item) => <i key={item} className={item <= index ? "is-done" : ""} />)}
        </div>
        <span className="pm-tutorial-icon" aria-hidden="true">{card.emoji}</span>
        <small>{index + 1} / {cards.length}</small>
        {card.title && <h2 id="pm-coach-title">{card.title}</h2>}
        <p id="pm-coach-text">{card.text}</p>
        <button ref={primaryButtonRef} type="button" className="pm-btn pm-btn-primary" onClick={advance}>
          {card.dare?.label ?? (isLast ? FALLBACK_LABEL.done : FALLBACK_LABEL.next)} →
        </button>
        <div className="pm-tutorial-secondary">
          {index > 0 && backLabel
            ? <button type="button" onClick={() => setIndex((value) => value - 1)}>← {backLabel}</button>
            : <span />}
          {laterLabel && <button type="button" onClick={later}>{laterLabel}</button>}
          {skipLabel && <button type="button" onClick={skip}>{skipLabel}</button>}
        </div>
      </section>
    </div>
  );
}
