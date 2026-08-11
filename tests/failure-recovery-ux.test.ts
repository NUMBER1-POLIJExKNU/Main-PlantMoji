import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("student-safe failure recovery", () => {
  it("shows an honest global offline state without threatening saved progress", () => {
    const status = read("src/components/network-status.tsx");
    const shell = read("src/components/reno-app-shell.tsx");
    expect(status).toContain('window.addEventListener("offline", sync)');
    expect(status).toContain("Data tersimpan tetap aman");
    expect(status).toContain("Saved progress stays safe");
    expect(shell).toContain("<NetworkStatus locale={locale} />");
  });

  it("hides operator details and localizes retry notices", () => {
    const notice = read("src/components/notice.tsx");
    expect(notice).toContain("Kebun sedang beristirahat");
    expect(notice).toContain("Coba lagi");
    expect(notice).toContain('locale = "en"');
  });
});
