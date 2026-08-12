"use server";

// Developer-mode mutations. Unlike the presenter actions next door, these
// write arbitrary values into the REAL tables and stay there — that is the
// point of the mode, and the reason it is gated harder.
//
// The gate is a short shared password ("one" unless DEV_MODE_CODE overrides
// it) — the team's explicit choice, same zero-friction stance as the presenter
// tools. It is a speed bump, not a security boundary: it keeps a curious
// student out of the panel, and nothing more. Real enforcement is that EVERY
// action below re-checks the code server-side, so reaching the panel by typing
// the URL still gets you nowhere without it.

import { revalidatePath } from "next/cache";
import { createHash, timingSafeEqual } from "node:crypto";
import { normalizeLocale, type AppLocale } from "@/lib/i18n";
import { getServerSupabase } from "@/lib/supabase/server";
import { shopItemByKey } from "@/game/economy/shop-catalog";
import {
  setDevBadge,
  setDevChapter,
  setDevHeroQuest,
  setDevMood,
  setDevProgress,
  setDevQuizProgress,
  setDevShopItem,
  type DevQuestStage,
} from "@/game/dev/dev-mode";
import { PLANT_MOODS, type PlantMood } from "@/types/events";
import { BADGE_KEYS, QUEST_KEYS, type BadgeKey, type QuestKey } from "@/types/game";

const PLANT_ID = "plant-01";

export interface DevActionState {
  status: "idle" | "success" | "error";
  message: string;
}

/** Shared developer password. DEV_MODE_CODE overrides it per deployment. */
function configuredDevCode(): string {
  return process.env.DEV_MODE_CODE?.trim() || "one";
}

function matches(submitted: string, configured: string): boolean {
  const a = createHash("sha256").update(submitted).digest();
  const b = createHash("sha256").update(configured).digest();
  return timingSafeEqual(a, b);
}

/** Entry check for the door on the Settings page. The panel behind it is not
 *  trusted because of this — every action re-validates the code itself. */
export async function verifyDevCode(code: unknown): Promise<boolean> {
  const submitted = typeof code === "string" ? code.trim() : "";
  return submitted.length > 0 && matches(submitted, configuredDevCode());
}

function err(locale: AppLocale, en: string, id: string): DevActionState {
  return { status: "error", message: locale === "id" ? id : en };
}

async function authorise(formData: FormData): Promise<{ locale: AppLocale; error?: DevActionState }> {
  const locale = normalizeLocale(formData.get("locale"));
  const raw = formData.get("devCode");
  const submitted = typeof raw === "string" ? raw.trim() : "";
  if (!submitted || !matches(submitted, configuredDevCode())) {
    return { locale, error: err(locale, "That developer code is not correct.", "Kode pengembang tidak cocok.") };
  }
  return { locale };
}

function revalidateAll(): void {
  for (const path of ["/", "/settings", "/quests", "/collection", "/shop", "/reports", "/plants"]) {
    revalidatePath(path);
  }
}

function numberField(formData: FormData, name: string): number | undefined {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

async function run(
  formData: FormData,
  operation: (supabase: NonNullable<ReturnType<typeof getServerSupabase>>, locale: AppLocale) => Promise<string>,
): Promise<DevActionState> {
  const { locale, error } = await authorise(formData);
  if (error) return error;
  const supabase = getServerSupabase();
  if (!supabase) return err(locale, "Supabase is not configured.", "Supabase belum dikonfigurasi.");
  try {
    const message = await operation(supabase, locale);
    revalidateAll();
    return { status: "success", message };
  } catch (cause) {
    console.error("dev-mode action failed:", cause);
    return err(locale, cause instanceof Error ? cause.message : "Developer action failed.", "Aksi pengembang gagal.");
  }
}

/** My Garden — level, XP, day streak, seeds. Blank fields are left alone. */
export async function devSetProgress(_previous: DevActionState, formData: FormData): Promise<DevActionState> {
  return run(formData, async (supabase) => {
    const result = await setDevProgress(supabase, PLANT_ID, {
      level: numberField(formData, "level"),
      totalXp: numberField(formData, "totalXp"),
      streak: numberField(formData, "streak"),
      seeds: numberField(formData, "seeds"),
    });
    return `Lv.${result.level} · ${result.totalXp} XP · ${result.streak}d · ${result.seeds} seeds`;
  });
}

/** Quests — promote a quest to hero mission and set how far along it is. */
export async function devSetQuest(_previous: DevActionState, formData: FormData): Promise<DevActionState> {
  return run(formData, async (supabase) => {
    const key = String(formData.get("questKey") ?? "");
    if (!(QUEST_KEYS as readonly string[]).includes(key)) throw new Error(`unknown quest: ${key}`);
    const stage = Math.min(4, Math.max(1, Number(formData.get("stage") ?? 1))) as DevQuestStage;
    const result = await setDevHeroQuest(supabase, PLANT_ID, key as QuestKey, stage);
    return `${result.questKey} → ${result.status}`;
  });
}

/** Collection · Moods — one mood locked or unlocked. */
export async function devSetMood(_previous: DevActionState, formData: FormData): Promise<DevActionState> {
  return run(formData, async (supabase) => {
    const mood = String(formData.get("mood") ?? "");
    if (!(PLANT_MOODS as readonly string[]).includes(mood)) throw new Error(`unknown mood: ${mood}`);
    const unlock = formData.get("unlock") === "1";
    await setDevMood(supabase, PLANT_ID, mood as PlantMood, unlock);
    return `${mood} ${unlock ? "unlocked" : "locked"}`;
  });
}

/** Collection · Badges — one badge locked or unlocked. */
export async function devSetBadge(_previous: DevActionState, formData: FormData): Promise<DevActionState> {
  return run(formData, async (supabase) => {
    const badge = String(formData.get("badge") ?? "");
    if (!(BADGE_KEYS as readonly string[]).includes(badge)) throw new Error(`unknown badge: ${badge}`);
    const unlock = formData.get("unlock") === "1";
    await setDevBadge(supabase, PLANT_ID, badge as BadgeKey, unlock);
    return `${badge} ${unlock ? "unlocked" : "locked"}`;
  });
}

/** Collection · Story — everything up to this chapter is open. */
export async function devSetChapter(_previous: DevActionState, formData: FormData): Promise<DevActionState> {
  return run(formData, async (supabase) => {
    const chapter = await setDevChapter(supabase, PLANT_ID, Number(formData.get("chapter") ?? 0));
    return `story unlocked through chapter ${chapter}`;
  });
}

/** Today's quiz — put the 0/3 chip anywhere in its run without answering. */
export async function devSetQuiz(_previous: DevActionState, formData: FormData): Promise<DevActionState> {
  return run(formData, async (supabase) => {
    const result = await setDevQuizProgress(supabase, PLANT_ID, Number(formData.get("solved") ?? 0));
    return `today's quiz ${result.solved}/${result.total} solved (${result.quizDate})`;
  });
}

/** Shop — grant or remove an item, no Seed cost either way. */
export async function devSetShopItem(_previous: DevActionState, formData: FormData): Promise<DevActionState> {
  return run(formData, async (supabase) => {
    const key = String(formData.get("itemKey") ?? "");
    const item = shopItemByKey(key);
    if (!item) throw new Error(`unknown item: ${key}`);
    const own = formData.get("own") === "1";
    await setDevShopItem(supabase, PLANT_ID, { key: item.key, category: item.category }, own);
    return `${item.key} ${own ? "granted" : "removed"}`;
  });
}
