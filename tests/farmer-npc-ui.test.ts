import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const html = source("public/farm/index.html");
const live = source("public/farm/live.js");
const css = source("public/farm/style.css");
const strings = source("public/farm/strings.js");
const assetExists = (publicPath: string) =>
  existsSync(resolve(process.cwd(), "public", publicPath.replace(/^\//, "")));

describe("Farmer Tani living-world UI", () => {
  it("draws the same Farmer Tani sprite as Quests, not box-shadow art", () => {
    // Transparent responsive PNG art avoids the GIF's opaque rectangle.
    expect(html).toContain('class="npc-farmer-img"');
    expect(html).not.toContain("/farm/assets/npc/gif/npc-01-pak-tani.gif");
    expect(html).toContain('src="/farm/assets/npc/2x/npc-01-pak-tani.png"');
    expect(html).toContain("/farm/assets/npc/8x/npc-01-pak-tani.png 256w");
    // The chat dialog portrait shows the same character's static art.
    expect(html).toMatch(
      /class="farmer-chat-portrait"[^>]*><img src="\/farm\/assets\/npc\/2x\/npc-01-pak-tani\.png" alt=""/,
    );
    // The retired ~90-layer box-shadow walk frames and their steps() cycle.
    expect(css).not.toContain(".npc-farmer::before");
    expect(css).not.toContain(".npc-farmer::after");
    expect(css).not.toContain("pm-npc-step-a");
    expect(css).not.toContain("pm-npc-step-b");
    // Sprite img: pixelated, feet on the button's bottom edge, and never
    // swallowing pointer events (drag/click targets stay on the button).
    expect(css).toMatch(/\.npc-farmer-img \{[\s\S]*?image-rendering: pixelated/);
    expect(css).toMatch(/\.npc-farmer-img \{[\s\S]*?pointer-events: none/);
    expect(css).toMatch(/\.npc-farmer-img \{[\s\S]*?object-position: center bottom/);
    // Facing flip: live.js writes scaleX(±1) on the BUTTON and the img
    // inherits the mirror — the img itself must never counter-flip (only
    // the AI-CHAT tag does, pinned in the walk-label test below).
    expect(css).not.toMatch(/\.npc-farmer-img[^{]*\{[^}]*scaleX/);
    // Both referenced files ship with the page.
    expect(assetExists("farm/assets/npc/2x/npc-01-pak-tani.png")).toBe(true);
  });

  it("puts the same farmer NPC to bed at night instead of hiding him", () => {
    expect(html).toContain('class="npc-farmer-bed"');
    expect(html).toContain('class="npc-sleep-zzz"');
    expect(css).toMatch(/body\.night \.npc-farmer\.npc-ready[\s\S]*?opacity:\s*1/);
    expect(css).toContain("body.night .npc-farmer-bed { display: block; }");
    expect(css).not.toMatch(/body\.night \.npc-farmer\s*\{[^}]*opacity:\s*0/);
    expect(live).toContain('farmerTag.textContent = night ? "Zzz.."');
    expect(live).toContain("function wakeFarmerAtNight()");
    expect(live).toContain("function scheduleFarmerNightSleep()");
    expect(live).toContain("}, 3000);");
    expect(css).toContain("body.night.farmer-night-awake .npc-farmer-bed { display:none; }");
  });

  it("measures the real grass boundary instead of wandering by viewport width", () => {
    expect(live).toContain('const grass = $(".grass-floor")');
    expect(live).toContain("grass.getBoundingClientRect()");
    expect(live).not.toContain("pm-npc-wander");
  });

  it("keeps the walk lane inside the character column, clear of the status cards", () => {
    // The grass runs under both desktop grid columns, but .mascot-stage
    // (z-index 5) is its own stacking context and .home-stack sits at 10 —
    // the farmer's z-index 15 cannot lift him above the cards, so the lane
    // itself has to stop where the character column does.
    expect(live).toContain('const stage = $(".mascot-stage")?.getBoundingClientRect()');
    expect(live).toContain("Math.max(rect.left, stage ? stage.left : rect.left)");
    expect(live).toContain("Math.min(rect.right, stage ? stage.right : rect.right)");
    // Footing still comes from the grass, only the horizontal span is clamped.
    expect(live).toContain("top: Math.round(rect.top - height + 8)");
    // A column narrower than the sprite must not produce right < left.
    expect(live).toContain("Math.max(left, laneRight - width - 12)");
    // Lane depends on the stage now, so its resize has to restart the wander.
    expect(live).toContain('for (const el of [$(".grass-floor"), $(".mascot-stage")])');

    // The weather/clock row must not sit under the fixed 44px mute button.
    expect(css).toMatch(/\.hud-top \{[\s\S]*?right:\s*44px/);
  });

  it("implements the fall, vine, climb, and reduced-motion paths", () => {
    expect(live).toContain("farmerFallAndClimb");
    expect(live).toContain('vine.classList.add("is-visible")');
    expect(live).toContain('matchMedia?.("(prefers-reduced-motion: reduce)")');
    expect(css).toContain(".npc-farmer-vine");
  });

  it("provides an accessible localized chat dialog with server-side answers", () => {
    expect(html).toContain('id="farmer-chat"');
    expect(html).toContain('aria-labelledby="farmer-chat-title"');
    expect(html.indexOf('id="farmer-chat"')).toBeGreaterThan(html.indexOf('</main>'));
    expect(live).toContain('fetch("/api/farmer-chat"');
    expect(live).toContain("VIRTUAL SENSOR DATA · DEMO MODE");
    expect(live).not.toContain("instanceof HTMLDialogElement");
    expect(live).toContain('typeof dialog.showModal === "function"');
    expect(css).toMatch(/\.npc-farmer\s*\{[\s\S]*?z-index:\s*15/);
    expect(css).toMatch(/\.farmer-chat\s*\{[\s\S]*?pointer-events:\s*auto/);
    expect(css).toMatch(/\.farmer-chat input[\s\S]*?pointer-events:\s*auto/);
  });

  it("schedules varied autonomous speech without interrupting important states", () => {
    expect(live).toContain("FARMER_FIRST_MIN_MS = 8_000");
    expect(live).toContain("FARMER_AUTO_MAX_MS = 70_000");
    expect(live).toContain("FARMER_COOLDOWN_MS = 25_000");
    expect(live).toContain("farmerCanSpeakAutonomously");
    expect(live).toContain("fxQueue.length === 0");
    expect(live).toContain('classList.contains("npc-falling")');
    expect(live).toContain("farmerRecentLines.length > 3");
  });

  it("keeps idle lines deterministic, bilingual, and opens chat from the bubble", () => {
    expect(strings).toContain("A sensor is a clue, not a command");
    expect(strings).toContain("Sensor itu petunjuk, bukan perintah");
    expect(live).toContain('bubble.addEventListener("click", openFarmerChat)');
    expect(css).toMatch(/\.npc-bubble[\s\S]*?pointer-events:\s*auto/);
    expect(html).toContain('class="npc-ai-tag"');
    expect(live).toContain("TAP FOR AI CHAT");
  });
  it("keeps the AI CHAT label upright while the sprite walks left", () => {
    // The tag is a child of the flipped button, so scaleX(-1) mirrored its
    // text on the leftward leg of every lap. CSS cannot read the parent's
    // animated transform, hence the class + counter-flip pair below.
    expect(css).toMatch(/\.npc-farmer\.npc-facing-left\s+\.npc-ai-tag[\s\S]*?scaleX\(-1\)/);
    expect(live).toContain("function setFarmerFacing");
    expect(live).toContain('classList.toggle("npc-facing-left", facing < 0)');

    // Every path that writes a transform must re-sync the flip, or the label
    // gets stuck mirrored after a fall, a carry, or a direction change.
    expect(live).toMatch(/setFarmerFacing\(facing\);[\s\S]{0,120}npc-walking/); // walk
    expect(live).toMatch(/npc-falling"\);\s*\n\s*setFarmerFacing\(-1\)/); // teeter
    expect(live).toMatch(/setFarmerFacing\(1\);[\s\S]{0,160}rotate\(-16deg\)/); // fall + climb
    expect(live).toMatch(/transform = "none";\s*\n\s*setFarmerFacing\(1\)/); // grab
    expect(live).toMatch(/transform = "scaleX\(1\)";\s*\n\s*setFarmerFacing\(1\)/); // landing
  });

  it("lets the farmer be grabbed and returns him to the measured grass floor", () => {
    expect(live).toContain('addEventListener("pointerdown", startFarmerDrag)');
    expect(live).toContain('window.addEventListener("pointermove", moveFarmerDrag');
    expect(live).toContain("event.preventDefault()");
    expect(live).toContain("suppressFarmerClick");
    expect(live).toContain("Please put me down, my young friend!");
    expect(live).toContain("Tolong turunkan Kakek, Nak!");
    expect(live).toContain("Math.hypot");
    expect(live).toContain("const ground = farmerGround()");
    expect(live).toContain("Math.min(ground.right, currentLeft)");
    expect(live).toContain('!farmer.classList.contains("npc-ready")');
    expect(live).toContain("Math.min(ground.right, startLeft)");
    expect(css).toMatch(/\.npc-farmer\.npc-grabbed[\s\S]*?cursor:\s*grabbing/);
    expect(css).toMatch(/\.npc-farmer\s*\{[\s\S]*?touch-action:\s*none/);
  });

  it("clears every finished animation on grab so the drag can move him", () => {
    // farmerAnimate runs with fill:"forwards" and nulls farmerMotionAnimation
    // as soon as an animation finishes, so cancelling only the tracked one left
    // finished animations pinning left/top from the animation origin — which
    // outranks the inline styles moveFarmerDrag writes. Measured on the
    // deployed build: 6px of sprite travel for 224px of pointer travel.
    expect(live).toContain("farmer.getAnimations().forEach((animation) => animation.cancel())");
    // The grab must still read the on-screen position BEFORE cancelling,
    // otherwise he teleports to the last non-animated spot on pointerdown.
    expect(live).toMatch(
      /const rect = farmer\.getBoundingClientRect\(\);[\s\S]*?farmer\.getAnimations\(\)[\s\S]*?farmer\.style\.left = `\$\{rect\.left\}px`/,
    );
  });

  it("does not sweep a text selection across the page while he is carried", () => {
    // moveFarmerDrag only preventDefaults after the 6px slop, so the opening
    // pixels of a grab used to highlight the name/mood lines behind him.
    expect(live).toContain('document.body?.classList.add("farmer-dragging")');
    expect(live).toContain('document.body?.classList.remove("farmer-dragging")');
    // Removal must precede endFarmerDrag's !drag.moved early return, or a
    // simple tap would leave the whole document unselectable.
    expect(live).toMatch(/classList\.remove\("farmer-dragging"\);[\s\S]{0,120}if \(!drag\.moved\)/);
    expect(css).toMatch(/body\.farmer-dragging \{[\s\S]*?user-select: none/);
    expect(css).toMatch(/\.npc-farmer \{[\s\S]*?user-select: none/);
  });

  it("moves the sun and moon along a WIB time-based sky arc", () => {
    expect(live).toContain('minute: "2-digit"');
    expect(live).toContain('celestial.style.setProperty("--celestial-x"');
    expect(live).toContain("Math.sin(Math.PI * clamped)");
    expect(css).toContain("left: var(--celestial-x");
    expect(css).toContain("body.night .env-sun");
  });

  it("gives comfortable Jamkachu grounded idle micro expressions", () => {
    // Kiki design integration (2026-08-11): the curious/proud/giggle SVG
    // face groups retired with the inline SVG — a comfortable idle
    // Jamkachu now flashes a happy-pool sprite reaction instead (same
    // Happy-only + awake gate as before).
    expect(live).toMatch(/function idleHappyExpression\(\) \{\s*\n\s*if \(careMood !== "Happy" \|\| sleepShown\) return;/);
    expect(live).toMatch(/function idleHappyExpression\(\) \{[\s\S]{0,400}?showPetExpression\(/);
  });

  it("uses a characterful double-tap move instead of the placeholder Whee line", () => {
    expect(strings).toContain('petSurprise: "Secret move: LEAF SPRING!"');
    expect(strings).toContain('petSurprise: "Jurus rahasia: LOMPAT DAUN!"');
    expect(live).not.toContain('PET_SURPRISE_FALLBACK = "Whee!"');
  });
});

describe("Farm-layer NPC gif placements (kiki design integration)", () => {
  it("gives the CARA BERMAIN guide a how-I-grow row and a cast footer", () => {
    // Growth row: designer growth GIF, static grown sprite under
    // prefers-reduced-motion via the <picture> source; the art stays
    // decorative behind the localized label.
    expect(html).toContain('class="farm-guide-grow"');
    expect(html).toContain('src="/farm/assets/jamkachu/gif/growth-happy.gif"');
    expect(html).toMatch(
      /<source media="\(prefers-reduced-motion: reduce\)" srcset="\/farm\/assets\/jamkachu\/4x\/plant-p4-fruit-happy\.png">/,
    );
    expect(html).toContain('data-i18n="guide.grow"');
    // Label ships with exact en+id parity via the live.js COPY table.
    expect(live).toContain('"guide.grow": "Rawat aku — aku tumbuh dari benih sampai berbuah!"');
    expect(live).toContain('"guide.grow": "Care for me — I grow from a seed all the way to fruit!"');
    // Cast footer: aria-hidden strip; no static strip exists, so reduced
    // motion hides it outright.
    expect(html).toMatch(/class="farm-guide-cast" src="\/farm\/assets\/npc\/gif\/npc-cast-idle\.gif" alt="" aria-hidden="true"/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.farm-guide-cast \{ display:none; \} \}/);
    expect(css).toMatch(/\.farm-guide-grow img \{[^}]*image-rendering:pixelated/);
    expect(assetExists("farm/assets/npc/gif/npc-cast-idle.gif")).toBe(true);
    expect(assetExists("farm/assets/jamkachu/gif/growth-happy.gif")).toBe(true);
    expect(assetExists("farm/assets/jamkachu/4x/plant-p4-fruit-happy.png")).toBe(true);
  });

  it("re-points the how-I-grow strip at the live mood + tier on every guide open", () => {
    // The markup's growth-happy default is only a fallback: renderGuideGrowth
    // re-targets the art at the CURRENT accessory tier and at the calm strip
    // whenever Jamkachu is not happily awake, so every designer growth
    // variant (plain + bow/ribbon) is reachable in play — none orphaned.
    expect(live).toContain("function renderGuideGrowth()");
    expect(live).toContain("/farm/assets/jamkachu/gif/growth-${strip}${suffix}.gif");
    // The reduced-motion <picture> source follows the same mood + tier.
    expect(live).toContain("/farm/assets/jamkachu/4x/plant-p4-fruit-${strip}${suffix}.png");
    // Re-rendered on every open, before the dialog shows.
    expect(live).toMatch(/renderGuideGrowth\(\);\s*\n\s*farmGuide\.showModal\(\)/);
    // Every variant the renderer can point at ships on disk.
    for (const strip of ["happy", "plain"]) {
      for (const suffix of ["", "-bow", "-ribbon"]) {
        expect(assetExists(`farm/assets/jamkachu/gif/growth-${strip}${suffix}.gif`)).toBe(true);
        expect(assetExists(`farm/assets/jamkachu/4x/plant-p4-fruit-${strip}${suffix}.png`)).toBe(true);
      }
    }
  });

  it("crowns the wardrobe with the moods-p4 gif for the CURRENT accessory tier", () => {
    expect(html).toContain('id="wardrobe-mascot"');
    // Tier comes from PMSprite state (thresholds + phase clamps stay in
    // jamkachu-sprite.js — the wardrobe never re-derives them), bare when
    // the driver is absent.
    expect(live).toContain("function renderWardrobeMascot()");
    expect(live).toContain(
      "window.PMSprite?.accessoryTier?.(spriteState.bondLevel, window.PMSprite?.stagePhase?.(spriteState.stage))",
    );
    expect(live).toContain("/farm/assets/jamkachu/gif/moods-p4${suffix}.gif");
    // Reduced motion: the static grown sprite of the same tier.
    expect(live).toMatch(/prefersReducedMotion\(\)\s*\n?\s*\? `\/farm\/assets\/jamkachu\/4x\/plant-p4-fruit-happy\$\{suffix\}\.png`/);
    // Rides every list repaint so bond level-ups refresh the tier live.
    expect(live).toMatch(/function renderWardrobeList\(\) \{[\s\S]{0,400}?renderWardrobeMascot\(\);/);
    expect(css).toMatch(/\.wardrobe-mascot \{[^}]*image-rendering: pixelated/);
    // Every tier variant the renderer can point at ships on disk.
    for (const suffix of ["", "-bow", "-ribbon"]) {
      expect(assetExists(`farm/assets/jamkachu/gif/moods-p4${suffix}.gif`)).toBe(true);
      expect(assetExists(`farm/assets/jamkachu/4x/plant-p4-fruit-happy${suffix}.png`)).toBe(true);
    }
  });
});
