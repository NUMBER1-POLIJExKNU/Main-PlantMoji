import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const reactShell = source("src/components/reno-app-shell.tsx");
// The destination table moved out of the shell so the board headers could read
// the same one (lib/nav-destinations.ts). Both files together are still "what
// the React side declares", which is what these assertions are about.
const reactNav = `${reactShell}
${source("src/lib/nav-destinations.ts")}`;
const reactCss = source("src/app/globals.css");

const TAB_HREFS = [
  "/",
  "/quests",
  "/plants",
  "/camera",
  "/diary",
  "/collection",
  "/shop",
  "/monitoring",
  "/reports",
  "/settings",
] as const;

describe("shared PlantMoji application shell", () => {
  it("exposes the game destinations and three utility destinations", () => {
    for (const href of TAB_HREFS) {
      expect(reactNav).toContain(`href: "${href}"`);
    }

    expect(reactNav.match(/href: "\/settings"/g)).toHaveLength(1);
    expect(reactNav).toContain('key: "camera", href: "/camera"');
    expect(reactNav).toContain('key: "shop", href: "/shop"');
    expect(reactShell).not.toContain('className="reno-nav-item reno-nav-disabled"');
  });

  it("keeps crop exploration and care memories as distinct game destinations", () => {
    expect(reactNav).toContain('key: "plants", href: "/plants"');
    expect(reactNav).toContain('key: "diary", href: "/diary"');
    expect(reactShell).toContain("const TOOL_ITEMS");
  });

  it("uses task-oriented navigation labels in both languages", () => {
    for (const label of ["Kebun Saya", "Misi", "Eksplor Tanaman", "Diari Tumbuh", "Koleksi", "Quests", "Crop Explorer", "Growth Diary", "Collection"]) {
      expect(reactNav).toContain(label);
    }
  });

  it("offers a previewable localized Jember skin picker", () => {
    const controls = source("src/components/appearance-controls.tsx");
    expect(controls).toContain("FARM_SKIN_CATALOG.map");
    expect(controls).toContain('role="dialog"');
    expect(controls).toContain("applyPicker");
    expect(controls).toContain("cancelPicker");
    expect(reactCss).toContain('[data-farm-skin="puger-coast"]');
    expect(reactCss).toContain('[data-farm-skin="argopuro-highlands"]');
  });

  it("keeps garden vital values and units in a contained HUD reading", () => {
    const vitals = source("src/components/home-environment-glance.tsx");
    expect(vitals).toContain('className="pm-home-sensor-reading"');
    expect(vitals).toContain("metric.suffix");
    expect(reactCss).toMatch(/\.pm-home-sensor\s*\{[^}]*overflow:\s*hidden/);
  });

  it("applies the night appearance to the complete My Garden scene", () => {
    const home = source("src/components/plant-home.tsx");
    const bond = source("src/components/bond-panel.tsx");
    const quest = source("src/components/home-quest-card.tsx");
    expect(home).toContain("pm-home-mood-badge");
    expect(bond).toContain("pm-home-bond");
    expect(quest).toContain("pm-home-quest");
    expect(reactCss).toMatch(/html\[data-theme="night"\] \.pm-scene\s*\{[^}]*background-blend-mode:\s*multiply/);
    expect(reactCss).toContain('html[data-theme="night"] .pm-scene .pm-bubble');
    expect(reactCss).toContain('html[data-theme="night"] .pm-home-bond');
  });

  it("renders the designer's Jamkachu sprite with mood-safe presentation", () => {
    const mascot = source("src/components/mascot.tsx");
    // The sprite mapping module is the single mood/stage/bond → art channel.
    expect(mascot).toContain('from "@/lib/jamkachu-sprite"');
    expect(mascot).toContain("spriteSrc({ stage, mood, bondLevel, sleeping })");
    // The mood stays accessible as text while the art itself is decorative.
    expect(mascot).toContain("MOOD_LABELS[mood]");
    expect(mascot).toContain('aria-hidden="true"');
    // Plain-body moods keep a visible differentiator.
    expect(mascot).toContain("MOOD_STATUS_CHIP");
    expect(reactCss).toMatch(/\.pm-mascot-sprite\s*\{[^}]*image-rendering:\s*pixelated/);
    expect(reactCss).toContain(".pm-mascot-chip");
  });

  it("shows Jember local time in the My Garden HUD", () => {
    const home = source("src/components/plant-home.tsx");
    expect(home).toContain("pm-home-clock");
    expect(home).toContain('timeZone: "Asia/Jakarta"');
    expect(reactCss).toContain(".pm-home-clock");
  });

  it("uses five core actions plus More without widening the mobile viewport", () => {
    expect(reactCss).toContain("grid-template-columns: repeat(6, minmax(0, 1fr))");
    expect(reactCss).toMatch(/\.reno-nav-links\s*\{[\s\S]*?position:\s*fixed/);
    expect(reactCss).toContain("env(safe-area-inset-bottom)");
    expect(reactCss).toContain("overflow-x: hidden");
    expect(reactCss).toMatch(/\.reno-nav-tool-pocket\s*\{\s*display:\s*none/);
    expect(reactShell).toContain("reno-more-button");
    expect(reactShell).toContain("reno-more-sheet");
  });

  it("frames React feature routes and uses a shared page header", () => {
    expect(reactShell).toContain('"reno-route-page"');
    expect(reactCss).toContain(".reno-route-page");

    for (const route of ["quests", "plants", "monitoring", "collection"]) {
      expect(source(`src/app/${route}/page.tsx`)).toContain("<PageHeader");
    }
  });

  it("renders backend notices in the normal farm panel language", () => {
    const notice = source("src/components/notice.tsx");
    expect(notice).toContain('className="pm-panel reno-notice-card"');
    expect(notice).not.toContain("min-h-screen");
  });

  it("dismisses a collection reward preview when switching tabs", () => {
    const collectionTabs = source("src/components/collection-tabs.tsx");
    expect(collectionTabs).toMatch(/setTab\(entry\.id\);[\s\S]*?setPreview\(null\);/);
  });

  it("uses one stateful badge action with clear activate and turn-off colors", () => {
    const collectionTabs = source("src/components/collection-tabs.tsx");
    expect(collectionTabs).toContain('selectedEffectActive ? "pm-btn-danger" : "pm-btn-primary"');
    expect(collectionTabs).not.toContain('kind: "badges"');
    expect(reactCss).toContain(".pm-btn-danger");
  });

  it("presents story chapters as a selectable game journey", () => {
    const collectionTabs = source("src/components/collection-tabs.tsx");
    const storyCard = source("src/components/story-chapter-card.tsx");
    expect(collectionTabs).toContain("pm-story-path");
    expect(collectionTabs).toContain("selectedChapterNumber");
    expect(collectionTabs).toContain("pm-story-node");
    expect(storyCard).toContain("pm-story-scene-art");
    expect(storyCard).toContain("pm-story-dialogue");
    expect(reactCss).toContain(".pm-story-stage");
  });

  it("presents moods as a selectable game dex with integrated lessons", () => {
    const collectionTabs = source("src/components/collection-tabs.tsx");
    expect(collectionTabs).toContain("pm-mood-dex-grid");
    expect(collectionTabs).toContain("selectedMoodKey");
    expect(collectionTabs).toContain("pm-mood-stage");
    expect(collectionTabs).toContain("pm-mood-lesson");
    expect(reactCss).toContain(".pm-mood-dex-slot");
  });

  it("mood dex cells render the designer's badge icon pack, not a generic emoji or ❔ silhouette (see tests/mood-dex.test.ts for the full pins)", () => {
    const collectionTabs = source("src/components/collection-tabs.tsx");
    expect(collectionTabs).not.toContain("❔");
    expect(collectionTabs).toContain("moodIconSrc");
    expect(collectionTabs).toContain("MOOD_LOCKED_ICON_FILE");
    // The shared ProgressCounter replaced the old static x/y counter chip.
    expect(collectionTabs).toContain("<ProgressCounter value={discoveredMoods} total={moods.length} label={copy.discovered} />");
    // NEW discovery ribbon reuses the existing badge-flip celebration.
    expect(collectionTabs).toContain("pm-mood-dex-ribbon");
    expect(collectionTabs).toContain('moodFlipping.has(mood.mood) ? " pm-badge-flip" : ""');
  });

  it("keeps presenter controls behind the explicit demo settings route", () => {
    const settings = source("src/app/settings/page.tsx");
    const controls = source("src/components/demo-control-center.tsx");
    const actions = source("src/app/settings/actions.ts");
    expect(settings).toContain('params.demo === "1"');
    // Team-internal project: the demo gate is deliberately zero-friction —
    // "admin" works everywhere unless DEMO_CHEAT_CODE overrides it.
    expect(actions).toContain('process.env.DEMO_CHEAT_CODE?.trim() || "admin"');
    // Developer mode is the other door: same zero-friction stance, its own
    // password. The password is a speed bump — what actually holds is that
    // every action re-checks the code on the server, so reaching the panel by
    // typing the URL gets you nothing.
    const devActions = source("src/app/settings/dev-actions.ts");
    const devToggle = source("src/components/dev-mode-toggle.tsx");
    expect(settings).toContain('params.dev === "1"');
    expect(settings).toContain("<DevModeToggle locale={locale} />");
    expect(devActions).toContain('process.env.DEV_MODE_CODE?.trim() || "one"');
    expect(devActions).toContain("export async function verifyDevCode");
    expect(devToggle).toContain("await verifyDevCode(code)");
    // Every mutation goes through authorise(), never straight to the table.
    for (const action of ["devSetProgress", "devSetQuest", "devSetMood", "devSetBadge", "devSetChapter", "devSetShopItem"]) {
      expect(devActions).toContain(`export async function ${action}`);
    }
    expect(devActions).toContain("const { locale, error } = await authorise(formData);");

    // One mode at a time. The cheat sandbox fakes what developer mode really
    // writes, so having both on would show numbers that disagree with the rows
    // behind them. Enforced at both doors AND on the panel itself, since the
    // panel is reachable by typing the URL.
    const devPanel = source("src/components/dev-mode-panel.tsx");
    const cheatToggle = source("src/components/cheat-mode-toggle.tsx");
    expect(devToggle).toContain("window.PMCheat?.deactivate()");
    expect(devPanel).toContain("window.PMCheat?.deactivate()");
    expect(cheatToggle).toContain('sessionStorage.removeItem("pm_dev_code")');
    // And a way out that does not involve editing the URL.
    expect(devPanel).toContain("function leave()");
    expect(devPanel).toContain("sessionStorage.removeItem(DEV_CODE_STORAGE_KEY)");
    expect(devPanel).toContain('router.push("/settings")');
    expect(controls).toContain("prepareDemoLevelUp");
    expect(controls).toContain("grantDemoXp");
    expect(controls).toContain("evolveDemoCompanion");
    expect(controls).toContain('/plants?demo=hot');
  });
});
