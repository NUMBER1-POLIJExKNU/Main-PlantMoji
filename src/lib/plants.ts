import "server-only";
import { getServerSupabase } from "./supabase/server";
import type { Plant } from "@/types/plant";
import type { BondState, QuestRow } from "@/types/game";

export type PlantFetchResult =
  | { status: "ok"; plant: Plant }
  | { status: "not-found" }
  | { status: "no-env" }
  | { status: "error"; message: string };

export async function fetchPlant(plantId: string): Promise<PlantFetchResult> {
  const supabase = getServerSupabase();
  if (!supabase) return { status: "no-env" };

  const { data, error } = await supabase
    .from("plants")
    .select("*")
    .eq("id", plantId)
    .maybeSingle();

  if (error) {
    console.error(`fetchPlant(${plantId}) failed:`, error.message);
    return { status: "error", message: error.message };
  }
  if (!data) return { status: "not-found" };
  return { status: "ok", plant: data as Plant };
}

/** Bond progression row; null when milestone3.sql hasn't been run yet. */
export async function fetchBondState(plantId: string): Promise<BondState | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("bond_state")
    .select("*")
    .eq("plant_id", plantId)
    .maybeSingle();

  if (error) {
    console.error(`fetchBondState(${plantId}) failed:`, error.message);
    return null;
  }
  return (data as BondState) ?? null;
}

/** The most recent live (ACTIVE/VERIFYING) quest for the home screen card. */
export async function fetchTopActiveQuest(plantId: string): Promise<QuestRow | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("plant_id", plantId)
    .in("status", ["ACTIVE", "VERIFYING"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`fetchTopActiveQuest(${plantId}) failed:`, error.message);
    return null;
  }
  return (data as QuestRow) ?? null;
}
