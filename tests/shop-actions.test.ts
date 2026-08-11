import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }));

import { equipShopItem } from "@/app/shop/actions";

describe("equipShopItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSupabase.mockReturnValue({ rpc: mocks.rpc });
  });

  it("sends only the catalog key and boolean to the equip RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ok: true, category: "accessory", equipped: true },
      error: null,
    });

    const result = await equipShopItem("acc_ribbon", true, "en");

    expect(mocks.rpc).toHaveBeenCalledWith("equip_item", {
      p_plant_id: "plant-01",
      p_item_key: "acc_ribbon",
      p_equipped: true,
    });
    expect(result).toMatchObject({
      status: "success",
      itemKey: "acc_ribbon",
      category: "accessory",
      equipped: true,
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/shop"], ["/"]]);
  });

  it("returns the RPC-confirmed unequipped state instead of assuming the request", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ok: true, category: "pot", equipped: false },
      error: null,
    });

    const result = await equipShopItem("pot_batik", false, "id");

    expect(result).toMatchObject({
      status: "success",
      itemKey: "pot_batik",
      category: "pot",
      equipped: false,
    });
  });

  it("rejects unknown keys before contacting Supabase", async () => {
    const result = await equipShopItem("acc_not_real", true, "en");

    expect(result).toMatchObject({ status: "error", code: "unknown_item" });
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps not-owned failures explicit and does not revalidate", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, error: "not_owned" }, error: null });

    const result = await equipShopItem("acc_ribbon", true, "en");

    expect(result).toMatchObject({ status: "error", code: "not_owned" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
