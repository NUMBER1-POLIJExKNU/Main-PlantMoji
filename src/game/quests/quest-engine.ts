// Quest state machine (handoff §16–§17, Phases 6–7).
//
// All timing is derived from persisted timestamps — never server timers
// (handoff Correction 4). Every transition is status-guarded so replayed
// events and concurrent ticks are safe: an update that matched zero rows
// simply means another delivery already made the transition.
//
// The engine never awards XP — the event router settles completions.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlantMood } from "@/types/events";
import type { QuestEngineResult, QuestRow } from "@/types/game";
import { getLatestSensorSnapshot, getPlantCropProfile } from "@/lib/crop-profile-data";
import { getCropProfile, type CropProfile } from "@/lib/crop-profiles";
import { QUEST_DEFINITIONS, questsTriggeredBy, type QuestDefinition } from "./quest-definitions";

const LIVE_STATUSES = ["ACTIVE", "VERIFYING"];

function fail(context: string, message: string): never {
  throw new Error(`quest-engine: ${context}: ${message}`);
}

/**
 * True when the event's sensor data proves the recovery has NOT happened,
 * even if another mood currently outranks the trigger (e.g. still 33°C while
 * the state machine shows SoilAcidic) — handoff §16's completion condition is
 * the sensor value, not the mood label. Blocks when ANY of:
 *   * def.verifyTemperatureMax is set and data.temperature is a finite number
 *     above it ("temperature <= 30°C and remains stable"), OR
 *   * def.verifyPhRange is set and data.soilPH is a finite number outside
 *     [min, max] ("calibrated pH returns to normal range and remains stable"), OR
 *   * def.verifyHumidityMin is set and data.humidity is a finite number below
 *     it (handoff §5.2 dry-air hysteresis: dry OFF at >= 45% — anything drier
 *     means the air has NOT recovered), OR
 *   * def.verifyTemperatureMin is set and data.temperature is a finite number
 *     below the profile's cold recover point (still too cold), OR
 *   * def.verifyHumidityMax is set and data.humidity is a finite number above
 *     the profile's humid-air recover point (air still too humid).
 * Each clause reads its live threshold from the plant's crop profile; the
 * QuestDefinition field is the opt-in flag carrying the handoff demo value.
 * Exported for tests only — the engine is the sole runtime caller.
 */
export function sensorBlocksRecovery(
  def: QuestDefinition,
  data?: Record<string, unknown>,
  profile: CropProfile = getCropProfile(null),
): boolean {
  if (def.kind !== "recovery" || !data) return false;

  if (def.verifyTemperatureMax !== undefined) {
    const temperature = data.temperature;
    if (
      typeof temperature === "number" &&
      Number.isFinite(temperature) &&
      temperature > profile.temperature.overheating.recoverAtOrBelow
    ) {
      return true;
    }
  }

  if (def.verifyTemperatureMin !== undefined) {
    const temperature = data.temperature;
    if (
      typeof temperature === "number" &&
      Number.isFinite(temperature) &&
      temperature < profile.temperature.cold.recoverAtOrAbove
    ) {
      return true;
    }
  }

  if (def.verifyPhRange !== undefined) {
    const soilPH = data.soilPH;
    if (
      typeof soilPH === "number" &&
      Number.isFinite(soilPH) &&
      (soilPH < profile.soilPh.recommended.min || soilPH > profile.soilPh.recommended.max)
    ) {
      return true;
    }
  }

  if (def.verifyHumidityMin !== undefined) {
    const humidity = data.humidity;
    if (
      typeof humidity === "number" &&
      Number.isFinite(humidity) &&
      humidity < profile.airHumidity.dryAir.recoverAtOrAbove
    ) {
      return true;
    }
  }

  if (def.verifyHumidityMax !== undefined) {
    const humidity = data.humidity;
    if (
      typeof humidity === "number" &&
      Number.isFinite(humidity) &&
      humidity > profile.airHumidity.humidAir.recoverAtOrBelow
    ) {
      return true;
    }
  }

  return false;
}

async function emitQuestEvent(
  supabase: SupabaseClient,
  quest: QuestRow,
  suffix: "created" | "completed" | "expired",
  occurredAt: string,
): Promise<void> {
  const type =
    suffix === "created" ? "QUEST_CREATED" : suffix === "completed" ? "QUEST_COMPLETED" : "QUEST_EXPIRED";
  const def = QUEST_DEFINITIONS[quest.quest_key];
  const { error } = await supabase.from("bond_events").upsert(
    {
      event_id: `quest:${quest.id}:${suffix}`,
      plant_id: quest.plant_id,
      type,
      occurred_at: occurredAt,
      data: {
        questKey: quest.quest_key,
        title: def?.title ?? quest.quest_key,
        xpReward: quest.xp_reward,
      },
    },
    { onConflict: "event_id", ignoreDuplicates: true },
  );
  if (error) fail("emit bond_event", error.message);
}

/**
 * Guarded transition: updates the quest only if it is still in
 * `expectedStatus`, returning the updated row or null when another delivery
 * already moved it (replay-safe).
 */
async function transition(
  supabase: SupabaseClient,
  questId: string,
  expectedStatus: string,
  patch: Partial<QuestRow>,
): Promise<QuestRow | null> {
  const { data, error } = await supabase
    .from("quests")
    .update(patch)
    .eq("id", questId)
    .eq("status", expectedStatus)
    .select();
  if (error) fail(`transition ${expectedStatus}→${patch.status}`, error.message);
  return ((data as QuestRow[]) ?? [])[0] ?? null;
}

async function fetchLiveQuests(supabase: SupabaseClient, plantId: string): Promise<QuestRow[]> {
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("plant_id", plantId)
    .in("status", LIVE_STATUSES);
  if (error) fail("fetch live quests", error.message);
  return (data as QuestRow[]) ?? [];
}

/** Live (ACTIVE/VERIFYING) quests, newest first — for the UI. */
export async function getActiveQuests(
  supabase: SupabaseClient,
  plantId: string,
): Promise<QuestRow[]> {
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("plant_id", plantId)
    .in("status", LIVE_STATUSES)
    .order("started_at", { ascending: false });
  if (error) fail("getActiveQuests", error.message);
  return (data as QuestRow[]) ?? [];
}

/** Finished (COMPLETED/EXPIRED) quests, newest first — for the UI. */
export async function getQuestHistory(
  supabase: SupabaseClient,
  plantId: string,
  limit = 20,
): Promise<QuestRow[]> {
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("plant_id", plantId)
    .in("status", ["COMPLETED", "EXPIRED"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("getQuestHistory", error.message);
  return (data as QuestRow[]) ?? [];
}

/**
 * Lazy timestamp sweep — completes quests whose time window has provably
 * passed. Called on every device event, page load, and periodic game tick.
 *
 * - VERIFYING recovery quests complete once verifying_since + window ≤ now,
 *   unless plants shows a relapse inside the window whose quest transition
 *   hasn't landed yet — then the sweep applies that relapse itself.
 * - ACTIVE maintain quests (Keep Me Happy) complete once started_at + window
 *   ≤ now while the plant is still in the trigger mood.
 */
export async function evaluateQuests(
  supabase: SupabaseClient,
  plantId: string,
  now: Date = new Date(),
): Promise<QuestEngineResult> {
  const result: QuestEngineResult = { created: [], completed: [], expired: [] };
  const nowMs = now.getTime();

  const live = await fetchLiveQuests(supabase, plantId);
  if (live.length === 0) return result;

  // Both branches below need the plant's present state: maintain quests to
  // confirm the mood is still held, VERIFYING quests to detect a relapse
  // whose quest transition hasn't landed yet.
  let currentMood: PlantMood | null = null;
  let stateChangedMs = Number.NEGATIVE_INFINITY;
  {
    const { data, error } = await supabase
      .from("plants")
      .select("current_state, state_changed_at")
      .eq("id", plantId)
      .maybeSingle();
    if (error) fail("fetch current mood", error.message);
    currentMood = (data?.current_state as PlantMood) ?? null;
    const parsed = data?.state_changed_at ? Date.parse(data.state_changed_at) : Number.NaN;
    if (Number.isFinite(parsed)) stateChangedMs = parsed;
  }

  // Lazily fetched + memoized: only a VERIFYING recovery quest whose window
  // has actually elapsed needs the plant's latest sensor reading, and at
  // most once per sweep regardless of how many such quests are live.
  let sensorCheckPromise: Promise<{ profile: CropProfile; data: Record<string, unknown> }> | null =
    null;
  function sensorCheck(): Promise<{ profile: CropProfile; data: Record<string, unknown> }> {
    if (!sensorCheckPromise) {
      sensorCheckPromise = (async () => {
        const [profile, snapshot] = await Promise.all([
          getPlantCropProfile(supabase, plantId).then((p) => p ?? getCropProfile(null)),
          getLatestSensorSnapshot(supabase, plantId),
        ]);
        const sensorData: Record<string, unknown> = snapshot
          ? { temperature: snapshot.temperature, humidity: snapshot.humidity, soilPH: snapshot.soilPh }
          : {};
        return { profile, data: sensorData };
      })();
    }
    return sensorCheckPromise;
  }

  for (const quest of live) {
    const def = QUEST_DEFINITIONS[quest.quest_key];
    if (!def) continue;

    if (quest.status === "VERIFYING" && quest.verifying_since) {
      const doneMs = Date.parse(quest.verifying_since) + def.requiredSeconds * 1000;
      // plants already shows the trigger mood again with a change INSIDE the
      // verification window — the relapse event reached plants but its quest
      // transition hasn't landed (mid-request race or lost retry). Apply the
      // relapse here so the machine converges from plants state alone.
      const relapsePending = currentMood === def.triggerMood && stateChangedMs < doneMs;
      if (relapsePending) {
        await transition(supabase, quest.id, "VERIFYING", {
          status: "ACTIVE",
          verifying_since: null,
        });
      } else if (doneMs <= nowMs) {
        // Elapsed time alone is never enough to complete a recovery quest
        // (handoff §17): mood hysteresis is wider than the quest's own
        // verify thresholds, so the sensor can sit in a dead zone (e.g.
        // 27°C — below "enter Overheating" but above verifyTemperatureMax
        // 26) without a PLANT_STATE_CHANGED event ever firing to re-check
        // it. The lazy sweep is the only path that can observe this, so it
        // must consult the latest persisted sensor reading itself before
        // declaring the recovery verified.
        const { profile, data } = await sensorCheck();
        if (sensorBlocksRecovery(def, data, profile)) {
          await transition(supabase, quest.id, "VERIFYING", {
            status: "ACTIVE",
            verifying_since: null,
          });
        } else {
          const completedAt = new Date(doneMs).toISOString();
          const updated = await transition(supabase, quest.id, "VERIFYING", {
            status: "COMPLETED",
            completed_at: completedAt,
          });
          if (updated) {
            result.completed.push(updated);
            await emitQuestEvent(supabase, updated, "completed", completedAt);
          }
        }
      }
    } else if (quest.status === "ACTIVE" && def.kind === "maintain" && currentMood === def.triggerMood) {
      const doneMs = Date.parse(quest.started_at) + def.requiredSeconds * 1000;
      if (doneMs <= nowMs) {
        const completedAt = new Date(doneMs).toISOString();
        const updated = await transition(supabase, quest.id, "ACTIVE", {
          status: "COMPLETED",
          completed_at: completedAt,
        });
        if (updated) {
          result.completed.push(updated);
          await emitQuestEvent(supabase, updated, "completed", completedAt);
        }
      }
    }
  }

  return result;
}

/**
 * Reacts to a PLANT_STATE_CHANGED event. Deliberately driven by the live
 * quest rows + the NEW mood rather than trusting `previousState` from the
 * wire — replays and gaps cannot desynchronize the state machine.
 *
 * Per live quest:
 * - mood re-entered its trigger while VERIFYING → relapse back to ACTIVE.
 * - mood left a maintain quest's trigger → COMPLETED if the hold window had
 *   already passed at `occurredAt`, else EXPIRED (a new one starts on the
 *   next trigger entry).
 * - mood left a recovery quest's trigger → VERIFYING from `occurredAt`
 *   (never complete on one good sample — handoff Phase 7).
 * Then quests triggered by the new mood are created (unique partial index
 * makes creation race/replay-safe), and the lazy sweep runs.
 */
export async function handleStateChange(
  supabase: SupabaseClient,
  plantId: string,
  _previousState: PlantMood | null,
  currentState: PlantMood,
  occurredAt: string,
  data?: Record<string, unknown>,
): Promise<QuestEngineResult> {
  const result: QuestEngineResult = { created: [], completed: [], expired: [] };
  const occurredMs = Date.parse(occurredAt);
  const profile = (await getPlantCropProfile(supabase, plantId)) ?? getCropProfile(null);

  for (const quest of await fetchLiveQuests(supabase, plantId)) {
    const def = QUEST_DEFINITIONS[quest.quest_key];
    if (!def) continue;

    if (def.triggerMood === currentState) {
      if (quest.status === "VERIFYING" && quest.verifying_since) {
        const doneMs = Date.parse(quest.verifying_since) + def.requiredSeconds * 1000;
        if (doneMs <= occurredMs) {
          // The recovery provably held for the FULL window before this
          // re-entry — the completion was earned; relapsing would destroy
          // it. Complete now; the creation loop below then starts a fresh
          // quest for the new trigger entry.
          const completedAt = new Date(doneMs).toISOString();
          const updated = await transition(supabase, quest.id, "VERIFYING", {
            status: "COMPLETED",
            completed_at: completedAt,
          });
          if (updated) {
            result.completed.push(updated);
            await emitQuestEvent(supabase, updated, "completed", completedAt);
          }
        } else {
          await transition(supabase, quest.id, "VERIFYING", {
            status: "ACTIVE",
            verifying_since: null,
          });
        }
      }
      continue;
    }

    // The sensor value can contradict the mood label: still-hot air (or
    // still-unbalanced soil pH) while a different mood outranks the trigger
    // must relapse / block verification.
    if (quest.status === "VERIFYING" && sensorBlocksRecovery(def, data, profile)) {
      await transition(supabase, quest.id, "VERIFYING", {
        status: "ACTIVE",
        verifying_since: null,
      });
      continue;
    }

    if (quest.status !== "ACTIVE") continue;

    if (def.kind === "maintain") {
      const doneMs = Date.parse(quest.started_at) + def.requiredSeconds * 1000;
      if (doneMs <= occurredMs) {
        const completedAt = new Date(doneMs).toISOString();
        const updated = await transition(supabase, quest.id, "ACTIVE", {
          status: "COMPLETED",
          completed_at: completedAt,
        });
        if (updated) {
          result.completed.push(updated);
          await emitQuestEvent(supabase, updated, "completed", completedAt);
        }
      } else {
        const updated = await transition(supabase, quest.id, "ACTIVE", {
          status: "EXPIRED",
          expired_at: occurredAt,
        });
        if (updated) {
          result.expired.push(updated);
          await emitQuestEvent(supabase, updated, "expired", occurredAt);
        }
      }
    } else if (!sensorBlocksRecovery(def, data, profile)) {
      await transition(supabase, quest.id, "ACTIVE", {
        status: "VERIFYING",
        verifying_since: occurredAt,
      });
    }
  }

  for (const def of questsTriggeredBy(currentState)) {
    const { data, error } = await supabase
      .from("quests")
      .insert({
        plant_id: plantId,
        quest_key: def.key,
        status: "ACTIVE",
        xp_reward: def.xpReward,
        started_at: occurredAt,
      })
      .select()
      .single();

    if (error) {
      // 23505 = the quests_one_live_per_key partial unique index: a live
      // quest of this key already exists (replay or relapse) — not an error.
      if (error.code !== "23505") fail(`create ${def.key}`, error.message);
    } else if (data) {
      const created = data as QuestRow;
      result.created.push(created);
      await emitQuestEvent(supabase, created, "created", occurredAt);
    }
  }

  const sweep = await evaluateQuests(supabase, plantId);
  result.completed.push(...sweep.completed);
  result.expired.push(...sweep.expired);
  return result;
}
