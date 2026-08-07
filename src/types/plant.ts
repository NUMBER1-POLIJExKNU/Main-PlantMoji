import type { PlantMood } from "./events";

/** Row shape of the `plants` table (snake_case, as stored in Supabase). */
export interface Plant {
  id: string;
  name: string;
  species: string | null;
  crop_profile_key: string | null;
  personality: string | null;
  growth_stage: string | null;
  current_state: PlantMood;
  state_changed_at: string;
  created_at: string;
}
