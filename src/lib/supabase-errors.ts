// Shared Supabase/PostgREST error detectors.
//
// PURE MODULE CONTRACT (same reasoning as lib/growth.ts's header): no
// "server-only" import, no Supabase client import — every detector takes a
// structural error shape, so engines, API routes, server actions, AND plain
// vitest can all import this file directly.
//
// UNION SEMANTICS: each detector is the union of every variant that
// previously lived duplicated at its call sites. Missing-migration graceful
// degradation is a hard product invariant — behavior may only get MORE
// tolerant here, never less. Widening a detector (matching one more code or
// message shape) is safe and expected; narrowing one is a shipping bug.

/** Structural shape of a Supabase/PostgREST/raw-Postgres error — accepts
 *  PostgrestError, storage errors, or hand-rolled test stubs alike. */
export interface SupabaseErrorLike {
  code?: string | null;
  message: string;
}

/** PostgREST's "table missing from schema cache" (PGRST205) — the migration
 *  creating the table hasn't been run in this Supabase project yet. */
export function isMissingTableError(error: SupabaseErrorLike): boolean {
  return error.code === "PGRST205" || /could not find the table/i.test(error.message);
}

/** A selected/written column the database doesn't have — raw Postgres 42703
 *  or PostgREST's schema-cache miss (PGRST204), in either message shape
 *  ("column x does not exist" from Postgres, "Could not find the 'x' column"
 *  from PostgREST). The column-adding migration hasn't been run yet. */
export function isMissingColumnError(error: SupabaseErrorLike): boolean {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist/i.test(error.message) ||
    /could not find the '.+' column/i.test(error.message)
  );
}

/** A write rejected by a CHECK constraint (raw Postgres 23514 or the
 *  PostgREST-surfaced message) — e.g. a pre-migration CHECK that doesn't
 *  know newer enum-like values yet. */
export function isCheckViolation(error: SupabaseErrorLike): boolean {
  return error.code === "23514" || /violates check constraint/i.test(error.message);
}

/** PostgREST "missing from schema cache" for an RPC-backed feature:
 *  PGRST202 = unknown function, PGRST205 = unknown table — the migration
 *  creating the function (and its tables) hasn't been run yet. */
export function isMissingRpcError(error: SupabaseErrorLike): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /could not find the (function|table)/i.test(error.message)
  );
}
