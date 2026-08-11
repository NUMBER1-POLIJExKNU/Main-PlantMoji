import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/demo-control-center.tsx", "utf8");

describe("WFK presentation director links", () => {
  it("keeps all six scene links in presentation mode and in sequence", () => {
    for (let scene = 1; scene <= 6; scene += 1) {
      expect(source).toContain(`scene=${scene}`);
    }
    expect(source.match(/presentation=1/g)).toHaveLength(6);
    expect(source).toContain("2 · SCAN");
    expect(source).toContain("4 · VERIFY");
    expect(source).toContain("6 · GROWTH");
  });
});
