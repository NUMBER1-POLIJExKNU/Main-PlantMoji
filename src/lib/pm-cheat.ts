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

export interface CheatState {
  active: boolean;
  status: { level: number; totalXp: number; days: number; seeds: number };
  vitals: CheatVitals;
  quests: Record<string, string>;
  shop: { ownAll: boolean };
  collection: { revealAll: boolean };
}

export interface PMCheatApi {
  isActive: () => boolean;
  activate: (seed: unknown) => void;
  deactivate: () => void;
  getState: () => CheatState | null;
  get: (path: string, fallback?: unknown) => unknown;
  set: (patch: Record<string, unknown>) => void;
  onChange: (cb: () => void) => () => void;
}

declare global {
  interface Window {
    PMCheat?: PMCheatApi;
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
