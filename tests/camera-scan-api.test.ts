import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
  analyzePestSnapshot: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }));
vi.mock("@/lib/pest-advisory", () => ({ analyzePestSnapshot: mocks.analyzePestSnapshot }));

import { POST } from "@/app/api/camera-scan/route";
import { CAMERA_COPY } from "@/app/camera/copy";

const SMALL_JPEG_B64 = "aGVsbG8taGVsbG8="; // any valid base64, well under 200KB

interface StubError { code?: string; message: string }

function makeSupabase(options: {
  lastAdvice?: string | null;
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
        : { data: options.lastAdvice ? [{ occurred_at: options.lastAdvice }] : [], error: null },
    ).then(resolve);
  return { from: vi.fn(() => ({ ...chain, insert })), insert };
}

function request(body: unknown) {
  return new Request("http://localhost/api/camera-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BASE_BODY = {
  plantId: "plant-01",
  imageBase64: SMALL_JPEG_B64,
  mimeType: "image/jpeg",
  locale: "en",
};

describe("POST /api/camera-scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSupabase.mockReturnValue(makeSupabase());
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "clear" });
  });

  it("rejects non-JPEG payloads and malformed base64", async () => {
    expect((await POST(request({ ...BASE_BODY, mimeType: "image/png" }))).status).toBe(400);
    expect((await POST(request({ ...BASE_BODY, imageBase64: "!!not-base64!!" }))).status).toBe(400);
    expect((await POST(request({ ...BASE_BODY, imageBase64: "" }))).status).toBe(400);
  });

  it("rejects snapshots over 200KB decoded", async () => {
    const response = await POST(request({ ...BASE_BODY, imageBase64: "A".repeat(280_000) }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("too_large");
    expect(mocks.analyzePestSnapshot).not.toHaveBeenCalled();
  });

  it("returns disabled and persists nothing when the advisory layer is off", async () => {
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "disabled" });
    const supabase = makeSupabase();
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request(BASE_BODY));
    expect(await response.json()).toEqual({ ok: true, disabled: true });
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("clear verdict returns none with no advisory and no row", async () => {
    const supabase = makeSupabase();
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request(BASE_BODY));
    expect(await response.json()).toEqual({ ok: true, verdict: "none" });
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("discarded (person in frame) returns the localized generic line and persists NOTHING", async () => {
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "discarded" });
    const supabase = makeSupabase();
    mocks.getServerSupabase.mockReturnValue(supabase);
    const en = await (await POST(request(BASE_BODY))).json();
    expect(en).toEqual({ ok: true, verdict: "none", advisory: CAMERA_COPY.en.scanGeneric });
    const id = await (await POST(request({ ...BASE_BODY, locale: "id" }))).json();
    expect(id.advisory).toBe(CAMERA_COPY.id.scanGeneric);
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("pest verdict inserts a TEXT-ONLY pest_advice row and returns the advisory", async () => {
    const line = "Something tickles! Can you check my leaves? 🐛";
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "pest", advisory: line });
    const supabase = makeSupabase({ lastAdvice: null });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request(BASE_BODY));
    expect(await response.json()).toEqual({ ok: true, verdict: "pest", advisory: line });
    expect(supabase.insert).toHaveBeenCalledTimes(1);
    const insertCalls = supabase.insert.mock.calls as unknown as Array<[Record<string, unknown>]>;
    const row = insertCalls[0][0];
    expect(row).toMatchObject({
      plant_id: "plant-01",
      kind: "pest_advice",
      note: { message: line, locale: "en" },
    });
    // THE invariant: the snapshot never reaches the database in any form.
    expect(JSON.stringify(supabase.insert.mock.calls)).not.toContain(SMALL_JPEG_B64);
  });

  it("pest verdict still answers when milestone19 is missing or the insert fails", async () => {
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "pest", advisory: "Check me! 🐛" });
    const supabase = makeSupabase({
      selectError: { code: "PGRST205", message: "Could not find the table 'public.camera_events'" },
    });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request(BASE_BODY));
    expect((await response.json()).verdict).toBe("pest");
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("rate-limits BEFORE the vision call: a recent advisory means Gemini never runs", async () => {
    // The paid call must sit behind the ≥10s gate, not in front of it —
    // otherwise a scripted client could burn GEMINI_API_KEY quota freely.
    const supabase = makeSupabase({ lastAdvice: new Date(Date.now() - 3_000).toISOString() });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request(BASE_BODY));
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("rate_limited");
    expect(mocks.analyzePestSnapshot).not.toHaveBeenCalled();
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("scans without a gate when Supabase is not configured (client still self-limits)", async () => {
    mocks.getServerSupabase.mockReturnValue(null);
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "pest", advisory: "Check me! 🐛" });
    const response = await POST(request(BASE_BODY));
    expect((await response.json()).verdict).toBe("pest");
  });
});

describe("camera-scan source contract — the image can never be persisted", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/api/camera-scan/route.ts"), "utf8");

  it("contains no storage, fs, or buffer materialization of the snapshot", () => {
    expect(source).not.toMatch(/supabase\.storage|from\(["']plant-photos/);
    expect(source).not.toMatch(/writeFile|createWriteStream|appendFile|node:fs/);
    expect(source).not.toMatch(/Buffer\.from/);
  });

  it("never imports reward machinery (AI is language-only)", () => {
    expect(source).not.toMatch(/seed-engine|bonus-xp|award|total_xp|bond_level/);
  });
});
