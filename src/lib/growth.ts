// Manual Growth Records (handoff §14, §35): Growth Stage must be MANUAL or
// record-based — never inferred from current sensors. This module owns the
// append-only `growth_records` log (supabase/milestone5-growth-records.sql).
//
// GROWTH_STAGES / GrowthStage / normalizeGrowthStage already live in
// lib/queries.ts (used by the settings page and its non-server-only
// helpers) — re-exported here so callers of this module have one place to
// import from, without a second source of truth for the stage list.
//
// Note on "server-only": fetchGrowthRecords below touches the Supabase
// secret key exactly like lib/plants.ts's fetchers (getServerSupabase()).
// Both the `server-only` package and lib/supabase/server throw unconditionally
// on import unless the module graph carries the "react-server" condition,
// which Next.js sets for real Server Components/Actions but the plain
// vitest/node runner does not. Loading them at module scope would make this
// file — including the pure parseGrowthInput/GROWTH_STAGES it also exports —
// impossible to import from a test, so `server-only` and lib/supabase/server
// are loaded lazily inside fetchGrowthRecords instead. This mirrors why
// lib/queries.ts and lib/weekly-report.ts avoid a top-level `server-only`
// import too (see their header comments): the caller decides
// server-only-ness, and pure helpers stay unit-testable.

import { GROWTH_STAGES, type GrowthStage } from "./queries";

export { GROWTH_STAGES };
export type { GrowthStage };

/** Row shape of the `growth_records` table. */
export interface GrowthRecordRow {
  id: string;
  plant_id: string;
  recorded_at: string;
  stage: GrowthStage;
  height_cm: number | null;
  leaf_count: number | null;
  note: string | null;
  created_at: string;
}

const MAX_HEIGHT_CM = 500;
const MAX_LEAF_COUNT = 10000;
const MAX_NOTE_LENGTH = 200;
const DEFAULT_PLANT_ID = "plant-01";

/** Validated + normalized fields ready for a `growth_records` insert. */
export interface GrowthInput {
  plantId: string;
  stage: GrowthStage;
  heightCm: number | null;
  leafCount: number | null;
  note: string | null;
}

export type ParseGrowthInputResult =
  | { ok: true; input: GrowthInput }
  | { ok: false; error: string };

/** Raw fields as they arrive from a <form> submission (FormData.get()
 *  values, or plain strings/undefined in tests). */
export interface GrowthInputFields {
  plantId?: FormDataEntryValue | null;
  stage?: FormDataEntryValue | null;
  heightCm?: FormDataEntryValue | null;
  leafCount?: FormDataEntryValue | null;
  note?: FormDataEntryValue | null;
}

type OptionalNumberResult = { ok: true; value: number | null } | { ok: false };

/** Blank/missing → null (field omitted). Otherwise must be a finite,
 *  strictly positive number within [0, max] — optionally integer-only. */
function parseOptionalPositive(
  raw: FormDataEntryValue | null | undefined,
  max: number,
  integerOnly: boolean,
): OptionalNumberResult {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };

  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { ok: false };
  if (integerOnly && !Number.isInteger(parsed)) return { ok: false };
  if (parsed <= 0 || parsed > max) return { ok: false };

  return { ok: true, value: parsed };
}

/**
 * Pure validation for a manual growth-record submission. Shared by the
 * `addGrowthRecord` server action and its tests — no Supabase access here.
 *
 * - stage: required, must match GROWTH_STAGES exactly.
 * - heightCm: optional, positive number <= 500.
 * - leafCount: optional, positive integer <= 10000.
 * - note: optional, <= 200 characters (trimmed).
 */
export function parseGrowthInput(fields: GrowthInputFields): ParseGrowthInputResult {
  const rawPlantId = fields.plantId;
  const plantId =
    typeof rawPlantId === "string" && rawPlantId.length > 0 && rawPlantId.length <= 64
      ? rawPlantId
      : DEFAULT_PLANT_ID;

  const rawStage = typeof fields.stage === "string" ? fields.stage.trim() : "";
  const stage = GROWTH_STAGES.find((candidate) => candidate === rawStage);
  if (!stage) {
    return { ok: false, error: `stage must be one of ${GROWTH_STAGES.join(", ")}` };
  }

  const heightResult = parseOptionalPositive(fields.heightCm, MAX_HEIGHT_CM, false);
  if (!heightResult.ok) {
    return { ok: false, error: `heightCm must be a positive number <= ${MAX_HEIGHT_CM}` };
  }

  const leafResult = parseOptionalPositive(fields.leafCount, MAX_LEAF_COUNT, true);
  if (!leafResult.ok) {
    return { ok: false, error: `leafCount must be a positive integer <= ${MAX_LEAF_COUNT}` };
  }

  const rawNote = typeof fields.note === "string" ? fields.note.trim() : "";
  if (rawNote.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `note must be ${MAX_NOTE_LENGTH} characters or fewer` };
  }

  return {
    ok: true,
    input: {
      plantId,
      stage,
      heightCm: heightResult.value,
      leafCount: leafResult.value,
      note: rawNote.length > 0 ? rawNote : null,
    },
  };
}

/** PostgREST's "table missing from schema cache" — the migration hasn't
 *  been run in this Supabase project yet. Duplicated from lib/plants.ts
 *  (see the header comment above for why this module can't import that
 *  file, or lib/supabase/server, eagerly). */
function isMissingTableError(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST205" || /could not find the table/i.test(error.message);
}

/** Past growth records for the timeline, most recent first. Tolerates a
 *  not-yet-migrated schema (supabase/milestone5-growth-records.sql not run
 *  yet) by returning an empty list, same pattern as lib/plants.ts. */
export async function fetchGrowthRecords(
  plantId: string,
  limit = 20,
): Promise<GrowthRecordRow[]> {
  await import("server-only");
  const { getServerSupabase } = await import("./supabase/server");

  const supabase = getServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("growth_records")
    .select("*")
    .eq("plant_id", plantId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) return [];
    console.error(`fetchGrowthRecords(${plantId}) failed:`, error.message);
    return [];
  }
  return (data ?? []) as GrowthRecordRow[];
}
