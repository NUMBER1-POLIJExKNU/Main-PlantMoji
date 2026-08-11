import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const html = source("public/farm/index.html");
const live = source("public/farm/live.js");
const css = source("public/farm/style.css");
const strings = source("public/farm/strings.js");

describe("Grandpa Tani living-world UI", () => {
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

  it("moves the sun and moon along a WIB time-based sky arc", () => {
    expect(live).toContain('minute: "2-digit"');
    expect(live).toContain('celestial.style.setProperty("--celestial-x"');
    expect(live).toContain("Math.sin(Math.PI * clamped)");
    expect(css).toContain("left: var(--celestial-x");
    expect(css).toContain("body.night .env-sun");
  });

  it("gives comfortable Jamkachu several grounded micro expressions", () => {
    expect(html).toContain('data-face="curious"');
    expect(html).toContain('data-face="proud"');
    expect(html).toContain('data-face="giggle"');
    expect(live).toContain('careMood !== "Happy"');
    expect(css).toContain(".mascot-svg.expr-giggle");
  });

  it("uses a characterful double-tap move instead of the placeholder Whee line", () => {
    expect(strings).toContain('petSurprise: "Secret move: LEAF SPRING!"');
    expect(strings).toContain('petSurprise: "Jurus rahasia: LOMPAT DAUN!"');
    expect(live).not.toContain('PET_SURPRISE_FALLBACK = "Whee!"');
  });
});
