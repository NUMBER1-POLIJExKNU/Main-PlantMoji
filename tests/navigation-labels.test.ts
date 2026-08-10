import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("shared navigation names", () => {
  const shell = read("src/components/reno-app-shell.tsx");
  const farm = read("public/farm/live.js");

  it.each(["My Garden", "Quests", "Crop Explorer", "Camera AI", "Growth Diary", "Monitoring", "Collection", "Shop", "Reports", "Settings"])(
    "uses the English label %s in both navigation shells",
    (label) => {
      expect(shell).toContain(label);
      expect(farm).toContain(label);
    },
  );

  it.each(["Kebun Saya", "Misi", "Eksplor Tanaman", "Kamera AI", "Diari Tumbuh", "Pemantauan", "Koleksi", "Toko", "Laporan", "Pengaturan"])(
    "uses the Indonesian label %s in both navigation shells",
    (label) => {
      expect(shell).toContain(label);
      expect(farm).toContain(label);
    },
  );

  it("keeps the requested Camera AI word order", () => {
    expect(shell).not.toContain('en: "AI Camera"');
  });
});
