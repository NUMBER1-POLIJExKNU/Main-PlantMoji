import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

// Named for the removed broadcast overlay; what remains is the intelligence
// console and the honesty rules about which layer produced which answer.
describe("intelligence console honesty", () => {
  it("uses one reusable console and accessible skippable typewriter", () => {
    const component = read("src/components/intelligence-console.tsx");
    expect(component).toContain("prefers-reduced-motion: reduce");
    expect(component).toContain('aria-label={text}');
    expect(component).toContain("onClick={() => setShown(text)}");
  });

  it("keeps crop truth deterministic while dramatizing the real pipeline", () => {
    const explorer = read("src/components/crop-explorer.tsx");
    expect(explorer).toContain('AI MAY CHANGE RESULT');
    expect(explorer).toContain('value: "FALSE"');
    expect(explorer).toContain('DETERMINISTIC RESULT');
    expect(explorer).toContain('READY / SAFE FALLBACK');
  });

  it("labels local camera privacy and authority limits", () => {
    const camera = read("src/components/camera-guardian.tsx");
    expect(camera).toContain('label: "CAMERA"');
    expect(camera).toContain('label: "LOCAL MODEL"');
    expect(camera).toContain('label: "RESULT"');
    expect(camera).not.toContain('REWARD CONTROL');
  });


  it("keeps the ops-console vocabulary OFF the player-facing farm home", () => {
    // Farm-wave text diet: the CARE VERIFICATION CORE console was removed —
    // the amber verifying shimmer + "Sensor sedang memeriksa…" tell the
    // story without engineering vocabulary (XP TRANSACTION / LOCKED),
    // which player copy must never contain.
    const farm = read("public/farm/index.html");
    expect(farm).not.toContain('id="quest-verify-console"');
    expect(farm).not.toContain("XP TRANSACTION");
    expect(farm).not.toContain("CARE VERIFICATION CORE");
  });
});
