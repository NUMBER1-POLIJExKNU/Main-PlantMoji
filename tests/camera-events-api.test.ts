import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getServerSupabase: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }));

import { POST } from "@/app/api/camera-events/route";

// Table-aware stub: the route reads the latest touch row (rate limit) and
// then inserts. Chain methods self-return; awaiting the chain resolves the
// select responder; insert is a spy so tests can assert row shape.

interface StubError { code?: string; message: string }

function makeSupabase(options: {
  lastTouch?: string | null;
  selectError?: StubError | null;
  insertError?: StubError | null;
} = {}) {
  const insert = vi.fn(async () => ({ error: options.insertError ?? null }));
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) chain[method] = () => chain;
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(
      options.selectError
        ? { data: null, error: options.selectError }
        : { data: options.lastTouch ? [{ occurred_at: options.lastTouch }] : [], error: null },
    ).then(resolve);
  return { from: vi.fn(() => ({ ...chain, insert })), insert };
}

function request(body: unknown) {
  return new Request("http://localhost/api/camera-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MISSING_TABLE: StubError = {
  code: "PGRST205",
  message: "Could not find the table 'public.camera_events' in the schema cache",
};

describe("POST /api/camera-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSupabase.mockReturnValue(makeSupabase());
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/camera-events", { method: "POST", body: "{" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects every kind except touch — the browser can NEVER forge a pest_advice row", async () => {
    for (const kind of ["pest_advice", "TOUCH", "", 7, null, undefined]) {
      const response = await POST(request({ kind }));
      expect(response.status, `kind=${String(kind)}`).toBe(400);
    }
  });

  it("rejects a malformed plantId and a malformed occurredAt", async () => {
    expect((await POST(request({ kind: "touch", plantId: "not ok!" }))).status).toBe(400);
    expect((await POST(request({ kind: "touch", occurredAt: "yesterday-ish" }))).status).toBe(400);
  });

  it("503s when Supabase is not configured", async () => {
    mocks.getServerSupabase.mockReturnValue(null);
    expect((await POST(request({ kind: "touch" }))).status).toBe(503);
  });

  it("503s migration_required while milestone19 is missing — graceful, no crash, no insert", async () => {
    const supabase = makeSupabase({ selectError: MISSING_TABLE });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request({ kind: "touch" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("migration_required");
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("rate-limits: a touch within 10s of the last row is 429 with no insert", async () => {
    const supabase = makeSupabase({ lastTouch: new Date(Date.now() - 3_000).toISOString() });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request({ kind: "touch", occurredAt: new Date().toISOString() }));
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("rate_limited");
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("inserts a server-timestamped touch row once the 10s gap is respected", async () => {
    const supabase = makeSupabase({ lastTouch: new Date(Date.now() - 60_000).toISOString() });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request({ kind: "touch", occurredAt: new Date().toISOString() }));
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(supabase.insert).toHaveBeenCalledTimes(1);
    const row = (supabase.insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(row).toMatchObject({ plant_id: "plant-01", kind: "touch" });
    // note must be OMITTED (not sent as null): pre-reconciliation databases
    // (dd2dc1d) keep a NOT NULL note column, and an explicit null would 500
    // every touch there — the column default must be allowed to apply.
    expect("note" in row).toBe(false);
    expect(typeof row.occurred_at).toBe("string");
  });

  it("accepts the very first event (empty table)", async () => {
    const supabase = makeSupabase({ lastTouch: null });
    mocks.getServerSupabase.mockReturnValue(supabase);
    expect((await POST(request({ kind: "touch" }))).status).toBe(200);
    expect(supabase.insert).toHaveBeenCalledTimes(1);
  });
});
