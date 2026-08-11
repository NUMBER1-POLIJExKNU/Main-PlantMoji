import { describe, expect, it } from "vitest";
import { formatExplanation } from "@/components/crop-explorer";

describe("Crop Explorer explanation readability", () => {
  it("places a blank line between every AI sentence", () => {
    expect(formatExplanation("Move it into shade. Measure again! Keep watching?"))
      .toBe("Move it into shade.\n\nMeasure again!\n\nKeep watching?");
  });

  it("normalizes provider wrapping before applying sentence paragraphs", () => {
    expect(formatExplanation("First sentence.\nSecond sentence.\r\nThird sentence."))
      .toBe("First sentence.\n\nSecond sentence.\n\nThird sentence.");
  });
});
