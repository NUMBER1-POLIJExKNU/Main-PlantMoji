import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(resolve(process.cwd(), "src/app", name));

function pngSize(buffer: Buffer): [number, number] {
  expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

describe("PlantMoji browser icons", () => {
  it("ships Next App Router and Apple icons from the same square logo family", () => {
    expect(pngSize(read("icon.png"))).toEqual([512, 512]);
    expect(pngSize(read("apple-icon.png"))).toEqual([180, 180]);
  });

  it("replaces the default favicon with a multi-size ICO", () => {
    const ico = read("favicon.ico");
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    expect(count).toBeGreaterThanOrEqual(6);
    const sizes = Array.from({ length: count }, (_, index) => {
      const width = ico[6 + index * 16];
      return width === 0 ? 256 : width;
    });
    expect(sizes).toEqual(expect.arrayContaining([16, 32, 48, 64, 128, 256]));
  });
});
