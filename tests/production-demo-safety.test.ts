import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("team-internal demo controls", () => {
  it("keeps the reset token optional and enforces it when configured", () => {
    const route = read("src/app/api/demo-reset/route.ts");
    expect(route).toContain("if (requiredToken)");
    expect(route).toContain('error: "unauthorized"');
  });

  it("keeps the explicitly requested rehearsal default", () => {
    const actions = read("src/app/settings/actions.ts");
    expect(actions).toContain('process.env.DEMO_CHEAT_CODE?.trim() || "admin"');
  });
});
