import type { AdvisoryStatus, SensorSnapshot } from "@/lib/crop-profiles";
import type { AppLocale } from "@/lib/i18n";

export type FarmerEnvironment = Record<"temperature" | "airHumidity" | "soilPh" | "light", AdvisoryStatus>;

export interface FarmerChatContext {
  plantName: string;
  cropName: string;
  snapshot: SensorSnapshot | null;
  environment: FarmerEnvironment;
  locale: AppLocale;
}

type Intent = "temperature" | "airHumidity" | "soilPh" | "light" | "overview";

function intentOf(question: string): Intent {
  const q = question.toLocaleLowerCase();
  if (/temperature|temp|hot|cold|warm|heat|suhu|panas|dingin/.test(q)) return "temperature";
  if (/humidity|humid|dry air|kelembapan|lembap|udara kering/.test(q)) return "airHumidity";
  if (/\bph\b|soil|acid|alkaline|tanah|asam|basa/.test(q)) return "soilPh";
  if (/light|bright|dark|sun|cahaya|terang|gelap|matahari/.test(q)) return "light";
  return "overview";
}

const STATUS_ID: Record<AdvisoryStatus, string> = { Optimal: "nyaman", Low: "lebih rendah dari rentang referensi", High: "lebih tinggi dari rentang referensi", Waiting: "belum bisa dinilai" };
const STATUS_EN: Record<AdvisoryStatus, string> = { Optimal: "sitting comfortably", Low: "below the reference range", High: "above the reference range", Waiting: "not ready to judge yet" };

function shown(value: number | null | undefined, unit: string) {
  return value == null || !Number.isFinite(value) ? null : `${value}${unit}`;
}

export function farmerFacts(context: FarmerChatContext): string {
  const { snapshot: s, environment: e } = context;
  return [
    `plant=${context.plantName}`,
    `crop profile=${context.cropName}`,
    `temperature=${shown(s?.temperature, " C") ?? "missing"}; analyzer=${e.temperature}`,
    `air humidity=${shown(s?.humidity, "%") ?? "missing"}; analyzer=${e.airHumidity}`,
    `soil pH=${shown(s?.soilPh, "") ?? "missing"}; analyzer=${e.soilPh}`,
    `relative light=${shown(s?.light, "%") ?? "missing"}; analyzer=${e.light}`,
  ].join(". ");
}

export function deterministicFarmerReply(question: string, context: FarmerChatContext): string {
  const intent = intentOf(question);
  const { snapshot: s, environment: e, locale } = context;
  if (locale === "id") {
    if (intent === "temperature") {
      const value = shown(s?.temperature, "°C");
      if (!value) return "Hoho… sensor suhu belum memberi kabar, Nak. Kita tunggu pembacaan nyata sebelum menebak-nebak, ya.";
      const action = e.temperature === "High" ? "Mari coba tempat yang lebih teduh dan sejuk, lalu ukur lagi." : e.temperature === "Low" ? "Mari minta bantuan mencari tempat yang sedikit lebih hangat, lalu ukur lagi." : "Tidak perlu mengubah apa-apa dulu; kita amati lagi nanti.";
      return `Pertanyaan yang bagus, Nak. Suhunya ${value} dan saat ini ${STATUS_ID[e.temperature]}. ${action}`;
    }
    if (intent === "airHumidity") {
      const value = shown(s?.humidity, "%");
      if (!value) return "Hoho… kelembapan udara belum terbaca, Nak. Ingat, ini udara di sekitar daun, bukan air di dalam tanah.";
      return `Nah, kelembapan udaranya ${value} dan ${STATUS_ID[e.airHumidity]}. Ini bicara tentang udara di sekitar daun, jadi jangan langsung menganggap tanah perlu disiram, ya.`;
    }
    if (intent === "soilPh") {
      const value = shown(s?.soilPh, "");
      if (!value) return "Tanah belum memberi angka pH yang bisa kita percaya, Nak. Jangan kita tebak atau tambahkan apa pun dulu.";
      return `Hoho, pH tanahnya terbaca ${value} dan ${STATUS_ID[e.soilPh]}. Kalau pH perlu perhatian, tunjukkan angkanya kepada guru atau petani setempat—jangan menambahkan bahan kimia sendiri.`;
    }
    if (intent === "light") {
      const value = shown(s?.light, "%");
      if (!value) return "Cahaya belum terbaca, Nak. Kita tunggu sensor dulu sebelum memindahkan tanaman kecil kita.";
      const action = e.light === "Low" ? "Kalau masih siang, mari coba tempat yang lebih terang dan aman, lalu lihat sensornya lagi." : "Cukup kita pertahankan dan periksa lagi nanti.";
      return `Mata yang jeli, Nak. Cahaya relatifnya ${value} dan saat ini ${STATUS_ID[e.light]}. ${action}`;
    }
    const problem = (["temperature", "airHumidity", "light", "soilPh"] as const).find((key) => e[key] === "High" || e[key] === "Low");
    if (!s) return "Hoho… sensor kita belum mengirim kabar. Tidak apa-apa, Nak—kita tunggu data nyata dan tidak perlu menebak-nebak.";
    if (!problem) return "Hoho, keempat pembacaan yang bisa kita nilai sedang duduk manis, Nak. Jangan terlalu sibuk mengubah ini-itu; pertahankan dulu dan mari berkunjung lagi nanti.";
    const labels = { temperature: "suhu", airHumidity: "kelembapan udara", light: "cahaya", soilPh: "pH tanah" };
    return `Kamu memperhatikan dengan baik, Nak. Yang paling perlu kita lihat dulu adalah ${labels[problem]}, karena nilainya ${STATUS_ID[e[problem]]}. Kita ubah satu hal kecil saja, lalu minta sensor bercerita lagi.`;
  }

  if (intent === "temperature") {
    const value = shown(s?.temperature, "°C");
    if (!value) return "Hoho… the temperature sensor has not spoken yet, my young friend. Let’s wait for a real reading instead of guessing.";
    const action = e.temperature === "High" ? "Let’s try a cooler, shadier spot, then measure again." : e.temperature === "Low" ? "Let’s ask for help finding a slightly warmer spot, then measure again." : "No need to change anything yet; we can observe again later.";
    return `Good question, my young friend. The temperature is ${value}, which is ${STATUS_EN[e.temperature]}. ${action}`;
  }
  if (intent === "airHumidity") {
    const value = shown(s?.humidity, "%");
    if (!value) return "Hoho… air humidity has not been measured yet. Remember, this is the air around the leaves, not water in the soil.";
    return `The air humidity is ${value}, and it is ${STATUS_EN[e.airHumidity]}. That tells us about air around the leaves, so it is not an instruction to water the soil.`;
  }
  if (intent === "soilPh") {
    const value = shown(s?.soilPh, "");
    if (!value) return "The soil has not given us a trustworthy pH number yet, my young friend. Let’s not guess or add anything.";
    return `Hoho, the soil pH reads ${value}, and it is ${STATUS_EN[e.soilPh]}. If it needs attention, show the reading to a teacher or local farmer—never add chemicals by yourself.`;
  }
  if (intent === "light") {
    const value = shown(s?.light, "%");
    if (!value) return "The light sensor has not spoken yet. Let’s wait before moving our little plant.";
    const action = e.light === "Low" ? "If it is daytime, let’s try a brighter safe spot and ask the sensor again." : "Let’s keep it steady and check again later.";
    return `Sharp eyes, my young friend. Relative light is ${value}, and it is ${STATUS_EN[e.light]}. ${action}`;
  }
  const problem = (["temperature", "airHumidity", "light", "soilPh"] as const).find((key) => e[key] === "High" || e[key] === "Low");
  if (!s) return "Hoho… our sensors have not sent news yet. That is all right—we will wait for real data instead of guessing.";
  if (!problem) return "Hoho, all four readings we can judge are sitting nicely today. No need to fuss over the little one—let’s keep things steady and visit again later.";
  const labels = { temperature: "temperature", airHumidity: "air humidity", light: "light", soilPh: "soil pH" };
  return `You noticed well, my young friend. Let’s look at ${labels[problem]} first, because it is ${STATUS_EN[e[problem]]}. We will change one small thing, then ask the sensors to tell us what happened.`;
}

export function validFarmerReply(reply: string, facts: string, locale: AppLocale): boolean {
  const text = reply.replace(/\s+/g, " ").trim();
  if (!text || text.length > 440 || /(?:^|\n)\s*[-*#]|as an ai|language model|analysis result|recommendation is|berdasarkan analisis|hasil analisis/i.test(text)) return false;
  const allowedNumbers = new Set(facts.match(/-?\d+(?:\.\d+)?/g) ?? []);
  if ((text.match(/-?\d+(?:\.\d+)?/g) ?? []).some((number) => !allowedNumbers.has(number))) return false;
  const warm = locale === "id"
    ? /hoho|nak|kita|mari|bagus|baik|pelan|bersama/i.test(text)
    : /hoho|my young friend|little one|let's|let us|together|good question|well noticed/i.test(text);
  return warm;
}
