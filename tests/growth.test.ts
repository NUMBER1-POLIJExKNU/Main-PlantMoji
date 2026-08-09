import { describe, expect, it } from "vitest";
import { GROWTH_STAGES, parseGrowthInput } from "@/lib/growth";

function baseValid() {
  return {
    plantId: "plant-01",
    stage: "Growing",
    heightCm: "12.5",
    leafCount: "6",
    note: "New leaf unfurled today",
  };
}

describe("parseGrowthInput", () => {
  it("accepts valid input and normalizes it", () => {
    const result = parseGrowthInput(baseValid());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toEqual({
      plantId: "plant-01",
      stage: "Growing",
      heightCm: 12.5,
      leafCount: 6,
      note: "New leaf unfurled today",
    });
  });

  it("defaults plantId to plant-01 when missing or blank", () => {
    const { plantId: _plantId, ...rest } = baseValid();
    const missing = parseGrowthInput(rest);
    expect(missing.ok).toBe(true);
    if (missing.ok) expect(missing.input.plantId).toBe("plant-01");

    const blank = parseGrowthInput({ ...baseValid(), plantId: "" });
    expect(blank.ok).toBe(true);
    if (blank.ok) expect(blank.input.plantId).toBe("plant-01");
  });

  it("accepts every canonical growth stage", () => {
    for (const stage of GROWTH_STAGES) {
      const result = parseGrowthInput({ ...baseValid(), stage });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.input.stage).toBe(stage);
    }
  });

  it("rejects a missing or unrecognized stage", () => {
    const missing = parseGrowthInput({ ...baseValid(), stage: undefined });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toMatch(/stage must be one of/);

    const unknown = parseGrowthInput({ ...baseValid(), stage: "Flowering" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toMatch(/stage must be one of/);

    // Stage matching is exact, not case/space-insensitive like the settings
    // growth-stage dropdown — a mismatched case must still be rejected.
    const wrongCase = parseGrowthInput({ ...baseValid(), stage: "growing" });
    expect(wrongCase.ok).toBe(false);
  });

  it("treats blank optional numeric fields as omitted", () => {
    const result = parseGrowthInput({ ...baseValid(), heightCm: "", leafCount: "  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.heightCm).toBeNull();
    expect(result.input.leafCount).toBeNull();
  });

  it("rejects a negative height", () => {
    const negative = parseGrowthInput({ ...baseValid(), heightCm: "-5" });
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.error).toMatch(/heightCm/);
  });

  // BUG C: 0 is a semantically valid height (e.g. a just-potted seed) and the
  // <input min=0> form field allows it — it must not be silently dropped.
  it("accepts a height of exactly zero", () => {
    const zero = parseGrowthInput({ ...baseValid(), heightCm: "0" });
    expect(zero.ok).toBe(true);
    if (zero.ok) expect(zero.input.heightCm).toBe(0);
  });

  it("rejects a height above the 500cm cap", () => {
    const result = parseGrowthInput({ ...baseValid(), heightCm: "500.1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/heightCm/);
  });

  it("accepts a height exactly at the 500cm cap", () => {
    const result = parseGrowthInput({ ...baseValid(), heightCm: "500" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.heightCm).toBe(500);
  });

  it("rejects a non-numeric height", () => {
    const result = parseGrowthInput({ ...baseValid(), heightCm: "tall" });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative or non-integer leaf count", () => {
    const negative = parseGrowthInput({ ...baseValid(), leafCount: "-1" });
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.error).toMatch(/leafCount/);

    const fractional = parseGrowthInput({ ...baseValid(), leafCount: "2.5" });
    expect(fractional.ok).toBe(false);
  });

  // BUG C: a just-potted seed genuinely has 0 leaves — the <input min=0>
  // form field allows it, so the parser must not drop it as falsy.
  it("accepts a leaf count of exactly zero", () => {
    const zero = parseGrowthInput({ ...baseValid(), leafCount: "0" });
    expect(zero.ok).toBe(true);
    if (zero.ok) expect(zero.input.leafCount).toBe(0);
  });

  it("rejects a leaf count above the 10000 cap", () => {
    const result = parseGrowthInput({ ...baseValid(), leafCount: "10001" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/leafCount/);
  });

  it("accepts a leaf count exactly at the 10000 cap", () => {
    const result = parseGrowthInput({ ...baseValid(), leafCount: "10000" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.leafCount).toBe(10000);
  });

  it("treats a blank or missing note as null", () => {
    const blank = parseGrowthInput({ ...baseValid(), note: "   " });
    expect(blank.ok).toBe(true);
    if (blank.ok) expect(blank.input.note).toBeNull();

    const { note: _note, ...rest } = baseValid();
    const missing = parseGrowthInput(rest);
    expect(missing.ok).toBe(true);
    if (missing.ok) expect(missing.input.note).toBeNull();
  });

  it("trims a note within the 200 character limit", () => {
    const result = parseGrowthInput({ ...baseValid(), note: "  padded note  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.note).toBe("padded note");
  });

  it("accepts a note exactly at the 200 character cap", () => {
    const note = "n".repeat(200);
    const result = parseGrowthInput({ ...baseValid(), note });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.note).toBe(note);
  });

  it("rejects a note over the 200 character cap", () => {
    const note = "n".repeat(201);
    const result = parseGrowthInput({ ...baseValid(), note });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/note must be/);
  });
});
