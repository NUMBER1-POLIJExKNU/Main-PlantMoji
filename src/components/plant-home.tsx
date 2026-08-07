"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getBrowserSupabase, hasBrowserSupabaseEnv } from "@/lib/supabase/client";
import { MOOD_LABELS, type PlantMood } from "@/types/events";
import type { Plant } from "@/types/plant";
import { XP_PER_LEVEL, normalizePersonality, type BondState, type QuestRow } from "@/types/game";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { getMoodMessage } from "@/game/personality/templates";
import BondPanel from "@/components/bond-panel";
import HomeQuestCard from "@/components/home-quest-card";
import LevelUpOverlay from "@/components/level-up-overlay";
import Mascot from "@/components/mascot";

// Scene tint + badge styling per mood. The scene classes (globals.css) shift
// the pixel-farm sky/grass palette; the badge keeps its per-mood color chip.
const MOOD_META: Record<PlantMood, { scene: string; badge: string }> = {
  Happy: { scene: "pm-scene-happy", badge: "bg-green-200 text-green-900" },
  Overheating: { scene: "pm-scene-overheating", badge: "bg-red-200 text-red-900" },
  DryAir: { scene: "pm-scene-dryair", badge: "bg-amber-200 text-amber-900" },
  Sleepy: { scene: "pm-scene-sleepy", badge: "bg-indigo-200 text-indigo-900" },
  SoilAcidic: { scene: "pm-scene-soilacidic", badge: "bg-orange-200 text-orange-900" },
  SoilAlkaline: { scene: "pm-scene-soilalkaline", badge: "bg-purple-200 text-purple-900" },
};

type Connection = "connecting" | "live" | "offline";

const emptySubscribe = () => () => {};

function questCardProps(quest: QuestRow | null, nowMsOrNull: number | null) {
  if (!quest) return null;
  const def = QUEST_DEFINITIONS[quest.quest_key];
  if (!def) return null;

  // Before hydration nowMs is null — pin "now" to the quest's own timestamp
  // so server and client render the identical zero-state (no mismatch).
  const nowMs =
    nowMsOrNull ?? Date.parse(quest.verifying_since ?? quest.started_at);

  let statusLabel = "In progress";
  let progressLabel = def.description;

  if (quest.status === "VERIFYING" && quest.verifying_since) {
    const doneAt = Date.parse(quest.verifying_since) + def.requiredSeconds * 1000;
    const left = Math.max(0, Math.ceil((doneAt - nowMs) / 1000));
    statusLabel = "Verifying";
    progressLabel = `Verifying… ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left`;
  } else if (quest.status === "ACTIVE" && def.kind === "maintain") {
    const elapsedMin = Math.max(0, Math.floor((nowMs - Date.parse(quest.started_at)) / 60000));
    const totalMin = Math.round(def.requiredSeconds / 60);
    progressLabel = `${Math.min(elapsedMin, totalMin)} / ${totalMin} min`;
  } else if (quest.status === "ACTIVE") {
    progressLabel = "Waiting for recovery…";
  }

  return { emoji: def.emoji, title: def.title, statusLabel, progressLabel };
}

export default function PlantHome({
  initialPlant,
  initialBond,
  initialQuest,
  initialMoodMessage,
}: {
  initialPlant: Plant;
  initialBond: BondState | null;
  initialQuest: QuestRow | null;
  initialMoodMessage?: string;
}) {
  const [plant, setPlant] = useState(initialPlant);
  const [bond, setBond] = useState(initialBond);
  const [quest, setQuest] = useState(initialQuest);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState<{ show: boolean; level: number }>({
    show: false,
    level: 0,
  });
  const [connection, setConnection] = useState<Connection>(() =>
    hasBrowserSupabaseEnv() ? "connecting" : "offline",
  );
  const connectionRef = useRef<Connection>("connecting");
  const moodRef = useRef<PlantMood>(initialPlant.current_state);

  // Keep the latest mood readable from realtime callbacks without
  // resubscribing (refs must not be written during render).
  useEffect(() => {
    moodRef.current = plant.current_state;
  }, [plant.current_state]);

  // Hydration-safe "am I on the client" flag — local time can only be
  // formatted after hydration, or server/browser locales may disagree.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const plantId = initialPlant.id;

    const setConn = (next: Connection) => {
      connectionRef.current = next;
      setConnection(next);
    };

    const refetch = async () => {
      const [plantRes, bondRes, questRes] = await Promise.all([
        supabase.from("plants").select("*").eq("id", plantId).maybeSingle(),
        supabase.from("bond_state").select("*").eq("plant_id", plantId).maybeSingle(),
        supabase
          .from("quests")
          .select("*")
          .eq("plant_id", plantId)
          .in("status", ["ACTIVE", "VERIFYING"])
          .order("status", { ascending: false })
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (plantRes.data) setPlant(plantRes.data as Plant);
      if (bondRes.data) applyBond(bondRes.data as BondState);
      // Only trust an error-free response: a transient query failure must not
      // blank out the visible quest card.
      if (!questRes.error) setQuest((questRes.data as QuestRow | null) ?? null);
    };

    const applyBond = (next: BondState) => {
      setBond((prev) => {
        // Celebrate a bond level increase — but urgent states outrank
        // celebration (handoff Phase 9), so only when the plant is Happy.
        if (prev && next.bond_level > prev.bond_level && moodRef.current === "Happy") {
          setLevelUp({ show: true, level: next.bond_level });
        }
        return next;
      });
    };

    const channel = supabase
      .channel(`plant-${plantId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "plants", filter: `id=eq.${plantId}` },
        (payload) => setPlant((prev) => ({ ...prev, ...(payload.new as Plant) })),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bond_state", filter: `plant_id=eq.${plantId}` },
        (payload) => applyBond(payload.new as BondState),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quests", filter: `plant_id=eq.${plantId}` },
        () => {
          // Quest rows change shape (created/verifying/completed) — re-pull
          // the current top quest instead of merging deltas.
          void supabase
            .from("quests")
            .select("*")
            .eq("plant_id", plantId)
            .in("status", ["ACTIVE", "VERIFYING"])
            .order("status", { ascending: false })
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data, error }) => {
              if (!error) setQuest((data as QuestRow | null) ?? null);
            });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConn("live");
          // postgres_changes never replays what happened while unsubscribed —
          // refetch once on every (re)join to close the gap.
          void refetch();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConn("offline");
        }
      });

    // Fallback for demo robustness (handoff §46.10): if Realtime drops,
    // poll every 10 s until the channel recovers.
    const pollId = setInterval(() => {
      if (connectionRef.current === "live") return;
      void refetch();
    }, 10_000);

    // Lazy game tick: lets "stable for N minutes" quests complete within a
    // minute even when no device event arrives; results come back via
    // realtime. Server-side evaluation stays timestamp-based.
    const tickId = setInterval(() => {
      void fetch("/api/game-tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId }),
      }).catch(() => {});
    }, 60_000);

    // Keeps quest progress labels ticking; the rAF seeds live time right
    // after hydration (setState only inside callbacks — lint-safe).
    const labelRaf = requestAnimationFrame(() => setNowMs(Date.now()));
    const labelId = setInterval(() => setNowMs(Date.now()), 15_000);

    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
      cancelAnimationFrame(labelRaf);
      clearInterval(labelId);
      supabase.removeChannel(channel);
    };
  }, [initialPlant.id]);

  const mood = MOOD_META[plant.current_state] ?? MOOD_META.Happy;
  const moodLabel = MOOD_LABELS[plant.current_state] ?? plant.current_state;
  const personality = normalizePersonality(plant.personality);
  // The server-rendered message (possibly AI-personalized) stays valid until
  // the mood changes client-side — then fall back to the local template.
  const moodMessage =
    plant.current_state === initialPlant.current_state && initialMoodMessage
      ? initialMoodMessage
      : getMoodMessage(personality, plant.current_state);
  const changedAt =
    mounted && plant.state_changed_at && Date.parse(plant.state_changed_at) > 0
      ? new Date(plant.state_changed_at).toLocaleTimeString()
      : null;

  return (
    <main className={`pm-scene relative flex min-h-screen flex-col overflow-x-clip ${mood.scene}`}>
      {/* Sky decorations — pure CSS, clipped so cloud drift never causes
          horizontal scroll. Sleepy swaps the sun for a moon + stars. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {plant.current_state === "Sleepy" ? (
          <>
            <div className="pm-stars" />
            <div className="pm-moon" />
          </>
        ) : (
          <div className="pm-sun" />
        )}
        <div className="pm-cloud pm-cloud-1" />
        <div className="pm-cloud pm-cloud-2" />
        <div className="pm-cloud pm-cloud-3" />
      </div>

      <LevelUpOverlay
        level={levelUp.level}
        show={levelUp.show}
        onDone={() => setLevelUp((prev) => ({ ...prev, show: false }))}
      />

      {/* Sky stage: name, mood badge, speech bubble, mascot */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pt-10">
        <h1 className="pm-pixel-title font-pixel max-w-full break-words text-center text-xl leading-relaxed">
          {plant.name}
        </h1>

        <span className={`font-pixel mt-3 rounded-full px-4 py-2 text-[10px] leading-none ${mood.badge}`}>
          {moodLabel}
        </span>

        <div className="mt-auto flex w-full flex-col items-center pt-8">
          <p className="pm-bubble pm-bounce">“{moodMessage}”</p>
          <div className="-mb-7 w-60 max-w-[70vw]">
            <Mascot mood={plant.current_state} />
          </div>
        </div>
      </div>

      {/* Grass floor — the panels sit on the lawn, glass-style */}
      <div className="pm-grass relative w-full pb-28">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-6 pt-14">
          {bond && (
            <BondPanel
              bondLevel={bond.bond_level}
              totalXp={bond.total_xp}
              xpInLevel={bond.total_xp % XP_PER_LEVEL}
              xpRequired={XP_PER_LEVEL}
              streakDays={bond.current_streak}
            />
          )}

          <HomeQuestCard quest={questCardProps(quest, nowMs)} />

          {plant.species && (
            <p className="pm-grass-text font-pixel-body text-lg">
              {plant.species}
              {plant.personality ? ` · ${plant.personality}` : ""}
            </p>
          )}

          <div className="pm-grass-text font-pixel-body flex items-center gap-2 text-lg">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                connection === "live"
                  ? "bg-green-500"
                  : connection === "connecting"
                    ? "animate-pulse bg-amber-400"
                    : "bg-zinc-400"
              }`}
            />
            {connection === "live" ? "LIVE" : connection === "connecting" ? "Connecting..." : "Offline"}
            {changedAt && <span>· state changed {changedAt}</span>}
          </div>
        </div>
      </div>
    </main>
  );
}
