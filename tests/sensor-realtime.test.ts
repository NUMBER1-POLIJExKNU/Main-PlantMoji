import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const live = read("public/farm/live.js");
const migration = read("supabase/milestone21-sensor-realtime.sql");

describe("live sensor readings (milestone21)", () => {
  it("adds sensor_readings to the realtime publication, idempotently", () => {
    // Re-running a migration on a project that already has the table must be a
    // no-op, the same shape every other publication add in this repo uses.
    expect(migration).toContain("pg_publication_tables");
    expect(migration).toContain("alter publication supabase_realtime add table public.sensor_readings;");
  });

  it("subscribes on its OWN channel, so a missing migration cannot take the page down", () => {
    // Until milestone21 runs, sensor_readings is absent from the publication
    // and the join errors. Isolated — exactly like bond_events (milestone8)
    // and camera_events (milestone19) — that costs the live push and nothing
    // else; plants/bond/quests keep their subscriptions.
    expect(live).toContain("`farm-sensors-${PLANT_ID}`");
    expect(live).toContain('table: "sensor_readings", filter: `plant_id=eq.${PLANT_ID}`');
    // Its own try/catch, not folded into the main channel's chain.
    const channel = live.slice(live.indexOf("farm-sensors-"), live.indexOf("farm-sensors-") + 900);
    expect(channel).toContain(".subscribe();");
  });

  it("keeps the poll as the safety net rather than replacing it", () => {
    // A dropped socket, a project without the migration, or a reading that
    // lands while the tab is hidden all still arrive within 15s.
    expect(live).toContain("setInterval(refresh, 15_000)");
  });

  it("never lets a real reading overwrite the classroom sandbox", () => {
    // The cheat panel owns the tiles while it is on; a push arriving
    // underneath would silently replace the numbers being demonstrated.
    const channel = live.slice(live.indexOf("farm-sensors-"), live.indexOf("farm-sensors-") + 900);
    expect(channel).toContain("window.PMCheat?.isActive()");
  });
});
