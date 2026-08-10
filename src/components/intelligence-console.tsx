"use client";

import { useEffect, useMemo, useState } from "react";

export interface IntelligenceLine { label: string; value?: string; tone?: "ok" | "warn" | "info" }

export function TypewriterText({ text, className = "", speed = 18 }: { text: string; className?: string; speed?: number }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { const reducedId = window.setTimeout(() => setShown(text), 0); return () => window.clearTimeout(reducedId); }
    let index = 0; const resetId = window.setTimeout(() => setShown(""), 0);
    const id = window.setInterval(() => { index += 1; setShown(text.slice(0, index)); if (index >= text.length) window.clearInterval(id); }, speed);
    return () => { window.clearTimeout(resetId); window.clearInterval(id); };
  }, [speed, text]);
  return <span className={className} aria-label={text} onClick={() => setShown(text)}>{shown}<i className="pm-type-caret" aria-hidden="true" /></span>;
}

export default function IntelligenceConsole({ title, lines, running = false, compact = false }: { title: string; lines: IntelligenceLine[]; running?: boolean; compact?: boolean }) {
  const [visible, setVisible] = useState(lines.length);
  const signature = useMemo(() => lines.map((line) => `${line.label}:${line.value}`).join("|"), [lines]);
  useEffect(() => {
    if (!running || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { const readyId = window.setTimeout(() => setVisible(lines.length), 0); return () => window.clearTimeout(readyId); }
    let count = 0; const resetId = window.setTimeout(() => setVisible(0), 0);
    const id = window.setInterval(() => { count += 1; setVisible(count); if (count >= lines.length) window.clearInterval(id); }, 105);
    return () => { window.clearTimeout(resetId); window.clearInterval(id); };
  }, [lines.length, running, signature]);
  return <section className={`pm-intelligence-console${compact ? " is-compact" : ""}`} aria-label={title} aria-live="polite"><header><span>●</span>{title}<b>{running ? "PROCESSING" : "READY"}</b></header><div>{lines.slice(0, visible).map((line, index) => <p key={`${line.label}-${index}`} className={`is-${line.tone ?? "info"}`}><span>&gt; {line.label}</span>{line.value && <strong>{line.value}</strong>}</p>)}{running && visible < lines.length && <p className="is-running"><span>&gt; _</span></p>}</div></section>;
}
