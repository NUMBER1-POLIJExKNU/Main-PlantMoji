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

const MOOD_META: Record<PlantMood, { emoji: string; card: string; badge: string }> = {
  Happy: { emoji: "😊", card: "bg-green-50 dark:bg-green-950", badge: "bg-green-200 text-green-900" },
  Overheating: { emoji: "🔥", card: "bg-red-50 dark:bg-red-950", badge: "bg-red-200 text-red-900" },
  DryAir: { emoji: "💨", card: "bg-amber-50 dark:bg-amber-950", badge: "bg-amber-200 text-amber-900" },
  Sleepy: { emoji: "🌙", card: "bg-indigo-50 dark:bg-indigo-950", badge: "bg-indigo-200 text-indigo-900" },
  SoilAcidic: { emoji: "🧪", card: "bg-orange-50 dark:bg-orange-950", badge: "bg-orange-200 text-orange-900" },
  SoilAlkaline: { emoji: "🧪", card: "bg-purple-50 dark:bg-purple-950", badge: "bg-purple-200 text-purple-900" },
};

type Connection = "connecting" | "live" | "offline";

const emptySubscribe = () => () => {};

function questCardProps(quest: QuestRow | null, nowMs: number) {
  if (!quest) return null;
  const def = QUEST_DEFINITIONS[quest.quest_key];
  if (!def) return null;

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
}: {
  initialPlant: Plant;
  initialBond: BondState | null;
  initialQuest: QuestRow | null;
}) {
  const [plant, setPlant] = useState(initialPlant);
  const [bond, setBond] = useState(initialBond);
  const [quest, setQuest] = useState(initialQuest);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [levelUp, setLevelUp] = useState<{ show: boolean; level: number }>({
    show: false,
    level: 0,
  });
  const [connection, setConnection] = useState<Connection>(() =>
    hasBrowserSupabaseEnv() ? "connecting" : "offline",
  );
  const connectionRef = useRef<Connection>("connecting");
  const moodRef = useRef<PlantMood>(initialPlant.current_state);
  moodRef.current = plant.current_state;

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
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (plantRes.data) setPlant(plantRes.data as Plant);
      if (bondRes.data) applyBond(bondRes.data as BondState);
      setQuest((questRes.data as QuestRow | null) ?? null);
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
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => setQuest((data as QuestRow | null) ?? null));
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

    // Keeps quest progress labels ticking.
    const labelId = setInterval(() => setNowMs(Date.now()), 15_000);

    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
      clearInterval(labelId);
      supabase.removeChannel(channel);
    };
  }, [initialPlant.id]);

  const mood = MOOD_META[plant.current_state] ?? MOOD_META.Happy;
  const moodLabel = MOOD_LABELS[plant.current_state] ?? plant.current_state;
  const personality = normalizePersonality(plant.personality);
  const moodMessage = getMoodMessage(personality, plant.current_state);
  const changedAt =
    mounted && plant.state_changed_at && Date.parse(plant.state_changed_at) > 0
      ? new Date(plant.state_changed_at).toLocaleTimeString()
      : null;

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center gap-5 px-6 pb-28 transition-colors duration-700 ${mood.card}`}
    >
      <LevelUpOverlay
        level={levelUp.level}
        show={levelUp.show}
        onDone={() => setLevelUp((prev) => ({ ...prev, show: false }))}
      />

      <span className="text-8xl" role="img" aria-label={moodLabel}>
        {mood.emoji}
      </span>

      <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {plant.name}
      </h1>

      <span className={`rounded-full px-4 py-1.5 text-lg font-semibold ${mood.badge}`}>
        {moodLabel}
      </span>

      <p className="max-w-xs text-center text-sm italic leading-6 text-zinc-600 dark:text-zinc-300">
        “{moodMessage}”
      </p>

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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {plant.species}
          {plant.personality ? ` · ${plant.personality}` : ""}
        </p>
      )}

      <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
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
    </main>
  );
}
