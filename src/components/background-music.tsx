"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "pm_background_music";
const PLAYLIST = ["/audio/1.mp3", "/audio/2.mp3", "/audio/3.mp3"];

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      setIsEnabled(stored !== "off");
    } catch {
      setIsEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, isEnabled ? "on" : "off");
    } catch {
      // Ignore storage errors in private browsing or restricted environments.
    }
  }, [hasHydrated, isEnabled]);

  const playCurrentTrack = async () => {
    const audio = audioRef.current;
    if (!audio || !isEnabled) return;

    const index = Number(audio.dataset.index ?? "0");
    const nextSource = PLAYLIST[index % PLAYLIST.length];

    if (audio.src !== window.location.origin + nextSource) {
      audio.src = nextSource;
      audio.load();
    }

    try {
      audio.autoplay = true;
      await audio.play();
    } catch {
      // Browser autoplay is still blocked until the first real interaction.
      // We retry on the next click or keyboard action below.
    }
  };

  const advanceToNextTrack = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentIndex = Number(audio.dataset.index ?? "0");
    const nextIndex = (currentIndex + 1) % PLAYLIST.length;
    audio.dataset.index = String(nextIndex);
    audio.src = PLAYLIST[nextIndex];
    audio.load();
    void playCurrentTrack();
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audio.volume = 0.45;
    audio.preload = "auto";
    audio.loop = false;
    audio.autoplay = true;
    audio.dataset.index = "0";
    audio.src = PLAYLIST[0];
    audioRef.current = audio;

    const onEnded = () => {
      if (!isEnabled) return;
      advanceToNextTrack();
    };

    const onError = () => {
      if (!isEnabled) return;
      advanceToNextTrack();
    };

    const onInteractionUnlock = () => {
      if (!isEnabled) return;
      void playCurrentTrack();
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    window.addEventListener("pointerdown", onInteractionUnlock, { capture: true });
    window.addEventListener("keydown", onInteractionUnlock, { capture: true });
    window.addEventListener("touchstart", onInteractionUnlock, { capture: true });

    if (isEnabled) {
      void playCurrentTrack();
    }

    return () => {
      audio.pause();
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      window.removeEventListener("pointerdown", onInteractionUnlock, { capture: true });
      window.removeEventListener("keydown", onInteractionUnlock, { capture: true });
      window.removeEventListener("touchstart", onInteractionUnlock, { capture: true });
    };
  }, [isEnabled]);

  const toggleMusic = async () => {
    const nextState = !isEnabled;
    setIsEnabled(nextState);

    const audio = audioRef.current;
    if (!audio) return;

    if (!nextState) {
      audio.pause();
      return;
    }

    audio.dataset.index = "0";
    audio.src = PLAYLIST[0];
    audio.load();
    await playCurrentTrack();
  };

  return (
    <button
      type="button"
      className={`reno-music-toggle${isEnabled ? " is-on" : " is-off"}`}
      aria-label={isEnabled ? "Matikan musik latar" : "Nyalakan musik latar"}
      aria-pressed={isEnabled}
      title={isEnabled ? "Music on" : "Music off"}
      onClick={() => {
        void toggleMusic();
      }}
    >
      <span className="reno-music-indicator" aria-hidden="true">
        {isEnabled ? "♫" : "∅"}
      </span>
    </button>
  );
}
