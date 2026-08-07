// PlantMoji live data binding for the team's pixel-farm page.
//
// The page markup/styles (index.html, style.css) are the designer's files,
// used AS-IS — this script only fills the existing elements with real data
// from Supabase (read-only publishable key + RLS) and keeps them fresh via
// Realtime with a polling fallback. No game logic lives here: the browser
// never decides XP, quests, or truth (handoff rules) — it only displays.

const PLANT_ID = "plant-01";

const MOODS = {
  Happy: { icon: "☀️", label: "Sunny & Optimal", bubble: "\"I'm feeling so healthy!<br>Thanks for the care.\"" },
  Overheating: { icon: "🔥", label: "Too Hot!", bubble: "\"It's too hot...<br>please cool me down!\"" },
  DryAir: { icon: "💨", label: "Dry Air", bubble: "\"The air feels so dry...<br>a little humidity please?\"" },
  Sleepy: { icon: "🌙", label: "Too Dark", bubble: "\"So dark... I'm getting sleepy.<br>More light please!\"" },
  SoilAcidic: { icon: "🧪", label: "Soil Too Acidic", bubble: "\"My soil feels sour...<br>can you check the pH?\"" },
  SoilAlkaline: { icon: "🧪", label: "Soil Too Alkaline", bubble: "\"My soil feels off...<br>can you check the pH?\"" },
};

// Quest catalog mirror (src/game/quests/quest-definitions.ts) — DISPLAY
// ONLY: titles/emoji/durations for rendering. The server owns quest truth;
// this page never decides completion, it only asks /api/game-tick to look.
const QUESTS = {
  KEEP_ME_HAPPY: { emoji: "🌱", title: "Keep Me Happy", kind: "maintain", requiredSeconds: 1800 },
  COOL_ME_DOWN: { emoji: "❄️", title: "Cool Me Down", kind: "recovery", requiredSeconds: 300 },
  GIVE_ME_MORE_LIGHT: { emoji: "☀️", title: "Give Me More Light", kind: "recovery", requiredSeconds: 300 },
  BALANCE_SOIL_ACIDIC: { emoji: "🧪", title: "Balance My Soil", kind: "recovery", requiredSeconds: 300 },
  BALANCE_SOIL_ALKALINE: { emoji: "🧪", title: "Balance My Soil", kind: "recovery", requiredSeconds: 300 },
};

// Cross-render state for the additions below (quest panel, level-up
// celebration, speech-bubble debounce).
let currentMood = null; // last seen plant.current_state
let lastBondLevel = null; // seeded on first bond render; increase ⇒ celebrate
let lastMoodFetched = null; // mood already sent to /api/mood-message
let refreshQuest = async () => {}; // assigned in main() once Supabase is up

const $ = (selector) => document.querySelector(selector);

function setText(selector, text) {
  const el = $(selector);
  if (el && text != null) el.textContent = text;
}

function renderPlant(plant) {
  if (!plant) return;
  currentMood = plant.current_state; // for the level-up "only when Happy" rule
  const mood = MOODS[plant.current_state] ?? MOODS.Happy;
  // DEV ADDITION (speech bubble — personality/AI voice): paint the local
  // template instantly, then ask /api/mood-message for the personalized line
  // (AI-flavored when a key is set, deterministic template otherwise). Both
  // run only when the mood actually CHANGED, so the 15 s poll never
  // re-fetches or stomps a displayed message. Fetch failure ⇒ template stays.
  if (plant.current_state !== lastMoodFetched) {
    const state = plant.current_state;
    lastMoodFetched = state;
    const bubble = $(".speech-bubble");
    if (bubble) bubble.innerHTML = mood.bubble;
    fetch(`/api/mood-message?plantId=${encodeURIComponent(PLANT_ID)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || typeof data.message !== "string") return;
        if (lastMoodFetched !== state) return; // mood moved on mid-flight
        const el = $(".speech-bubble");
        if (el) el.textContent = `"${data.message}"`;
      })
      .catch(() => {});
  }
  const icon = $(".weather-icon");
  if (icon) icon.textContent = mood.icon;
  setText(".weather-text .desc", mood.label);
  const nameEl = $(".username");
  if (nameEl && nameEl.dataset.level != null) {
    nameEl.textContent = `${plant.name} · Bond Lv.${nameEl.dataset.level}`;
  } else if (nameEl) {
    nameEl.textContent = plant.name;
  }
  // Health vital (3rd bar): honest proxy — Happy means in-range environment.
  const vitals = document.querySelectorAll(".vital-item");
  const health = vitals[2];
  if (health) {
    const pct = plant.current_state === "Happy" ? 98 : 45;
    const fill = health.querySelector(".fill");
    if (fill) fill.style.width = `${pct}%`;
    const perc = health.querySelector(".v-perc");
    if (perc) perc.textContent = `${pct}%`;
  }
}

function renderBond(bond, plantName) {
  if (!bond) return;
  // DEV ADDITION (level-up celebration): celebrate a bond level increase —
  // but urgent states outrank celebration (plant-home.tsx applyBond, handoff
  // Phase 9), so only when the plant is currently Happy. First render only
  // seeds the baseline.
  if (lastBondLevel != null && bond.bond_level > lastBondLevel && currentMood === "Happy") {
    showLevelUp(bond.bond_level);
  }
  lastBondLevel = bond.bond_level;
  const nameEl = $(".username");
  if (nameEl) {
    nameEl.dataset.level = String(bond.bond_level);
    if (plantName) nameEl.textContent = `${plantName} · Bond Lv.${bond.bond_level}`;
  }
  const bar = $(".xp-bar");
  if (bar) bar.style.width = `${bond.total_xp % 100}%`;
  const coin = $(".badge.coin");
  if (coin) coin.innerHTML = `<i class="icon">⭐</i> ${bond.total_xp} XP`;
  const streak = $(".badge.streak");
  if (streak) {
    streak.innerHTML = `<i class="icon">🔥</i> ${bond.current_streak} Days`;
    streak.style.display = bond.current_streak > 0 ? "" : "none";
  }
}

function renderSensors(reading) {
  const vitals = document.querySelectorAll(".vital-item");
  if (reading?.temperature != null) {
    setText(".weather-text .temp", `${Number(reading.temperature).toFixed(1)}°C`);
  }
  const humidityRow = vitals[0];
  if (humidityRow && reading?.humidity != null) {
    const pct = Math.max(0, Math.min(100, Math.round(reading.humidity)));
    const fill = humidityRow.querySelector(".fill");
    if (fill) fill.style.width = `${pct}%`;
    const perc = humidityRow.querySelector(".v-perc");
    if (perc) perc.textContent = `${pct}%`;
  }
  const lightRow = vitals[1];
  if (lightRow && reading?.light != null) {
    const pct = Number(reading.light) === 1 ? 85 : 15;
    const fill = lightRow.querySelector(".fill");
    if (fill) fill.style.width = `${pct}%`;
    const perc = lightRow.querySelector(".v-perc");
    if (perc) perc.textContent = `${pct}%`;
  }
}

// ── DEV ADDITION: quest panel (#quest-panel in index.html) ──────────────
// Mirrors plant-home.tsx questCardProps: VERIFYING shows a ticking M:SS
// countdown, ACTIVE maintain shows elapsed minutes, ACTIVE recovery waits.
// When the countdown hits 0 we nudge /api/game-tick once (guard flag) so
// the server can land the completion, then re-query shortly after.

let questTickId = null; // 1 s repaint while a countdown/elapsed label is live
let questTickRequestedFor = null; // quest id already game-ticked at 0:00

function questDef(quest) {
  return (
    QUESTS[quest.quest_key] ?? {
      emoji: "📜",
      title: quest.quest_key,
      kind: "recovery",
      requiredSeconds: 300,
    }
  );
}

function paintQuest(quest) {
  const titleEl = $("#quest-panel .quest-title");
  const progressEl = $("#quest-panel .quest-progress");
  if (!titleEl || !progressEl) return;
  if (!quest) {
    titleEl.textContent = "No active quest — keep caring 🌿";
    progressEl.textContent = "";
    return;
  }
  const def = questDef(quest);
  titleEl.textContent = `${def.emoji} ${def.title}`;
  if (quest.status === "VERIFYING" && quest.verifying_since) {
    const doneAt = Date.parse(quest.verifying_since) + def.requiredSeconds * 1000;
    const left = Math.max(0, Math.ceil((doneAt - Date.now()) / 1000));
    progressEl.textContent = `Verifying… ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left`;
    if (left <= 0 && questTickRequestedFor !== quest.id) {
      questTickRequestedFor = quest.id;
      fetch("/api/game-tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId: PLANT_ID }),
      }).catch(() => {});
      setTimeout(() => refreshQuest(), 2000);
    }
  } else if (quest.status === "ACTIVE" && def.kind === "maintain") {
    const totalMin = Math.round(def.requiredSeconds / 60);
    const elapsedMin = Math.max(0, Math.floor((Date.now() - Date.parse(quest.started_at)) / 60000));
    progressEl.textContent = `${Math.min(elapsedMin, totalMin)} / ${totalMin} min`;
  } else {
    progressEl.textContent = "Waiting for recovery…";
  }
}

function renderQuest(quest) {
  if (questTickId) {
    clearInterval(questTickId);
    questTickId = null;
  }
  paintQuest(quest);
  if (!quest) return;
  const needsTicking =
    (quest.status === "VERIFYING" && quest.verifying_since) ||
    (quest.status === "ACTIVE" && questDef(quest).kind === "maintain");
  if (needsTicking) questTickId = setInterval(() => paintQuest(quest), 1000);
}

// ── DEV ADDITION: level-up celebration overlay ──────────────────────────
// Created once from JS and appended to <body> so index.html stays clean;
// styled by the injected <style> block below (Press Start 2P is already
// loaded by the page). Auto-hides after 2.5 s; click dismisses.

let levelUpHideId = null;

function ensureLevelUpOverlay() {
  let overlay = document.getElementById("levelup-overlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "levelup-overlay";
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="levelup-box"><div class="levelup-title">✨ LEVEL UP</div><div class="levelup-level"></div></div>';
  overlay.addEventListener("click", () => {
    overlay.hidden = true;
    if (levelUpHideId) clearTimeout(levelUpHideId);
  });
  if (document.body) document.body.appendChild(overlay);
  return overlay;
}

function showLevelUp(level) {
  const overlay = ensureLevelUpOverlay();
  const levelEl = overlay.querySelector(".levelup-level");
  if (levelEl) levelEl.textContent = `Bond Lv.${level}`;
  const box = overlay.querySelector(".levelup-box");
  if (box) {
    // Restart the pop animation on repeat celebrations.
    box.style.animation = "none";
    void box.offsetWidth;
    box.style.animation = "";
  }
  overlay.hidden = false;
  if (levelUpHideId) clearTimeout(levelUpHideId);
  levelUpHideId = setTimeout(() => {
    overlay.hidden = true;
  }, 2500);
}

// ── DEV ADDITION: injected styles ───────────────────────────────────────
// style.css belongs to the designer, so the few rules the new elements need
// live here (reusing the designer's CSS variables). Designer: feel free to
// move these into style.css, restyle, and delete this block.

function injectLiveStyles() {
  if (document.getElementById("live-js-styles")) return;
  const style = document.createElement("style");
  style.id = "live-js-styles";
  style.textContent = `
    /* Quest panel — typography mirrors .mini-sensors so it looks native. */
    .quest-panel { width: 300px; max-width: 100%; display: flex; flex-direction: column; gap: 10px; }
    .quest-panel h3 { font-family: var(--font-heading); font-size: 12px; border-bottom: 2px solid rgba(43, 58, 39, 0.1); padding-bottom: 12px; display: flex; align-items: center; gap: 10px; }
    .quest-panel h3 .icon { font-style: normal; font-size: 18px; }
    .quest-panel .quest-title { font-family: var(--font-heading); font-size: 11px; line-height: 1.6; }
    .quest-panel .quest-progress { font-family: var(--font-body); font-size: 20px; color: #444; min-height: 22px; }

    /* Level-up overlay */
    #levelup-overlay { position: fixed; inset: 0; z-index: 999; display: flex; align-items: center; justify-content: center; background: rgba(43, 58, 39, 0.45); backdrop-filter: blur(4px); cursor: pointer; }
    #levelup-overlay[hidden] { display: none; }
    .levelup-box { display: flex; flex-direction: column; align-items: center; gap: 20px; animation: levelupPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .levelup-title { font-family: var(--font-heading); font-size: 32px; color: var(--color-yellow); text-shadow: 4px 4px 0 var(--color-outline); }
    .levelup-level { font-family: var(--font-heading); font-size: 16px; color: var(--color-white); text-shadow: 3px 3px 0 var(--color-outline); }
    @keyframes levelupPop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  `;
  document.head.appendChild(style);
}

async function main() {
  injectLiveStyles();
  let config;
  try {
    config = await (await fetch("/api/public-config")).json();
  } catch {
    return;
  }
  if (!config?.url || !config?.key) {
    setText(".weather-text .desc", "Supabase not configured");
    return;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(config.url, config.key);

  let plantName = null;

  // DEV ADDITION (quest panel): top live quest, exactly plant-home.tsx's
  // query — "VERIFYING" > "ACTIVE" lexicographically, so an in-verification
  // quest (the demo's countdown beat) always wins the panel. Only an
  // error-free response is trusted: a transient failure (or missing table —
  // migrations not run) must never blank or break the panel.
  refreshQuest = async () => {
    const { data, error } = await supabase
      .from("quests")
      .select("*")
      .eq("plant_id", PLANT_ID)
      .in("status", ["ACTIVE", "VERIFYING"])
      .order("status", { ascending: false })
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error) renderQuest(data ?? null);
  };

  const refresh = async () => {
    const [plantRes, bondRes, sensorRes] = await Promise.all([
      supabase.from("plants").select("*").eq("id", PLANT_ID).maybeSingle(),
      supabase.from("bond_state").select("*").eq("plant_id", PLANT_ID).maybeSingle(),
      supabase
        .from("sensor_readings")
        .select("temperature, humidity, light, soil_ph, recorded_at")
        .eq("plant_id", PLANT_ID)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (bondRes.data) renderBond(bondRes.data, plantName ?? plantRes.data?.name);
    if (plantRes.data) {
      plantName = plantRes.data.name;
      renderPlant(plantRes.data);
    }
    if (sensorRes.data) renderSensors(sensorRes.data);
    refreshQuest(); // DEV ADDITION: quest panel rides the same poll cycle
  };

  await refresh();

  supabase
    .channel(`farm-${PLANT_ID}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "plants", filter: `id=eq.${PLANT_ID}` },
      (payload) => {
        plantName = payload.new?.name ?? plantName;
        renderPlant(payload.new);
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "bond_state", filter: `plant_id=eq.${PLANT_ID}` },
      (payload) => renderBond(payload.new, plantName),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "quests", filter: `plant_id=eq.${PLANT_ID}` },
      // DEV ADDITION (quest panel): quest rows change shape as they move
      // through their lifecycle — re-pull the top quest, don't merge deltas.
      () => refreshQuest(),
    )
    .subscribe();

  // Polling fallback + sensor refresh (sensor_readings has no realtime).
  setInterval(refresh, 15_000);

  // Lazy game tick so time-window quests complete while parked on this page.
  setInterval(() => {
    fetch("/api/game-tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId: PLANT_ID }),
    }).catch(() => {});
  }, 60_000);
}

main();
