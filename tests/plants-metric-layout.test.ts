import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** /plants bottom sensor dashboard (Metric cards): the status badge is
 *  shrink-proof (long localized text like "PERLU PENYESUAIAN"), so if the
 *  header row cannot wrap, the title column collapses to a few characters
 *  and the blanket `.reno-route-page :where(h2){overflow-wrap:anywhere}`
 *  rule shatters "Temperature" into "temp/erat/ure". The row must be
 *  allowed to wrap so the badge drops below the title instead. */
describe("plants metric card layout", () => {
  const page = readFileSync(join(process.cwd(), "src/app/plants/page.tsx"), "utf8");
  const metric = page.slice(page.indexOf("function Metric"), page.indexOf("export default"));

  it("lets the metric header wrap instead of crushing the label", () => {
    expect(metric).toContain("flex-wrap");
    expect(metric).toContain("shrink-0");
  });
});
