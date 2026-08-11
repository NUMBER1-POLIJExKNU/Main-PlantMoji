import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const html = source("public/farm/index.html");
const css = source("public/farm/style.css");
const live = source("public/farm/live.js");

describe("self-explaining status HUD", () => {
  it("makes every progression value a keyboard-accessible help button", () => {
    for (const kind of ["level", "xp", "hp", "streak", "seeds"]) {
      expect(html).toContain(`data-status-help="${kind}"`);
      expect(live).toContain(`"status.help.${kind}"`);
    }
    expect(html.match(/data-status-help="xp"/g)).toHaveLength(2);
    expect(css).toContain(".status-help:focus-visible");
  });

  it("explains how rewards are earned and what they do without changing state", () => {
    expect(live).toContain("function statusHelpText(kind)");
    expect(live).toContain("function showStatusHelp(element)");
    expect(live).toContain('document.querySelectorAll("[data-status-help]")');
    expect(live).toContain('floatWhyCard(statusHelpText(kind), element.getBoundingClientRect())');
    expect(live).toContain("sensor-verified care missions");
    expect(live).toContain("Spend them in the Shop");

    const helpStart = live.indexOf("function showStatusHelp(element)");
    const helpEnd = live.indexOf("/** One-time listener wiring", helpStart);
    const helpBody = live.slice(helpStart, helpEnd);
    expect(helpBody).not.toMatch(/fetch\(|\.from\(|\.rpc\(|total_xp\s*=|seeds\s*=/);
  });
});
