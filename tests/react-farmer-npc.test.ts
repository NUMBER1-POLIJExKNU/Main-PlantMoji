import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
describe("React My Garden farmer NPC", () => {
  const component = read("src/components/farmer-npc.tsx");
  const home = read("src/components/plant-home.tsx");
  it("renders the farmer on the actual React home and returns him to bed after three seconds", () => {
    expect(home).toContain("<FarmerNpc");
    expect(component).toContain('"Zzz.."');
    expect(component).toContain("setAwake(true)");
    expect(component).toContain("}, 3000)");
    expect(component).toContain("onPointerMove");
  });
});
