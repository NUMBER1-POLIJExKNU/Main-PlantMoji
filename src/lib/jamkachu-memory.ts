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

export function toJamkachuMemory(row: MemoryEventRow, locale: AppLocale): JamkachuMemory | null {
  if (!MEMORY_EVENT_TYPES.includes(row.type as MemoryEventType)) return null;
  const type = row.type as MemoryEventType;
  const data = row.data ?? {};
  const id = String(row.event_id);
  if (!id || Number.isNaN(Date.parse(row.occurred_at))) return null;
  if (type === "QUEST_COMPLETED") {
    const name = safeText(data.title ?? data.questKey, locale === "id" ? "misi perawatan" : "care quest");
    return { id, type, occurredAt: row.occurred_at, title: locale === "id" ? `Perawatan terverifikasi: ${name}` : `Verified care: ${name}`, verifiedSummary: `My caretaker completed the verified care quest “${name}”.`, fallback: locale === "id" ? `Aku masih ingat saat kamu menyelesaikan ${name}. Rasanya menyenangkan karena kita merawat kebun ini bersama.` : `I still remember when you completed ${name}. It felt wonderful to care for this garden together.` };
  }
  if (type === "COMPANION_EVOLVED") {
    // Localized ladder name when the stored stage is a known enum value;
    // unknown strings pass through raw (companionStageLabel falls back).
    const stage = companionStageLabel(locale, safeText(data.stage, locale === "id" ? "tahap baru" : "a new stage"));
    return { id, type, occurredAt: row.occurred_at, title: locale === "id" ? `Jamkachu tumbuh menjadi ${stage}` : `Jamkachu grew into ${stage}`, verifiedSummary: `I grew into the companion stage “${stage}”.`, fallback: locale === "id" ? `Waktu itu aku tumbuh menjadi ${stage}. Aku masih ingat betapa bangganya kita saat melihat perubahan itu.` : `That was when I grew into ${stage}. I still remember how proud we were to see that change.` };
  }
  if (type === "LEVEL_UP") {
    const level = safeText(data.levelAfter, "?");
    return { id, type, occurredAt: row.occurred_at, title: locale === "id" ? `Ikatan mencapai Level ${level}` : `Bond reached Level ${level}`, verifiedSummary: `Our bond reached level ${level}.`, fallback: locale === "id" ? `Di sinilah ikatan kita mencapai Level ${level}. Aku senang karena kita bisa tumbuh semakin dekat.` : `This was when our bond reached Level ${level}. I was so happy that we had grown closer.` };
  }
  if (type === "BADGE_UNLOCKED") {
    const name = safeText(data.name ?? data.badgeKey, locale === "id" ? "lencana baru" : "a new badge");
    return { id, type, occurredAt: row.occurred_at, title: locale === "id" ? `Lencana terbuka: ${name}` : `Badge unlocked: ${name}`, verifiedSummary: `We unlocked the badge “${name}” together.`, fallback: locale === "id" ? `Kita mendapatkan lencana ${name} bersama. Itu benar-benar kenangan kecil yang membanggakan.` : `We earned the ${name} badge together. That was such a proud little memory.` };
  }
  const chapter = safeText(data.title ?? data.chapter, locale === "id" ? "bab baru" : "a new chapter");
  return { id, type, occurredAt: row.occurred_at, title: locale === "id" ? `Bab cerita terbuka: ${chapter}` : `Story chapter unlocked: ${chapter}`, verifiedSummary: `A new chapter of our story opened: “${chapter}”.`, fallback: locale === "id" ? `Saat itu kisah kita membuka bab ${chapter}. Aku masih senang setiap kali mengingat kita menjalaninya bersama.` : `That was when our story opened ${chapter}. I still smile when I remember sharing it with you.` };
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
