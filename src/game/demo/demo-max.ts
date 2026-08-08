import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BADGE_DEFINITIONS } from "@/game/badges/badge-definitions";
import {
  BADGE_BONUS_XP,
  CHAPTER_BONUS_XP,
  MOOD_DISCOVERY_XP,
  STREAK_MILESTONES,
  STREAK_MILESTONE_XP,
  badgeRewardKey,
  chapterRewardKey,
  moodRewardKey,
  streakMilestoneRewardKey,
} from "@/game/progression/bonus-xp";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import {
  dailyChallengeRewardKey,
  getDailyEvent,
} from "@/game/random/daily-events";
import { CHAPTER_DEFINITIONS } from "@/game/story/story-definitions";
import { dayString } from "@/game/progression/streak-engine";
import { PLANT_MOODS } from "@/types/events";
import { BADGE_KEYS, QUEST_KEYS } from "@/types/game";
import { COMPANION_STAGES } from "@/types/game";

/** Level 10 unlocks every currently shipped badge and story chapter. */
export const DEMO_MAX_LEVEL = 10;
/** Keep the bar visibly full while remaining inside Bond Level 10. */
export const DEMO_MAX_XP = 999;
export const DEMO_MAX_STREAK = 30;

function deterministicUuid(input: string): string {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32);
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function isoBefore(now: Date, minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export function buildDemoMaxSeed(plantId: string, now: Date = new Date()) {
  if (!plantId.trim()) throw new Error("demo-max: plantId is required");
  if (Number.isNaN(now.getTime())) throw new Error("demo-max: invalid date");

  const occurredAt = now.toISOString();
  const badgeRows = BADGE_KEYS.map((badgeKey) => ({
    plant_id: plantId,
    badge_key: badgeKey,
    unlocked_at: occurredAt,
  }));

  const moodEventRows = PLANT_MOODS.map((mood, index) => ({
    event_id: `demo-max:${plantId}:mood:${mood}`,
    plant_id: plantId,
    type: "PLANT_STATE_CHANGED",
    occurred_at: isoBefore(now, PLANT_MOODS.length - index),
    data: {
      previousState: index === 0 ? null : PLANT_MOODS[index - 1],
      currentState: mood,
      demoMax: true,
    },
  }));

  // One completed row for every quest type makes the History screen useful
  // during a demo without fabricating an active sensor-verification flow.
  const questRows = QUEST_KEYS.map((questKey, index) => {
    const completedAt = isoBefore(now, QUEST_KEYS.length - index + 10);
    return {
      id: deterministicUuid(`demo-max:${plantId}:quest:${questKey}`),
      plant_id: plantId,
      quest_key: questKey,
      status: "COMPLETED",
      xp_reward: QUEST_DEFINITIONS[questKey].xpReward,
      started_at: isoBefore(now, QUEST_KEYS.length - index + 15),
      verifying_since: null,
      completed_at: completedAt,
      expired_at: null,
      created_at: completedAt,
    };
  });

  const badgeEvents = BADGE_KEYS.map((badgeKey) => ({
    event_id: `badge:${plantId}:${badgeKey}`,
    plant_id: plantId,
    type: "BADGE_UNLOCKED",
    occurred_at: occurredAt,
    data: { badgeKey, name: BADGE_DEFINITIONS[badgeKey].name, demoMax: true },
  }));
  const chapterEvents = CHAPTER_DEFINITIONS.map((chapter) => ({
    event_id: `chapter:${plantId}:${chapter.chapter}`,
    plant_id: plantId,
    type: "CHAPTER_UNLOCKED",
    occurred_at: occurredAt,
    data: { chapter: chapter.chapter, title: chapter.title, demoMax: true },
  }));
  const questEvents = questRows.map((quest) => ({
    event_id: `quest:${quest.id}:completed`,
    plant_id: plantId,
    type: "QUEST_COMPLETED",
    occurred_at: quest.completed_at,
    data: {
      questKey: quest.quest_key,
      title: QUEST_DEFINITIONS[quest.quest_key].title,
      xpReward: quest.xp_reward,
      demoMax: true,
    },
  }));
  const progressEvents = [
    {
      event_id: `demo-max:${plantId}:level-10`,
      plant_id: plantId,
      type: "LEVEL_UP",
      occurred_at: occurredAt,
      data: { levelBefore: 1, levelAfter: DEMO_MAX_LEVEL, totalXp: DEMO_MAX_XP, demoMax: true },
    },
    {
      event_id: `demo-max:${plantId}:streak-30`,
      plant_id: plantId,
      type: "STREAK_UPDATED",
      occurred_at: occurredAt,
      data: { currentStreak: DEMO_MAX_STREAK, longestStreak: DEMO_MAX_STREAK, demoMax: true },
    },
  ];
  const bondEventRows: Array<{ event_id: string; plant_id: string; type: string; occurred_at: string; data: Record<string, unknown> }> = [...badgeEvents, ...chapterEvents, ...questEvents, ...progressEvents];
  const companionEvolutionRows = COMPANION_STAGES.slice(1).map((stage, index) => ({
    plant_id: plantId,
    cycle: 1,
    stage,
    from_stage: COMPANION_STAGES[index],
    form_key: "balanced",
    care_snapshot: { demoMax: 1 },
    evolved_at: isoBefore(now, COMPANION_STAGES.length - index),
  }));
  bondEventRows.push(...companionEvolutionRows.map((row) => ({
    event_id: `companion:${plantId}:1:${row.stage}`,
    plant_id: plantId,
    type: "COMPANION_EVOLVED",
    occurred_at: row.evolved_at,
    data: { fromStage: row.from_stage, stage: row.stage, formKey: "balanced", demoMax: true },
  })));

  // Seed every self-healing reward key used by the engine. Otherwise the
  // next page-load tick would award old unlock bonuses again and jump above
  // the intended level-10 demo state.
  const xpRewardRows = [
    ...BADGE_KEYS.map((badgeKey) => ({
      reward_key: badgeRewardKey(plantId, badgeKey),
      plant_id: plantId,
      amount: BADGE_BONUS_XP,
    })),
    ...CHAPTER_DEFINITIONS.map((chapter) => ({
      reward_key: chapterRewardKey(plantId, chapter.chapter),
      plant_id: plantId,
      amount: CHAPTER_BONUS_XP,
    })),
    ...PLANT_MOODS.map((mood) => ({
      reward_key: moodRewardKey(plantId, mood),
      plant_id: plantId,
      amount: MOOD_DISCOVERY_XP,
    })),
    ...STREAK_MILESTONES.map((days) => ({
      reward_key: streakMilestoneRewardKey(plantId, days),
      plant_id: plantId,
      amount: STREAK_MILESTONE_XP,
    })),
    ...questRows.map((quest) => ({
      reward_key: `quest:${quest.id}:completion`,
      plant_id: plantId,
      amount: quest.xp_reward,
    })),
  ];

  const todayEvent = getDailyEvent(plantId, now);
  if (todayEvent.kind === "daily_challenge" && todayEvent.challengeXp) {
    xpRewardRows.push({
      reward_key: dailyChallengeRewardKey(plantId, dayString(now), todayEvent.id),
      plant_id: plantId,
      amount: todayEvent.challengeXp,
    });
  }

  const representedXp = xpRewardRows.reduce((total, row) => total + row.amount, 0);
  if (representedXp > DEMO_MAX_XP) {
    throw new Error("demo-max: represented rewards exceed maximum XP");
  }
  xpRewardRows.push({
    reward_key: `demo-max:${plantId}:top-up`,
    plant_id: plantId,
    amount: DEMO_MAX_XP - representedXp,
  });

  return { occurredAt, badgeRows, moodEventRows, questRows, bondEventRows, xpRewardRows, companionEvolutionRows };
}

async function throwOnError(
  operation: string,
  result: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const { error } = await result;
  if (error) throw new Error(`demo-max ${operation} failed: ${error.message}`);
}

/**
 * Applies the fully unlocked demo state. Every inserted row has a stable key,
 * so a failed/partial run can be submitted again safely.
 */
export async function applyDemoMaxState(
  supabase: SupabaseClient,
  plantId: string,
  now: Date = new Date(),
) {
  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .select("id")
    .eq("id", plantId)
    .maybeSingle();
  if (plantError) throw new Error(`demo-max plant lookup failed: ${plantError.message}`);
  if (!plant) throw new Error(`demo-max unknown plant: ${plantId}`);

  const seed = buildDemoMaxSeed(plantId, now);

  await throwOnError(
    "badges",
    supabase.from("plant_badges").upsert(seed.badgeRows, {
      onConflict: "plant_id,badge_key",
      ignoreDuplicates: true,
    }),
  );
  await throwOnError(
    "moods",
    supabase.from("device_events").upsert(seed.moodEventRows, {
      onConflict: "event_id",
      ignoreDuplicates: true,
    }),
  );
  await throwOnError(
    "quests",
    supabase.from("quests").upsert(seed.questRows, { onConflict: "id" }),
  );
  await throwOnError(
    "events",
    supabase.from("bond_events").upsert(seed.bondEventRows, {
      onConflict: "event_id",
      ignoreDuplicates: true,
    }),
  );
  await throwOnError("companion evolutions", supabase.from("companion_evolutions").upsert(seed.companionEvolutionRows, { onConflict: "plant_id,cycle,stage", ignoreDuplicates: true }));
  await throwOnError("companion state", supabase.from("companion_state").upsert({ plant_id: plantId, cycle: 1, stage: "Guardian", form_key: "balanced", last_evolved_at: seed.occurredAt, updated_at: seed.occurredAt }, { onConflict: "plant_id" }));
  await throwOnError(
    "rewards",
    supabase.from("xp_rewards").upsert(seed.xpRewardRows, {
      onConflict: "reward_key",
      ignoreDuplicates: true,
    }),
  );
  await throwOnError(
    "plant update",
    supabase
      .from("plants")
      .update({
        current_state: "Happy",
        state_changed_at: seed.occurredAt,
      })
      .eq("id", plantId),
  );

  // Write progression last so a re-run always restores the exact display
  // target even if ordinary gameplay added XP after an earlier max unlock.
  await throwOnError(
    "bond state",
    supabase.from("bond_state").upsert(
      {
        plant_id: plantId,
        total_xp: DEMO_MAX_XP,
        bond_level: DEMO_MAX_LEVEL,
        current_streak: DEMO_MAX_STREAK,
        longest_streak: DEMO_MAX_STREAK,
        last_qualified_date: dayString(now),
        current_chapter: CHAPTER_DEFINITIONS.length,
        updated_at: seed.occurredAt,
      },
      { onConflict: "plant_id" },
    ),
  );

  return {
    plantId,
    level: DEMO_MAX_LEVEL,
    totalXp: DEMO_MAX_XP,
    streak: DEMO_MAX_STREAK,
    moods: PLANT_MOODS.length,
    badges: BADGE_KEYS.length,
    chapters: CHAPTER_DEFINITIONS.length,
    quests: QUEST_KEYS.length,
    companionStage: "Guardian",
    companionForm: "balanced",
  };
}
