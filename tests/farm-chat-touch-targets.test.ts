import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("public/farm/style.css", "utf8");
const html = readFileSync("public/farm/index.html", "utf8");

describe("farm chat touch contract", () => {
  it("keeps every primary chat control comfortable on student phones", () => {
    expect(css).toMatch(/\.farmer-chat-close\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/);
    expect(css).toMatch(/\.farmer-chat-prompts button\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.farmer-chat-form input\s*\{[^}]*min-height:\s*44px[^}]*font:\s*16px/);
    expect(css).toMatch(/\.farmer-chat-form button\s*\{[^}]*min-height:\s*44px/);
  });

  it("keeps the dialog close and input accessible by name", () => {
    expect(html).toContain("class=\"farmer-chat-close\"");
    expect(html).toContain("id=\"farmer-chat-input\"");
    expect(html).toContain("for=\"farmer-chat-input\"");
  });
});
