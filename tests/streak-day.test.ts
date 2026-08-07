import { describe, expect, it } from "vitest";
import { dayString } from "@/game/progression/streak-engine";

describe("dayString", () => {
  it("keeps the WIB calendar date for an instant just before local midnight", () => {
    // 2026-08-07T16:59:00Z + 7h = 2026-08-07T23:59:00 WIB — still Aug 7.
    expect(dayString(new Date("2026-08-07T16:59:00Z"))).toBe("2026-08-07");
  });

  it("rolls over to the next WIB calendar date exactly at local midnight", () => {
    // 2026-08-07T17:00:00Z + 7h = 2026-08-08T00:00:00 WIB — now Aug 8.
    expect(dayString(new Date("2026-08-07T17:00:00Z"))).toBe("2026-08-08");
  });

  it("accepts an explicit timeZone override instead of the STREAK_TIMEZONE default", () => {
    // The same instant read back in plain UTC is still Aug 7 (no +7h shift applied).
    expect(dayString(new Date("2026-08-07T17:00:00Z"), "UTC")).toBe("2026-08-07");
  });
});
