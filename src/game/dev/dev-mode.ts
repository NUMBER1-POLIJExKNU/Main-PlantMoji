// Developer mode: granular writes to the REAL data, for the team building the
// app. This is the opposite of the classroom cheat sandbox — nothing here is
// client-only and every change persists into normal mode, which is the whole
// point. Presentation, pacing and meaning are deliberately not considered:
// these are switches and number fields for people who know what they mean.
//
// Sensors are never touched. The mood helpers below write to `device_events`,
// which also carries device traffic, so every query here is pinned to
// `type = 'PLANT_STATE_CHANGED'` and can neither read nor write a reading.
//
// The bulk demo tools (game/demo/demo-max, demo-reset) stay as they are: they
// unlock or wipe EVERYTHING at once, which is right for a rehearsal and wrong
// for "give me badge 3 and chapter 2". This module is the per-item half.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STREAK_MILESTONES,
  badgeRewardKey,
  chapterRewardKey,
  moodRewardKey,
  streakMilestoneRewardKey,
} from "@/game/progression/bonus-xp";
import { CHAPTER_DEFINITIONS } from "@/game/story/story-definitions";
import { dailyQuiz, wibDate } from "@/game/quiz/daily-quiz";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { PLANT_MOODS, type PlantMood } from "@/types/events";
import { BADGE_KEYS, MAX_BOND_LEVEL, levelForXp, type BadgeKey, type QuestKey } from "@/types/game";

function fail(operation: string, error: { message: string } | null): void {
  if (error) throw new Error(`dev-mode ${operation} failed: ${error.message}`);
}

const nowIso = (now: Date) => now.toISOString();

// ── Progress: level, XP, day streak, seeds ──────────────────────────────

export interface DevProgressPatch {
  level?: number;
  totalXp?: number;
  streak?: number;
  seeds?: number;
}

/**
 * Write bond_state directly.
 *
 * The engine's rule is that XP only moves through the award_xp RPC, never a
 * read-modify-write — but the existing admin path (game/demo/demo-max) already
 * upserts bond_state wholesale for exactly this reason, and a developer typing
 * "give me 250 XP" has no reward to attribute it to. This follows that
 * precedent rather than inventing a second one.
 *
 * Level is stored, not derived, so a developer can put the two out of step on
 * purpose; `levelForXp` is offered separately by the UI as a convenience.
 */
export async function setDevProgress(
  supabase: SupabaseClient,
  plantId: string,
  patch: DevProgressPatch,
  now: Date = new Date(),
): Promise<{ level: number; totalXp: number; streak: number; seeds: number }> {
  const { data: current, error: readError } = await supabase
    .from("bond_state")
    .select("total_xp, bond_level, current_streak, longest_streak, seeds")
    .eq("plant_id", plantId)
    .maybeSingle();
  fail("progress read", readError);

  const row = (current ?? {}) as Record<string, number | null>;
  const totalXp = patch.totalXp ?? Number(row.total_xp ?? 0);
  const level = patch.level ?? Number(row.bond_level ?? 1);
  const streak = patch.streak ?? Number(row.current_streak ?? 0);
  const seeds = patch.seeds ?? Number(row.seeds ?? 0);

  fail(
    "progress write",
    (await supabase.from("bond_state").upsert(
      {
        plant_id: plantId,
        total_xp: Math.max(0, Math.round(totalXp)),
        // XP is uncapped (it banks past the top level), the LEVEL is not —
        // a row above MAX_BOND_LEVEL would ask the sprite table for a band
        // that does not exist.
        bond_level: Math.min(MAX_BOND_LEVEL, Math.max(1, Math.round(level))),
        current_streak: Math.max(0, Math.round(streak)),
        longest_streak: Math.max(Math.max(0, Math.round(streak)), Number(row.longest_streak ?? 0)),
        seeds: Math.max(0, Math.round(seeds)),
        updated_at: nowIso(now),
      },
      { onConflict: "plant_id" },
    )).error,
  );

  // Seal what is already unlocked. Without this the next page-load tick pays
  // the unlock bonuses again and the number the developer just typed drifts
  // upward on the very next refresh — the trap demo-max documents. Unlike
  // demo-max this seals ONLY what has actually been unlocked, so a genuine
  // future unlock still pays out normally.
  await sealEarnedRewards(supabase, plantId);

  return { level: Math.max(1, Math.round(level)), totalXp: Math.max(0, Math.round(totalXp)), streak, seeds };
}

/** Amount-0 ledger rows for every bonus this plant has already been given, so
 *  the self-healing sweep can never grant them a second time. */
async function sealEarnedRewards(supabase: SupabaseClient, plantId: string): Promise<void> {
  const [badges, state, moods] = await Promise.all([
    supabase.from("plant_badges").select("badge_key").eq("plant_id", plantId),
    supabase.from("bond_state").select("current_chapter, current_streak").eq("plant_id", plantId).maybeSingle(),
    getSeenMoodKeys(supabase, plantId),
  ]);

  const chapter = Number((state.data as { current_chapter?: number } | null)?.current_chapter ?? 0);
  const streak = Number((state.data as { current_streak?: number } | null)?.current_streak ?? 0);

  const rows = [
    ...((badges.data ?? []) as Array<{ badge_key: string }>).map((b) => ({ reward_key: badgeRewardKey(plantId, b.badge_key as BadgeKey), plant_id: plantId, amount: 0 })),
    ...CHAPTER_DEFINITIONS.filter((c) => c.chapter <= chapter).map((c) => ({ reward_key: chapterRewardKey(plantId, c.chapter), plant_id: plantId, amount: 0 })),
    ...moods.map((mood) => ({ reward_key: moodRewardKey(plantId, mood), plant_id: plantId, amount: 0 })),
    ...STREAK_MILESTONES.filter((days) => days <= streak).map((days) => ({ reward_key: streakMilestoneRewardKey(plantId, days), plant_id: plantId, amount: 0 })),
  ];
  if (rows.length === 0) return;
  fail("reward seal", (await supabase.from("xp_rewards").upsert(rows, { onConflict: "reward_key", ignoreDuplicates: true })).error);
}

// ── Collection: moods, badges, story ────────────────────────────────────

/** Moods this plant has been seen in — the same PLANT_STATE_CHANGED trail the
 *  Collection screen reads, never a sensor row. */
export async function getSeenMoodKeys(supabase: SupabaseClient, plantId: string): Promise<PlantMood[]> {
  const { data, error } = await supabase
    .from("device_events")
    .select("currentState:data->>currentState")
    .eq("plant_id", plantId)
    .eq("type", "PLANT_STATE_CHANGED")
    .limit(5000);
  fail("mood read", error);
  const seen = new Set<PlantMood>();
  for (const row of (data ?? []) as Array<{ currentState: string | null }>) {
    if (row.currentState && (PLANT_MOODS as readonly string[]).includes(row.currentState)) {
      seen.add(row.currentState as PlantMood);
    }
  }
  return [...seen];
}

/**
 * Discovering a mood adds one PLANT_STATE_CHANGED event, exactly like the real
 * device would. LOCKING one deletes those events — there is no other way to
 * make the Collection forget a mood, since it is derived from that trail. The
 * delete is pinned to this plant, this event type and this mood, so no sensor
 * reading and no other mood's history is in range.
 */
export async function setDevMood(
  supabase: SupabaseClient,
  plantId: string,
  mood: PlantMood,
  discovered: boolean,
  now: Date = new Date(),
): Promise<void> {
  if (!discovered) {
    fail(
      "mood lock",
      (await supabase
        .from("device_events")
        .delete()
        .eq("plant_id", plantId)
        .eq("type", "PLANT_STATE_CHANGED")
        .eq("data->>currentState", mood)).error,
    );
    // The plant's CURRENT state also counts as seen, so step it off this mood.
    const { data: plant } = await supabase.from("plants").select("current_state").eq("id", plantId).maybeSingle();
    if ((plant as { current_state?: string } | null)?.current_state === mood) {
      fail("mood current reset", (await supabase.from("plants").update({ current_state: "Happy", state_changed_at: nowIso(now) }).eq("id", plantId)).error);
    }
    return;
  }
  fail(
    "mood unlock",
    (await supabase.from("device_events").upsert(
      {
        event_id: `dev-mode:${plantId}:mood:${mood}`,
        plant_id: plantId,
        type: "PLANT_STATE_CHANGED",
        occurred_at: nowIso(now),
        data: { previousState: null, currentState: mood, devMode: true },
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    )).error,
  );
}

export async function setDevBadge(
  supabase: SupabaseClient,
  plantId: string,
  badgeKey: BadgeKey,
  unlocked: boolean,
  now: Date = new Date(),
): Promise<void> {
  if (!unlocked) {
    fail("badge lock", (await supabase.from("plant_badges").delete().eq("plant_id", plantId).eq("badge_key", badgeKey)).error);
    return;
  }
  fail(
    "badge unlock",
    (await supabase.from("plant_badges").upsert(
      { plant_id: plantId, badge_key: badgeKey, unlocked_at: nowIso(now) },
      { onConflict: "plant_id,badge_key", ignoreDuplicates: true },
    )).error,
  );
}

/** Story unlocks are a high-water mark, so this is one number: every chapter
 *  at or below it is open and everything above it is locked. */
export async function setDevChapter(
  supabase: SupabaseClient,
  plantId: string,
  chapter: number,
  now: Date = new Date(),
): Promise<number> {
  const clamped = Math.max(0, Math.min(CHAPTER_DEFINITIONS.length, Math.round(chapter)));
  fail(
    "chapter write",
    (await supabase.from("bond_state").upsert(
      { plant_id: plantId, current_chapter: clamped, updated_at: nowIso(now) },
      { onConflict: "plant_id" },
    )).error,
  );
  return clamped;
}

// ── Today's quiz: how many of the three are already answered ────────────

/** Today's quiz is three questions on the WIB date, keyed per round. This
 *  marks the first `solved` of them complete and clears the rest, so the
 *  chip on My Garden can be put at any point of its 0/3 → 3/3 run without
 *  answering through the modal each time.
 *
 *  xp_awarded stays 0 on every row it writes. The real flow awards XP through
 *  the answer_daily_quiz RPC, and fabricating it here would put the quiz's
 *  ledger out of step with bond_state — set XP directly in the field above if
 *  that is what you want. */
export async function setDevQuizProgress(
  supabase: SupabaseClient,
  plantId: string,
  solved: number,
  now: Date = new Date(),
): Promise<{ solved: number; total: number; quizDate: string }> {
  const quizDate = wibDate(now);
  // Locale only affects the displayed wording; the keys are the same either way.
  const questions = dailyQuiz(plantId, "en", `${quizDate}:round:0`);
  const clamped = Math.max(0, Math.min(questions.length, Math.round(solved)));

  fail(
    "quiz clear",
    (await supabase
      .from("daily_quiz_attempts")
      .delete()
      .eq("plant_id", plantId)
      .eq("quiz_date", quizDate)
      .eq("round_no", 0)).error,
  );

  if (clamped > 0) {
    fail(
      "quiz write",
      (await supabase.from("daily_quiz_attempts").insert(
        questions.slice(0, clamped).map((question) => ({
          plant_id: plantId,
          quiz_date: quizDate,
          round_no: 0,
          question_key: question.key,
          attempts: 1,
          completed_at: nowIso(now),
          xp_awarded: 0,
        })),
      )).error,
    );
  }
  return { solved: clamped, total: questions.length, quizDate };
}

// ── Quests: which one is the hero, and how far along ────────────────────

/** SENSE and ACT are both "running"; VERIFY is the sensor check; REWARD is
 *  done. Mirrors the four steps the hero card draws. */
export type DevQuestStage = 1 | 2 | 3 | 4;

/**
 * Make `questKey` the hero mission and put it at `stage`.
 *
 * The hero is simply the most recently started live quest (getActiveQuests
 * orders by started_at desc, the page takes [0]), so promoting one is a matter
 * of giving it the newest start time. Any other live quest is left alone — it
 * just falls to a side mission.
 */
export async function setDevHeroQuest(
  supabase: SupabaseClient,
  plantId: string,
  questKey: QuestKey,
  stage: DevQuestStage,
  now: Date = new Date(),
): Promise<{ questKey: QuestKey; status: string }> {
  const def = QUEST_DEFINITIONS[questKey];
  if (!def) throw new Error(`dev-mode: unknown quest ${questKey}`);
  const occurredAt = nowIso(now);
  const status = stage >= 4 ? "COMPLETED" : stage === 3 ? "VERIFYING" : "ACTIVE";

  const { data: existing, error: readError } = await supabase
    .from("quests")
    .select("id")
    .eq("plant_id", plantId)
    .eq("quest_key", questKey)
    .in("status", ["ACTIVE", "VERIFYING"])
    .maybeSingle();
  fail("quest read", readError);

  const row = {
    plant_id: plantId,
    quest_key: questKey,
    status,
    xp_reward: def.xpReward,
    started_at: occurredAt,
    verifying_since: status === "VERIFYING" ? occurredAt : null,
    completed_at: status === "COMPLETED" ? occurredAt : null,
    expired_at: null,
  };

  const id = (existing as { id?: string } | null)?.id;
  if (id) {
    fail("quest update", (await supabase.from("quests").update(row).eq("id", id)).error);
  } else {
    fail("quest insert", (await supabase.from("quests").insert(row)).error);
  }
  return { questKey, status };
}

// ── Shop ────────────────────────────────────────────────────────────────

/**
 * Grant or remove an item outright — no Seed cost either way. The real
 * purchase path (purchase_item RPC) exists to charge and to serialise; a
 * developer stocking a test account wants neither, and the Seed balance has
 * its own field above.
 */
export async function setDevShopItem(
  supabase: SupabaseClient,
  plantId: string,
  item: { key: string; category: "pot" | "decor" | "accessory" },
  owned: boolean,
  now: Date = new Date(),
): Promise<void> {
  if (!owned) {
    fail("shop remove", (await supabase.from("shop_purchases").delete().eq("plant_id", plantId).eq("item_key", item.key)).error);
    return;
  }
  fail(
    "shop grant",
    (await supabase.from("shop_purchases").upsert(
      { plant_id: plantId, item_key: item.key, category: item.category, price_paid: 0, equipped: false, purchased_at: nowIso(now) },
      { onConflict: "plant_id,item_key", ignoreDuplicates: true },
    )).error,
  );
}

/** Everything the dev panel needs to draw its current state in one round trip. */
export async function readDevSnapshot(supabase: SupabaseClient, plantId: string) {
  const [state, badges, moods, owned, live] = await Promise.all([
    supabase.from("bond_state").select("total_xp, bond_level, current_streak, seeds, current_chapter").eq("plant_id", plantId).maybeSingle(),
    supabase.from("plant_badges").select("badge_key").eq("plant_id", plantId),
    getSeenMoodKeys(supabase, plantId),
    supabase.from("shop_purchases").select("item_key").eq("plant_id", plantId),
    supabase.from("quests").select("quest_key, status").eq("plant_id", plantId).in("status", ["ACTIVE", "VERIFYING"]).order("started_at", { ascending: false }),
  ]);
  const row = (state.data ?? {}) as Record<string, number | null>;
  const liveRows = (live.data ?? []) as Array<{ quest_key: string; status: string }>;
  return {
    level: Number(row.bond_level ?? 1),
    totalXp: Number(row.total_xp ?? 0),
    streak: Number(row.current_streak ?? 0),
    seeds: Number(row.seeds ?? 0),
    chapter: Number(row.current_chapter ?? 0),
    levelForXp: levelForXp(Number(row.total_xp ?? 0)),
    badges: ((badges.data ?? []) as Array<{ badge_key: string }>).map((b) => b.badge_key),
    moods,
    ownedItems: ((owned.data ?? []) as Array<{ item_key: string }>).map((o) => o.item_key),
    heroQuest: liveRows[0]?.quest_key ?? null,
    heroStatus: liveRows[0]?.status ?? null,
    allBadges: BADGE_KEYS,
    allMoods: PLANT_MOODS,
    totalChapters: CHAPTER_DEFINITIONS.length,
  };
}
