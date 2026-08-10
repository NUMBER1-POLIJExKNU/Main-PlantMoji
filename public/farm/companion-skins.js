// PlantMoji farm-layer companion skin catalog (milestone20) — a display-only
// mirror of COMPANION_SKINS in src/types/game.ts, which stays the single
// source of truth. tests/companion-skins-parity.test.ts fails if the two
// tables drift, so always edit both files together.
//
// Plain synchronous script — NOT a module — so it can be loaded with a bare
// <script src="/farm/companion-skins.js"> tag BEFORE live.js (same pattern
// as companion-ladder.js). It only assigns window.PM_SKINS. Consumers must
// read it defensively (`window.PM_SKINS?.skins ?? []`) so a missing tag
// never breaks the page.
//
// Presentation only: skins are cosmetic Jember-crop looks unlocked by bond
// level. They NEVER grant or gate XP, seeds, quests, evolution, or sensors —
// the companion engine never reads this table. Order matters: ascending
// unlockLevel, "jamkachu" first (the default, always unlocked).

(function () {
  const PM_SKINS = {
    skins: [
      { key: "jamkachu", unlockLevel: 1, nameEn: "Classic Jamkachu", nameId: "Jamkachu Klasik", accent: "#89D974" },
      { key: "edamame", unlockLevel: 2, nameEn: "Edamame Buddy", nameId: "Sobat Edamame", accent: "#9CCB5D" },
      { key: "padi", unlockLevel: 4, nameEn: "Golden Rice", nameId: "Padi Emas", accent: "#E8C95A" },
      { key: "jagung", unlockLevel: 6, nameEn: "Sweet Corn", nameId: "Jagung Manis", accent: "#F5B93F" },
      { key: "kopi", unlockLevel: 8, nameEn: "Robusta Coffee", nameId: "Kopi Robusta", accent: "#8A5A3B" },
      { key: "kakao", unlockLevel: 10, nameEn: "Cacao Pod", nameId: "Buah Kakao", accent: "#B0693C" },
      { key: "buah_naga", unlockLevel: 12, nameEn: "Dragon Fruit", nameId: "Buah Naga", accent: "#E85FA2" },
    ],
  };

  if (typeof window !== "undefined") {
    window.PM_SKINS = PM_SKINS;
  }
})();
