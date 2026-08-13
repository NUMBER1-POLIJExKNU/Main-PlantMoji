(function () {
  "use strict";

  if (window.PMBackgroundMusic) return;

  var STORAGE_KEY = "pm_background_music";
  var STATE_KEY = "pm_background_music_state";
  var BUTTON_ID = "pm-background-music-toggle";
  var STYLE_ID = "pm-background-music-style";
  var PLAYLIST = ["/audio/1.mp3", "/audio/2.mp3", "/audio/3.mp3"];
  var audio = null;
  var enabled = true;
  var unlocked = false;
  var lastSaveAt = 0;

  function readPreference() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== "off";
    } catch (_error) {
      return true;
    }
  }

  function writePreference(nextEnabled) {
    try {
      window.localStorage.setItem(STORAGE_KEY, nextEnabled ? "on" : "off");
    } catch (_error) {
      // localStorage can be blocked in private or embedded contexts.
    }
  }

  function readState() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(STATE_KEY) || "{}");
      var index = Number(parsed.index);
      var currentTime = Number(parsed.currentTime);
      return {
        index: Number.isFinite(index) && index >= 0 ? index % PLAYLIST.length : 0,
        currentTime: Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0,
      };
    } catch (_error) {
      return { index: 0, currentTime: 0 };
    }
  }

  function saveState(force) {
    if (!audio) return;
    var now = Date.now();
    if (!force && now - lastSaveAt < 900) return;
    lastSaveAt = now;
    try {
      window.localStorage.setItem(
        STATE_KEY,
        JSON.stringify({
          index: Number(audio.dataset.index || "0") || 0,
          currentTime: audio.currentTime || 0,
        }),
      );
    } catch (_error) {
      // Best-effort continuity only.
    }
  }

  function updateButton() {
    var button = document.getElementById(BUTTON_ID);
    if (!button) return;
    button.classList.toggle("is-on", enabled);
    button.classList.toggle("is-off", !enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("aria-label", enabled ? "Matikan musik latar" : "Nyalakan musik latar");
    button.title = enabled ? "Music on" : "Music off";
  }

  function applyTrack(index, currentTime) {
    if (!audio) return;
    var safeIndex = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    var source = PLAYLIST[safeIndex];
    audio.dataset.index = String(safeIndex);
    if (audio.getAttribute("src") !== source) {
      audio.src = source;
      audio.load();
    }
    if (currentTime > 0) {
      var restoreTime = function () {
        if (!audio) return;
        try {
          audio.currentTime = Math.max(0, Math.min(currentTime, audio.duration || currentTime));
        } catch (_error) {
          // Some browsers reject seeking before metadata is ready.
        }
      };
      if (audio.readyState >= 1) restoreTime();
      else audio.addEventListener("loadedmetadata", restoreTime, { once: true });
    }
  }

  function advanceToNextTrack() {
    if (!audio) return;
    var currentIndex = Number(audio.dataset.index || "0") || 0;
    applyTrack(currentIndex + 1, 0);
    saveState(true);
    void play();
  }

  async function play() {
    if (!audio || !enabled) return false;
    try {
      await audio.play();
      unlocked = true;
      return true;
    } catch (_error) {
      return false;
    }
  }

  function pause() {
    if (!audio) return;
    audio.pause();
    saveState(true);
  }

  function toggle() {
    enabled = !enabled;
    writePreference(enabled);
    updateButton();
    if (enabled) void play();
    else pause();
    return enabled;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#" + BUTTON_ID + "{position:fixed;top:12px;right:12px;z-index:12000;display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;padding:0;border:3px solid var(--color-border,#2f3f2a);border-radius:10px;background:color-mix(in srgb,var(--color-surface,#fff8dc) 96%,white 4%);box-shadow:0 4px 0 rgba(36,52,33,.28);cursor:pointer;transition:transform .15s ease,opacity .15s ease,filter .15s ease;}",
      "#" + BUTTON_ID + ":active{transform:translateY(1px);}",
      "#" + BUTTON_ID + ":focus-visible{outline:3px solid var(--color-water,#5fb9d6);outline-offset:2px;}",
      "#" + BUTTON_ID + " img{display:block;width:32px;height:32px;object-fit:contain;image-rendering:auto;pointer-events:none;user-select:none;}",
      "#" + BUTTON_ID + ".is-off{opacity:.55;filter:grayscale(1);}",
      "#" + BUTTON_ID + ".is-off::after{content:\"\";position:absolute;width:34px;height:4px;border-radius:999px;background:#d84343;box-shadow:0 1px 0 rgba(255,255,255,.65);transform:rotate(-38deg);}",
      "@media (max-width:800px){#" + BUTTON_ID + "{top:calc(10px + env(safe-area-inset-top));right:10px;width:44px;height:44px;}#" + BUTTON_ID + " img{width:29px;height:29px;}}",
    ].join("");
    document.head.appendChild(style);
  }

  function injectButton() {
    if (!document.body) return;
    ensureStyles();
    var existing = document.getElementById(BUTTON_ID);
    if (existing) {
      updateButton();
      return;
    }
    var button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "reno-music-toggle";
    button.innerHTML = '<img src="/audio/music-logo.png" alt="" width="32" height="32" draggable="false">';
    button.addEventListener("click", function () {
      toggle();
    });
    document.body.appendChild(button);
    updateButton();
  }

  function onInteractionUnlock() {
    if (!enabled || unlocked) return;
    void play();
  }

  function ensureAudio() {
    if (audio) return audio;
    enabled = readPreference();
    var state = readState();
    audio = new Audio();
    audio.volume = 0.45;
    audio.preload = "auto";
    audio.loop = false;
    audio.autoplay = true;
    audio.addEventListener("ended", advanceToNextTrack);
    audio.addEventListener("error", advanceToNextTrack);
    audio.addEventListener("timeupdate", function () {
      saveState(false);
    });
    applyTrack(state.index, state.currentTime);
    return audio;
  }

  function boot() {
    ensureAudio();
    injectButton();
    if (enabled) void play();
  }

  window.addEventListener("pointerdown", onInteractionUnlock, { capture: true });
  window.addEventListener("keydown", onInteractionUnlock, { capture: true });
  window.addEventListener("touchstart", onInteractionUnlock, { capture: true });
  window.addEventListener("pagehide", function () {
    saveState(true);
  });
  window.addEventListener("beforeunload", function () {
    saveState(true);
  });
  window.addEventListener("storage", function (event) {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    enabled = readPreference();
    updateButton();
    if (enabled) void play();
    else pause();
  });

  window.PMBackgroundMusic = {
    play: play,
    pause: pause,
    toggle: toggle,
    isEnabled: function () {
      return enabled;
    },
  };

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
