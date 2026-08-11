import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("UI containment regressions", () => {
  it("wraps quiz tabs, questions, choices and feedback inside the modal", () => {
    const css = read("public/farm/style.css");
    expect(css).toContain(".quiz-card{max-width:100%;overflow-x:hidden}");
    expect(css).toContain("#quiz-case-phases{grid-template-columns:repeat(3,minmax(0,1fr))}");
    expect(css).toContain(".quiz-choice,.quiz-feedback,.quiz-next{max-width:100%;overflow-wrap:anywhere");
  });

  it("contains diary forms, stamps and user-written notes", () => {
    const css = read("src/app/diary/diary.css");
    const page = read("src/app/diary/page.tsx");
    expect(page).toContain("pm-diary-page");
    expect(css).toContain(".pm-diary-page{max-width:100%;overflow-x:clip}");
    expect(css).toContain(".pm-diary-stage-stamp{width:fit-content;max-width:calc(100% - 24px)");
    expect(css).toContain(".pm-growth-postcard-copy>*{max-width:100%;overflow-wrap:anywhere");
  });

  it("clips badge particles to their effect slots and stacks the mobile action", () => {
    const collection = read("src/components/collection-tabs.tsx");
    expect(collection).toContain("pm-badge-effect-icon");
    expect(collection).toContain("place-items-center overflow-hidden rounded-full");
    expect(collection).toContain(".pm-badge-effect-row > button { grid-column: 1 / -1; width: 100%; }");
    expect(collection).not.toContain('selectedEffect.particles.slice(0,2).join("")');
  });

  it("enforces a shared containment contract across React feature routes", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain("Route containment contract");
    expect(css).toContain('.reno-route-page :where([class*="grid-cols-"])>*{min-width:0}');
    expect(css).toContain("grid-template-columns:repeat(4,minmax(0,1fr))");
  });
});
