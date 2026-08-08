import type { BadgeKey } from "@/types/game";

export interface BadgeEffectDefinition {
  badgeKey: BadgeKey;
  particles: string[];
  name: { en: string; id: string };
}

export const BADGE_EFFECT_STORAGE_KEY = "plantmoji_badge_effect_v1";

/** Cosmetic tap effects only. They never affect sensors, quests, or XP. */
export const BADGE_EFFECTS: Record<BadgeKey, BadgeEffectDefinition> = {
  FIRST_RESCUE: { badgeKey:"FIRST_RESCUE",particles:["💚","✨","💚"],name:{en:"Healing hearts",id:"Hati penyembuh"} },
  LIGHT_MASTER: { badgeKey:"LIGHT_MASTER",particles:["☀️","✨","🌟"],name:{en:"Sun shower",id:"Hujan matahari"} },
  LEVEL_5_BOND: { badgeKey:"LEVEL_5_BOND",particles:["💚","💛","💚"],name:{en:"Friendship hearts",id:"Hati persahabatan"} },
  COOL_KEEPER: { badgeKey:"COOL_KEEPER",particles:["❄️","🧊","❄️"],name:{en:"Snow burst",id:"Ledakan salju"} },
  PH_GUARDIAN: { badgeKey:"PH_GUARDIAN",particles:["🌱","✨","🌿"],name:{en:"Soil sprouts",id:"Tunas tanah"} },
  STREAK_7: { badgeKey:"STREAK_7",particles:["🔥","7️⃣","🔥"],name:{en:"Care flame",id:"Api perawatan"} },
  HUMIDITY_HERO: { badgeKey:"HUMIDITY_HERO",particles:["💧","☁️","💦"],name:{en:"Cloud splash",id:"Percikan awan"} },
  MOOD_SCHOLAR: { badgeKey:"MOOD_SCHOLAR",particles:["😊","😮","🤓"],name:{en:"Mood pop",id:"Pop suasana"} },
  CARE_VETERAN: { badgeKey:"CARE_VETERAN",particles:["⭐","🌟","⭐"],name:{en:"Quest stars",id:"Bintang misi"} },
  CHRONICLER: { badgeKey:"CHRONICLER",particles:["✏️","📓","✨"],name:{en:"Story scribbles",id:"Coretan cerita"} },
  STREAK_30: { badgeKey:"STREAK_30",particles:["🏆","✨","🌟"],name:{en:"Golden celebration",id:"Perayaan emas"} },
  LEVEL_10_BOND: { badgeKey:"LEVEL_10_BOND",particles:["💛","👑","💛","✨"],name:{en:"Best-friend hug",id:"Pelukan sahabat"} },
};
