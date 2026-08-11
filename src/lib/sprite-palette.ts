// Client-side pot palette swap for the seed-shop try-on preview (Phase 1,
// docs/superpowers/plans/2026-08-11-kiki-design-integration.md).
//
// Ports public/farm/jamkachu-sprite.js's canvas palette-swap algorithm to a
// small React-side module: an exact-hex swap constrained to the pot rows
// (rows ≥ 40/64 of the 64px grid) so leaves/face/outlines can never be
// touched. POT_RAMP / SKIN_RAMPS / POT_ITEM_RAMPS mirror the farm layer's
// tables VALUE-FOR-VALUE — pinned identical in
// tests/jamkachu-sprite-parity.test.ts, same guard as the stage/mood tables
// in src/lib/jamkachu-sprite.ts. Presentation only: this module never writes
// game state, and ANY failure (SSR call, tainted canvas, missing 2d context,
// decode error) resolves null so the caller falls back to the plain sprite —
// never a blank preview.

export interface PotRamp {
  body: string;
  rim: string;
  dark?: string;
}

/** Designer pot fills, sampled from the committed PNGs: the pot art is
 *  IDENTICAL across all 35 sprites — rows 40–60 of the 64px grid, six exact
 *  fills. The swap below recolors ONLY these hexes, ONLY inside the pot
 *  rows. */
export const POT_RAMP = {
  body: "#B08968", // pot body
  shade: "#926C4E", // pot body shade (right/bottom)
  rim: "#DEBA60", // rim base band
  rimLight: "#F5D67B", // rim light band
  rimHi: "#FCECB0", // rim top highlight
  glint: "#FAD060", // small gold glint at the rim/body seam
} as const;

/** Pot pixels live below this row of the 64px grid (row 40 of 64). */
export const POT_TOP_FRACTION = 40 / 64;

/** Cosmetic skin ramps (milestone20, display-only). "jamkachu" is null on
 *  purpose: the designer's own pot IS the default look. Mirrors the farm
 *  layer's SKIN_RAMPS exactly. */
export const SKIN_RAMPS: Record<string, PotRamp | null> = {
  jamkachu: null,
  edamame: { body: "#9CCB5D", rim: "#BADB8E", dark: "#6D8E41" },
  padi: { body: "#E8C95A", rim: "#EFD98C", dark: "#A28D3F" },
  jagung: { body: "#F5B93F", rim: "#F8CE79", dark: "#AC822C" },
  kopi: { body: "#8A5A3B", rim: "#AD8C76", dark: "#613F29" },
  kakao: { body: "#B0693C", rim: "#C89677", dark: "#7B4A2A" },
  buah_naga: { body: "#E85FA2", rim: "#EF8FBE", dark: "#A24371" },
};

/** Shop pot-item ramps (milestone18 — equipped pot wins over skin), keyed by
 *  the SHOP_CATALOG pot item keys. Mirrors the farm layer's POT_ITEM_RAMPS
 *  exactly. */
export const POT_ITEM_RAMPS: Record<string, PotRamp> = {
  pot_terracotta: { body: "#C86B4A", rim: "#E08B5F", dark: "#9A4E33" },
  pot_batik: { body: "#5B4632", rim: "#8A6B48" }, // squares #E8D5A9/#B8862F retired
  pot_tincan: { body: "#B9C2C9", rim: "#D7DDE2", dark: "#8E979E" }, // highlight #F2F6F8 retired
  pot_coffee_sack: { body: "#A98055", rim: "#C59B68" },
  pot_bamboo: { body: "#C9A84E", rim: "#E1C56A", dark: "#7E8637" },
  pot_jember_mosaic: { body: "#3C8C75", rim: "#56A9B8" }, // zigzag #F1D36B retired
};

/** Bond Lv.10 keepsake: the pot itself turns permanently gold on the farm
 *  (docs/superpowers/specs/2026-08-07-dopamine-ux-reframe-design.md: "Lv.10
 *  special pot"), and public/farm/jamkachu-sprite.js's activeRamp() checks
 *  this BEFORE the equipped shop pot or skin — Lv.10 always wins. Mirrors
 *  the farm's GOLDPOT_RAMP literal value-for-value (pinned in
 *  tests/jamkachu-sprite-parity.test.ts). The farm literal also carries
 *  shade/rimLight/rimHighlight/glint fields its own buildSwapMap never
 *  reads (only body/rim/dark are consumed there) — we omit `dark` here too
 *  so the computed swap (mixHex-derived shade/tints) is pixel-identical. */
export const GOLDPOT_RAMP: PotRamp = {
  body: "#D9A63C",
  rim: "#F2D268",
};

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(hex: string, targetHex: string, amount: number): Rgb {
  const a = hexToRgb(hex);
  const b = hexToRgb(targetHex);
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * amount)) as Rgb;
}

/** Builds the designer-hex → replacement-RGB map for one target ramp. The
 *  six designer fills collapse onto {body, rim, dark} + fixed tints,
 *  matching the light/shade ratios the designer's own pot uses. */
function buildSwapMap(ramp: PotRamp): Record<string, Rgb> {
  const dark = ramp.dark ?? null;
  return {
    [POT_RAMP.body]: hexToRgb(ramp.body),
    [POT_RAMP.shade]: dark ? hexToRgb(dark) : mixHex(ramp.body, "#000000", 0.3),
    [POT_RAMP.rim]: hexToRgb(ramp.rim),
    [POT_RAMP.rimLight]: mixHex(ramp.rim, "#FFFFFF", 0.35),
    [POT_RAMP.rimHi]: mixHex(ramp.rim, "#FFFFFF", 0.65),
    [POT_RAMP.glint]: mixHex(ramp.body, "#FFFFFF", 0.25),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`sprite-palette: failed to load ${src}`));
    image.src = src;
  });
}

/** `${src}|${body}|${rim}|${dark}` → resolved blob URL. Small in-memory
 *  cache so re-selecting the same pot on the same base sprite doesn't
 *  re-decode/re-paint the canvas. */
const swapCache = new Map<string, string>();

/**
 * Recolors one sprite's pot pixels to `ramp`, constrained to rows at or
 * below 40/64 of the image height and to the exact designer pot hexes —
 * leaves/face/outlines are never touched. Resolves an object URL, or null on
 * ANY failure (SSR call, tainted canvas, missing 2d context, decode error).
 * Callers MUST fall back to the plain `src` on null — never render a blank
 * preview. Browser-only (Image/canvas/URL.createObjectURL).
 */
export async function swapPotPalette(src: string, ramp: PotRamp): Promise<string | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  const cacheKey = `${src}|${ramp.body}|${ramp.rim}|${ramp.dark ?? ""}`;
  const cached = swapCache.get(cacheKey);
  if (cached) return cached;
  try {
    const image = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    const potTop = Math.floor(canvas.height * POT_TOP_FRACTION);
    const frame = ctx.getImageData(0, potTop, canvas.width, canvas.height - potTop);
    const data = frame.data;
    const map = buildSwapMap(ramp);
    const lut = new Map<number, Rgb>();
    for (const hex of Object.keys(map)) {
      const [r, g, b] = hexToRgb(hex);
      lut.set((r << 16) | (g << 8) | b, map[hex]);
    }
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue; // transparent pixel, leave alone
      const repl = lut.get((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      if (!repl) continue; // exact ramp hexes only
      data[i] = repl[0];
      data[i + 1] = repl[1];
      data[i + 2] = repl[2];
    }
    ctx.putImageData(frame, 0, potTop);
    const url = await new Promise<string | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/png");
    });
    if (url) swapCache.set(cacheKey, url);
    return url;
  } catch {
    return null; // tainted canvas / OOM / decode error: caller keeps the plain sprite
  }
}

/** Ramp for a shop pot item key, or null when the key isn't a recolorable
 *  pot. Callers pass the result straight to swapPotPalette. */
export function potRampFor(itemKey: string | null | undefined): PotRamp | null {
  if (!itemKey) return null;
  return POT_ITEM_RAMPS[itemKey] ?? null;
}
