// PlantMoji presenter demo hotkeys + QA self-test overlay (dopamine plan,
// Task 21; spec §3 "Demo script" + §4.5).
//
// Plain synchronous script — NOT a module. SELF-GATED: unless the page URL
// carries a `?demo` query parameter this file does nothing at all, so it is
// safe to ship on every load. Crew-facing tooling → all copy is English.
//
// When active it provides:
//   1  → window.PMFx.lucky()      (lucky ×2 stamp FX)
//   2  → window.PMFx.levelUp()    (level-up overlay FX)
//   3  → window.PMFx.chapter()    (chapter-gate peak FX)
//   4  → window.PMFx.pod()        (reward-pod drop FX)
//   5  → cycle window.setMascotMood through the six moods
//   0  → QA self-test overlay (Esc closes)
// plus a small fixed "DEMO" tag bottom-left while the mode is active.
//
// Guardrails (spec §4.5): everything here is PRESENTATION TRIGGERING ONLY —
// zero Supabase writes, zero XP, zero localStorage writes, zero network.
// The real path for filming is the seeded DB; producers are told these keys
// only replay visuals. window.PMFx is exposed by live.js and is itself
// presentation-only ({ lucky(), levelUp(), chapter(), pod() }); this script
// codes defensively against that exact contract and shows a "FX hook not
// loaded" toast instead of throwing when a hook is missing (e.g. demo.js
// loaded on a page without live.js, or load order changed).

(() => {
  "use strict";
  if (window.__pmDemoLoaded) return; // double-load guard
  window.__pmDemoLoaded = true;

  // ── Self-gate: no-op unless ?demo is present ───────────────────────────
  let demoActive = false;
  try {
    demoActive = new URLSearchParams(location.search).has("demo");
  } catch {
    demoActive = false;
  }
  if (!demoActive) return;

  // Design tokens (spec §2.5) — inline on purpose: this script must style
  // itself without depending on the farm style.css.
  const FONT_PIXEL = "'Press Start 2P', monospace";
  const COLOR_DARK = "#243421";
  const COLOR_BORDER = "#BCD3B4";
  const COLOR_PRIMARY = "#5FAE45";

  const MOODS = ["Happy", "Overheating", "DryAir", "Sleepy", "SoilAcidic", "SoilAlkaline"];
  const FX_HOOKS = ["lucky", "levelUp", "chapter", "pod"];
  const RUN_ALL_STEP_MS = 1500;

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  // ── DEMO tag (bottom-left, always visible while active) ────────────────

  function injectDemoTag() {
    if (document.getElementById("pm-demo-tag")) return;
    const tag = document.createElement("div");
    tag.id = "pm-demo-tag";
    tag.textContent = window.PM_STRINGS?.demoTag || "DEMO";
    tag.setAttribute("aria-hidden", "true");
    const s = tag.style;
    s.position = "fixed";
    s.left = "12px";
    s.bottom = "12px";
    s.zIndex = "9998";
    s.fontFamily = FONT_PIXEL;
    s.fontSize = "10px";
    s.lineHeight = "1";
    s.letterSpacing = "1px";
    s.color = "#FFFFFF";
    s.background = COLOR_DARK;
    s.border = `2px solid ${COLOR_BORDER}`;
    s.borderRadius = "6px";
    s.boxShadow = "0 3px 0 rgba(36,52,33,.3)";
    s.padding = "6px 8px";
    s.pointerEvents = "none";
    s.imageRendering = "pixelated";
    document.body.appendChild(tag);
  }

  // ── Toast (missing hooks, mood cycling, run-all progress) ──────────────

  let toastEl = null;
  let toastTimer = null;

  function toast(message) {
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement("div");
      toastEl.id = "pm-demo-toast";
      toastEl.setAttribute("role", "status");
      const s = toastEl.style;
      s.position = "fixed";
      s.left = "12px";
      s.bottom = "44px"; // just above the DEMO tag
      s.zIndex = "9998";
      s.fontFamily = FONT_PIXEL;
      s.fontSize = "9px";
      s.lineHeight = "1.6";
      s.color = COLOR_DARK;
      s.background = "#FFFFFF";
      s.border = `2px solid ${COLOR_BORDER}`;
      s.borderRadius = "6px";
      s.boxShadow = "0 3px 0 rgba(36,52,33,.2)";
      s.padding = "6px 8px";
      s.maxWidth = "260px";
      s.pointerEvents = "none";
      if (!prefersReducedMotion()) s.transition = "opacity .2s linear";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.style.opacity = "1";
    toastTimer = setTimeout(() => {
      toastTimer = null;
      if (!toastEl) return;
      toastEl.style.opacity = "0";
      // Remove after the fade so stale toasts never linger in the DOM.
      setTimeout(() => {
        if (toastEl && toastEl.style.opacity === "0") {
          toastEl.remove();
          toastEl = null;
        }
      }, 250);
    }, 1600);
  }

  // ── Hotkey actions ─────────────────────────────────────────────────────

  /** Fire one PMFx presentation hook defensively; toast when unavailable. */
  function fireFx(name) {
    const hook = window.PMFx?.[name];
    if (typeof hook === "function") {
      try {
        hook();
      } catch {
        toast(`FX "${name}" threw — check console`);
      }
      return true;
    }
    toast("FX hook not loaded");
    return false;
  }

  let moodIndex = -1;
  function cycleMood() {
    if (typeof window.setMascotMood !== "function") {
      toast("FX hook not loaded");
      return;
    }
    moodIndex = (moodIndex + 1) % MOODS.length;
    const mood = MOODS[moodIndex];
    try {
      window.setMascotMood(mood);
      toast(`Mood → ${mood}`);
    } catch {
      toast(`Mood "${mood}" threw — check console`);
    }
  }

  // ── QA self-test overlay (key 0) ───────────────────────────────────────

  let overlayEl = null;
  const runAllTimers = [];

  function cancelRunAll() {
    while (runAllTimers.length) clearTimeout(runAllTimers.pop());
  }

  function closeOverlay() {
    cancelRunAll();
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
  }

  /** Count leaf entries (strings/functions) in the PM_STRINGS tree. */
  function countStringKeys(node) {
    if (typeof node === "string" || typeof node === "function") return 1;
    if (Array.isArray(node)) return node.reduce((sum, v) => sum + countStringKeys(v), 0);
    if (node && typeof node === "object") {
      return Object.values(node).reduce((sum, v) => sum + countStringKeys(v), 0);
    }
    return 0;
  }

  function overlayRow(label, value) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.gap = "16px";
    row.style.margin = "6px 0";
    const l = document.createElement("span");
    l.textContent = label;
    l.style.opacity = "0.75";
    const v = document.createElement("span");
    v.textContent = value;
    v.style.textAlign = "right";
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function buildOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "pm-demo-qa";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Demo QA self-test");
    const os = overlay.style;
    os.position = "fixed";
    os.inset = "0";
    os.zIndex = "10000";
    os.display = "flex";
    os.alignItems = "center";
    os.justifyContent = "center";
    os.background = "rgba(20, 28, 18, 0.72)";

    const panel = document.createElement("div");
    const ps = panel.style;
    ps.fontFamily = FONT_PIXEL;
    ps.fontSize = "10px";
    ps.lineHeight = "1.8";
    ps.color = "#E9F2E4";
    ps.background = "#1C2618"; // dark pixel panel
    ps.border = `3px solid ${COLOR_BORDER}`;
    ps.borderRadius = "10px";
    ps.boxShadow = "0 6px 0 rgba(0,0,0,.35)";
    ps.padding = "20px 22px";
    ps.minWidth = "300px";
    ps.maxWidth = "min(420px, calc(100vw - 32px))";
    ps.maxHeight = "calc(100vh - 32px)";
    ps.overflowY = "auto";
    ps.imageRendering = "pixelated";

    const title = document.createElement("div");
    title.textContent = "DEMO QA SELF-TEST";
    title.style.fontSize = "12px";
    title.style.color = "#A8DE8F";
    title.style.marginBottom = "12px";
    panel.appendChild(title);

    // Audio: engine present? muted? and an audible probe.
    const sfx = window.PMSfx;
    const sfxLoaded = !!sfx;
    let mutedText = "unknown";
    if (sfxLoaded) {
      try {
        mutedText = sfx.muted() ? "muted" : "on";
      } catch {
        mutedText = "unknown";
      }
    }
    let blipText = "unavailable";
    if (sfxLoaded && typeof sfx.play === "function") {
      try {
        sfx.play("blip"); // silent if muted/locked/rate-limited — by design
        blipText = "attempted";
      } catch {
        blipText = "threw";
      }
    }
    panel.appendChild(overlayRow("PMSfx engine", sfxLoaded ? "loaded" : "MISSING"));
    panel.appendChild(overlayRow("Sound pref", mutedText));
    panel.appendChild(overlayRow('Play "blip"', blipText));

    // Strings: page locale + leaf-key count of the table.
    const strings = window.PM_STRINGS;
    const locale = document.documentElement.lang || "unknown";
    panel.appendChild(overlayRow("Locale", locale));
    panel.appendChild(
      overlayRow("PM_STRINGS", strings ? `${countStringKeys(strings)} keys` : "MISSING"),
    );

    // PMFx presentation hooks, one row each.
    for (const name of FX_HOOKS) {
      const present = typeof window.PMFx?.[name] === "function";
      panel.appendChild(overlayRow(`PMFx.${name}`, present ? "yes" : "NO"));
    }

    // Environment flags.
    panel.appendChild(overlayRow("Reduced motion", prefersReducedMotion() ? "reduce" : "no-preference"));
    const supa = window.__pmSupabaseConfigured; // set by live.js; may be undefined
    panel.appendChild(
      overlayRow("Supabase", supa === true ? "configured" : supa === false ? "not configured" : "unknown"),
    );

    // "Run all FX" — closes the panel first so the FX are actually visible,
    // then fires each present hook sequentially, 1.5s apart.
    const runBtn = document.createElement("button");
    runBtn.type = "button";
    runBtn.textContent = "RUN ALL FX";
    const bs = runBtn.style;
    bs.display = "block";
    bs.width = "100%";
    bs.marginTop = "14px";
    bs.padding = "10px 12px";
    bs.fontFamily = FONT_PIXEL;
    bs.fontSize = "10px";
    bs.color = "#FFFFFF";
    bs.background = COLOR_PRIMARY;
    bs.border = `3px solid ${COLOR_BORDER}`;
    bs.borderRadius = "8px";
    bs.boxShadow = "0 4px 0 rgba(0,0,0,.3)";
    bs.cursor = "pointer";
    runBtn.addEventListener("click", () => {
      closeOverlay();
      FX_HOOKS.forEach((name, i) => {
        runAllTimers.push(
          setTimeout(() => {
            toast(`FX ${i + 1}/${FX_HOOKS.length}: ${name}`);
            fireFx(name);
          }, i * RUN_ALL_STEP_MS),
        );
      });
    });
    panel.appendChild(runBtn);

    const hint = document.createElement("div");
    hint.textContent = "Esc closes · presentation only — no data writes";
    hint.style.marginTop = "12px";
    hint.style.fontSize = "8px";
    hint.style.opacity = "0.6";
    panel.appendChild(hint);

    // Clicking the dim backdrop (not the panel) also closes.
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeOverlay();
    });

    overlay.appendChild(panel);
    return overlay;
  }

  function toggleOverlay() {
    if (overlayEl) {
      closeOverlay();
      return;
    }
    overlayEl = buildOverlay();
    document.body.appendChild(overlayEl);
  }

  // ── Keyboard wiring ────────────────────────────────────────────────────

  function isTypingTarget(target) {
    if (!target || typeof target !== "object") return false;
    const tag = (target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return !!target.isContentEditable;
  }

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (isTypingTarget(event.target)) return;
    switch (event.key) {
      case "1":
        fireFx("lucky");
        break;
      case "2":
        fireFx("levelUp");
        break;
      case "3":
        fireFx("chapter");
        break;
      case "4":
        fireFx("pod");
        break;
      case "5":
        cycleMood();
        break;
      case "0":
        toggleOverlay();
        break;
      case "Escape":
        if (overlayEl) closeOverlay();
        break;
      default:
        return;
    }
  });

  // ── Boot ───────────────────────────────────────────────────────────────

  if (document.body) injectDemoTag();
  else document.addEventListener("DOMContentLoaded", injectDemoTag, { once: true });
})();
