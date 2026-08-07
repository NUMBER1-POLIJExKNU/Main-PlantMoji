"use server";

import { revalidatePath } from "next/cache";
import { getCropProfile, isCropProfileKey } from "@/lib/crop-profiles";
import { getServerSupabase } from "@/lib/supabase/server";

export async function updateCropProfile(formData: FormData): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  const plantId = formData.get("plantId");
  const profileKey = formData.get("cropProfileKey");
  if (typeof plantId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(plantId)) return;
  if (!isCropProfileKey(profileKey)) {
    console.error("updateCropProfile rejected an unknown crop profile key");
    return;
  }

  const profile = getCropProfile(profileKey);
  const { error } = await supabase
    .from("plants")
    .update({ crop_profile_key: profile.key, species: profile.species })
    .eq("id", plantId);
  if (error) {
    console.error(`updateCropProfile(${plantId}) failed:`, error.message);
    return;
  }

  revalidatePath("/plants");
  revalidatePath("/");
  revalidatePath("/reports");
}
