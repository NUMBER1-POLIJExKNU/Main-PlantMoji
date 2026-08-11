// NPC cast badge (kiki design integration) — one designer sprite plus its
// visible name, rendered as a small header/avatar accent. The badge plays the
// designer's ambient idle GIF (a tiny 160×144 farm diorama, 3–4 frame loop);
// under prefers-reduced-motion the <picture> source swaps in the static PNG,
// picked from the four committed export scales via srcSet so every effective
// pixel density (device DPR and page zoom alike) gets the crispest file —
// all four designer scales are live candidates, none dead weight.
//
// Accessibility contract: the visible <b> name is the accessible signal, so
// the sprite art itself stays decorative (empty alt + aria-hidden).

import { npcNameLabel, type AppLocale, type NpcKey } from "@/lib/i18n";

export const NPC_SPRITE_FILES: Record<NpcKey, string> = {
  "pak-tani": "npc-01-pak-tani",
  botanis: "npc-02-botanis",
  penjelajah: "npc-03-penjelajah",
  pedagang: "npc-04-pedagang",
  "moji-bot": "npc-05-moji-bot",
  "mbah-tani": "npc-06-mbah-tani",
};

/** The designer's four export scales of the 32-grid art: 32/64/128/256px. */
export const NPC_SCALES = ["1x", "2x", "4x", "8x"] as const;
export type NpcScale = (typeof NPC_SCALES)[number];

export function npcSpriteSrc(npc: NpcKey, scale: NpcScale = "4x"): string {
  return `/farm/assets/npc/${scale}/${NPC_SPRITE_FILES[npc]}.png`;
}

/** Ambient idle loop on the designer's grass backdrop (GIFs carry no alpha).
 *  Only safe over that same grass — see npcStillImgProps below. */
export function npcIdleGifSrc(npc: NpcKey): string {
  return `/farm/assets/npc/gif/${NPC_SPRITE_FILES[npc]}.gif`;
}

/** All four committed scales as one responsive srcSet (32w…256w). Pair with
 *  a `sizes` matching the CSS slot and the browser picks the crispest file
 *  for the effective density. */
export function npcSpriteSrcSet(npc: NpcKey): string {
  return NPC_SCALES.map((scale, index) => `${npcSpriteSrc(npc, scale)} ${32 * 2 ** index}w`).join(", ");
}

/** The still sprite, ready to spread onto an <img>.
 *
 *  Every one of the six idle GIFs opens on a frame with its transparency flag
 *  off, so frame 0 paints the whole 160×144 canvas — the designer's grass
 *  diorama — opaque, and later frames only overlay it. Placed anywhere other
 *  than that same grass (a shop stage, a page header) the NPC therefore
 *  arrives inside a solid rectangle. The PNG exports are RGBA and carry the
 *  identical drawing without the backdrop, which is the trade already made for
 *  Mbah Tani on the home farm. Motion is the thing given up, and it is worth
 *  less than the sprite sitting in the scene it was placed in. */
export function npcStillImgProps(npc: NpcKey, sizes: string) {
  return { src: npcSpriteSrc(npc, "2x"), srcSet: npcSpriteSrcSet(npc), sizes };
}

export default function NpcBadge({
  npc,
  locale,
  note,
}: {
  npc: NpcKey;
  locale: AppLocale;
  /** Optional localized one-liner (pass copy that already exists in both locales). */
  note?: string;
}) {
  return (
    <span className="pm-npc-badge">
      {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
      <img {...npcStillImgProps(npc, "64px")} alt="" aria-hidden="true" width={70} height={63} />
      <span>
        <b>{npcNameLabel(locale, npc)}</b>
        {note && <small>{note}</small>}
      </span>
    </span>
  );
}
