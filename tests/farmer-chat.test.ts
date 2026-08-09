import { describe, expect, it } from "vitest";
import { deterministicFarmerReply, farmerFacts, validFarmerReply, type FarmerChatContext } from "@/lib/farmer-chat";

const context: FarmerChatContext = {
  plantName: "Jamkachu",
  cropName: "Strawberry",
  snapshot: { temperature: 33, humidity: 70, soilPh: 5.8, light: 25 },
  environment: { temperature: "High", airHumidity: "Optimal", soilPh: "Optimal", light: "Low" },
  locale: "en",
};

describe("Grandpa Tani deterministic chat", () => {
  it("answers with a warm voice while preserving the measured temperature", () => {
    const reply = deterministicFarmerReply("Is it too hot?", context);
    expect(reply).toContain("33°C");
    expect(reply).toMatch(/young friend|Hoho|together/i);
    expect(reply).toMatch(/cooler|shadier/i);
  });

  it("does not confuse air humidity with soil moisture", () => {
    const reply = deterministicFarmerReply("What about humidity?", context);
    expect(reply).toContain("70%");
    expect(reply).toMatch(/air around the leaves/i);
    expect(reply).toMatch(/not an instruction to water/i);
  });

  it("keeps soil pH advice adult-assisted and chemical-free", () => {
    const reply = deterministicFarmerReply("What does soil pH mean?", context);
    expect(reply).toContain("5.8");
    expect(reply).toMatch(/teacher or local farmer/i);
    expect(reply).toMatch(/never add chemicals/i);
  });

  it("rejects AI-like, invented, or cold provider responses", () => {
    const facts = farmerFacts(context);
    expect(validFarmerReply("As an AI, the analysis result recommends 91% humidity.", facts, "en")).toBe(false);
    expect(validFarmerReply("Temperature is high. Move it.", facts, "en")).toBe(false);
    expect(validFarmerReply("Hoho, my young friend, 33°C is warm. Let's find shade together.", facts, "en")).toBe(true);
  });

  it("uses a friendly Bahasa Indonesia fallback", () => {
    const reply = deterministicFarmerReply("Bagaimana keadaan tanaman?", { ...context, locale: "id" });
    expect(reply).toMatch(/Nak|Hoho|kita/i);
    expect(reply).toMatch(/suhu/i);
  });
});
