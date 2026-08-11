// One shared "have they seen this yet" store for every onboarding surface —
// React coaches here, and the static farm layer's own public/farm/seen.js
// twin (same key, same blob shape, read/written independently since the
// farm layer is plain JS with nothing to import from src/).
//
// A single JSON blob (rather than one localStorage key per feature) means
// a reset/replay never has to hunt down N separate flags, and the legacy
// migration below only ever has to run once.
//
// Contract (docs/superpowers/plans/2026-08-11-kid-guide-dare-coach.md):
//   localStorage["pm_seen_v3"] = {"v":3,"seen":{"<id>":1}}   (1 = seen,
//   absent = not seen).
//
// Every storage access is try/catch: SSR renders (no `localStorage` global
// at all — reading the bare identifier throws a ReferenceError) and
// private-mode/storage-disabled browsers (throwing DOMExceptions on
// getItem/setItem) both fail silently — reads report "not seen", writes
// are no-ops.

const KEY = "pm_seen_v3";
const VERSION = 3;

type SeenBlob = { v: number; seen: Record<string, 1> };

/** Legacy per-feature flags folded into the shared store the first time it
 *  is read. Left in place afterward — never deleted, never read again:
 *  once pm_seen_v3 exists (even as an empty blob), its mere presence is
 *  the "already migrated" signal, so this table only ever runs when the
 *  key is missing from storage entirely. */
const LEGACY_KEYS: ReadonlyArray<readonly [legacyKey: string, id: string]> = [
  ["pm_hatched", "hatch"],
  ["pm_tour_seen_v1", "tour"],
  ["plantmoji_guide_seen_v1", "guide.farm"],
  ["plantmoji_guide_seen_v2", "guide.home"],
];

function emptyBlob(): SeenBlob {
  return { v: VERSION, seen: {} };
}

function isSeenBlob(value: unknown): value is SeenBlob {
  if (!value || typeof value !== "object") return false;
  const { seen: seenField } = value as { seen?: unknown };
  return !!seenField && typeof seenField === "object";
}

function writeBlob(blob: SeenBlob): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(blob));
  } catch {
    // Storage disabled/full (private mode, quota) — write silently no-ops.
  }
}

/** Legacy flags → v3 ids. Runs only the very first time pm_seen_v3 doesn't
 *  exist yet; writes the merged blob immediately so the key's presence
 *  alone prevents this from ever running again (see LEGACY_KEYS above). */
function migrate(): SeenBlob {
  const seenIds: Record<string, 1> = {};
  for (const [legacyKey, id] of LEGACY_KEYS) {
    try {
      if (localStorage.getItem(legacyKey)) seenIds[id] = 1;
    } catch {
      // Unreadable legacy key: treat as not-seen, same fail-closed rule.
    }
  }
  const blob: SeenBlob = { v: VERSION, seen: seenIds };
  writeBlob(blob);
  return blob;
}

function loadBlob(): SeenBlob {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // No `localStorage` global (SSR) or storage unreadable: fail closed,
    // and never touch the legacy keys either — nothing to migrate from.
    return emptyBlob();
  }
  if (raw === null) return migrate();
  try {
    const parsed = JSON.parse(raw);
    if (isSeenBlob(parsed)) return { v: VERSION, seen: { ...parsed.seen } };
  } catch {
    // Corrupt payload — fall through to a fresh empty blob below.
  }
  return emptyBlob();
}

/** Has `id` already been marked seen? False on the server, in private mode
 *  with storage disabled, or before the id has ever been marked. */
export function seen(id: string): boolean {
  try {
    return loadBlob().seen[id] === 1;
  } catch {
    return false;
  }
}

/** Record `id` as seen. No-op if storage is unavailable, or if `id` was
 *  already marked (avoids a redundant write). */
export function markSeen(id: string): void {
  try {
    const blob = loadBlob();
    if (blob.seen[id] === 1) return;
    writeBlob({ v: VERSION, seen: { ...blob.seen, [id]: 1 } });
  } catch {
    // Unavailable storage: no-op, same as every other write here.
  }
}

/** Replay a single coach/feature: drop just its id from the store, leaving
 *  every other id untouched. */
export function clear(id: string): void {
  try {
    const blob = loadBlob();
    if (!(id in blob.seen)) return;
    const nextSeen = { ...blob.seen };
    delete nextSeen[id];
    writeBlob({ v: VERSION, seen: nextSeen });
  } catch {
    // Unavailable storage: no-op.
  }
}

/** Wipe the whole store back to empty — every coach replays. Writes an
 *  empty blob rather than removing the key, so pm_seen_v3 still "exists"
 *  afterward and migrate() can never fire again and pull old legacy flags
 *  back in behind the reset. */
export function reset(): void {
  writeBlob(emptyBlob());
}
