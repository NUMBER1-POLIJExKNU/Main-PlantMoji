import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("React Grandpa Tani chat", () => {
  const npc = read("src/components/farmer-npc.tsx");
  const dialog = read("src/components/farmer-chat-dialog.tsx");
  const css = read("src/app/globals.css");

  it("opens chat on a tap but not after a drag", () => {
    expect(npc).toMatch(/if \(!moved\) \{[\s\S]*setAwake\(true\);[\s\S]*setChatOpen\(true\);/);
    expect(npc).toContain("<FarmerChatDialog");
    expect(npc).toContain("onPointerCancel={pointerCancel}");
  });

  it("posts localized questions to the guarded server route", () => {
    expect(dialog).toContain('fetch("/api/farmer-chat"');
    expect(dialog).toContain("JSON.stringify({ question: cleanQuestion, locale })");
    expect(dialog).toContain("controller.abort()")
    expect(dialog).toContain("8_000");
    expect(dialog).toContain("onClick={() => void ask(prompt)}");
  });

  it("provides an accessible responsive dialog in both languages", () => {
    expect(dialog).toContain("createPortal");
    expect(dialog).toContain("document.body");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain("Kakek Tani");
    expect(dialog).toContain("Grandpa Tani");
    expect(css).toContain(".pm-farmer-chat-backdrop");
    expect(css).toContain("max-height:82dvh");
  });
});
