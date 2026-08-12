"use client";

// Shared client access to the classroom-demo cheat sandbox (public/farm/
// cheat.js → window.PMCheat). Client-only: reading/writing here only ever
// touches localStorage, never Supabase or hardware. Centralizes the window
// typing so every cheat-aware React component agrees on one shape.

import { useEffect, useState } from "react";

export interface CheatVitals {
  temperature: number;
  humidity: number;
  light: number;
  soilPh: number;
}

/** Which toggle is held in each exclusive slot; null = nothing held. */
export interface CheatActions {
  place: string | null;
  cover: string | null;
  vent: string | null;
  lamp: string | null;
}

export type CheatActionSlot = keyof CheatActions;

/** One care action a presenter can press. Authored once in cheat.js so both
 *  panels render the same list. */
export interface CheatAction {
  id: string;
  kind: "toggle" | "delta";
  /** Toggles only — the exclusive slot this action claims. */
  slot?: CheatActionSlot;
  emoji: string;
  id_label: string;
  en_label: string;
  /** True when the real-world change takes days, not seconds (soil pH). */
  slow?: boolean;
}

/** Which of the two sandbox modes is running. "trial" is the student
 *  onboarding game (public/farm/trial.js); "cheat" is the presenter sandbox. */
export type SandboxMode = "cheat" | "trial";

export interface CheatState {
  active: boolean;
  mode: SandboxMode;
  status: { level: number; totalXp: number; days: number; seeds: number };
  vitals: CheatVitals;
  quests: Record<string, string>;
  /** Quest the HERO MISSION card should show; null = the real active one. */
  heroQuest: string | null;
  shop: { ownAll: boolean };
  collection: { revealAll: boolean };
  actions: CheatActions;
}

/** Crop thresholds the toggle targets aim at. Mirrors CropProfile's bands. */
export interface CheatBands {
  temp?: { recMin?: number; recMax?: number; overheatEnter?: number; coldEnter?: number };
  humidity?: { recMin?: number; recMax?: number; dryEnter?: number; humidEnter?: number };
  ph?: { recMin?: number; recMax?: number };
  light?: { min?: number };
}

export interface PMCheatApi {
  isActive: () => boolean;
  activate: (seed: unknown, mode?: SandboxMode) => void;
  deactivate: () => void;
  getState: () => CheatState | null;
  get: (path: string, fallback?: unknown) => unknown;
  set: (patch: Record<string, unknown>) => void;
  onChange: (cb: () => void) => () => void;
  ACTIONS: CheatAction[];
  setBands: (bands: CheatBands) => void;
  getActions: () => CheatActions;
  press: (id: string) => void;
  /** null while inactive. */
  getMode: () => SandboxMode | null;
  /** Promote a trial run to full cheat mode, keeping everything earned. */
  switchToCheat: () => void;
  releaseToggles: () => void;
  getBands: () => Required<CheatBands>;
  fitVital: (key: keyof CheatVitals, value: number) => number;
}

/** The trial-mode rules engine (public/farm/trial.js). Absent until that
 *  script has parsed, so every call site must read it defensively. */
export interface PMTrialApi {
  GATE_LEVEL: number;
  GATE_XP: number;
  isActive: () => boolean;
  /** XP still owed before cheat mode unlocks; 0 once it has. */
  xpToGate: () => number;
  /** Begin a run: empty progress, no items, nothing discovered. */
  start: () => void;
  switchToCheat: () => void;
}

declare global {
  interface Window {
    PMCheat?: PMCheatApi;
    PMTrial?: PMTrialApi;
  }
}

/** Subscribe to the sandbox. `state` is null while inactive or before
 *  cheat.js has loaded, so callers render nothing / normal mode by default. */
export function useCheat(): {
  active: boolean;
  state: CheatState | null;
  api: PMCheatApi | null;
} {
  const [snap, setSnap] = useState<{ active: boolean; state: CheatState | null }>({
    active: false,
    state: null,
  });

  useEffect(() => {
    const api = window.PMCheat;
    if (!api) return;
    const sync = () => setSnap({ active: api.isActive(), state: api.getState() });
    sync();
    return api.onChange(sync);
  }, []);

  return { active: snap.active, state: snap.state, api: typeof window !== "undefined" ? window.PMCheat ?? null : null };
}
