import { companionStageLabel, type AppLocale } from "@/lib/i18n";

export const MEMORY_EVENT_TYPES = ["QUEST_COMPLETED", "COMPANION_EVOLVED", "LEVEL_UP", "BADGE_UNLOCKED", "CHAPTER_UNLOCKED"] as const;
export type MemoryEventType = (typeof MEMORY_EVENT_TYPES)[number];

export interface MemoryEventRow {
  event_id: string;
  type: string;
  data: Record<string, unknown> | null;
  occurred_at: string;
}

export interface JamkachuMemory {
  id: string;
  type: MemoryEventType;
  occurredAt: string;
  title: string;
  verifiedSummary: string;
  fallback: string;
}

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const cleaned = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 100) : fallback;
}

/** FNV-1a over the event id — variety must be deterministic per memory so
 *  SSR, client re-render, and tests all agree on which line a memory gets. */
export function memorySeed(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Writing angles handed to the AI so consecutive reflections don't share
 *  one sentence shape. English on purpose — prompt language, not player copy. */
export const REFLECTION_ANGLES: readonly string[] = [
  "one tiny sensory detail you remember from that day — how the light, the water, or the air felt",
  "exactly how it felt in your leaves the very moment it happened",
  "how far the two of you have grown together since that day",
  "a playful question back to your caretaker, asking if they remember it too",
  "what you were secretly hoping or worrying about right before it happened",
  "why that small moment mattered more than it looked from outside",
];

/** Salted separately from the fallback pick so the two don't correlate. */
export function memoryReflectionAngle(id: string): string {
  return REFLECTION_ANGLES[memorySeed(`angle:${id}`) % REFLECTION_ANGLES.length];
}

/**
 * Rough, digit-free "how long ago" phrase for the AI prompt. Digit-free is a
 * hard requirement: validMemoryReflection rejects any digit that isn't in the
 * verified memory, so "2 weeks ago" would poison an otherwise good reply.
 */
export function memoryTimeAgo(occurredAt: string, locale: AppLocale, now: Date = new Date()): string | null {
  const occurredMs = Date.parse(occurredAt);
  if (Number.isNaN(occurredMs)) return null;
  const days = (now.getTime() - occurredMs) / 86_400_000;
  if (days < 0) return null;
  if (days < 1) return locale === "id" ? "baru hari ini" : "just today";
  if (days < 2) return locale === "id" ? "kemarin" : "yesterday";
  if (days < 7) return locale === "id" ? "beberapa hari yang lalu" : "a few days ago";
  if (days < 14) return locale === "id" ? "sekitar seminggu yang lalu" : "about a week ago";
  if (days < 31) return locale === "id" ? "beberapa minggu yang lalu" : "a few weeks ago";
  if (days < 62) return locale === "id" ? "sekitar sebulan yang lalu" : "about a month ago";
  return locale === "id" ? "sudah cukup lama" : "quite a while ago";
}

type MemoryTemplate = (subject: string) => string;

// Five genuinely different diary voices per event type, en/id paired 1:1 by
// index. The seed picks one per memory, so tapping through the picker reads
// like different diary entries even with no GEMINI_API_KEY at all. None of
// these introduce digits beyond the interpolated subject (validMemoryReflection
// builds its allowed-number set from this exact chosen line).
const FALLBACK_POOLS: Record<MemoryEventType, Record<AppLocale, MemoryTemplate[]>> = {
  QUEST_COMPLETED: {
    en: [
      (name) => `I still remember when you completed ${name}. It felt wonderful to care for this garden together.`,
      (name) => `The day you finished ${name}, my leaves felt lighter all afternoon. Did you notice?`,
      (name) => `Remember ${name}? You showed up for me that day, and I haven't forgotten it.`,
      (name) => `Sometimes I think about the moment you wrapped up ${name} — the garden felt calmer right after.`,
      (name) => `${name} — that one made me happy. Little jobs like that are how we became a real team.`,
    ],
    id: [
      (name) => `Aku masih ingat saat kamu menyelesaikan ${name}. Rasanya menyenangkan karena kita merawat kebun ini bersama.`,
      (name) => `Hari kamu menyelesaikan ${name}, daunku terasa lebih ringan sepanjang sore. Kamu sadar tidak?`,
      (name) => `Ingat ${name}? Hari itu kamu datang untukku, dan aku belum melupakannya.`,
      (name) => `Kadang aku memikirkan saat kamu menuntaskan ${name} — kebun terasa lebih tenang setelahnya.`,
      (name) => `${name} — yang itu membuatku senang. Dari tugas-tugas kecil seperti itulah kita jadi tim sungguhan.`,
    ],
  },
  COMPANION_EVOLVED: {
    en: [
      (stage) => `That was when I grew into ${stage}. I still remember how proud we were to see that change.`,
      (stage) => `Becoming ${stage} felt like stretching into a whole new set of leaves. You were right there watching.`,
      (stage) => `Do you remember the day I turned into ${stage}? I was a little nervous, and then so glad you saw it.`,
      (stage) => `I keep that ${stage} day close — proof of how far your care has carried me.`,
      (stage) => `The morning I woke up as ${stage}, everything looked different. We grew that day, both of us.`,
    ],
    id: [
      (stage) => `Waktu itu aku tumbuh menjadi ${stage}. Aku masih ingat betapa bangganya kita saat melihat perubahan itu.`,
      (stage) => `Menjadi ${stage} rasanya seperti merentangkan daun-daun yang benar-benar baru. Kamu ada di sana menyaksikannya.`,
      (stage) => `Ingat hari aku berubah menjadi ${stage}? Aku sedikit gugup, lalu sangat senang kamu melihatnya.`,
      (stage) => `Hari ${stage} itu kusimpan baik-baik — bukti sejauh apa perawatanmu membawaku.`,
      (stage) => `Pagi saat aku terbangun sebagai ${stage}, semuanya terlihat berbeda. Hari itu kita berdua tumbuh.`,
    ],
  },
  LEVEL_UP: {
    en: [
      (level) => `This was when our bond reached Level ${level}. I was so happy that we had grown closer.`,
      (level) => `Level ${level} — I remember thinking our roots had tangled together a little more that day.`,
      (level) => `When we hit Level ${level}, I wanted to wave every leaf I had. Thank you for staying with me.`,
      (level) => `Reaching Level ${level} was never about the number. It was every small visit you made before it.`,
      (level) => `Level ${level} snuck up on us, didn't it? One day of care at a time.`,
    ],
    id: [
      (level) => `Di sinilah ikatan kita mencapai Level ${level}. Aku senang karena kita bisa tumbuh semakin dekat.`,
      (level) => `Level ${level} — aku ingat merasa akar kita saling terjalin sedikit lebih erat hari itu.`,
      (level) => `Saat kita mencapai Level ${level}, rasanya aku ingin melambaikan semua daunku. Terima kasih sudah menemaniku.`,
      (level) => `Mencapai Level ${level} tidak pernah soal angkanya. Itu tentang setiap kunjungan kecilmu sebelumnya.`,
      (level) => `Level ${level} datang diam-diam, ya? Satu hari perawatan demi satu hari.`,
    ],
  },
  BADGE_UNLOCKED: {
    en: [
      (name) => `We earned the ${name} badge together. That was such a proud little memory.`,
      (name) => `The ${name} badge still makes me smile — we really worked for that one.`,
      (name) => `Remember unlocking ${name}? You did the caring; I just did the growing.`,
      (name) => `Whenever I think of the ${name} badge, I remember us cheering quietly in the garden.`,
      (name) => `${name} — our little trophy. It tells the story of your patience better than words could.`,
    ],
    id: [
      (name) => `Kita mendapatkan lencana ${name} bersama. Itu benar-benar kenangan kecil yang membanggakan.`,
      (name) => `Lencana ${name} masih membuatku tersenyum — kita benar-benar berjuang untuk yang satu itu.`,
      (name) => `Ingat saat membuka ${name}? Kamu yang merawat; aku tinggal tumbuh.`,
      (name) => `Setiap kali memikirkan lencana ${name}, aku teringat kita bersorak pelan di kebun.`,
      (name) => `${name} — piala kecil kita. Ia menceritakan kesabaranmu lebih baik daripada kata-kata.`,
    ],
  },
  CHAPTER_UNLOCKED: {
    en: [
      (chapter) => `That was when our story opened ${chapter}. I still smile when I remember sharing it with you.`,
      (chapter) => `Opening ${chapter} felt like turning a page we had written ourselves.`,
      (chapter) => `Do you remember starting ${chapter}? I couldn't wait to see what we'd grow into next.`,
      (chapter) => `${chapter} began that day — another piece of our story that only we know.`,
      (chapter) => `When ${chapter} unlocked, I realized our little diary was becoming a real book.`,
    ],
    id: [
      (chapter) => `Saat itu kisah kita membuka bab ${chapter}. Aku masih senang setiap kali mengingat kita menjalaninya bersama.`,
      (chapter) => `Membuka ${chapter} rasanya seperti membalik halaman yang kita tulis sendiri.`,
      (chapter) => `Ingat saat memulai ${chapter}? Aku tidak sabar melihat kita tumbuh jadi apa selanjutnya.`,
      (chapter) => `${chapter} dimulai hari itu — satu lagi bagian cerita kita yang hanya kita yang tahu.`,
      (chapter) => `Saat ${chapter} terbuka, aku sadar buku harian kecil kita mulai menjadi buku sungguhan.`,
    ],
  },
};

function pickFallback(type: MemoryEventType, locale: AppLocale, id: string, subject: string): string {
  const pool = FALLBACK_POOLS[type][locale];
  return pool[memorySeed(id) % pool.length](subject);
}

export function toJamkachuMemory(row: MemoryEventRow, locale: AppLocale): JamkachuMemory | null {
  if (!MEMORY_EVENT_TYPES.includes(row.type as MemoryEventType)) return null;
  const type = row.type as MemoryEventType;
  const data = row.data ?? {};
  const id = String(row.event_id);
  if (!id || Number.isNaN(Date.parse(row.occurred_at))) return null;
  if (type === "QUEST_COMPLETED") {
    const name = safeText(data.title ?? data.questKey, locale === "id" ? "misi perawatan" : "care quest");
    return { id, type, occurredAt: row.occurred_at, title: locale === "id" ? `Perawatan terverifikasi: ${name}` : `Verified care: ${name}`, verifiedSummary: `My caretaker completed the verified care quest “${name}”.`, fallback: pickFallback(type, locale, id, name) };
  }
  if (type === "COMPANION_EVOLVED") {
    // Localized ladder name when the stored stage is a known enum value;
    // unknown strings pass through raw (companionStageLabel falls back).
    const stage = companionStageLabel(locale, safeText(data.stage, locale === "id" ? "tahap baru" : "a new stage"));
    return { id, type, occurredAt: row.occurred_at, title: locale === "id" ? `Jamkachu tumbuh menjadi ${stage}` : `Jamkachu grew into ${stage}`, verifiedSummary: `I grew into the companion stage “${stage}”.`, fallback: pickFallback(type, locale, id, stage) };
  }
  if (type === "LEVEL_UP") {
    const level = safeText(data.levelAfter, "?");
    return { id, type, occurredAt: row.occurred_at, title: locale === "id" ? `Ikatan mencapai Level ${level}` : `Bond reached Level ${level}`, verifiedSummary: `Our bond reached level ${level}.`, fallback: pickFallback(type, locale, id, level) };
  }
  if (type === "BADGE_UNLOCKED") {
    const name = safeText(data.name ?? data.badgeKey, locale === "id" ? "lencana baru" : "a new badge");
    return { id, type, occurredAt: row.occurred_at, title: locale === "id" ? `Lencana terbuka: ${name}` : `Badge unlocked: ${name}`, verifiedSummary: `We unlocked the badge “${name}” together.`, fallback: pickFallback(type, locale, id, name) };
  }
  const chapter = safeText(data.title ?? data.chapter, locale === "id" ? "bab baru" : "a new chapter");
  return { id, type, occurredAt: row.occurred_at, title: locale === "id" ? `Bab cerita terbuka: ${chapter}` : `Story chapter unlocked: ${chapter}`, verifiedSummary: `A new chapter of our story opened: “${chapter}”.`, fallback: pickFallback(type, locale, id, chapter) };
}

export function selectFeaturedMemory(memories: JamkachuMemory[]): JamkachuMemory | null {
  const special = new Set<MemoryEventType>(["COMPANION_EVOLVED", "CHAPTER_UNLOCKED", "BADGE_UNLOCKED"]);
  return memories.find((memory) => special.has(memory.type))
    ?? memories.find((memory) => memory.type === "QUEST_COMPLETED")
    ?? memories.find((memory) => memory.type === "LEVEL_UP")
    ?? null;
}

export function validMemoryReflection(text: string, memory: JamkachuMemory): boolean {
  const cleaned = text.trim();
  if (!cleaned || cleaned.length > 300 || /\b(as an ai|language model|analysis result|dashboard)\b/i.test(cleaned)) return false;
  const allowedNumbers = new Set((`${memory.verifiedSummary} ${memory.fallback}`.match(/\d+(?:[.,]\d+)?/g) ?? []));
  return (cleaned.match(/\d+(?:[.,]\d+)?/g) ?? []).every((value) => allowedNumbers.has(value));
}
