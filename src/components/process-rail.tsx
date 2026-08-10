"use client";

export type ProcessStepState = "waiting" | "running" | "complete" | "fallback" | "error";

export interface ProcessStep {
  key: string;
  label: string;
  summary?: string;
  state: ProcessStepState;
}

const ICON: Record<ProcessStepState, string> = { waiting: "○", running: "●", complete: "✓", fallback: "↪", error: "!" };

export default function ProcessRail({ steps, label = "Processing stages" }: { steps: ProcessStep[]; label?: string }) {
  return <ol className="pm-process-rail" aria-label={label}>{steps.map((step) => <li key={step.key} className={`is-${step.state}`} aria-current={step.state === "running" ? "step" : undefined}><span aria-hidden="true">{ICON[step.state]}</span><div><strong>{step.label}</strong>{step.summary && <small>{step.summary}</small>}</div></li>)}</ol>;
}
