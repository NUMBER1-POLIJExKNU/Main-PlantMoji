import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  cheatQuestStage,
  comfortableVitals,
  sensorsForStage,
  stageFromBoard,
  stageFromQuestStatus,
  stageFromSensors,
  toSensorData,
  STAGE_ACT,
  STAGE_VERIFY,
  STAGE_REWARD,
} from "@/game/quests/cheat-quest-stage";
import { parseRawSensorReading } from "@/types/raw-sensors";
import { sensorBlocksRecovery } from "@/game/quests/quest-engine";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { getCropProfile } from "@/lib/crop-profiles";

// The sandbox lets a presenter force a stage OR earn it by editing sensors.
// These cover both paths and, above all, that "earning" it uses the engine's
// own rule instead of a demo-only imitation.

const comfy = { temperature: 24, humidity: 50, light: 60, soilPh: 6 };

describe("cheat quest stage", () => {
  it("leaves the real quest row in charge when the sandbox says nothing", () => {
    expect(cheatQuestStage({ key: "COOL_ME_DOWN", questStatus: "ACTIVE" })).toBe(STAGE_ACT);
    expect(cheatQuestStage({ key: "COOL_ME_DOWN", questStatus: "VERIFYING" })).toBe(STAGE_VERIFY);
    expect(stageFromQuestStatus(null)).toBe(STAGE_ACT);
  });

  it("never moves outside the sandbox, whatever the sensors say", () => {
    // Normal mode is sensor-driven by design: only a real reading advances a
    // quest. cheatQuestStage is only ever handed vitals while the sandbox is
    // on (see quest-hero-stages.tsx), and with none it can only echo the row.
    const perfect = comfy;
    for (const status of ["ACTIVE", "VERIFYING", null]) {
      expect(cheatQuestStage({ key: "COOL_ME_DOWN", questStatus: status })).toBe(
        stageFromQuestStatus(status),
      );
    }
    // A board left over in localStorage is the sandbox's own state, but the
    // island does not read it with the sandbox off, so the row still rules.
    expect(stageFromQuestStatus("ACTIVE")).toBe(STAGE_ACT);
    expect(stageFromSensors("COOL_ME_DOWN", perfect)).toBe(STAGE_VERIFY); // sandbox-only path
  });

  it("treats a VERIFYING row with no timestamp as not verifying", () => {
    // The page computes `verifying` as status === VERIFYING AND a non-null
    // verifying_since, then hands the island that verdict — forwarding the raw
    // status instead would light VERIFY for a half-written row in NORMAL mode.
    const page = readFileSync("src/app/quests/page.tsx", "utf8");
    expect(page).toContain('questStatus={verifying ? "VERIFYING" : "ACTIVE"}');
    expect(page).toContain('const verifying = quest.status === "VERIFYING" && quest.verifying_since != null;');
  });

  it("lets the board force any stage, including REWARD", () => {
    expect(stageFromBoard({ COOL_ME_DOWN: 4 }, "COOL_ME_DOWN")).toBe(STAGE_REWARD);
    expect(cheatQuestStage({ key: "COOL_ME_DOWN", questStatus: "ACTIVE", quests: { COOL_ME_DOWN: 4 } })).toBe(STAGE_REWARD);
    // Untouched, or junk, means "no opinion" — never a reset to stage 0.
    expect(stageFromBoard({}, "COOL_ME_DOWN")).toBe(0);
    expect(stageFromBoard({ COOL_ME_DOWN: "nonsense" }, "COOL_ME_DOWN")).toBe(0);
  });

  it("advances a recovery quest once the sensor edit actually fixes it", () => {
    const hot = { ...comfy, temperature: 34 };
    expect(stageFromSensors("COOL_ME_DOWN", hot)).toBe(STAGE_ACT);
    expect(stageFromSensors("COOL_ME_DOWN", comfy)).toBe(STAGE_VERIFY);

    const sour = { ...comfy, soilPh: 4.2 };
    expect(stageFromSensors("BALANCE_SOIL_ACIDIC", sour)).toBe(STAGE_ACT);
    expect(stageFromSensors("BALANCE_SOIL_ACIDIC", comfy)).toBe(STAGE_VERIFY);

    const dry = { ...comfy, humidity: 20 };
    expect(stageFromSensors("HUMIDIFY_MY_AIR", dry)).toBe(STAGE_ACT);
    expect(stageFromSensors("HUMIDIFY_MY_AIR", comfy)).toBe(STAGE_VERIFY);
  });

  it("asks the engine's own predicate, not a demo-only imitation", () => {
    const profile = getCropProfile(null);
    for (const key of ["COOL_ME_DOWN", "WARM_ME_UP", "BALANCE_SOIL_ALKALINE", "DEHUMIDIFY_MY_AIR"] as const) {
      for (const vitals of [comfy, { ...comfy, temperature: 40 }, { ...comfy, temperature: 5 }, { ...comfy, soilPh: 9 }, { ...comfy, humidity: 95 }]) {
        const blocked = sensorBlocksRecovery(QUEST_DEFINITIONS[key], toSensorData(vitals), profile);
        expect(stageFromSensors(key, vitals, profile)).toBe(blocked ? STAGE_ACT : STAGE_VERIFY);
      }
    }
  });

  it("maps the store's soilPh onto the engine's soilPH", () => {
    // A silent mismatch here would make every soil quest look already fixed.
    expect(toSensorData({ temperature: 1, humidity: 2, light: 3, soilPh: 4 })).toEqual({
      temperature: 1, humidity: 2, light: 3, soilPH: 4,
    });
  });

  it("never hands out REWARD for a sensor edit alone", () => {
    // On real hardware the reward is gated on the reading HOLDING. Collapsing
    // that into the moment of the fix would sell the tap-to-win this quest
    // design refuses, so fixing the problem stops at VERIFY.
    expect(stageFromSensors("COOL_ME_DOWN", comfy)).toBe(STAGE_VERIFY);
    expect(cheatQuestStage({ key: "COOL_ME_DOWN", questStatus: "ACTIVE", vitals: comfy })).toBe(STAGE_VERIFY);
  });

  it("says nothing about maintain quests, which no sensor edit can fast-forward", () => {
    expect(QUEST_DEFINITIONS.KEEP_ME_HAPPY.kind).toBe("maintain");
    expect(stageFromSensors("KEEP_ME_HAPPY", comfy)).toBe(0);
    // ...so the board is the only way to move them.
    expect(cheatQuestStage({ key: "KEEP_ME_HAPPY", questStatus: "ACTIVE", vitals: comfy, quests: { KEEP_ME_HAPPY: 3 } })).toBe(STAGE_VERIFY);
  });

  it("lets the board win outright, including backwards", () => {
    // The regression this replaces: taking the furthest of the three sources
    // meant the live row floored every quest at ACT and a comfortable sandbox
    // floored a recovery quest at VERIFY, so three of the four buttons moved
    // nothing and the board read as broken.
    const comfortable = { key: "COOL_ME_DOWN", questStatus: "VERIFYING", vitals: comfy } as const;
    expect(cheatQuestStage(comfortable)).toBe(STAGE_VERIFY);
    for (const stage of [1, 2, 3, 4]) {
      expect(cheatQuestStage({ ...comfortable, quests: { COOL_ME_DOWN: stage } })).toBe(stage);
    }
    // Pinned to REWARD, a sensor nudge that alone would say ACT is ignored.
    expect(cheatQuestStage({
      key: "COOL_ME_DOWN",
      questStatus: "ACTIVE",
      quests: { COOL_ME_DOWN: 4 },
      vitals: { ...comfy, temperature: 34 },
    })).toBe(STAGE_REWARD);
  });

  it("hands a quest back to the sensors when its pin is cleared", () => {
    const released = { key: "COOL_ME_DOWN", questStatus: "ACTIVE", quests: { COOL_ME_DOWN: 0 } } as const;
    expect(cheatQuestStage({ ...released, vitals: comfy })).toBe(STAGE_VERIFY);
    expect(cheatQuestStage({ ...released, vitals: { ...comfy, temperature: 34 } })).toBe(STAGE_ACT);
    // ...and with no sensors in play at all, back to the real row.
    expect(cheatQuestStage(released)).toBe(STAGE_ACT);
  });

  it("writes sensor readings that actually make the jumped-to stage true", () => {
    // The board moving the card while the mascot kept the old face was the
    // whole complaint. Round-trip: the readings a stage writes must be the
    // readings that stage would be derived FROM.
    const profile = getCropProfile(null);
    const recovery = (["COOL_ME_DOWN", "WARM_ME_UP", "HUMIDIFY_MY_AIR", "DEHUMIDIFY_MY_AIR", "BALANCE_SOIL_ACIDIC", "BALANCE_SOIL_ALKALINE"] as const);
    for (const key of recovery) {
      for (const stage of [STAGE_ACT, STAGE_VERIFY]) {
        const vitals = sensorsForStage(key, stage, profile);
        expect(stageFromSensors(key, vitals, profile)).toBe(stage);
      }
    }
  });

  it("moves exactly one reading, so the mascot shows the quest being demoed", () => {
    // Mood is a priority ladder — two readings out of band at once would hand
    // the mascot a face belonging to a different quest.
    const profile = getCropProfile(null);
    const comfy0 = comfortableVitals(profile);
    for (const key of ["COOL_ME_DOWN", "HUMIDIFY_MY_AIR", "BALANCE_SOIL_ALKALINE", "GIVE_ME_MORE_LIGHT"] as const) {
      const problem = sensorsForStage(key, STAGE_ACT, profile);
      const changed = (Object.keys(comfy0) as (keyof typeof comfy0)[]).filter((k) => problem[k] !== comfy0[k]);
      expect(changed).toHaveLength(1);
    }
    // VERIFY and REWARD are simply the comfortable state.
    expect(sensorsForStage("COOL_ME_DOWN", STAGE_REWARD, profile)).toEqual(comfy0);
    // A maintain quest has no problem state to reproduce.
    expect(sensorsForStage("KEEP_ME_HAPPY", STAGE_ACT, profile)).toEqual(comfy0);
  });

  it("keeps every written reading physically possible", () => {
    const profile = getCropProfile(null);
    for (const key of Object.keys(QUEST_DEFINITIONS) as (keyof typeof QUEST_DEFINITIONS)[]) {
      for (const stage of [1, 2, 3, 4]) {
        const v = sensorsForStage(key, stage, profile);
        expect(parseRawSensorReading({
          plantId: "plant-01", temperature: v.temperature, humidity: v.humidity, soilPH: v.soilPh, light: v.light,
        }).ok).toBe(true);
      }
    }
  });

  it("hands the board's crop profile through, not a default", () => {
    const panel = readFileSync("src/components/cheat-quest-panel.tsx", "utf8");
    expect(panel).toContain("vitals: sensorsForStage(key as QuestKey, step, cropProfile ?? undefined)");
    const page = readFileSync("src/app/quests/page.tsx", "utf8");
    expect(page).toContain("<CheatQuestPanel locale={locale} quests={cheatQuests} cropProfile={cropProfile} />");
  });

  it("clears the pin when the board re-clicks the stage it is already on", () => {
    const panel = readFileSync("src/components/cheat-quest-panel.tsx", "utf8");
    expect(panel).toMatch(/if \(stages\[key\] === step\) \{\s*\n\s*api\.set\(\{ quests: \{ \[key\]: 0 \} \}\);\s*\n\s*return;/);
    // Releasing must NOT rewrite the sensors — the point is to let the sensor
    // editor take over from wherever the readings currently sit.
    expect(panel).not.toMatch(/quests: \{ \[key\]: 0 \} \},\s*vitals/);
    // The note has to say both halves — a hidden toggle is not a feature.
    expect(panel).toContain("the sensors move to match");
    expect(panel).toContain("click it again to hand the quest back to the sensor editor");
    expect(panel).toContain("nilai sensor ikut menyesuaikan");
  });

  it("lets the board choose which quest the hero card shows", () => {
    const panel = readFileSync("src/components/cheat-quest-panel.tsx", "utf8");
    // Nine rows and no sign of which one the hero card was on — and with two
    // quests sharing the "Balance My Soil" title, pressing the wrong row moved
    // the card only through the sensors, which reach ACT and VERIFY but never
    // SENSE or REWARD. That read as "SENSE and REWARD are broken".
    expect(panel).toContain("const isHero = state?.heroQuest === quest.key;");
    // A real checkbox, not a styled ★ button: pick-one-of-many is what a
    // checkbox looks like, and the native control carries the keyboard and
    // screen-reader behaviour a <button> had to fake with aria-pressed.
    expect(panel).toContain('type="checkbox"');
    expect(panel).toContain("checked={isHero}");
    expect(panel).toContain("onChange={() => api.set({ heroQuest: isHero ? null : quest.key })}");
    expect(panel).not.toContain("★");
    expect(panel).not.toContain("☆");
    expect(panel).toContain("Tick the box to make it the hero mission");
    expect(panel).toContain("Jadikan Misi Utama");

    const hero = readFileSync("src/components/quest-hero-stages.tsx", "utf8");
    expect(hero).toContain("const heroKey = (active && state?.heroQuest && catalogue[state.heroQuest] ? state.heroQuest : defaultKey)");
    // A promoted quest has no Supabase row, so only the sandbox may speak for
    // it — and its live countdown must not be borrowed from the real one.
    expect(hero).toContain('questStatus: promoted ? "ACTIVE" : questStatus,');
    expect(hero).toContain("{progress && !promoted && (");
  });

  it("keeps the hero card off the sandbox entirely when it is not running", () => {
    const hero = readFileSync("src/components/quest-hero-stages.tsx", "utf8");
    expect(hero).toContain(": stageFromQuestStatus(questStatus);");
    // The whole catalogue is localized on the server, so no copy table ships.
    const page = readFileSync("src/app/quests/page.tsx", "utf8");
    expect(page).toContain("function heroCatalogue(locale: AppLocale)");
    expect(page).toContain("catalogue={heroCatalogue(locale)}");
  });

  it("keeps the sensor rule out of the client bundle's server dependencies", () => {
    // sensorBlocksRecovery moved to a leaf module precisely so the client
    // island could import it; if it drifts back, quest-engine's Supabase
    // helpers follow it into the browser bundle.
    const leaf = readFileSync("src/game/quests/sensor-recovery.ts", "utf8");
    expect(leaf).toContain("export function sensorBlocksRecovery");
    expect(leaf).not.toContain("@supabase/supabase-js");
    expect(leaf).not.toContain("crop-profile-data");
    const island = readFileSync("src/components/quest-hero-stages.tsx", "utf8");
    expect(island).not.toContain("quest-engine");
  });
});

describe("collection reward preview", () => {
  const tabs = readFileSync("src/components/collection-tabs.tsx", "utf8");

  it("opens the reward pop below the panels, without throwing the page around", () => {
    // The pop used to render under the tab bar, above every button that fires
    // it, so it needed block:"center" to drag the reader back up. It sits BELOW
    // the tab panels now — right where those buttons are — so "nearest" is the
    // right call: it scrolls only when the pop is genuinely off-screen, and the
    // common case does not move the page at all.
    expect(tabs).toContain("const previewRef = useRef<HTMLElement | null>(null);");
    expect(tabs).toContain("ref={previewRef}");
    expect(tabs).toContain('previewRef.current?.scrollIntoView({ block: "nearest" });');
    // Instant, not smooth — a smooth scrollIntoView no-ops inside
    // .reno-route-content, which left the pop exactly where it was.
    expect(tabs).not.toContain('behavior: "smooth"');
    // The slot has to come AFTER the tab panels, or it is back above them.
    expect(tabs.indexOf("ref={previewRef}")).toBeGreaterThan(tabs.indexOf('{tab === "moods" && ('));
  });
});
