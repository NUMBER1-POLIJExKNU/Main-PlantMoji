// Build an "unwell" face from the designer's own pixels: the worried frown
// of the thirsty art with the gentle closed eyes of the sleepy art. The
// thirsty face's big dark ovals read as sullen when the mascot is shown
// large, and four of the eight moods have to wear it.
//
// The swap region is measured per file (never hardcoded): the union of the
// eye pixels in BOTH source faces, so the ovals are fully covered and the
// lids land where they were drawn.
import { writeFileSync } from "node:fs";
import sharp from "sharp";
const WT = "C:/Users/hennr/Desktop/JEMBER/PROJECT/PROGRAM/plantmoji/.claude/worktrees/design-kiki-sprites";
const OUT = "C:/Users/hennr/AppData/Local/Temp/claude/C--Users-hennr-Desktop-JEMBER-PROJECT-PROGRAM-plantmoji/1aa1282a-fadc-434c-a7c8-1dba1fc96ca9/scratchpad";

/** Bounding box of dark pixels the body fully encloses — the eyes, never
 *  the head outline (which always has transparency on one side). */
async function eyeBox(file) {
  const { data, info } = await sharp(file).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const R = Math.max(4, Math.round(W / 36));
  const opaque = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 40;
  const dark = (x, y) => { const i = (y * W + x) * 4; return data[i + 3] > 40 && data[i] < 95 && data[i + 1] < 105 && data[i + 2] < 95; };
  let top = null, bot = null, left = W, right = 0, rows = [];
  for (let y = R; y < H - R; y++) {
    let n = 0, lo = W, hi = 0;
    for (let x = R; x < W - R; x++) {
      if (dark(x, y) && opaque(x - R, y) && opaque(x + R, y) && opaque(x, y - R) && opaque(x, y + R)) { n++; if (x < lo) lo = x; if (x > hi) hi = x; }
    }
    rows.push({ y, n, lo, hi });
  }
  for (const r of rows) {
    if (r.n < 3) continue;
    if (top === null) { top = r.y; bot = r.y; left = r.lo; right = r.hi; }
    else if (r.y - bot <= 3) { bot = r.y; left = Math.min(left, r.lo); right = Math.max(right, r.hi); }
    else break; // stop at the mouth
  }
  return top === null ? null : { top, bot, left, right };
}

export async function buildUnwell(phase, slug, tier, scale) {
  const suffix = tier ? `-${tier}` : "";
  const dir = `${WT}/public/farm/assets/jamkachu/${scale}`;
  const thirsty = `${dir}/plant-p${phase}-${slug}-thirsty${suffix}.png`;
  const sleepy = `${dir}/plant-p${phase}-${slug}-sleepy${suffix}.png`;
  const a = await eyeBox(thirsty), b = await eyeBox(sleepy);
  if (!a || !b) throw new Error(`eye box not found for p${phase} ${scale}${suffix}`);
  const pad = Math.max(1, Math.round(Number(scale.replace("x", "")) / 2));
  const meta = await sharp(thirsty).metadata();
  const left = Math.max(0, Math.min(a.left, b.left) - pad);
  const top = Math.max(0, Math.min(a.top, b.top) - pad);
  const width = Math.min(meta.width - left, Math.max(a.right, b.right) + pad - left + 1);
  const height = Math.min(meta.height - top, Math.max(a.bot, b.bot) + pad - top + 1);
  const eyes = await sharp(sleepy).extract({ left, top, width, height }).png().toBuffer();
  return sharp(thirsty).composite([{ input: eyes, left, top }]).png().toBuffer();
}

const VARIANTS = [
  [1, "seed", [""]], [2, "sprout", [""]],
  [3, "flower", ["", "bow"]], [4, "fruit", ["", "bow", "ribbon"]],
];

if (process.argv[2] === "preview") {
  const tiles = [];
  const show = [[4, "fruit", "ribbon"], [4, "fruit", ""], [3, "flower", "bow"], [2, "sprout", ""]];
  for (let i = 0; i < show.length; i++) {
    const buf = await buildUnwell(show[i][0], show[i][1], show[i][2], "4x");
    tiles.push({ input: await sharp(buf).resize(230, 230, { kernel: "nearest" }).png().toBuffer(), left: i * 235, top: 0 });
  }
  await sharp({ create: { width: 940, height: 230, channels: 4, background: { r: 245, g: 248, b: 240, alpha: 1 } } })
    .composite(tiles).toFile(`${OUT}/unwell-preview.png`);
  console.log("p4-ribbon | p4-bare | p3-bow | p2");
} else if (process.argv[2] === "write") {
  let n = 0;
  for (const [phase, slug, tiers] of VARIANTS) {
    for (const tier of tiers) {
      for (const scale of ["1x", "2x", "4x"]) {
        const buf = await buildUnwell(phase, slug, tier, scale);
        writeFileSync(`${WT}/public/farm/assets/jamkachu/${scale}/plant-p${phase}-${slug}-unwell${tier ? `-${tier}` : ""}.png`, buf);
        n++;
      }
    }
  }
  console.log(`wrote ${n} unwell sprites`);
}
