import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Source-contract tests (repo convention): the override is a browser-only
// store wired across a static shell and a React bundle, so what actually
// breaks is the WIRING — a missing script tag, a call site left on the real
// clock, or someone "simplifying" it into a Date.now() patch.

const devclock = readFileSync("public/farm/devclock.js", "utf8");
const live = readFileSync("public/farm/live.js", "utf8");
const farmHtml = readFileSync("public/farm/index.html", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const guardian = readFileSync("src/components/camera-guardian.tsx", "utf8");
const panel = readFileSync("src/components/dev-mode-panel.tsx", "utf8");
const clockLib = readFileSync("src/lib/pm-clock.ts", "utf8");
const motion = readFileSync("src/lib/motion-detect.ts", "utf8");
const appearance = readFileSync("src/components/appearance-controls.tsx", "utf8");
const plantHome = readFileSync("src/components/plant-home.tsx", "utf8");

describe("developer WIB clock override", () => {
  it("loads on both entry points, before live.js", () => {
    // next.config.ts rewrites "/" to the static shell, which never runs the
    // React layout — the same gap that shipped cheat.js broken once. The
    // camera page is a React route and the sleep gate it must clear lives in
    // the shell, so a tag in only one place moves half the app's clock.
    const clockAt = farmHtml.indexOf('src="/farm/devclock.js"');
    const liveAt = farmHtml.indexOf('src="/farm/live.js"');
    expect(clockAt).toBeGreaterThanOrEqual(0);
    expect(clockAt).toBeLessThan(liveAt);
    expect(layout).toContain('<Script src="/farm/devclock.js" strategy="beforeInteractive" />');
  });

  it("never patches Date.now, Date, or performance", () => {
    // The whole design rests on this. Every cooldown, throttle and rate limit
    // in the app measures elapsed time; shifting the global clock would move
    // the 10s motion gap and the 10min scan gate with it, and the resulting
    // bugs would look nothing like a clock problem.
    expect(devclock).not.toMatch(/Date\.now\s*=/);
    expect(devclock).not.toMatch(/window\.Date\s*=/);
    expect(devclock).not.toMatch(/performance\.now\s*=/);
    // now() must be derived from real time plus the offset, not frozen.
    expect(devclock).toContain("new Date(Date.now() + offsetMs)");
  });

  it("stores an offset in localStorage and nothing anywhere else", () => {
    expect(devclock).toContain('var KEY = "plantmoji_devclock_v1"');
    // Comments stripped first: the header PROMISES it never touches Supabase,
    // and matching that sentence would make this assertion pass for the wrong
    // reason (and fail the moment the promise is written down).
    const code = devclock.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/supabase|fetch\(|XMLHttpRequest|navigator\.send/i);
  });

  it("routes every live.js WIB readout through the override", () => {
    // wibNow is the single source for the sky, the sleep face, the Jember
    // clock and isNightWIB (which gates the camera_events fan-out). Feeding
    // the override in at this one point moves all of them together.
    expect(live).toContain("function clockNow()");
    expect(live).toContain("window.PMClock?.now() ?? new Date()");
    const wibNowAt = live.indexOf("function wibNow()");
    expect(wibNowAt).toBeGreaterThanOrEqual(0);
    const body = live.slice(wibNowAt, wibNowAt + 1_200);
    expect(body).toContain("const source = clockNow();");
    // Both the Intl path and the fixed UTC+7 fallback must read the shifted
    // instant — the fallback ran on Date.now() and would have quietly stayed
    // on real time in any browser without IANA data.
    expect(body).toContain("formatToParts(source)");
    expect(body).toContain("new Date(source.getTime() + 7 * 60 * 60_000)");
    expect(body).not.toContain("formatToParts(new Date())");
  });

  it("repaints the farm world when the override changes", () => {
    // Otherwise the sky and the sleep face sit on the old time until the next
    // 60s care tick, which reads as "the override did not work".
    expect(live).toContain("window.PMClock?.onChange(");
    const at = live.indexOf("window.PMClock?.onChange(");
    const handler = live.slice(at, at + 220);
    expect(handler).toContain("renderJemberClock()");
    expect(handler).toContain("updateCareUi()");
  });

  it("keeps motion-detect pure and injects the clock at the call site", () => {
    // motion-detect.ts is a zero-import, zero-DOM module by contract; reading
    // localStorage inside isGuardianSuspendedWIB would end that. It stays a
    // pure function of a Date and the guardian passes the shifted one in.
    expect(motion).not.toMatch(/localStorage|window\./);
    expect(motion).toContain("export function isGuardianSuspendedWIB(date: Date = new Date())");
    expect(guardian).toContain("const guardianAsleep = () => isGuardianSuspendedWIB(devNow());");
    // No call site may keep reading the real clock.
    expect(guardian).not.toMatch(/isGuardianSuspendedWIB\(\)/);
    // All five night gates: the sampling loop, camera start, the visibility
    // handler, the local-model interval and the periodic scan.
    expect(guardian.split("guardianAsleep()").length - 1).toBe(5);
  });

  it("leaves elapsed-time gates in the guardian on the real clock", () => {
    // The touch throttle and the scan gate are anti-abuse, not presentation.
    // A shifted clock must never be able to open them.
    expect(guardian).toContain("if (now - lastTouchPostRef.current < TOUCH_POST_GAP_MS) return;");
    expect(guardian).toContain("if (Date.now() - lastScanRef.current < SCAN_MIN_GAP_MS) return;");
    expect(guardian).not.toContain("devNow().getTime()");
  });

  it("falls back to real time whenever the script is absent", () => {
    // Server render, a stale cached shell, or a blocked script must all look
    // exactly like "no override" — never a crash and never a frozen clock.
    expect(clockLib).toContain('if (typeof window === "undefined") return new Date();');
    expect(clockLib).toContain("window.PMClock?.now() ?? new Date()");
  });

  it("shows the override on every page while it is on", () => {
    // An invisible time shift is a trap: you forget it, then read every later
    // "why is Jamkachu asleep?" as a bug — or present with it still on.
    expect(devclock).toContain('var BADGE_ID = "pm-devclock-badge"');
    expect(devclock).toContain("function mountBadge()");
    // Element only. cheat.js proved that a marker ATTRIBUTE on <body> from a
    // beforeInteractive script makes React report a hydration mismatch on
    // every navigation.
    expect(devclock).not.toMatch(/document\.body\.setAttribute/);
    expect(devclock).toContain("document.body.appendChild(badge)");
  });

  it("gives the panel a control that names its own blast radius", () => {
    expect(panel).toContain("<ClockSection />");
    expect(panel).toContain("this device only");
    // The two-device trap: the tablet posts, the desktop decides. Setting the
    // override on one of them alone still fails, and looks like a bug.
    expect(panel).toContain("both devices");
    // Single-line substring on purpose — this repo's sources are CRLF, so a
    // multi-line literal with bare \n silently matches nothing.
    expect(panel).toContain("NOT patch Date.now()");
  });

  it("moves the day/night SKIN with the override, not just the behaviour", () => {
    // Shipped broken once: the guardian and the farm shell ran on the shifted
    // clock while every React route painted a night sky from resolveTheme's
    // own separate clock read. The app disagreeing with itself reads as "the
    // override did nothing", which is worse than no override at all.
    expect(appearance).toContain("resolveTheme(theme, devNow())");
    expect(appearance).not.toMatch(/resolveTheme\(theme\)/);
    // The shell does not remount on client navigation, so a subscription —
    // not just the 60s tick — is what makes the sky follow immediately.
    expect(appearance).toContain("window.PMClock?.onChange(");
  });

  it("shifts plant-home's WIB clock without touching its quest timers", () => {
    // One nowMs feeds both. The countdown is elapsed time and must stay real;
    // only the wall-clock branch may move.
    expect(plantHome).toContain("const clockMs = nowMs === null ? null : nowMs + devClockOffsetMs();");
    expect(plantHome).toContain("setNowMs(Date.now())");
    expect(plantHome).not.toContain("setNowMs(devNow()");
    // The clock readout and the farmer's night flag both read the shifted
    // value; nothing else may.
    expect(plantHome.split("clockMs").length - 1).toBe(5);
  });
});

// The offset arithmetic is the one piece of this feature with real logic, and
// "the app thinks it is 21:00" is the whole point — so run the actual script
// instead of asserting on its text. The suite has no DOM (vitest environment
// is "node"), which is exactly the shape devclock.js must survive: `document`
// stays undeclared here, so every badge path has to no-op.

interface ClockApi {
  offsetMs: () => number;
  isActive: () => boolean;
  now: () => Date;
  wib: () => { date: string; hour: number; minute: number } | null;
  realWib: () => { date: string; hour: number; minute: number } | null;
  label: () => string;
  setWibTime: (hour: number, minute?: number) => void;
  setOffsetMs: (value: number) => void;
  clear: () => void;
}

/** Load devclock.js against a fresh fake window, returning its PMClock and
 *  the backing store so persistence can be inspected between loads. */
function loadClock(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  const win = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    setInterval: () => 0,
    CustomEvent: class {
      constructor(public type: string) {}
    },
  } as unknown as Window & typeof globalThis;
  const context = createContext({ window: win, Intl, Date, Math, JSON, isFinite, String, Number });
  runInContext(devclock, context);
  return { clock: (win as unknown as { PMClock: ClockApi }).PMClock, store };
}

const NIGHT_START = 18;
const NIGHT_END = 6;
const isNight = (hour: number) => hour >= NIGHT_START || hour < NIGHT_END;

describe("developer WIB clock behaviour", () => {
  it("is off until asked, and reads real time while off", () => {
    const { clock } = loadClock();
    expect(clock.isActive()).toBe(false);
    expect(clock.offsetMs()).toBe(0);
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1_000);
  });

  it("lands on the requested WIB hour whatever the real time is", () => {
    // Every hour of the day, because the wrap-around arithmetic is where this
    // would break: asking for 10:00 at 23:00 WIB must not travel backwards
    // 13 hours when 11 forwards gets there.
    for (let target = 0; target < 24; target += 1) {
      const { clock } = loadClock();
      clock.setWibTime(target, 30);
      const wib = clock.wib();
      expect(wib).not.toBeNull();
      expect(wib?.hour).toBe(target);
      expect(wib?.minute).toBe(30);
      // Never more than 12h either way — the least-surprising direction, and
      // what keeps the WIB calendar date within a day of the real one.
      expect(Math.abs(clock.offsetMs())).toBeLessThanOrEqual(12 * 3_600_000);
    }
  });

  it("puts the app on either side of the 18:00–06:00 guardian gate on demand", () => {
    // The reason the feature exists: from Korea, WIB night is the working day.
    const { clock } = loadClock();
    clock.setWibTime(21, 0);
    expect(isNight(clock.wib()!.hour)).toBe(true);
    clock.setWibTime(10, 0);
    expect(isNight(clock.wib()!.hour)).toBe(false);
  });

  it("keeps running at 1x rather than freezing", () => {
    const { clock } = loadClock();
    clock.setWibTime(10, 0);
    const first = clock.now().getTime();
    const drift = clock.now().getTime() - first;
    expect(drift).toBeGreaterThanOrEqual(0);
    // Offset is fixed, so the gap between two now() calls tracks real elapsed
    // time — a frozen clock would return the same instant forever.
    const offset = clock.offsetMs();
    expect(Math.abs(clock.now().getTime() - (Date.now() + offset))).toBeLessThan(1_000);
  });

  it("never moves Date.now out from under the app's cooldowns", () => {
    const before = Date.now;
    const { clock } = loadClock();
    clock.setWibTime(3, 0);
    expect(Date.now).toBe(before);
    expect(Math.abs(Date.now() - new Date().getTime())).toBeLessThan(1_000);
  });

  it("persists across a reload and clears back to real time", () => {
    const { clock, store } = loadClock();
    clock.setWibTime(21, 0);
    const saved = store.get("plantmoji_devclock_v1");
    expect(saved).toBeTruthy();

    const reloaded = loadClock(Object.fromEntries(store));
    expect(reloaded.clock.offsetMs()).toBe(clock.offsetMs());
    expect(isNight(reloaded.clock.wib()!.hour)).toBe(true);

    reloaded.clock.clear();
    expect(reloaded.clock.isActive()).toBe(false);
    // Cleared means REMOVED, not stored as 0 — a leftover key reads as "an
    // override is configured" to anyone inspecting the device later.
    expect(reloaded.store.has("plantmoji_devclock_v1")).toBe(false);
  });

  it("clamps a corrupted or absurd store instead of trusting it", () => {
    // A clock a year out would quietly poison every "today" the UI prints.
    const { clock } = loadClock({ "plantmoji_devclock_v1": JSON.stringify({ offsetMs: 9e12 }) });
    expect(Math.abs(clock.offsetMs())).toBeLessThanOrEqual(36 * 3_600_000);

    const garbage = loadClock({ "plantmoji_devclock_v1": "not json" });
    expect(garbage.clock.offsetMs()).toBe(0);

    const nan = loadClock({ "plantmoji_devclock_v1": JSON.stringify({ offsetMs: "abc" }) });
    expect(nan.clock.offsetMs()).toBe(0);
  });

  it("ignores nonsense times rather than shifting somewhere random", () => {
    const { clock } = loadClock();
    clock.setWibTime(Number.NaN);
    expect(clock.offsetMs()).toBe(0);
  });
});
