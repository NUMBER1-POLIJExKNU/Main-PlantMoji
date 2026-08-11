# Kiki Design Integration — designer sprites become Jamkachu

**Goal:** The team designer's pixel-art packs (Big Plant ×3 accessory tiers + 6-NPC cast) fully replace the code-drawn character art across the app, with every existing system (moods, evolution, skins, shop, NPCs, FX) re-seated on top. Nothing from the packs goes unused; no gameplay/truth logic changes.

**User decisions (2026-08-11):** (1) FULL replacement + system porting — sprites are the one true Jamkachu. (2) Accessory tiers (bare → head bow → prize ribbon) are automatic bond-level rewards, not shop items.

## Assets (already in `public/farm/assets/`, committed with this plan)

- `jamkachu/{1x,2x,4x}/plant-p{1..4}-{seed,sprout,flower,fruit}-{happy,plain,thirsty,sleepy,overheat}[-bow|-ribbon].png` — 64px grid; suffix: none=bare, `-bow` (p3, p4), `-ribbon` (p4 only). p1/p2 have no tier variants.
- `jamkachu/gif/{growth-happy,growth-plain,moods-p4}[-bow|-ribbon].gif` — 192px, 4 frames.
- `npc/{1x,2x,4x,8x}/npc-0{1..6}-{pak-tani,botanis,penjelajah,pedagang,moji-bot,mbah-tani}.png` — 32px grid; `npc/gif/*.gif` idle anims (3–4 frames) + `npc-cast-idle.gif` (full cast strip).

## Mapping tables (single source: `public/farm/jamkachu-sprite.js` + mirror `src/lib/jamkachu-sprite.ts`, parity-tested like companion-ladder)

- **Stage→phase:** Seed→p1 · Sprout,Seedling→p2 · Bud,Bloom→p3 · Fruit,Guardian,Elder,Radiant,Legend→p4. Late-stage differentiation stays via `--companion-accent` aura overlay + decor + ceremony (stage-extra SVG groups retire).
- **Mood→sprite** (8 `PlantMood` + night): Happy→happy · Sleepy→sleepy · Overheating→overheat · DryAir→thirsty · TooCold/HumidAir/SoilAcidic/SoilAlkaline→plain **+ status emoji chip** (🥶/💦/🧪/🧪) floated near the sprite head (aria-hidden; `#char-mood` text remains the accessible signal — the 8 moods must stay distinguishable). Night sleep (`sleepShown`)→sleepy.
- **Bond→tier:** bond_level ≥8 → ribbon · ≥4 → bow · else bare. Clamp by phase: p1/p2 always bare, p3 caps at bow. (Thresholds ride the skins pacing 1/2/4/6/8/10/12.)
- **Sprite src:** `assets/jamkachu/4x/plant-p{n}-{phase}-{mood}{tier?}.png` (4x source everywhere, `image-rendering:pixelated`).

## Architecture (farm layer — production `/`)

1. `index.html`: the inline `<svg class="mascot-svg">` (~lines 225–649) becomes `<div class="mascot-svg">` containing: `<img id="jamkachu-sprite">` + a THIN overlay `<svg class="mascot-overlay">` keeping ONLY the shop accessory groups (`shop-g-acc_*`) and pot-anchored decor (`decor-sticker/flag/goldpot`), repositioned to the sprite footprint + `#mood-status-chip` + the existing `.shop-decor-layer`. All face/`stage-extra`/`crop-variant`/pot groups are deleted. The `.mascot-svg` div KEEPS receiving every existing class (`face-*`, `companion-*`, `skin-*`, `shop-*`, `decor-lv*`, `is-tapface`, breath classes) — classes stay the state channel.
2. `jamkachu-sprite.js` (NEW, loaded before live.js): `window.PMSprite` with `repaint()` (reads mood/stage/bond/skin/equips → sets img src + chip), `paletteSwap(img, ramp)` (canvas, pot-region + exact designer pot hexes only → skin/pot-item ramps; cache per (src,ramp) as blob URL; on any canvas failure fall back to un-swapped sprite — never a blank mascot), preloading (current phase's 5 moods + next phase happy).
3. `live.js` surgical hooks ONLY (keep function contracts): `setMascotMood`, `renderCompanion`, `applySkinClass`, `updateCareUi` (sleep), `renderShopPurchases`, `applyDecorations` each end with `PMSprite.repaint()`. `showPetExpression`/`PET_EXPRESSION_POOLS` re-target: pools become {sprite-mood flash + emoji burst} pairs (tap variety survives, designer art stays the face). `maybeIdleExpression`: pupil-nudge/blink retire → idle bob/tilt on the container + occasional sparkle. Evolution sequencer: `setStage()` classes keep driving; repaint on each step; `.evo-sil`/`.evo-flash`/crossfade CSS filters apply to the div/img unchanged.
4. **Skins + shop pots = palette swaps** of the sprite's pot pixels (skin ramps from `companion-skins.js` palettes; each shop pot item gets a ramp derived from its old SVG hex fills). Precedence: equipped shop pot > skin > designer default. Shop ACCESSORIES stay as overlay-SVG groups above the img (hat/crown on the head crown, never over the eyes). Crop silhouettes (`crop-*` mascot variants) retire from the mascot (crop identity lives in skins/pot + text); note in commit message.
5. `style.css`: delete face/tap/stage-extra/crop-variant/pot rules; add sprite sizing (img fills the old 300×350 stage footprint, pixelated), breath = subtle whole-body `scaleY` bob on the div (reduced-motion gated), chip styles, night dim unchanged.
6. **Farmer NPC → mbah-tani:** replace `.npc-farmer::before/::after` box-shadow frames with `<img src="assets/npc/gif/npc-06-mbah-tani.gif">` inside `#npc-farmer`; WAAPI wander/drag/night-bed/chat logic untouched (they move the container); facing flip = `scaleX(-1)` on the img.

## React layer

7. `src/lib/jamkachu-sprite.ts` (mirror of the mapping) + `spriteSrc()` helper; parity test.
8. `mascot.tsx` → renders the sprite img (mood/stage/tier props) — used by growth-showcase (demo panel, all routes) and dead-routed plant-home. `pixel-loading-toy` → `plant-p2-sprout-happy.png`. `.pm-memory-jamkachu` / `.pm-report-jamkachu` mini-mascots → sprite imgs (p3 happy / p4 per report tone).
9. `farmer-npc.tsx` → mbah-tani gif art (behavior untouched).
10. **NPC placements:** pedagang→`/shop` keeper header · pak-tani→`/quests` header · botanis→`/monitoring` header accent · moji-bot→`/camera` AI-advisory card avatar + demo control center · penjelajah→crop explorer surface · farm guide dialog (CARA BERMAIN) footer gets `npc-cast-idle.gif`; wardrobe panel header gets `moods-p4` gif (current tier); growth gif in the guide's "how I grow" row. All `<img>` with localized alt text; decorative uses aria-hidden.

## Constraints

- No engineering vocabulary in player UI; en+id copy parity for any new strings (NPC name labels use the designer's Indonesian names as-is).
- No realtime IDs, routes, or engine/table writes change. Zero gameplay logic changes.
- Reduced-motion: no new always-on animation; GIF usage is ambient-only (idle anims), respect `prefers-reduced-motion` by swapping GIF→static PNG where feasible.
- All sprite files referenced must exist (fs contract test enumerating the full matrix); no 404s offline (same-origin static, no CDN).
- Sub-800px and desktop rail: img scales within existing `.mascot-wrapper` sizing rules; no horizontal overflow.

## Test plan

- Rewrite: `jamkachu-expressions`, `jamkachu-expression-variety` (pin new pool contract), `farm-evolution-visuals` (phase mapping + ceremony hooks), `farm-shop-layer` (overlay accessories + pot ramps), `companion-skins-parity` (palette tables replace `.skin-*` CSS pot blocks), `farmer-npc-ui`, `react-farmer-npc` (img art).
- New: `jamkachu-sprite-parity.test.ts` (farm↔React tables identical, tier clamps, mood map total over all 8 moods), `jamkachu-sprite-assets.test.ts` (every mapped src exists on disk, all 145 files reachable), NPC placement smoke pins.
- `pet-response`, ladder/skins data tests: keep green (contract preserved).
- Full vitest + lint + `next build --webpack` green before merge to main.

## Sequencing (contested-file caution)

Implemented on branch `worktree-design-kiki-sprites`; farm triad (live.js/index.html/style.css) is concurrently edited on main by another session — merge to main happens LAST, deliberately, rebasing over whatever landed.
