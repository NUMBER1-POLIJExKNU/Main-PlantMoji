import type { BadgeKey, QuestKey } from "@/types/game";
import type { PlantMood } from "@/types/events";

export const APP_LOCALE_COOKIE = "plantmoji_locale";
export const DEFAULT_APP_LOCALE = "id";

export type AppLocale = "id" | "en";

export function normalizeLocale(value: unknown): AppLocale {
  return value === "en" ? "en" : DEFAULT_APP_LOCALE;
}

export const NAV_COPY: Record<AppLocale, Record<string, string>> = {
  id: {
    dashboard: "Beranda",
    plants: "Tanaman",
    monitoring: "Pemantauan",
    camera: "Kamera AI",
    quests: "Misi",
    collection: "Koleksi",
    shop: "Toko",
    settings: "Pengaturan",
  },
  en: {
    dashboard: "Dashboard",
    plants: "Plants",
    monitoring: "Monitoring",
    camera: "Camera AI",
    quests: "Quests",
    collection: "Collection",
    shop: "Shop",
    settings: "Settings",
  },
};

export const MOOD_COPY: Record<AppLocale, Record<PlantMood, string>> = {
  id: {
    Happy: "Sehat",
    Overheating: "Terlalu Panas",
    DryAir: "Udara Kering",
    Sleepy: "Kurang Cahaya",
    SoilAcidic: "Tanah Terlalu Asam",
    SoilAlkaline: "Tanah Terlalu Basa",
  },
  en: {
    Happy: "Happy",
    Overheating: "Overheating",
    DryAir: "Dry Air",
    Sleepy: "Too Dark",
    SoilAcidic: "Soil Too Acidic",
    SoilAlkaline: "Soil Too Alkaline",
  },
};

export const MOOD_EDUCATION_ID: Record<PlantMood, { title: string; why: string; action: string }> = {
  Happy: {
    title: "Di Zona Nyaman",
    why: "Semua pembacaan berada di dalam batas profil stroberi sehingga tanaman dapat tumbuh tanpa banyak stres.",
    action: "Jaga kondisi tetap stabil. Perawatan yang konsisten lebih baik daripada perubahan mendadak.",
  },
  Overheating: {
    title: "Terlalu Panas untuk Tumbuh",
    why: "Udara yang terlalu panas membuat daun kehilangan air lebih cepat dan memperlambat fotosintesis.",
    action: "Beri naungan, jauhkan dari kaca panas, atau tambah aliran udara, lalu tunggu verifikasi sensor.",
  },
  DryAir: {
    title: "Udara Kering, Bukan Tanah Kering",
    why: "Kelembapan udara rendah menarik air keluar dari daun, walaupun tanah masih cukup basah.",
    action: "Lembapkan udara di sekitar daun atau jauhkan pot dari kipas dan AC. Jangan otomatis menyiram tanah.",
  },
  Sleepy: {
    title: "Tanpa Cahaya, Tanpa Makanan",
    why: "Tanaman memerlukan cahaya untuk fotosintesis dan membuat gula sebagai sumber energi.",
    action: "Pindahkan ke tempat yang lebih terang atau pulihkan sumber cahaya.",
  },
  SoilAcidic: {
    title: "Tanah Terlalu Asam",
    why: "pH yang terlalu rendah membuat sebagian unsur hara sulit diserap akar stroberi.",
    action: "Gunakan perawatan lembut seperti air biasa atau media tanam baru, lalu ukur kembali. Hindari bahan kimia kuat.",
  },
  SoilAlkaline: {
    title: "Tanah Terlalu Basa",
    why: "pH yang terlalu tinggi membuat zat besi dan unsur mikro lain lebih sulit diserap akar.",
    action: "Gunakan perawatan lembut dan ukur kembali. Hindari bahan kimia kuat.",
  },
};

export interface LocalizedQuestCopy {
  title: string;
  description: string;
  why: string;
}

export const QUEST_COPY_ID: Record<QuestKey, LocalizedQuestCopy> = {
  KEEP_ME_HAPPY: {
    title: "Jaga Aku Tetap Sehat",
    description: "Jaga semua kondisiku tetap nyaman selama 30 menit.",
    why: "Kondisi yang stabil lebih membantu pertumbuhan daripada satu pembacaan sensor yang kebetulan baik.",
  },
  STAY_COMFY: {
    title: "Tetap Nyaman",
    description: "Jaga aku di zona nyaman selama dua jam tanpa putus.",
    why: "Dua jam yang stabil membantu tanaman memakai energinya untuk tumbuh, bukan terus menyesuaikan diri.",
  },
  COOL_ME_DOWN: {
    title: "Sejukkan Aku",
    description: "Udaraku terlalu panas. Sejukkan dan jaga tetap stabil selama 5 menit.",
    why: "Udara yang lebih sejuk mengurangi kehilangan air dari daun dan membantu fotosintesis berjalan kembali.",
  },
  GIVE_ME_MORE_LIGHT: {
    title: "Beri Aku Cahaya",
    description: "Tempatku terlalu gelap. Nyalakan kembali cahaya dan jaga selama 5 menit.",
    why: "Cahaya adalah sumber energi fotosintesis yang dipakai tanaman untuk membuat makanan.",
  },
  HUMIDIFY_MY_AIR: {
    title: "Lembapkan Udaraku",
    description: "Udara di sekitar daun terlalu kering. Lembapkan udara, bukan tanah, lalu jaga selama 5 menit.",
    why: "Kelembapan udara yang cukup memperlambat hilangnya air dari daun. Misi ini bukan perintah untuk menyiram tanah.",
  },
  BALANCE_SOIL_ACIDIC: {
    title: "Seimbangkan Tanahku",
    description: "Tanah terlalu asam. Gunakan perawatan lembut, lalu jaga pH stabil selama 5 menit.",
    why: "pH 5,5–6,5 membantu akar stroberi menyerap unsur hara. Hindari menambahkan bahan kimia kuat.",
  },
  BALANCE_SOIL_ALKALINE: {
    title: "Seimbangkan Tanahku",
    description: "Tanah terlalu basa. Gunakan perawatan lembut, lalu jaga pH stabil selama 5 menit.",
    why: "pH 5,5–6,5 membantu unsur mikro tetap tersedia bagi akar stroberi. Hindari bahan kimia kuat.",
  },
};

export const BADGE_COPY_ID: Record<BadgeKey, { name: string; description: string }> = {
  FIRST_RESCUE: {
    name: "Pertolongan Pertama",
    description: "Membantu tanaman kembali sehat untuk pertama kali.",
  },
  LIGHT_MASTER: { name: "Pembantu Cahaya", description: "Menyelesaikan 5 misi cahaya." },
  LEVEL_5_BOND: { name: "Sahabat Baik", description: "Mencapai level persahabatan 5." },
  COOL_KEEPER: { name: "Pembantu Sejuk", description: "Menyelesaikan 5 misi menyejukkan." },
  PH_GUARDIAN: { name: "Tanah Sehat", description: "Menjaga tanah sehat selama 7 hari." },
  STREAK_7: { name: "Rawat 7 Hari", description: "Merawat tanaman 7 hari berturut-turut." },
  HUMIDITY_HERO: { name: "Pembantu Udara", description: "Mengatasi udara kering 5 kali." },
  MOOD_SCHOLAR: { name: "Penemu Suasana", description: "Menemukan semua 6 suasana tanaman." },
  CARE_VETERAN: { name: "Bintang Misi", description: "Menyelesaikan 25 misi." },
  CHRONICLER: { name: "Penulis Tanaman", description: "Menulis 5 catatan pertumbuhan." },
  STREAK_30: { name: "Rawat 30 Hari", description: "Merawat tanaman 30 hari berturut-turut." },
  LEVEL_10_BOND: { name: "Sahabat Terbaik", description: "Mencapai level persahabatan 10." },
};

export const DAILY_EVENT_COPY_ID: Record<string, { name: string; description: string }> = {
  GOLDEN_HOUR: {
    name: "Jam Emas di Sawah",
    description: "Hari untuk merayakan cahaya sore Jember di atas sawah — XP misi bernilai 1,5× hari ini.",
  },
  DOUBLE_CARE: {
    name: "Hari Perawat Tanaman",
    description: "Untuk menghargai tangan-tangan teliti di kebun kopi dan kakao Jember, XP misi bernilai 1,25× hari ini.",
  },
  STEADY_DAY: {
    name: "Tangan yang Stabil",
    description: "Jaga tanaman bebas dari kondisi bermasalah pada pukul 06.00–18.00 hari ini untuk mendapat +15 XP.",
  },
  JOURNAL_DAY: {
    name: "Hari Catatan Lapangan",
    description: "Catat satu perkembangan tanaman hari ini untuk mendapat +10 XP.",
  },
  QUEST_FINISHER: {
    name: "Hari Panen Kecil",
    description: "Selesaikan satu misi hari ini untuk mendapat bonus +10 XP.",
  },
  CARNAVAL_DAY: {
    name: "Hari Karnaval",
    description: "Aku sedang membayangkan Jember Fashion Carnaval dan ingin bergaya seperti peserta parade.",
  },
  PASAR_PAGI_DAY: {
    name: "Pagi di Pasar",
    description: "Aku membayangkan ramainya pasar pagi: keranjang, obrolan, dan sayuran segar.",
  },
  MOUNTAIN_MIST_DAY: {
    name: "Hari Kabut Gunung",
    description: "Pikiranku melayang ke lereng hijau di antara Gunung Argopuro dan Gunung Raung.",
  },
  VOLCANIC_SOIL_DAY: {
    name: "Bangga Tanah Vulkanik",
    description: "Lahan Jember tumbuh subur di tanah vulkanik tua — aku bangga tumbuh di sini.",
  },
};

export function questCopy(locale: AppLocale, key: QuestKey, fallback: LocalizedQuestCopy) {
  return locale === "id" ? QUEST_COPY_ID[key] : fallback;
}
