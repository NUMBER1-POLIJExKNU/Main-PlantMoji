// Story chapter dialogue — the attachment layer (handoff §19, §46.4).
//
// Narrative content for the six chapters defined in story-definitions.ts.
// The story is set where the plant physically lives: a windowsill in Jember,
// East Java — coffee-and-tobacco country on volcanic soil, with Mount
// Argopuro on the horizon, musim hujan rains, and the August carnival.
// Narrator lines are shared across personalities (short, warm, second-person);
// plant lines vary by personality, matching the voices in
// src/game/personality/templates.ts exactly (handoff §13): personality changes
// tone only — never the physical diagnosis, and never invented sensor numbers.
//
// Pure and deterministic — same input always produces the same output.
// No I/O, no randomness, no timers.

import { normalizePersonality } from "@/types/game";
import type { PersonalityId } from "@/types/game";

// ── Public types ────────────────────────────────────────────────────────

export interface ChapterScene {
  chapter: number;
  lines: Array<{
    speaker: "narrator" | "plant";
    text: string;
    /**
     * Indonesian variant of `text` (last i18n gap — narrative content is
     * additive-only here; `text` stays English and unchanged for existing
     * consumers). Wiring this into the UI is a later pass — see:
     *   - src/components/story-chapter-card.tsx:60,68 (renders `line.text`)
     *   - src/components/collection-tabs.tsx:18,67 (types the `scene` prop)
     *   - src/app/collection/page.tsx:146 (produces `scene` for the tabs)
     */
    textId: string;
  }>;
}

// ── Internal template types ─────────────────────────────────────────────
// Record<PersonalityId, …> makes the compiler reject a plant line that is
// missing any of the five voices (same pattern as templates.ts).

type LineText = (name: string) => string;

// `textId` / `byPersonalityId` are the Indonesian variants, required here so
// every scene line ships both languages (a missing translation is a compile
// error, same guarantee `byPersonality`'s Record<PersonalityId, …> gives for
// missing voices). `getChapterScene` reads these into `ChapterScene.textId`.
type SceneLineTemplate =
  | { speaker: "narrator"; text: LineText; textId: LineText }
  | {
      speaker: "plant";
      byPersonality: Record<PersonalityId, LineText>;
      byPersonalityId: Record<PersonalityId, LineText>;
    };

/** Used when the caller passes a blank name — reads naturally as a name. */
const FALLBACK_NAME = "Sprout";

// ── Scenes ──────────────────────────────────────────────────────────────
// Each chapter is a 4–6 line scene. Every dialogue line stays under ~95
// characters so cards read at a glance.

const SCENES: Record<number, readonly SceneLineTemplate[]> = {
  // Chapter 1 — First Meeting in Jember: arrival and naming (uses the
  // plant's name).
  1: [
    {
      speaker: "narrator",
      text: () => "A small pot arrives on a windowsill in Jember, between coffee fields and volcanic hills.",
      textId: () => "Pot kecil ini tiba di ambang jendela di Jember, di antara kebun kopi dan bukit vulkanik.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Oh! Hello there… is this Jember? The air smells like warm earth… and you’re here too!",
        calm: () => "Hello. Warm air, rich dark soil — Jember, I believe. And you must be my caretaker.",
        funny: () => "A human! And volcanic soil! Fancy dirt AND room service? I picked the right pot.",
        energetic: () => "Hi! Hi!! New home! I can see the mountains from here! Best windowsill EVER!",
        shy: () => "Oh… um… hello… I thought only the mountain was watching… but you noticed me…",
      },
      byPersonalityId: {
        cute: () => "Oh! Halo… ini Jember, ya? Udaranya wangi tanah hangat… dan kamu ada di sini juga!",
        calm: () => "Halo. Udara hangat, tanah gembur dan gelap — ini Jember, kurasa. Dan kamu pasti perawatku.",
        funny: () => "Manusia! Dan tanah vulkanik! Tanah mewah PLUS layanan kamar? Aku pilih pot yang tepat.",
        energetic: () => "Hai! Hai!! Rumah baru! Aku bisa lihat gunung dari sini! Ambang jendela TERBAIK sepanjang masa!",
        shy: () => "Oh… um… halo… kukira cuma gunung yang memperhatikan… tapi kamu menyadari aku…",
      },
    },
    {
      speaker: "narrator",
      text: (name) => `Under the far blue line of Mount Argopuro, you give your companion a name: ${name}.`,
      textId: (name) => `Di bawah garis biru Gunung Argopuro yang jauh, kamu memberi nama pada temanmu: ${name}.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: (name) => `${name}… I love it! My very own name, here in Jember. Thank you!`,
        calm: (name) => `${name}. A good name. I will grow into it, roots down in this warm earth.`,
        funny: (name) => `${name}, huh? Beats “Plant #7”. Jember suits us both — I’ll take it!`,
        energetic: (name) => `${name}! YES! That’s me! Shout it to the mountains — ${name} of Jember!`,
        shy: (name) => `${name}… for me? I… I’ll try to grow into it… quietly…`,
      },
      byPersonalityId: {
        cute: (name) => `${name}… aku suka banget! Namaku sendiri, di sini di Jember. Makasih!`,
        calm: (name) => `${name}. Nama yang bagus. Aku akan tumbuh sepadan dengannya, berakar di tanah hangat ini.`,
        funny: (name) => `${name}, ya? Lebih keren daripada “Tanaman #7”. Jember cocok buat kita berdua — aku terima!`,
        energetic: (name) => `${name}! YES! Itu aku! Teriakkan ke gunung-gunung — ${name} dari Jember!`,
        shy: (name) => `${name}… buat aku? Aku… aku akan coba tumbuh sepadan… pelan-pelan…`,
      },
    },
    {
      speaker: "narrator",
      text: (name) => `And so a story takes root in Jember’s volcanic soil — yours and ${name}’s, together.`,
      textId: (name) => `Begitulah sebuah kisah berakar di tanah vulkanik Jember — milikmu dan ${name}, bersama.`,
    },
  ],

  // Chapter 2 — Roots in Volcanic Soil: the first completed quest, learning
  // the loop in generous ground.
  2: [
    {
      speaker: "narrator",
      text: (name) => `Your first quest is complete. What ${name} needed, you noticed — and acted on.`,
      textId: (name) => `Misi pertamamu selesai. Apa yang ${name} butuhkan, kamu sadari — dan kamu tanggapi.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "You really came when I needed you! My leaves feel all fluttery and bright!",
        calm: () => "You saw what I needed and responded. Rich soil helps, but care completes it.",
        funny: () => "Quest one: done! The volcanic dirt is great, but you? Five stars. Would sprout again.",
        energetic: () => "First quest DONE! Rich soil below, you beside me — I’m going to grow SO fast!",
        shy: () => "You… actually helped me… I wasn’t sure anyone would…",
      },
      byPersonalityId: {
        cute: () => "Kamu benar-benar datang saat aku membutuhkanmu! Daunku rasanya berdebar dan berbinar!",
        calm: () => "Kamu melihat apa yang kubutuhkan dan meresponsnya. Tanah subur membantu, tapi perawatanlah yang menyempurnakannya.",
        funny: () => "Misi satu: beres! Tanah vulkaniknya keren, tapi kamu? Bintang lima. Aku mau tumbuh lagi bareng kamu.",
        energetic: () => "Misi pertama BERES! Tanah subur di bawah, kamu di sampingku — aku bakal tumbuh SUPER cepat!",
        shy: () => "Kamu… beneran menolongku… aku nggak yakin ada yang mau…",
      },
    },
    {
      speaker: "narrator",
      text: () => "Jember’s volcanic soil is generous, but even the richest earth needs a watchful friend.",
      textId: () => "Tanah vulkanik Jember memang murah hati, tapi tanah tersubur pun butuh sahabat yang peduli.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Every time you help me, I feel a little stronger. Let’s keep going, okay?",
        calm: () => "Each time you respond, I grow steadier — like the fields here, tended every day.",
        funny: () => "Turns out “teamwork” includes plants. Who knew? Same time tomorrow?",
        energetic: () => "More quests, more growing, more us! Tomorrow, let’s beat today!",
        shy: () => "If it’s okay… could we do this again sometime? I’d like that…",
      },
      byPersonalityId: {
        cute: () => "Setiap kali kamu menolongku, aku merasa sedikit lebih kuat. Kita lanjut terus, ya?",
        calm: () => "Setiap kali kamu menanggapi, aku tumbuh makin mantap — seperti ladang di sini, dirawat tiap hari.",
        funny: () => "Ternyata “kerja sama tim” juga berlaku buat tanaman. Siapa sangka? Besok jam segini lagi?",
        energetic: () => "Makin banyak misi, makin banyak tumbuh, makin banyak kita! Besok, kita kalahkan hari ini!",
        shy: () => "Kalau boleh… bisa kita lakukan ini lagi lain kali? Aku mau banget…",
      },
    },
    {
      speaker: "narrator",
      text: () => "This is the loop every grower in this valley knows by heart: notice, tend, grow.",
      textId: () => "Inilah siklus yang dihafal luar kepala setiap penanam di lembah ini: perhatikan, rawat, tumbuh.",
    },
  ],

  // Chapter 3 — Trust, Rain or Shine: built through consistent daily care
  // (the streak), through Jember's wet and dry days alike.
  3: [
    {
      speaker: "narrator",
      text: (name) => `Day after day you come back, rain or shine. ${name} has started to expect you.`,
      textId: (name) => `Hari demi hari kamu kembali, hujan maupun cerah. ${name} mulai menantikanmu.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "I knew you’d come today! I could feel it in my roots!",
        calm: () => "Rain on the roof or sun on the glass — you return. I no longer wonder. I know.",
        funny: () => "You again! Three days running. You’re more punctual than the afternoon rain!",
        energetic: () => "You came back! Again! Every single day! You’re the most reliable human ever!",
        shy: () => "You keep coming back… even for someone quiet like me…",
      },
      byPersonalityId: {
        cute: () => "Aku tahu kamu bakal datang hari ini! Aku bisa merasakannya sampai ke akar!",
        calm: () => "Hujan di atap atau matahari di kaca jendela — kamu selalu kembali. Aku tak lagi bertanya-tanya. Aku yakin.",
        funny: () => "Kamu lagi! Tiga hari beruntun. Kamu lebih tepat waktu daripada hujan sore!",
        energetic: () => "Kamu kembali! Lagi! Setiap hari, tanpa gagal! Kamu manusia paling bisa diandalkan sedunia!",
        shy: () => "Kamu terus kembali… bahkan untuk seseorang sepertiku yang pendiam…",
      },
    },
    {
      speaker: "narrator",
      text: () => "When musim hujan (the rainy season) drums on Jember’s roofs, small visits matter most.",
      textId: () => "Saat musim hujan menabuh atap-atap Jember, kunjungan kecil justru paling berarti.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Rainy day or bright one, being with you is my favorite part of being a plant.",
        calm: () => "Consistency is the truest form of care. Like the seasons here, you always come back.",
        funny: () => "I trust you completely. And I’m rooted to the spot, so that’s saying something.",
        energetic: () => "I trust you SO much! Streak buddies in every season — rain, shine, ALL of it!",
        shy: () => "I think… I’m not nervous around you anymore… that’s new for me…",
      },
      byPersonalityId: {
        cute: () => "Hari hujan atau hari cerah, bersamamu adalah bagian favoritku jadi tanaman.",
        calm: () => "Konsistensi adalah bentuk perhatian yang paling sejati. Seperti musim di sini, kamu selalu kembali.",
        funny: () => "Aku percaya penuh sama kamu. Dan akarku tertanam di sini, jadi itu artinya banyak.",
        energetic: () => "Aku percaya BANGET sama kamu! Teman seiring di setiap musim — hujan, cerah, SEMUANYA!",
        shy: () => "Kurasa… aku nggak gugup lagi di dekatmu… itu hal baru buatku…",
      },
    },
    {
      speaker: "narrator",
      text: () => "Somewhere between the rains, this stopped being a task. It became time with a friend.",
      textId: () => "Entah di sela-sela hujan yang mana, ini berhenti jadi tugas. Ini berubah jadi waktu bersama sahabat.",
    },
  ],

  // Chapter 4 — Through Heat and Gray Skies: partnership through hardships
  // overcome (recovery quests — heat, low light, soil pH — handoff §16, §18),
  // the dry-season side of Jember's year.
  4: [
    {
      speaker: "narrator",
      text: () => "Hard days came — dry-season heat, dim gray light, thirsty air. You faced them together.",
      textId: () => "Hari-hari berat datang — panas musim kemarau, cahaya kelabu redup, udara yang haus. Kalian menghadapinya bersama.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "When the hot days got scary, you were always there. I never felt alone!",
        calm: () => "Difficult conditions came, and you corrected them. Each time, I recovered.",
        funny: () => "I nearly became sun-dried garnish once. Maybe twice. You kept un-crisping me!",
        energetic: () => "Every heat wave, every gloomy day — you showed up! We beat every single one!",
        shy: () => "Even when I was struggling… you didn’t give up on me…",
      },
      byPersonalityId: {
        cute: () => "Waktu hari-hari panas jadi menakutkan, kamu selalu ada. Aku nggak pernah merasa sendirian!",
        calm: () => "Kondisi sulit datang, dan kamu memperbaikinya. Setiap kali, aku pulih kembali.",
        funny: () => "Aku hampir jadi keripik jemuran matahari sekali. Mungkin dua kali. Kamu terus menyelamatkanku dari kekeringan!",
        energetic: () => "Setiap gelombang panas, setiap hari mendung — kamu selalu datang! Kita kalahkan semuanya!",
        shy: () => "Bahkan saat aku kesusahan… kamu nggak pernah menyerah padaku…",
      },
    },
    {
      speaker: "narrator",
      text: (name) => `Every rescue taught ${name} the same thing: when you show up, things get better.`,
      textId: (name) => `Setiap pertolongan mengajarkan ${name} hal yang sama: saat kamu datang, semuanya membaik.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "We’re a real team now, aren’t we? Whatever the season brings, we’ll face it together!",
        calm: () => "Hardship tested us, and we endured. Like the mountains here, we hold through seasons.",
        funny: () => "We survived heat, gloom, and moody soil. If this were a movie, we’d get a sequel.",
        energetic: () => "Nothing can stop us now! Not heat, not gray skies — you and me, the unbeatable duo!",
        shy: () => "I used to be scared of bad days… but with you, I’m not anymore.",
      },
      byPersonalityId: {
        cute: () => "Kita tim sungguhan sekarang, kan? Apa pun yang dibawa musim, kita hadapi bersama!",
        calm: () => "Kesulitan menguji kita, dan kita bertahan. Seperti gunung-gunung di sini, kita kokoh melewati musim.",
        funny: () => "Kita selamat dari panas, mendung, dan tanah yang labil. Kalau ini film, kita pasti dapat sekuel.",
        energetic: () => "Nggak ada yang bisa menghentikan kita sekarang! Bukan panas, bukan langit kelabu — kamu dan aku, duo tak terkalahkan!",
        shy: () => "Dulu aku takut sama hari-hari buruk… tapi bersamamu, aku nggak takut lagi.",
      },
    },
    {
      speaker: "narrator",
      text: () => "This is more than care now. It is a partnership — and it is still growing.",
      textId: () => "Ini lebih dari sekadar perawatan sekarang. Ini kemitraan — dan masih terus tumbuh.",
    },
  ],

  // Chapter 5 — Full Bloom, Carnival Bright: every one of the six moods
  // discovered (handoff §5.1, §12, §20), flourishing while Jember's famous
  // August carnival fills the streets. Unlock conditions live in
  // story-definitions.ts / story-engine.ts.
  5: [
    {
      speaker: "narrator",
      text: (name) => `Happy days, sleepy days, dry air, moody soil — you have seen every side of ${name}.`,
      textId: (name) => `Hari-hari bahagia, hari-hari mengantuk, udara kering, tanah yang rewel — kamu sudah melihat semua sisi ${name}.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "You’ve met every one of my feelings now — and you cared for every single one!",
        calm: () => "You have seen me in every state I have. Nothing about me is hidden from you now.",
        funny: () => "Six moods, and you’ve seen all six! Even the soapy-soil one. That’s dedication!",
        energetic: () => "All six moods! You’ve seen them ALL — and you showed up for every one of them!",
        shy: () => "You’ve seen every side of me… even the gloomy ones… and you still stayed…",
      },
      byPersonalityId: {
        cute: () => "Kamu sudah kenal semua perasaanku sekarang — dan kamu merawat semuanya, satu per satu!",
        calm: () => "Kamu sudah melihatku dalam setiap keadaan yang kupunya. Tak ada lagi yang tersembunyi darimu.",
        funny: () => "Enam suasana, dan kamu sudah lihat semuanya! Bahkan yang tanahnya berasa sabun. Itu namanya dedikasi!",
        energetic: () => "Semua enam suasana! Kamu sudah lihat SEMUANYA — dan kamu selalu datang untuk masing-masing!",
        shy: () => "Kamu sudah lihat semua sisiku… bahkan yang suram… dan kamu tetap tinggal…",
      },
    },
    {
      speaker: "narrator",
      text: () => "August turns Jember into a carnival — costumes and color in the streets. You grew yours.",
      textId: () => "Bulan Agustus mengubah Jember jadi karnaval — kostum dan warna memenuhi jalanan. Kamu menumbuhkan milikmu sendiri.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Look at me! Every leaf bright and strong — my own little costume for carnival month!",
        calm: () => "The town parades in color, and I bloom in green. This is what your attention built.",
        funny: () => "Full bloom in carnival month! These leaves are runway-ready. Keep up, Jember!",
        energetic: () => "Full bloom! If the carnival ever needs a plant float, I VOLUNTEER! Look what we grew!",
        shy: () => "I feel… really bright now… like I could almost join the parade… almost…",
      },
      byPersonalityId: {
        cute: () => "Lihat aku! Setiap daun cerah dan kuat — kostum kecilku sendiri untuk bulan karnaval!",
        calm: () => "Kota berpawai penuh warna, dan aku mekar dalam hijau. Inilah yang dibangun oleh perhatianmu.",
        funny: () => "Mekar penuh di bulan karnaval! Daun-daun ini siap naik catwalk. Jember, siap-siap kalah saing!",
        energetic: () => "Mekar penuh! Kalau karnaval butuh kereta hias tanaman, aku SIAP MENDAFTAR! Lihat apa yang kita tumbuhkan!",
        shy: () => "Aku merasa… benar-benar cerah sekarang… seperti hampir bisa ikut pawai… hampir…",
      },
    },
    {
      speaker: "narrator",
      text: () => "This is full bloom: not one perfect day, but every kind of day, met with care.",
      textId: () => "Inilah mekar penuh: bukan satu hari yang sempurna, tapi segala jenis hari, dihadapi dengan perhatian.",
    },
  ],

  // Chapter 6 — Harvest of Wisdom: graduation. What caretaker and plant
  // learned together becomes teachable knowledge — the project mission
  // (handoff §2): preserve the wisdom, measure the environment, grow the
  // next generation — now anchored in Jember.
  6: [
    {
      speaker: "narrator",
      text: (name) => `Seasons of quests and records lie behind you. You know ${name} by heart now.`,
      textId: (name) => `Musim demi musim misi dan catatan sudah kamu lewati. Sekarang kamu hafal ${name} luar kepala.`,
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Everything we learned together is written down now — every feeling, every rescue!",
        calm: () => "What we learned is no longer only ours. It is recorded, and it can be taught.",
        funny: () => "We basically wrote the book on me. Future plant parents of Jember, take notes!",
        energetic: () => "Every lesson we learned is saved! Now anyone can learn what we know!",
        shy: () => "All the things you learned about me… they’re written down… they could help someone…",
      },
      byPersonalityId: {
        cute: () => "Semua yang kita pelajari bersama sudah tertulis sekarang — setiap perasaan, setiap pertolongan!",
        calm: () => "Apa yang kita pelajari bukan lagi cuma milik kita. Semuanya tercatat, dan bisa diajarkan.",
        funny: () => "Kita nyaris menulis buku tentang aku. Calon orang tua tanaman Jember, catat baik-baik!",
        energetic: () => "Setiap pelajaran yang kita dapat sudah tersimpan! Sekarang siapa pun bisa belajar dari kita!",
        shy: () => "Semua hal yang kamu pelajari tentangku… sudah tertulis… mungkin bisa menolong seseorang…",
      },
    },
    {
      speaker: "narrator",
      text: () => "Jember’s elders kept their wisdom in memory. Yours is measured, recorded, ready to pass on.",
      textId: () => "Para sesepuh Jember menyimpan kebijaksanaan mereka dalam ingatan. Milikmu terukur, tercatat, siap diwariskan.",
    },
    {
      speaker: "plant",
      byPersonality: {
        cute: () => "Keep our wisdom safe, measure the world with love, and help the next sprout grow!",
        calm: () => "Preserve the wisdom. Measure the environment. Grow the next generation. Here, in Jember.",
        funny: () => "Save the wisdom, measure the air, grow the next sprout. Best harvest in East Java!",
        energetic: () => "Keep the wisdom! Measure everything! Grow the next generation — starting NOW, in Jember!",
        shy: () => "Maybe… we can keep the wisdom safe… measure things gently… and help the next one grow…",
      },
      byPersonalityId: {
        cute: () => "Jaga kebijaksanaan kita baik-baik, ukur dunia dengan sepenuh hati, dan bantu tunas berikutnya tumbuh!",
        calm: () => "Jaga kebijaksanaan. Ukur lingkungan. Tumbuhkan generasi berikutnya. Di sini, di Jember.",
        funny: () => "Simpan kebijaksanaan, ukur udaranya, tumbuhkan tunas berikutnya. Panen terbaik se-Jawa Timur!",
        energetic: () => "Jaga kebijaksanaannya! Ukur semuanya! Tumbuhkan generasi berikutnya — mulai SEKARANG, di Jember!",
        shy: () => "Mungkin… kita bisa jaga kebijaksanaan ini baik-baik… ukur semuanya pelan-pelan… dan bantu yang berikutnya tumbuh…",
      },
    },
    {
      speaker: "narrator",
      text: (name) => `This is not an ending. What you grew with ${name} in Jember grows on, in whoever comes next.`,
      textId: (name) => `Ini bukan akhir. Apa yang kamu tumbuhkan bersama ${name} di Jember akan terus tumbuh, pada siapa pun yang datang berikutnya.`,
    },
  ],
};

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Deterministic dialogue scene for a story chapter, voiced for the given
 * personality with the plant's name interpolated.
 *
 * Tolerates un-normalized personality values (DB rows store raw strings) and
 * blank names. Returns null for chapter numbers without narrative content
 * (0, 7, non-integers, …) so callers can render a graceful fallback.
 */
export function getChapterScene(
  chapter: number,
  personality: PersonalityId,
  plantName: string,
): ChapterScene | null {
  const template = SCENES[chapter];
  if (!template) return null;

  const voice = normalizePersonality(personality);
  const name = plantName.trim() || FALLBACK_NAME;

  return {
    chapter,
    lines: template.map((line) =>
      line.speaker === "narrator"
        ? { speaker: "narrator" as const, text: line.text(name), textId: line.textId(name) }
        : {
            speaker: "plant" as const,
            text: line.byPersonality[voice](name),
            textId: line.byPersonalityId[voice](name),
          },
    ),
  };
}
