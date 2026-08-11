import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("scalable Jamkachu speech bubble", () => {
  const html = read("public/farm/index.html");
  const css = read("public/farm/style.css");
  const live = read("public/farm/live.js");

  it("keeps the existing live dialogue target inside a stable decorative frame", () => {
    expect(html).toContain('class="speech-bubble-frame animated-bounce"');
    expect(html).toContain('class="speech-bubble"');
    expect(live).toContain('const bubble = $(".speech-bubble")');
  });

  it("grows with dialogue without stretching corner ornaments", () => {
    expect(css).toMatch(/\.speech-bubble-frame \{[\s\S]*?width:\s*fit-content/);
    expect(css).toMatch(/\.speech-bubble \{[\s\S]*?max-width:\s*470px/);
    expect(css).toMatch(/\.speech-bubble \{[\s\S]*?overflow-wrap:\s*anywhere/);
    expect(html).not.toContain("speech-bubble-leaves");
    expect(css).not.toContain(".speech-bubble-leaves");
    expect(css).toContain(".speech-bubble-sparkles");
  });

  it("keeps the pixel concept and a responsive phone width", () => {
    expect(css).toContain("background: #0A3D62");
    expect(css).toContain("#C8EE98");
    expect(css).toMatch(/@media \(max-width: 520px\)[\s\S]*?\.speech-bubble-frame/);
  });
});
