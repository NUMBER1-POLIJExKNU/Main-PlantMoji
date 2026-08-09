import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("night theme readability", () => {
  it("provides dark surfaces and light text for guide and memory content", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain('html[data-theme="night"] .pm-guide-card');
    expect(css).toContain('html[data-theme="night"] .pm-memory-bubble');
    expect(css).toContain('html[data-theme="night"] .pm-growth-postcard');
  });

  it("keeps camera status and advice readable at night", () => {
    const css = readFileSync("src/app/camera/camera.css", "utf8");
    expect(css).toContain('html[data-theme="night"] .pm-cam-privacy');
    expect(css).toContain('html[data-theme="night"] .pm-cam-note');
    expect(css).toContain('html[data-theme="night"] .pm-cam-event.is-pest_advice');
  });
});
