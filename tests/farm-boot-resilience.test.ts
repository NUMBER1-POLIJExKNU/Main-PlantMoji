import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Connection speed/stability fixes for flaky school networks (farm-layer
// boot path). public/farm/live.js and public/farm/index.html are plain
// browser scripts/markup (document/window/fetch globals, no exports) so
// they can't be imported and exercised in Node — these are source-contract
// assertions on the raw text, the same pattern tests/farm-offline-home.test.ts
// and tests/cheat-sandbox-wiring.test.ts use.
//
// What was broken before this fix: a network STALL (never resolves, never
// rejects — not a clean fetch failure, which was already caught) on the
// config fetch or the first Supabase round-trip could hang main() forever,
// so renderOfflineHome() never ran and the page sat on its static "--"
// markup indefinitely. These tests pin the timeout/retry/guard code that
// closes that gap, plus the index.html load-order changes that get the
// config fetch and the Supabase connection started sooner.

const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");

/** Slices out a function's full body by matching brace depth from its
 *  signature, so line-count drift elsewhere in the file can never truncate
 *  an assertion (same technique as farm-offline-home.test.ts's
 *  offlineHomeBody()). Works for both `function x() {` and
 *  `const x = async () => {` style signatures — either way the first `{`
 *  after the signature opens the body. */
function functionBody(signature: string): string {
  const start = live.indexOf(signature);
  expect(start, `expected to find: ${signature}`).toBeGreaterThanOrEqual(0);
  const openBrace = live.indexOf("{", start);
  let depth = 0;
  for (let i = openBrace; i < live.length; i++) {
    if (live[i] === "{") depth++;
    else if (live[i] === "}") {
      depth--;
      if (depth === 0) return live.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces while scanning: ${signature}`);
}

function mainBody(): string {
  return functionBody("async function main() {");
}

describe("boot config fetch: timeout + retry (no unhandled network stall)", () => {
  it("caps the config fetch and backs off across up to two retries", () => {
    expect(live).toContain("const CONFIG_FETCH_TIMEOUT_MS = 6_000;");
    expect(live).toContain("const CONFIG_RETRY_DELAYS_MS = [750, 1_500];");
  });

  it("fetchPublicConfig() reuses the <head> preconnect script's in-flight promise, racing it against the same timeout", () => {
    const body = functionBody("async function fetchPublicConfig() {");
    expect(body).toContain("attempt === 0 && window.__pmConfigPromise");
    expect(body).toContain("withTimeout(window.__pmConfigPromise, CONFIG_FETCH_TIMEOUT_MS)");
  });

  it("every retry after the first fetches directly with an AbortSignal timeout", () => {
    const body = functionBody("async function fetchPublicConfig() {");
    expect(body).toContain('fetch("/api/public-config", { signal: AbortSignal.timeout(CONFIG_FETCH_TIMEOUT_MS) })');
    expect(body).toMatch(/for \(let attempt = 0; attempt < 1 \+ CONFIG_RETRY_DELAYS_MS\.length; attempt\+\+\)/);
  });

  it("exhausting every retry still throws so main()'s existing offline path takes over unchanged", () => {
    const body = functionBody("async function fetchPublicConfig() {");
    expect(body).toContain("throw lastError;");
    // main() must still call the SAME renderOfflineHome + scheduleHatch(null)
    // flow tests/farm-offline-home.test.ts pins — this fix must not touch it.
    expect(mainBody()).toMatch(
      /config = await fetchPublicConfig\(\);\s*\n\s*\} catch \{[^]*?renderOfflineHome\(\);[^]*?scheduleHatch\(null\);/,
    );
  });
});

describe("Supabase client requests: hard timeout on every query and realtime handshake", () => {
  it("defines a 10s timeout wrapped around the client's fetch implementation", () => {
    expect(live).toContain("const SUPABASE_FETCH_TIMEOUT_MS = 10_000;");
    expect(live).toMatch(
      /global: \{\s*fetch: \(input, init\) => fetch\(input, \{ \.\.\.init, signal: AbortSignal\.timeout\(SUPABASE_FETCH_TIMEOUT_MS\) \}\),/,
    );
  });

  it("passes that option to BOTH createClient call sites (vendored bundle and the CDN fallback)", () => {
    const body = functionBody("async function loadSupabaseClient(url, key) {");
    expect(body).toContain("window.supabase.createClient(url, key, supabaseClientOptions)");
    expect(body).toContain("createClient(url, key, supabaseClientOptions)");
  });
});

describe("first refresh(): one retry on a stall/throw before main().catch takes over", () => {
  it("waits 2s and retries exactly once", () => {
    expect(live).toContain("const FIRST_REFRESH_RETRY_DELAY_MS = 2_000;");
    expect(mainBody()).toMatch(
      /try \{\s*\n\s*await refresh\(\);\s*\n\s*\} catch \{[^]*?setTimeout\(resolve, FIRST_REFRESH_RETRY_DELAY_MS\)\)[^]*?await refresh\(\);\s*\n\s*\}\s*\n\s*firstOnlinePaint = true;/,
    );
  });

  it("a second failure is left to propagate to main().catch, not swallowed here", () => {
    // No inner try/catch around the retry's `await refresh();` — if it
    // throws again it must escape this block entirely.
    const body = mainBody();
    const match = /try \{\s*await refresh\(\);\s*\} catch \{([^]*?)\}\s*firstOnlinePaint/.exec(body);
    expect(match, "expected the try/catch wrapping the first refresh()").not.toBeNull();
    expect(match![1]).not.toContain("try {");
  });
});

describe("15s poll: in-flight guard skips an overlapping tick", () => {
  it("refresh() bails out while a previous call hasn't settled, and always clears the flag", () => {
    const body = functionBody("const refresh = async () => {");
    expect(body).toMatch(/if \(refreshInFlight\) return;/);
    expect(body).toMatch(/refreshInFlight = true;/);
    expect(body).toMatch(/finally \{\s*\n\s*refreshInFlight = false;\s*\n\s*\}/);
  });

  it("records the last successful refresh time for the visibility catch-up to read", () => {
    const body = functionBody("const refresh = async () => {");
    expect(body).toContain("lastRefreshAt = Date.now();");
  });
});

describe("realtime reconnect: one refresh to close the gap, but never on the first connect", () => {
  it("the main channel's .subscribe() carries a status callback", () => {
    expect(mainBody()).toMatch(/\.subscribe\(\(status\) => \{/);
  });

  it("only refreshes on SUBSCRIBED after a prior connect, tracked by realtimeEverSubscribed", () => {
    const body = mainBody();
    expect(body).toMatch(
      /\.subscribe\(\(status\) => \{[^]*?if \(status === "SUBSCRIBED"\) \{[^]*?if \(realtimeEverSubscribed\) refresh\(\);[^]*?realtimeEverSubscribed = true;[^]*?\}[^]*?\}\);/,
    );
  });

  it("realtimeEverSubscribed starts false so the very first SUBSCRIBED after boot does not double-refresh", () => {
    expect(live).toContain("let realtimeEverSubscribed = false;");
  });
});

describe("visibilitychange: catch up immediately on a stale return to the tab", () => {
  it("only refreshes when visible again AND the last refresh is older than 20s", () => {
    expect(live).toContain("const VISIBILITY_STALE_REFRESH_MS = 20_000;");
    expect(mainBody()).toMatch(
      /document\.addEventListener\("visibilitychange", \(\) => \{\s*\n\s*if \(document\.visibilityState === "visible" && Date\.now\(\) - lastRefreshAt > VISIBILITY_STALE_REFRESH_MS\) \{\s*\n\s*refresh\(\);/,
    );
  });
});

describe("index.html: config fetch starts before the render-blocking stylesheets parse", () => {
  it("an inline <head> script starts fetch(\"/api/public-config\") before the first <link rel=\"stylesheet\">", () => {
    const headAt = html.indexOf("<head>");
    const configFetchAt = html.indexOf('window.__pmConfigPromise = fetch("/api/public-config")');
    const firstStylesheetAt = html.indexOf('<link rel="stylesheet"');
    expect(headAt).toBeGreaterThanOrEqual(0);
    expect(configFetchAt).toBeGreaterThan(headAt);
    expect(firstStylesheetAt).toBeGreaterThan(configFetchAt);
  });

  it("stores the promise on window.__pmConfigPromise, which live.js's fetchPublicConfig() consumes", () => {
    expect(html).toContain("window.__pmConfigPromise = fetch(");
    expect(live).toContain("window.__pmConfigPromise");
  });

  it("clones the response before reading it, so live.js can still read the original body", () => {
    expect(html).toContain("response.clone().json()");
  });

  it("injects a preconnect + dns-prefetch hint to the Supabase origin once config resolves", () => {
    expect(html).toContain("new URL(config.url).origin");
    expect(html).toContain('preconnect.rel = "preconnect"');
    expect(html).toContain("preconnect.crossOrigin");
    expect(html).toContain('dnsPrefetch.rel = "dns-prefetch"');
  });

  it("never throws out of the inline script if fetch/URL is unavailable", () => {
    const scriptStart = html.indexOf('window.__pmConfigPromise = fetch("/api/public-config")');
    const wrappingTryAt = html.lastIndexOf("try {", scriptStart);
    expect(wrappingTryAt).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("</script>", scriptStart) - wrappingTryAt).toBeLessThan(2000); // stays in the same small script block
  });
});

describe("index.html: classic scripts fetch in parallel via defer, order preserved", () => {
  const DEFERRED_SRCS = [
    "/farm/cheat.js",
    "/farm/strings.js",
    "/farm/seen.js",
    "/farm/companion-ladder.js",
    "/farm/companion-skins.js",
    "/farm/sfx.js",
    "/farm/quiz.js",
    "/farm/vendor/supabase.js",
  ];

  it.each(DEFERRED_SRCS)("%s carries the defer attribute", (src) => {
    expect(html).toContain(`<script defer src="${src}"></script>`);
  });

  it("keeps all 8 in their original relative document order, still before the live.js module", () => {
    let lastIndex = -1;
    for (const src of DEFERRED_SRCS) {
      const at = html.indexOf(`<script defer src="${src}"></script>`);
      expect(at, `${src} out of order`).toBeGreaterThan(lastIndex);
      lastIndex = at;
    }
    const liveTag = html.indexOf('<script type="module" src="/farm/live.js"></script>');
    expect(liveTag).toBeGreaterThan(lastIndex);
  });

  it("does not add a redundant/conflicting defer to the live.js module tag", () => {
    expect(html).not.toContain('<script type="module" defer');
    expect(html).not.toContain('<script defer type="module"');
  });
});

describe("index.html: sidebar title art reserves its CSS box to avoid layout shift", () => {
  // Both halves of the designer title need width/height, and the heights must
  // follow each source's real aspect ratio — the pot is 434x564, so the 44x44
  // the old square logo used would reserve too short a box and shift the nav
  // down on first paint.
  it("the brand images carry width/height matching their CSS boxes", () => {
    expect(html).toContain('<img src="/farm/assets/title-pot.png" alt="" class="logo-img" width="44" height="57">');
    expect(html).toContain('<img src="/farm/assets/title-letter.png" alt="PLANT MOJI" class="brand-wordmark" width="96" height="55">');
  });
});
