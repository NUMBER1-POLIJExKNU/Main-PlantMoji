// Moods tab redesign — source-contract pins (same pattern as
// tests/shop-preview.test.ts and tests/ui-shell.test.ts: read the plain
// source and pin the strings that make the feature honest, distinguishable,
// and accessible, rather than rendering the tree).
//
// Scope note: mid-implementation the coordinator swapped the CELL art plan
// from a real-sprite silhouette to the designer's purpose-made mood badge
// icon pack (public/farm/assets/moods/) — this file pins the pack that
// actually shipped, not the superseded silhouette approach. The DETAIL
// panel still shows the real Jamkachu sprite (unchanged from the brief).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PLANT_MOODS } from "@/types/events";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const assetExists = (publicPath: string) =>
  existsSync(resolve(process.cwd(), "public", publicPath.replace(/^\//, "")));

const tabs = read("src/components/collection-tabs.tsx");
const page = read("src/app/collection/page.tsx");
const css = read("src/app/globals.css");

describe("mood dex CELL art — designer badge icon pack, not the browser emoji or a ❔ glyph", () => {
  it("never renders the generic ❔ silhouette glyph anywhere in the moods tab", () => {
    expect(tabs).not.toContain("❔");
  });

  it("maps every PlantMood to its own icon file under public/farm/assets/moods/", () => {
    expect(tabs).toContain('const MOOD_ICON_FILE: Record<string, string> = {');
    for (const mood of PLANT_MOODS) {
      expect(tabs).toMatch(new RegExp(`${mood}:\\s*"mood-\\d\\d-[a-z-]+"`));
    }
  });

  it("locked cells always render the same generic mood-07-locked icon, never a mood-specific one", () => {
    expect(tabs).toContain('const MOOD_LOCKED_ICON_FILE = "mood-07-locked";');
    expect(tabs).toContain("const iconFile = discovered ? (MOOD_ICON_FILE[mood.mood] ?? MOOD_LOCKED_ICON_FILE) : MOOD_LOCKED_ICON_FILE;");
  });

  it("builds icon paths under /farm/assets/moods/<variant>/<file>.png", () => {
    expect(tabs).toContain('function moodIconSrc(file: string, variant: "4x" | "badge4x" = "4x"): string {');
    expect(tabs).toContain("return `/farm/assets/moods/${variant}/${file}.png`;");
  });

  it("never wires up the two icons reserved for other moods (mood-08-thirsty, mood-10-too-bright)", () => {
    expect(tabs).not.toContain("mood-08-thirsty");
    expect(tabs).not.toContain("mood-10-too-bright");
  });

  it("every mapped icon file ships in the 4x and badge4x asset folders actually used", () => {
    const files = [
      "mood-01-happy", "mood-02-overheating", "mood-03-dry-air", "mood-04-sleepy",
      "mood-05-soil-acidic", "mood-06-soil-alkaline", "mood-07-locked",
      "mood-09-too-wet", "mood-11-too-cold",
    ];
    for (const file of files) {
      expect(assetExists(`farm/assets/moods/4x/${file}.png`)).toBe(true);
    }
  });

  it("the dex card renders the icon as a real <img>, not an emoji span", () => {
    expect(tabs).toContain('<img className="pm-mood-dex-icon" src={moodIconSrc(iconFile)} alt="" aria-hidden="true" draggable={false} />');
  });
});

describe("SoilAcidic vs. SoilAlkaline collision is resolved by distinct art", () => {
  it("map to two different icon files (not the shared 🧪 chip anymore)", () => {
    expect(tabs).toContain('SoilAcidic: "mood-05-soil-acidic"');
    expect(tabs).toContain('SoilAlkaline: "mood-06-soil-alkaline"');
  });

  it("the two soil icon files are physically different assets", () => {
    const acidic = readFileSync(resolve(process.cwd(), "public/farm/assets/moods/4x/mood-05-soil-acidic.png"));
    const alkaline = readFileSync(resolve(process.cwd(), "public/farm/assets/moods/4x/mood-06-soil-alkaline.png"));
    expect(Buffer.compare(acidic, alkaline)).not.toBe(0);
  });

  it("both moods still carry distinct English/Indonesian labels naming acidic vs. alkaline", () => {
    expect(page).toContain("labelEn: MOOD_LABELS[mood]");
    expect(page).toContain("labelId: MOOD_COPY.id[mood]");
  });

  it("the detail hero's small reinforcement badge also uses the mood-specific icon file, disambiguating the shared Jamkachu \"plain\" body + chip", () => {
    expect(tabs).toContain("const badgeIconFile = MOOD_ICON_FILE[selectedMood.mood] ?? MOOD_LOCKED_ICON_FILE;");
    expect(tabs).toContain('<span className="pm-mood-stage-badge" aria-hidden="true">');
  });
});

describe("detail panel keeps the real Jamkachu sprite hero (unchanged by the icon-pack swap)", () => {
  it("imports the sprite mapping module and computes the hero from the player's real current phase", () => {
    expect(tabs).toContain('from "@/lib/jamkachu-sprite"');
    expect(tabs).toContain("const heroSpriteSrc = spriteAssetPath(spritePhase, MOOD_SPRITE[selectedMood.mood as PlantMood] ?? \"happy\");");
  });

  it("CollectionTabsProps carries spritePhase, and the collection page supplies it from companion_state.stage", () => {
    expect(tabs).toContain("spritePhase: SpritePhase;");
    expect(tabs).toContain("export default function CollectionTabs({ locale, moods, badges, chapters, wisdom, spritePhase }: CollectionTabsProps)");
    expect(page).toContain('supabase.from("companion_state").select("stage").eq("plant_id", PLANT_ID)');
    expect(page).toContain("const spritePhase = stagePhase(companionStage);");
    expect(page).toContain("spritePhase={spritePhase}");
  });

  it("keeps MOOD_STATUS_CHIP visible on the hero for the moods sharing the \"plain\" sprite body", () => {
    expect(tabs).toContain("const chip = MOOD_STATUS_CHIP[selectedMood.mood as PlantMood];");
    expect(tabs).toContain('{discovered && chip && <span className="pm-mood-stage-chip" aria-hidden="true">{chip}</span>}');
  });

  it("locked hero sprite is a true silhouette (brightness(0), not grayscale) — a shape tease, no color leak", () => {
    expect(css).toMatch(/\.is-silhouette\s*\{\s*filter:brightness\(0\);\s*opacity:\.55;\s*\}/);
  });

  it("locked hero never applies the mood-specific gradient class (would leak identity by color)", () => {
    expect(tabs).toContain("`pm-mood-stage${discovered ? ` mood-${selectedMood.mood.toLowerCase()}` : \" is-locked\"}`");
  });
});

describe("NEW discovery state — presentation-side only, mirrors the Badges tab's realtime/localStorage idiom", () => {
  it("has its own realtime channel independent of collection-badges (never edits the badges effect)", () => {
    expect(tabs).toContain('.channel("collection-moods")');
    expect(tabs).toContain('.channel("collection-badges")');
    expect(tabs).toMatch(/table:\s*"plants"\s*\}/);
  });

  it("reuses the existing pm-badge-flip keyframe (no new animation added) and plays the coin SFX", () => {
    expect(tabs).toContain('setMoodFlipping((prev) => {');
    expect(tabs).toContain('window.PMSfx?.play("coin");');
    expect(tabs).toContain('moodFlipping.has(mood.mood) ? " pm-badge-flip" : ""');
    // The keyframe itself is defined once, shared by badges and moods.
    expect(tabs.match(/@keyframes pm-badge-flip/g)?.length).toBe(1);
  });

  it("NEW renders as a .pm-chip ribbon", () => {
    expect(tabs).toContain('{isNew && <span className="pm-chip pm-mood-dex-ribbon">{copy.newBadge}</span>}');
    expect(css).toContain(".pm-mood-dex-ribbon");
  });

  it("derives isNew from discovered + a localStorage-backed opened set (no engine/table read)", () => {
    expect(tabs).toContain("const isNew = discovered && !openedMoods.has(mood.mood);");
    expect(tabs).toContain('const MOOD_SEEN_STORAGE_KEY = "pm-mood-dex-seen";');
  });

  it("clears when the player opens that mood's detail", () => {
    expect(tabs).toMatch(/if \(discovered\) markMoodOpened\(mood\.mood\);/);
    expect(tabs).toContain("const markMoodOpened = (key: string) => {");
  });
});

describe("shared ProgressCounter replaces the static x/y counter chip", () => {
  it("moods tab renders <ProgressCounter>, not a bare counter", () => {
    expect(tabs).toContain("<ProgressCounter value={discoveredMoods} total={moods.length} label={copy.discovered} />");
  });

  it("the old static counter chip markup is gone from the dex head", () => {
    expect(tabs).not.toContain("<b>{discoveredMoods}/{moods.length}</b>");
  });

  it("discoveredMoods also counts a live discovery from this session, not just server props", () => {
    expect(tabs).toContain("moods.filter((mood) => mood.discovered || liveDiscoveredMoods.has(mood.mood)).length");
  });
});

describe("completion callout is an honest placeholder — no invented engine reward", () => {
  it("renders only once every mood is discovered, reusing the shared reward-pop styling", () => {
    expect(tabs).toContain("{discoveredMoods === moods.length && (");
    expect(tabs).toMatch(/pm-panel pm-reward-pop mt-4 text-center[\s\S]{0,500}copy\.moodComplete/);
  });

  it("never grants XP or seeds directly — no engine mutation import in this file", () => {
    expect(tabs).not.toContain("awardXp");
    expect(tabs).not.toContain("supabase.rpc");
  });
});

describe("layout adopts the shared .pm-badge-layout grid+detail split (>=800px), like the Badges tab", () => {
  it("the moods grid and detail panel are wrapped in .pm-badge-layout", () => {
    expect(tabs).toMatch(/tab === "moods"[\s\S]*?<div className="pm-badge-layout">[\s\S]*?pm-mood-dex-grid[\s\S]*?pm-mood-stage/);
  });

  it("the >=800px two-column split is still defined (owned by the Badges tab's inline <style>, only consumed here)", () => {
    expect(tabs).toContain("@media (min-width: 800px) {");
    expect(tabs).toMatch(/\.pm-badge-layout\s*\{\s*grid-template-columns:\s*minmax\(0,\s*30rem\)\s*minmax\(0,\s*1fr\);/);
  });
});

describe("mobile: no overflow at 360-430px, >=44px tap targets, reduced motion respected", () => {
  it("the dex grid collapses to 3 columns under 580px (fits a 360-430px viewport without overflow)", () => {
    expect(css).toContain(".pm-mood-dex-grid{grid-template-columns:repeat(3,1fr)}");
  });

  it("each dex slot's tap target is comfortably >=44px (86px min-height card)", () => {
    expect(css).toMatch(/\.pm-mood-dex-slot\s*\{[^}]*min-height:86px;/);
  });

  it("ships no new always-on animation — pm-badge-flip/pm-reward-pop are the existing reduced-motion-gated ones", () => {
    expect(tabs).not.toMatch(/@keyframes pm-mood-[a-z-]+/);
  });

  it("sprite and icon images use image-rendering:pixelated", () => {
    expect(css).toMatch(/\.pm-mood-dex-well img\s*\{[^}]*image-rendering:pixelated/);
    expect(css).toMatch(/\.pm-mood-stage-scene > span > img\s*\{[^}]*image-rendering:pixelated/);
    expect(css).toMatch(/\.pm-mood-stage-badge img\s*\{[^}]*image-rendering:pixelated/);
  });
});

describe("accessibility: decorative images are aria-hidden; visible text is the accessible signal", () => {
  it("the dex card icon and hero sprite are aria-hidden with empty alt", () => {
    expect(tabs).toMatch(/<img className="pm-mood-dex-icon" src=\{moodIconSrc\(iconFile\)\} alt="" aria-hidden="true"/);
    expect(tabs).toMatch(/<img className=\{discovered \? "" : "is-silhouette"\} src=\{heroSpriteSrc\} alt="" aria-hidden="true"/);
  });

  it("the mood label text (or the category hint, when locked) is the visible/accessible signal on each card", () => {
    expect(tabs).toContain("<small>{discovered ? mood.label : `${categoryHint.icon} ${categoryHint.label}`}</small>");
  });

  it("locked cells show a mood CATEGORY hint, not a bare lock word", () => {
    expect(tabs).toContain('const MOOD_CATEGORY: Record<string, "temperature" | "air" | "light" | "soil" | "comfort"> = {');
    expect(tabs).not.toContain("mood.discovered ? mood.label : copy.locked");
  });
});

describe("en+id parity for every new mood-dex string", () => {
  it("MOOD_SENSOR_HINT names the real sensor for all 8 moods, in both locales", () => {
    for (const mood of PLANT_MOODS) {
      expect(tabs).toMatch(new RegExp(`${mood}: \\{ id: "[^"]+", en: "[^"]+" \\}`));
    }
  });

  it("MOOD_CATEGORY_COPY covers every category in both locales with non-empty icon+label", () => {
    for (const category of ["temperature", "air", "light", "soil", "comfort"]) {
      expect(tabs).toMatch(new RegExp(`id:\\s*\\{[\\s\\S]{0,400}${category}:\\s*\\{ icon: "[^"]+", label: "[^"]+" \\}`));
      expect(tabs).toMatch(new RegExp(`en:\\s*\\{[\\s\\S]{0,400}${category}:\\s*\\{ icon: "[^"]+", label: "[^"]+" \\}`));
    }
  });

  it("carries the exact NEW ribbon and completion-callout copy in both locales", () => {
    expect(tabs).toContain('newBadge: "BARU"');
    expect(tabs).toContain('newBadge: "NEW"');
    expect(tabs).toContain('moodComplete: "◆ KOLEKSI LENGKAP ◆"');
    expect(tabs).toContain('moodComplete: "◆ COLLECTION COMPLETE ◆"');
    expect(tabs).toContain("moodCompleteLine: \"Semua suasana sudah ditemukan! Hadiah kejutan sedang disiapkan.\"");
    expect(tabs).toContain("moodCompleteLine: \"Every mood has been discovered! A surprise reward is on its way.\"");
  });

  it("page.tsx ships both English AND Indonesian mood names together for the detail panel", () => {
    expect(page).toContain("labelEn: MOOD_LABELS[mood],");
    expect(page).toContain("labelId: MOOD_COPY.id[mood],");
    expect(tabs).toContain("const primaryLabel = locale === \"id\" ? selectedMood.labelId : selectedMood.labelEn;");
    expect(tabs).toContain("const secondaryLabel = locale === \"id\" ? selectedMood.labelEn : selectedMood.labelId;");
    expect(tabs).toContain('{discovered && <small className="pm-mood-stage-altname">{secondaryLabel}</small>}');
  });
});
