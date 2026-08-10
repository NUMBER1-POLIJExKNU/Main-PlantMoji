import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }));

import { POST } from "@/app/api/companion-skin/route";

// POST /api/companion-skin (milestone20). The route is display-only: it may
// write companion_state.skin_key and NOTHING else, must answer schema drift
// with migration_missing at HTTP 200, and reads (never writes) bond_state.

interface StubError { code?: string; message: string }
interface UpdateResult { data: Array<{ plant_id: string }> | null; error: StubError | null }

/** Stub covering the route's three query shapes:
 *  bond_state.select().eq().maybeSingle(), companion_state.update().eq()
 *  [.select()], and companion_state.insert(). Update results are consumed in
 *  order (last one repeats) so the 23505 replay path can be scripted. */
function makeSupabase(options: {
  bond?: { data: { bond_level: number } | null; error: StubError | null };
  updateResults?: UpdateResult[];
  insertError?: StubError | null;
} = {}) {
  const bond = options.bond ?? { data: { bond_level: 12 }, error: null };
  const updateResults = options.updateResults ?? [{ data: [{ plant_id: "plant-01" }], error: null }];
  const updatePayloads: Array<Record<string, unknown>> = [];
  const insertPayloads: Array<Record<string, unknown>> = [];
  let updateCall = 0;

  const from = vi.fn((table: string) => {
    if (table === "bond_state") {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => bond,
      };
      return chain;
    }
    return {
      update: (payload: Record<string, unknown>) => {
        updatePayloads.push(payload);
        const result = updateResults[Math.min(updateCall, updateResults.length - 1)];
        updateCall += 1;
        // `.eq()` is awaited directly on the 23505 replay and followed by
        // `.select()` on the first attempt — support both.
        const tail = {
          select: () => Promise.resolve(result),
          then: (onFulfilled: (value: UpdateResult) => unknown) =>
            Promise.resolve(result).then(onFulfilled),
        };
        return { eq: () => tail };
      },
      insert: (payload: Record<string, unknown>) => {
        insertPayloads.push(payload);
        return Promise.resolve({ error: options.insertError ?? null });
      },
    };
  });

  return { from, updatePayloads, insertPayloads };
}

// The route rate-limits per x-forwarded-for with module-level state that
// survives across tests, so every request gets a unique XFF unless a test
// deliberately pins one to exercise the limiter itself.
let xffCounter = 0;
function request(body: unknown, headers: Record<string, string> = {}) {
  xffCounter += 1;
  return new Request("http://localhost/api/companion-skin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.0.${Math.floor(xffCounter / 200)}.${xffCounter % 200}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

type Stub = ReturnType<typeof makeSupabase>;
function installSupabase(stub: Stub): Stub {
  mocks.getServerSupabase.mockReturnValue(stub);
  return stub;
}

describe("POST /api/companion-skin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSupabase.mockReturnValue(makeSupabase());
  });

  it("rejects an unknown skinKey with 400 and writes nothing", async () => {
    const supabase = installSupabase(makeSupabase());
    const response = await POST(request({ skinKey: "durian" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "unknown_skin" });
    expect(supabase.updatePayloads).toHaveLength(0);
    expect(supabase.insertPayloads).toHaveLength(0);
  });

  it("answers a not-yet-unlocked skin with locked at HTTP 200 and writes nothing", async () => {
    const supabase = installSupabase(makeSupabase({ bond: { data: { bond_level: 5 }, error: null } }));
    const response = await POST(request({ skinKey: "jagung" })); // needs level 6
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, error: "locked" });
    expect(supabase.updatePayloads).toHaveLength(0);
    expect(supabase.insertPayloads).toHaveLength(0);
  });

  it("treats a missing bond_state row as level 1: only jamkachu selectable", async () => {
    installSupabase(makeSupabase({ bond: { data: null, error: null } }));
    const locked = await POST(request({ skinKey: "edamame" })); // needs level 2
    expect(locked.status).toBe(200);
    expect(await locked.json()).toEqual({ ok: false, error: "locked" });

    installSupabase(makeSupabase({ bond: { data: null, error: null } }));
    const ok = await POST(request({ skinKey: "jamkachu" }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, skinKey: "jamkachu" });
  });

  it("degrades a bond_state read failure to level 1 instead of crashing or unlocking", async () => {
    installSupabase(makeSupabase({ bond: { data: null, error: { message: "connection refused" } } }));
    const response = await POST(request({ skinKey: "padi" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, error: "locked" });
  });

  it("happy path returns {ok:true, skinKey} and the update payload carries ONLY skin_key", async () => {
    const supabase = installSupabase(makeSupabase({ bond: { data: { bond_level: 8 }, error: null } }));
    const response = await POST(request({ plantId: "plant-01", skinKey: "kopi" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, skinKey: "kopi" });
    // toEqual is exact: any extra column (xp, stage, form_key, ...) fails here.
    expect(supabase.updatePayloads).toEqual([{ skin_key: "kopi" }]);
    expect(supabase.insertPayloads).toHaveLength(0);
  });

  it("falls back to an insert of exactly {plant_id, skin_key} when the update matches zero rows", async () => {
    const supabase = installSupabase(makeSupabase({ updateResults: [{ data: [], error: null }] }));
    const response = await POST(request({ skinKey: "padi" })); // plantId defaults to plant-01
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, skinKey: "padi" });
    expect(supabase.insertPayloads).toEqual([{ plant_id: "plant-01", skin_key: "padi" }]);
  });

  it("replays the update exactly once when the fallback insert loses the race (23505)", async () => {
    const supabase = installSupabase(makeSupabase({
      updateResults: [
        { data: [], error: null }, // first update: no companion row yet
        { data: null, error: null }, // replay after 23505: succeeds
      ],
      insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
    }));
    const response = await POST(request({ skinKey: "kakao" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, skinKey: "kakao" });
    expect(supabase.updatePayloads).toEqual([{ skin_key: "kakao" }, { skin_key: "kakao" }]);
    expect(supabase.insertPayloads).toHaveLength(1);
  });

  it("answers every schema-drift code on the update with migration_missing at HTTP 200", async () => {
    const drift: StubError[] = [
      { code: "42703", message: "column companion_state.skin_key does not exist" },
      { code: "PGRST204", message: "Could not find the 'skin_key' column of 'companion_state'" },
      { code: "PGRST205", message: "Could not find the table 'public.companion_state'" },
      { code: "23514", message: 'new row violates check constraint "companion_state_skin_key_check"' },
    ];
    for (const error of drift) {
      const supabase = installSupabase(makeSupabase({ updateResults: [{ data: null, error }] }));
      const response = await POST(request({ skinKey: "jamkachu" }));
      expect(response.status, error.code).toBe(200);
      expect(await response.json()).toEqual({ ok: false, error: "migration_missing" });
      expect(supabase.insertPayloads).toHaveLength(0);
    }
  });

  it("answers schema drift surfacing on the fallback insert with migration_missing too", async () => {
    installSupabase(makeSupabase({
      updateResults: [{ data: [], error: null }],
      insertError: { code: "PGRST205", message: "Could not find the table 'public.companion_state'" },
    }));
    const response = await POST(request({ skinKey: "jamkachu" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, error: "migration_missing" });
  });

  it("returns 500 update_failed for a non-drift, non-race insert failure", async () => {
    installSupabase(makeSupabase({
      updateResults: [{ data: [], error: null }],
      insertError: { code: "57014", message: "canceling statement due to statement timeout" },
    }));
    const response = await POST(request({ skinKey: "jamkachu" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "update_failed" });
  });

  it("returns 500 when the post-23505 replay also fails", async () => {
    installSupabase(makeSupabase({
      updateResults: [
        { data: [], error: null },
        { data: null, error: { message: "connection reset" } },
      ],
      insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
    }));
    const response = await POST(request({ skinKey: "jamkachu" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "update_failed" });
  });

  it("returns 503 unavailable when Supabase is not configured", async () => {
    mocks.getServerSupabase.mockReturnValue(null);
    const response = await POST(request({ skinKey: "jamkachu" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "unavailable" });
  });

  it("rate-limits the 13th request in a window from the same x-forwarded-for", async () => {
    const xff = { "x-forwarded-for": "203.0.113.99" };
    for (let i = 0; i < 12; i++) {
      const response = await POST(request({ skinKey: "jamkachu" }, xff));
      expect(response.status, `request ${i + 1}`).toBe(200);
    }
    const limited = await POST(request({ skinKey: "jamkachu" }, xff));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ ok: false, error: "rate_limited" });
  });
});
