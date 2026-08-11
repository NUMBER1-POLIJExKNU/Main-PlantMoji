// Static Seed Shop catalog — the AUTHORITATIVE price list (spec: catalog
// prices are validated server-side; server actions read this module and the
// browser never sends a price). Static TS module, mirroring the MVP pattern
// used by story chapter definitions: en/id copy inline, no database table.
//
// Item keys are LOAD-BEARING: the farm layer derives CSS classes from them
// (`shop-<item_key>` on .mascot-svg, `own-<item_key>` on .shop-decor-layer),
// so renaming a key is a breaking visual change.

import type { AppLocale } from "@/lib/i18n";

export type ShopCategory = "pot" | "decor" | "accessory";

export interface ShopItem {
  key: string;
  category: ShopCategory;
  /** Price in Seeds. Positive integer. */
  price: number;
  emoji: string;
  name: { en: string; id: string };
  blurb: { en: string; id: string };
}

export const SHOP_CATALOG: readonly ShopItem[] = [
  // ── Pots (equippable, at most one) ────────────────────────────────────
  {
    key: "pot_terracotta",
    category: "pot",
    price: 20,
    emoji: "🏺",
    name: { en: "Terracotta Pot", id: "Pot Terakota" },
    blurb: {
      en: "Sun-baked orange clay, warm like a Jember afternoon.",
      id: "Tanah liat oranye yang hangat seperti sore di Jember.",
    },
  },
  {
    key: "pot_batik",
    category: "pot",
    price: 35,
    emoji: "🟫",
    name: { en: "Batik Pot", id: "Pot Batik" },
    blurb: {
      en: "A pot wrapped in a proud batik pattern.",
      id: "Pot berbalut motif batik kebanggaan.",
    },
  },
  {
    key: "pot_tincan",
    category: "pot",
    price: 25,
    emoji: "🥫",
    name: { en: "Tin Can Pot", id: "Pot Kaleng" },
    blurb: {
      en: "Upcycled tin can — thrifty and shiny.",
      id: "Kaleng daur ulang — hemat dan berkilau.",
    },
  },
  { key: "pot_coffee_sack", category: "pot", price: 30, emoji: "☕", name: { en: "Coffee Sack Pot", id: "Pot Karung Kopi" }, blurb: { en: "A reused coffee sack inspired by Jember farms.", id: "Karung kopi guna ulang yang terinspirasi kebun Jember." } },
  { key: "pot_bamboo", category: "pot", price: 40, emoji: "🎋", name: { en: "Bamboo Planter", id: "Pot Bambu" }, blurb: { en: "A warm bamboo-style home for Jamkachu.", id: "Rumah bergaya bambu yang hangat untuk Jamkachu." } },
  { key: "pot_jember_mosaic", category: "pot", price: 45, emoji: "🟩", name: { en: "Jember Mosaic Pot", id: "Pot Mosaik Jember" }, blurb: { en: "Highland green and coastal blue in one pattern.", id: "Hijau pegunungan dan biru pesisir dalam satu motif." } },
  // ── Farm decorations (display once owned, no equip) ───────────────────
  {
    key: "decor_scarecrow",
    category: "decor",
    price: 40,
    emoji: "🎃",
    name: { en: "Scarecrow", id: "Orang-orangan Sawah" },
    blurb: {
      en: "A friendly guard for the garden.",
      id: "Penjaga ramah untuk kebun.",
    },
  },
  {
    key: "decor_fence",
    category: "decor",
    price: 30,
    emoji: "🎍",
    name: { en: "Bamboo Fence", id: "Pagar Bambu" },
    blurb: {
      en: "A neat little bamboo border.",
      id: "Pagar bambu kecil yang rapi.",
    },
  },
  {
    key: "decor_lantern",
    category: "decor",
    price: 25,
    emoji: "🏮",
    name: { en: "Garden Lantern", id: "Lentera Kebun" },
    blurb: {
      en: "A soft glow for starry nights.",
      id: "Cahaya lembut untuk malam berbintang.",
    },
  },
  {
    key: "decor_pond",
    category: "decor",
    price: 45,
    emoji: "🪷",
    name: { en: "Mini Pond", id: "Kolam Mini" },
    blurb: {
      en: "A tiny pond with a lily pad.",
      id: "Kolam mungil dengan daun teratai.",
    },
  },
  { key: "decor_coffee_sign", category: "decor", price: 30, emoji: "☕", name: { en: "Coffee Farm Sign", id: "Papan Kebun Kopi" }, blurb: { en: "A small sign celebrating Jember coffee country.", id: "Papan kecil yang merayakan kawasan kopi Jember." } },
  { key: "decor_greenhouse", category: "decor", price: 55, emoji: "🏡", name: { en: "Mini Greenhouse", id: "Rumah Kaca Mini" }, blurb: { en: "A tiny classroom greenhouse for the farm.", id: "Rumah kaca kelas berukuran mini untuk kebun." } },
  { key: "decor_rain_barrel", category: "decor", price: 45, emoji: "🛢️", name: { en: "Rain Barrel", id: "Tong Air Hujan" }, blurb: { en: "A reminder to collect and use water wisely.", id: "Pengingat untuk menampung dan memakai air dengan bijak." } },
  { key: "decor_compost", category: "decor", price: 40, emoji: "♻️", name: { en: "Compost Corner", id: "Sudut Kompos" }, blurb: { en: "Garden leftovers return to the growing cycle.", id: "Sisa kebun kembali ke dalam siklus pertumbuhan." } },
  { key: "decor_tobacco_barn", category: "decor", price: 50, emoji: "🏚️", name: { en: "Jember Drying Barn", id: "Gudang Pengering Jember" }, blurb: { en: "A miniature landmark from Jember's farming landscape.", id: "Miniatur penanda dari lanskap pertanian Jember." } },
  { key: "decor_puger_pinwheel", category: "decor", price: 35, emoji: "🌬️", name: { en: "Puger Sea Pinwheel", id: "Kincir Angin Puger" }, blurb: { en: "A bright spinner inspired by the Puger coast.", id: "Kincir cerah yang terinspirasi pesisir Puger." } },
  { key: "decor_jfc_banner", category: "decor", price: 55, emoji: "🎭", name: { en: "JFC Parade Banner", id: "Bendera Parade JFC" }, blurb: { en: "A playful carnival banner inspired by Jember Fashion Carnaval.", id: "Bendera ceria terinspirasi Jember Fashion Carnaval." } },
  { key: "decor_indonesia_flag", category: "decor", price: 20, emoji: "🇮🇩", name: { en: "Red-and-White Flag", id: "Bendera Merah Putih" }, blurb: { en: "A little red-and-white welcome for the garden.", id: "Sambutan merah-putih kecil untuk kebun." } },
  { key: "decor_mugunghwa", category: "decor", price: 30, emoji: "🌺", name: { en: "Mugunghwa Patch", id: "Lencana Mugunghwa" }, blurb: { en: "A Korean national-flower patch for the farm fence.", id: "Lencana bunga nasional Korea untuk pagar kebun." } },
  // ── Jamkachu accessories (equippable, at most one) ────────────────────
  {
    key: "acc_strawhat",
    category: "accessory",
    price: 30,
    emoji: "👒",
    name: { en: "Straw Hat", id: "Topi Jerami" },
    blurb: {
      en: "A farmer's hat for sunny days.",
      id: "Topi petani untuk hari yang cerah.",
    },
  },
  {
    key: "acc_ribbon",
    category: "accessory",
    price: 20,
    emoji: "🎀",
    name: { en: "Stem Ribbon", id: "Pita Batang" },
    blurb: {
      en: "A cheerful bow tied on the stem.",
      id: "Pita ceria yang diikat di batang.",
    },
  },
  {
    key: "acc_glasses",
    category: "accessory",
    price: 25,
    emoji: "👓",
    name: { en: "Round Glasses", id: "Kacamata Bulat" },
    blurb: {
      en: "Perched smartly on the forehead.",
      id: "Bertengger gaya di atas dahi.",
    },
  },
  { key: "acc_coffee_crown", category: "accessory", price: 35, emoji: "🌼", name: { en: "Coffee Flower Crown", id: "Mahkota Bunga Kopi" }, blurb: { en: "Little white blossoms for a Jember look.", id: "Bunga putih kecil untuk gaya khas Jember." } },
  { key: "acc_bandana", category: "accessory", price: 25, emoji: "🧣", name: { en: "Farmer Bandana", id: "Bandana Petani" }, blurb: { en: "A practical scarf for a cheerful farm day.", id: "Kain praktis untuk hari ceria di kebun." } },
  { key: "acc_goggles", category: "accessory", price: 40, emoji: "🥽", name: { en: "Explorer Goggles", id: "Kacamata Penjelajah" }, blurb: { en: "Ready to inspect every sensor clue.", id: "Siap memeriksa setiap petunjuk dari sensor." } },
  { key: "acc_jfc_headdress", category: "accessory", price: 65, emoji: "🪶", name: { en: "JFC Feather Headdress", id: "Hiasan Kepala Bulu JFC" }, blurb: { en: "A bright, lightweight carnival look for Jamkachu.", id: "Gaya karnaval ringan dan cerah untuk Jamkachu." } },
  { key: "acc_indonesia_sash", category: "accessory", price: 25, emoji: "🇮🇩", name: { en: "Merah Putih Sash", id: "Selempang Merah Putih" }, blurb: { en: "A simple red-and-white sash for a proud garden visit.", id: "Selempang merah-putih sederhana untuk kunjungan kebun." } },
] as const;

export function shopItemByKey(key: string): ShopItem | null {
  return SHOP_CATALOG.find((item) => item.key === key) ?? null;
}

/**
 * The designer's sprite for an item (images/icons/shop → public/icons/shop),
 * or null for a key the catalog does not sell.
 *
 * Every item has one now. A pot still recolors the plant sprite and an
 * accessory still overlays it on the farm — those remain the honest preview of
 * what you get — but the shop card has to show the object itself, because the
 * card is where you choose and a recolored pot cannot be shown in a 52px box
 * next to twelve others.
 *
 * The farm shell needs the same pictures and cannot import this module, so
 * public/farm/index.html hard-codes the decor paths —
 * tests/shop-farm-decor.test.ts keeps the two in step.
 */
export function shopItemArt(key: string): string | null {
  return shopItemByKey(key) ? `/icons/shop/${key}.png` : null;
}

/** Tab icon for a category, drawn by the designer (a potted plant, a
 *  scarecrow, a ribbon) instead of the emoji the tabs used to carry. */
export function shopCategoryArt(category: ShopCategory): string {
  return `/icons/shop/category-${category}.png`;
}

// ── Error copy (honest, never optimistic — spec "Error handling") ───────

export const PURCHASE_ERROR_CODES = [
  "insufficient_seeds",
  "already_owned",
  "not_owned",
  "not_equippable",
  "unknown_item",
  "migration_missing",
  "offline",
] as const;

export type PurchaseErrorCode = (typeof PURCHASE_ERROR_CODES)[number];

const ERROR_COPY: Record<PurchaseErrorCode, { en: string; id: string }> = {
  insufficient_seeds: {
    en: "Not enough Seeds yet — finish quests, quizzes, and streak days to earn more.",
    id: "Benih belum cukup — selesaikan misi, quiz, dan hari rawatan untuk menambah Benih.",
  },
  already_owned: {
    en: "Already owned!",
    id: "Sudah dimiliki!",
  },
  not_owned: {
    en: "Buy this item first before equipping it.",
    id: "Beli dulu barang ini sebelum dipakai.",
  },
  not_equippable: {
    en: "Decorations display on the farm automatically once owned.",
    id: "Dekorasi tampil otomatis di kebun setelah dimiliki.",
  },
  unknown_item: {
    en: "That item is not in the catalog.",
    id: "Barang itu tidak ada di katalog.",
  },
  migration_missing: {
    en: "The shop is coming soon at this school. (ops: run supabase/milestone18-seed-shop.sql)",
    id: "Toko segera hadir di sekolah ini. (ops: run supabase/milestone18-seed-shop.sql)",
  },
  offline: {
    en: "The shop can't reach the garden server right now. Try again soon.",
    id: "Toko belum bisa terhubung ke server kebun. Coba lagi sebentar lagi.",
  },
};

export function purchaseErrorCopy(code: PurchaseErrorCode, locale: AppLocale): string {
  return ERROR_COPY[code][locale];
}

// ── Page copy (en/id parity guarded by tests/shop-catalog.test.ts) ──────

export const SHOP_UI_COPY = {
  en: {
    eyebrow: "Spend your Seeds",
    title: "Seed Shop",
    subtitle: "Jamkachu's cosmetic shop",
    balanceLabel: "Seeds",
    owned: "Owned",
    equipped: "Equipped",
    equip: "Wear it",
    unequip: "Take off",
    buy: "Buy",
    purchased: "Yay! It's yours!",
    equippedToast: "Looking good!",
    filters: { all: "All", affordable: "Can buy", owned: "Owned" },
    preview: "Try it on",
    previewing: "Trying on",
    closePreview: "Close preview",
    decorAuto: "Appears automatically on My Garden",
    needMore: "more Seeds needed",
    categories: { pot: "Pots", decor: "Farm decorations", accessory: "Accessories" },
    tryOnStage: "Try-on stage",
    tryOnNote: "Try it on — seeds are only spent when you buy.",
    tryOnHint: "Tap an item below to try it on.",
    accessoryPreviewNote: "Accessories will show on Jamkachu once you wear them on the farm.",
    comingSoonTitle: "Coming soon at this school",
    comingSoonLines: [
      "The Seed Shop opens once the garden server learns about Seeds.",
      "Everything you earn until then is kept safe.",
      "(ops: run supabase/milestone18-seed-shop.sql, then redeploy)",
    ],
    offlineTitle: "Connecting...",
    offlineLines: [
      "Supabase environment variables are not set yet.",
      "Copy .env.local.example to .env.local, fill in the values, then restart the dev server.",
    ],
  },
  id: {
    eyebrow: "Belanjakan Benihmu",
    title: "Toko Benih",
    subtitle: "Toko kosmetik Jamkachu",
    balanceLabel: "Benih",
    owned: "Dimiliki",
    equipped: "Dipakai",
    equip: "Pakai",
    unequip: "Lepas",
    buy: "Beli",
    purchased: "Hore! Jadi milikmu!",
    equippedToast: "Keren!",
    filters: { all: "Semua", affordable: "Bisa dibeli", owned: "Dimiliki" },
    preview: "Coba pakai",
    previewing: "Sedang dicoba",
    closePreview: "Tutup pratinjau",
    decorAuto: "Otomatis tampil di Kebun Saya",
    needMore: "Benih lagi dibutuhkan",
    categories: { pot: "Pot", decor: "Dekorasi kebun", accessory: "Aksesori" },
    tryOnStage: "Panggung coba pakai",
    tryOnNote: "Coba dulu — biji hanya terpakai saat membeli.",
    tryOnHint: "Ketuk salah satu barang di bawah untuk mencobanya.",
    accessoryPreviewNote: "Aksesori akan tampil di Jamkachu begitu kamu pakai di kebun.",
    comingSoonTitle: "Segera hadir di sekolah ini",
    comingSoonLines: [
      "Toko Benih akan buka setelah server kebun mengenal Benih.",
      "Semua yang kamu kumpulkan sampai saat itu tetap tersimpan aman.",
      "(ops: run supabase/milestone18-seed-shop.sql, then redeploy)",
    ],
    offlineTitle: "Menghubungkan...",
    offlineLines: [
      "Variabel lingkungan Supabase belum diatur.",
      "Salin .env.local.example ke .env.local, isi nilainya, lalu mulai ulang server dev.",
    ],
  },
} as const;
