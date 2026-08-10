import { describe, expect, it } from "vitest";
import {
  isCheckViolation,
  isMissingColumnError,
  isMissingRpcError,
  isMissingTableError,
  type SupabaseErrorLike,
} from "@/lib/supabase-errors";

// Shared error detectors (lib/supabase-errors.ts). Each detector is the
// UNION of every variant that used to live duplicated at its call sites, so
// every code and every message shape from the old local copies must hit —
// and unrelated errors must miss on all four (missing-migration graceful
// degradation may widen, never narrow).

/** Errors no detector may ever claim: a match here would turn a real outage
 *  into a silent "migration missing" no-op. */
const UNRELATED: SupabaseErrorLike[] = [
  { code: "500", message: "Internal Server Error" },
  { message: "connection refused" },
  { code: "57014", message: "canceling statement due to statement timeout" },
  { code: "23505", message: 'duplicate key value violates unique constraint "companion_state_pkey"' },
  { code: null, message: "TypeError: fetch failed" },
];

describe("isMissingTableError", () => {
  it("matches PGRST205 by code alone", () => {
    expect(isMissingTableError({ code: "PGRST205", message: "whatever" })).toBe(true);
  });

  it("matches PostgREST's message without a code", () => {
    expect(
      isMissingTableError({ message: "Could not find the table 'public.plants' in the schema cache" }),
    ).toBe(true);
  });

  it("misses column, check, and unrelated errors", () => {
    expect(isMissingTableError({ code: "42703", message: "column plants.mood does not exist" })).toBe(false);
    expect(isMissingTableError({ code: "23514", message: "violates check constraint" })).toBe(false);
    for (const error of UNRELATED) expect(isMissingTableError(error), error.message).toBe(false);
  });
});

describe("isMissingColumnError", () => {
  it("matches raw Postgres 42703 by code alone", () => {
    expect(isMissingColumnError({ code: "42703", message: "whatever" })).toBe(true);
  });

  it("matches PostgREST's schema-cache miss PGRST204 by code alone", () => {
    expect(isMissingColumnError({ code: "PGRST204", message: "whatever" })).toBe(true);
  });

  it("matches the raw Postgres message without a code", () => {
    // The exact shape sensor-history's local copy was written for.
    expect(
      isMissingColumnError({ message: "column sensor_readings.light_lux does not exist" }),
    ).toBe(true);
  });

  it("matches PostgREST's quoted-column message without a code", () => {
    // The exact shape settings/actions.ts and companion-engine handled.
    expect(
      isMissingColumnError({
        message: "Could not find the 'skin_key' column of 'companion_state' in the schema cache",
      }),
    ).toBe(true);
  });

  it("misses missing-table and unrelated errors", () => {
    expect(
      isMissingColumnError({ code: "PGRST205", message: "Could not find the table 'public.plants'" }),
    ).toBe(false);
    for (const error of UNRELATED) expect(isMissingColumnError(error), error.message).toBe(false);
  });
});

describe("isCheckViolation", () => {
  it("matches raw Postgres 23514 by code alone", () => {
    expect(isCheckViolation({ code: "23514", message: "whatever" })).toBe(true);
  });

  it("matches the surfaced message without a code", () => {
    expect(
      isCheckViolation({
        message: 'new row for relation "companion_state" violates check constraint "companion_state_stage_check"',
      }),
    ).toBe(true);
  });

  it("misses unique violations and unrelated errors", () => {
    // 23505 (unique) must NOT read as a CHECK violation.
    for (const error of UNRELATED) expect(isCheckViolation(error), error.message).toBe(false);
  });
});

describe("isMissingRpcError", () => {
  it("matches PGRST202 (unknown function) by code alone", () => {
    expect(isMissingRpcError({ code: "PGRST202", message: "whatever" })).toBe(true);
  });

  it("matches PGRST205 (unknown table) by code alone", () => {
    expect(isMissingRpcError({ code: "PGRST205", message: "whatever" })).toBe(true);
  });

  it("matches both function and table message shapes without a code", () => {
    expect(
      isMissingRpcError({
        message: "Could not find the function public.award_seeds(p_amount, p_plant_id) in the schema cache",
      }),
    ).toBe(true);
    expect(
      isMissingRpcError({ message: "Could not find the table 'public.camera_events' in the schema cache" }),
    ).toBe(true);
  });

  it("misses missing-column and unrelated errors", () => {
    expect(isMissingRpcError({ code: "42703", message: "column x does not exist" })).toBe(false);
    for (const error of UNRELATED) expect(isMissingRpcError(error), error.message).toBe(false);
  });
});

describe("cross-detector negatives", () => {
  it("a plain 500-style failure matches none of the four detectors", () => {
    const error = { code: "500", message: "Internal Server Error" };
    expect(isMissingTableError(error)).toBe(false);
    expect(isMissingColumnError(error)).toBe(false);
    expect(isCheckViolation(error)).toBe(false);
    expect(isMissingRpcError(error)).toBe(false);
  });

  it("accepts a null code structurally (PostgrestError-compatible)", () => {
    expect(isMissingTableError({ code: null, message: "could not find the table" })).toBe(true);
  });
});
