// ── Shared table-aware Supabase stub ─────────────────────────────────────
// PostgREST-style thenable chain: every builder method records itself and
// returns the chain; awaiting resolves the table's responder, which can
// inspect the recorded chain (e.g. to tell a head:true count apart from a
// row select on the same table). Extracted from the five suites that each
// carried a near-identical copy (badge-engine, quest-verify-sweep,
// settle-sweep, steady-day, seed-engine).

import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST-shaped response a stub query chain resolves to when awaited. */
export interface StubResponse {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
}

/** One recorded builder-method call. */
export interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

/** Per-table responder; receives the calls recorded on its own chain. */
export type Responder = (chainCalls: RecordedCall[]) => StubResponse;

/** Responder for `supabase.rpc(name, args)` calls. */
export type RpcResponder = (name: string, args: Record<string, unknown>) => StubResponse;

/** Union of every chain method any consuming suite exercises. Methods the
 *  code under test never calls are inert — they only exist on the stub. */
export const CHAIN_METHODS = [
  "select",
  "eq",
  "neq",
  "in",
  "gte",
  "lt",
  "lte",
  "order",
  "limit",
  "update",
  "upsert",
  "maybeSingle",
];

export type SupabaseStub = SupabaseClient & { rpc: ReturnType<typeof vi.fn> };

/**
 * @param responders per-table responders; unknown tables resolve `{ data: [], error: null }`.
 * @param log optional flat recorder shared across every chain (method order preserved).
 * @param rpc optional responder backing the `rpc` spy (a `vi.fn`, inspectable via `.mock`).
 */
export function makeSupabase(
  responders: Record<string, Responder>,
  log: RecordedCall[] = [],
  rpc: RpcResponder = () => ({ data: null, error: null }),
): SupabaseStub {
  return {
    from(table: string) {
      const chainCalls: RecordedCall[] = [];
      const stub: Record<string, unknown> = {};
      for (const method of CHAIN_METHODS) {
        stub[method] = (...args: unknown[]) => {
          const call = { table, method, args };
          chainCalls.push(call);
          log.push(call);
          return stub;
        };
      }
      stub.then = (
        resolve: (value: StubResponse) => unknown,
        reject: (reason: unknown) => unknown,
      ) => {
        const responder = responders[table] ?? (() => ({ data: [], error: null }));
        return Promise.resolve(responder(chainCalls)).then(resolve, reject);
      };
      return stub;
    },
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => rpc(name, args)),
  } as unknown as SupabaseStub;
}

/** True when the chain holds a `select(..., { count: ... })` count query. */
export const isCountQuery = (calls: RecordedCall[]) =>
  calls.some(
    (c) => c.method === "select" && (c.args[1] as { count?: string } | undefined)?.count,
  );

/** True when the chain holds a `select(..., { head: true })` head count. */
export const isHeadCount = (calls: RecordedCall[]) =>
  calls.some(
    (c) => c.method === "select" && (c.args[1] as { head?: boolean } | undefined)?.head,
  );
