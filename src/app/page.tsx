import PlantHome from "@/components/plant-home";
import { fetchBondState, fetchPlant, fetchTopActiveQuest } from "@/lib/plants";
import { getHomeMoodMessage } from "@/lib/plant-messages";
import { runGameTick } from "@/game/events/event-router";

// The plant's live state must always be read fresh from Supabase.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

function Notice({ title, lines }: { title: string; lines: string[] }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-6xl">🌱</span>
      <h1 className="text-2xl font-bold">LeafTalk</h1>
      <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">{title}</p>
      <div className="max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </main>
  );
}

export default async function Home() {
  // Lazy sweep first so time-based quest completions are visible on load.
  try {
    await runGameTick(PLANT_ID);
  } catch (error) {
    console.error("home: game tick failed:", error);
  }

  const result = await fetchPlant(PLANT_ID);

  if (result.status === "no-env") {
    return (
      <Notice
        title="Connecting..."
        lines={[
          "Supabase 환경 변수가 아직 설정되지 않았습니다.",
          ".env.local.example을 .env.local로 복사한 뒤 값을 채우고 dev 서버를 재시작하세요.",
          "자세한 순서: docs/SETUP-milestone1-2.md",
        ]}
      />
    );
  }

  if (result.status === "no-schema") {
    return (
      <Notice
        title="Supabase 테이블이 아직 없습니다"
        lines={[
          "환경 변수 연결은 정상이지만 스키마가 실행되지 않았습니다.",
          "Supabase Dashboard → SQL Editor에서 아래 두 파일을 순서대로 실행하세요:",
          "1) supabase/milestone1.sql   2) supabase/milestone3.sql",
          "실행 후 이 페이지를 새로고침하면 Jin이 나타납니다.",
        ]}
      />
    );
  }

  if (result.status === "not-found") {
    return (
      <Notice
        title={`${PLANT_ID} 데이터가 없습니다`}
        lines={[
          "Supabase SQL Editor에서 supabase/milestone1.sql을 실행해",
          "plants 테이블과 Jamkachu(plant-01) 시드 데이터를 만들어 주세요.",
        ]}
      />
    );
  }

  if (result.status === "error") {
    return (
      <Notice
        title="Supabase 연결 오류"
        lines={[result.message, "URL과 키 값을 다시 확인해 주세요."]}
      />
    );
  }

  const [bond, quest, moodMessage] = await Promise.all([
    fetchBondState(PLANT_ID),
    fetchTopActiveQuest(PLANT_ID),
    // AI-personalized when ANTHROPIC_API_KEY is set (cached per mood change,
    // handoff §24); deterministic template otherwise — never blocks on failure.
    getHomeMoodMessage(result.plant),
  ]);

  return (
    <PlantHome
      initialPlant={result.plant}
      initialBond={bond}
      initialQuest={quest}
      initialMoodMessage={moodMessage}
    />
  );
}
