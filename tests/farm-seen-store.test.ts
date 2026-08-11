import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Behavior tests for the unified one-time seen-store (kid-guide plan Task
// 2): public/farm/seen.js executed against stub windows, the same
// new-Function technique tests/farm-onboarding-tour.test.ts uses for
// strings.js. The SHARED CONTRACT (the React shell's src/lib/seen.ts
// implements the same): one localStorage blob `pm_seen_v3` of shape
// {"v":3,"seen":{"<id>":1}} (1 = seen, absent = not), API
// window.PMSeen = { seen, markSeen, clear, reset }, legacy flags migrated
// on first read, try/catch around every storage access.

const seenSource = readFileSync(resolve(process.cwd(), "public/farm/seen.js"), "utf8");
const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");
const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");

const KEY = "pm_seen_v3";

type Seen = {
  seen(id: string): boolean;
  markSeen(id: string): void;
  clear(id: string): void;
  reset(): void;
};

function makeStore(initial: Record<string, string> = {}, opts: { readThrows?: boolean; writeThrows?: boolean } = {}) {
  const data: Record<string, string> = { ...initial };
  const win: { localStorage: unknown; PMSeen?: Seen } = {
    localStorage: {
      getItem(key: string): string | null {
        if (opts.readThrows) throw new Error("storage blocked");
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
      },
      setItem(key: string, value: string): void {
        if (opts.writeThrows) throw new Error("private mode");
        data[key] = String(value);
      },
      removeItem(key: string): void {
        delete data[key];
      },
    },
  };
  new Function("window", seenSource)(win);
  if (!win.PMSeen) throw new Error("seen.js did not assign window.PMSeen");
  return { seen: win.PMSeen, data };
}

describe("PMSeen store (pm_seen_v3)", () => {
  it("exposes exactly the four contract methods", () => {
    const { seen } = makeStore();
    expect(Object.keys(seen).sort()).toEqual(["clear", "markSeen", "reset", "seen"]);
  });

  it("starts unseen and persists {v:3,seen:{id:1}} on markSeen", () => {
    const { seen, data } = makeStore();
    expect(seen.seen("hatch")).toBe(false);
    seen.markSeen("hatch");
    expect(seen.seen("hatch")).toBe(true);
    expect(JSON.parse(data[KEY])).toEqual({ v: 3, seen: { hatch: 1 } });
  });

  it("migrates ALL four legacy flags on first read and leaves the legacy keys in place", () => {
    const legacy = {
      pm_hatched: "1",
      pm_tour_seen_v1: "1",
      plantmoji_guide_seen_v1: "1",
      plantmoji_guide_seen_v2: "1",
    };
    const { seen, data } = makeStore({ ...legacy });
    expect(seen.seen("hatch")).toBe(true);
    expect(seen.seen("tour")).toBe(true);
    expect(seen.seen("guide.farm")).toBe(true);
    expect(seen.seen("guide.home")).toBe(true);
    expect(JSON.parse(data[KEY])).toEqual({ v: 3, seen: { hatch: 1, tour: 1, "guide.farm": 1, "guide.home": 1 } });
    // Legacy keys stay (harmless) — they are just never read again.
    for (const key of Object.keys(legacy)) expect(data[key]).toBe("1");
  });

  it("migrates partially when only some legacy flags exist", () => {
    const { seen } = makeStore({ pm_hatched: "1" });
    expect(seen.seen("hatch")).toBe(true);
    expect(seen.seen("tour")).toBe(false);
    expect(seen.seen("guide.farm")).toBe(false);
  });

  it("never re-migrates once the blob exists (legacy keys are dead after first read)", () => {
    const { seen } = makeStore({ [KEY]: JSON.stringify({ v: 3, seen: {} }), pm_hatched: "1" });
    expect(seen.seen("hatch")).toBe(false);
  });

  it("clear() forgets ONE id (replay = clear one flag)", () => {
    const { seen, data } = makeStore();
    seen.markSeen("tour");
    seen.markSeen("hatch");
    seen.clear("tour");
    expect(seen.seen("tour")).toBe(false);
    expect(seen.seen("hatch")).toBe(true);
    expect(JSON.parse(data[KEY])).toEqual({ v: 3, seen: { hatch: 1 } });
  });

  it("reset() writes an EMPTY blob (never removes the key) so migration cannot resurrect legacy flags", () => {
    const { seen, data } = makeStore({ pm_hatched: "1" });
    expect(seen.seen("hatch")).toBe(true);
    seen.reset();
    expect(seen.seen("hatch")).toBe(false);
    expect(JSON.parse(data[KEY])).toEqual({ v: 3, seen: {} });
  });

  it("rebuilds from legacy flags when the blob is corrupted JSON", () => {
    const { seen, data } = makeStore({ [KEY]: "{not json", pm_tour_seen_v1: "1" });
    expect(seen.seen("tour")).toBe(true);
    expect(JSON.parse(data[KEY])).toEqual({ v: 3, seen: { tour: 1 } });
  });

  it("fails CLOSED when storage reads throw: everything reports seen, nothing throws", () => {
    const { seen } = makeStore({}, { readThrows: true });
    expect(seen.seen("hatch")).toBe(true);
    expect(seen.seen("anything.at.all")).toBe(true);
    expect(() => {
      seen.markSeen("x");
      seen.clear("x");
      seen.reset();
    }).not.toThrow();
  });

  it("degrades gracefully when only writes throw (private mode): in-session memory, no persistence, no throw", () => {
    const { seen, data } = makeStore({}, { writeThrows: true });
    expect(() => seen.markSeen("tour")).not.toThrow();
    expect(seen.seen("tour")).toBe(true); // remembered for this session
    expect(data[KEY]).toBeUndefined(); // …but nothing persisted
  });
});

describe("host wiring (index.html + live.js)", () => {
  it("index.html loads seen.js as a classic script before the live.js module", () => {
    const seenTag = html.indexOf('<script src="/farm/seen.js"></script>');
    const liveTag = html.indexOf('<script type="module" src="/farm/live.js"></script>');
    expect(seenTag).toBeGreaterThan(-1);
    expect(liveTag).toBeGreaterThan(seenTag);
  });

  it("live.js never touches the legacy flags directly again — only PMSeen", () => {
    expect(live).not.toMatch(/localStorage\.(getItem|setItem)\("(pm_hatched|pm_tour_seen_v1|plantmoji_guide_seen_v1|plantmoji_guide_seen_v2)"/);
    expect(live).not.toMatch(/localStorage\.(getItem|setItem)\("pm_seen_v3"/); // the blob belongs to seen.js
    expect(live).toContain("window.PMSeen ? window.PMSeen.seen(id) === true : true");
    expect(live).toContain("window.PMSeen?.markSeen(id)");
  });
});
