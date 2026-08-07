// PlantMoji live data binding for the team's pixel-farm page.
//
// The page markup/styles (index.html, style.css) are the designer's files,
// used AS-IS — this script only fills the existing elements with real data
// from Supabase (read-only publishable key + RLS) and keeps them fresh via
// Realtime with a polling fallback. No game logic lives here: the browser
// never decides XP or truth (handoff rules) — it only displays.

const PLANT_ID = "plant-01";

const MOODS = {
  Happy: { icon: "☀️", label: "Sunny & Optimal", bubble: "\"I'm feeling so healthy!<br>Thanks for the care.\"" },
  Overheating: { icon: "🔥", label: "Too Hot!", bubble: "\"It's too hot...<br>please cool me down!\"" },
  DryAir: { icon: "💨", label: "Dry Air", bubble: "\"The air feels so dry...<br>a little humidity please?\"" },
  Sleepy: { icon: "🌙", label: "Too Dark", bubble: "\"So dark... I'm getting sleepy.<br>More light please!\"" },
  SoilAcidic: { icon: "🧪", label: "Soil Too Acidic", bubble: "\"My soil feels sour...<br>can you check the pH?\"" },
  SoilAlkaline: { icon: "🧪", label: "Soil Too Alkaline", bubble: "\"My soil feels off...<br>can you check the pH?\"" },
};

// Cross-render state for speech-bubble request de-duplication.
let lastMoodFetched = null; // mood already sent to /api/mood-message

const $ = (selector) => document.querySelector(selector);

function setText(selector, text) {
  const el = $(selector);
  if (el && text != null) el.textContent = text;
}

function renderPlant(plant) {
  if (!plant) return;
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

async function main() {
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
