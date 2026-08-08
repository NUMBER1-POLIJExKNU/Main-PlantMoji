import { dailyQuiz, farmCase, quizByKey, quizHint, wibDate, type QuizCategory } from "@/game/quiz/daily-quiz";
import { normalizeLocale } from "@/lib/i18n";
import { getServerSupabase } from "@/lib/supabase/server";
import { evaluateBadges } from "@/game/badges/badge-engine";
import { evaluateChapters } from "@/game/story/story-engine";

export const dynamic = "force-dynamic";
const validPlant = (value: string) => /^[A-Za-z0-9_-]{1,64}$/.test(value);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const plantId = params.get("plantId") ?? "plant-01";
  if (!validPlant(plantId)) return Response.json({ ok:false,error:"invalid_plant" },{status:400});
  const locale = normalizeLocale(params.get("locale"));
  const round = Math.max(0, Math.min(9999, Number.parseInt(params.get("round") ?? "0",10) || 0));
  const quizDate = wibDate();
  const questions = dailyQuiz(plantId, locale, `${quizDate}:round:${round}`).map((question) => ({ key:question.key,category:question.category,question:question.question,choices:question.choices,hint:quizHint(question.category,locale) }));
  const caseData=farmCase(plantId,quizDate,locale,round);
  const supabase = getServerSupabase();
  if (!supabase) return Response.json({ ok:true,quizDate,questions,case:caseData,progress:[],mastery:{},offline:true });
  const [current,history]=await Promise.all([
    supabase.from("daily_quiz_attempts").select("question_key,attempts,completed_at,xp_awarded").eq("plant_id",plantId).eq("quiz_date",quizDate).eq("round_no",round),
    supabase.from("daily_quiz_attempts").select("question_key,xp_awarded").eq("plant_id",plantId).gt("xp_awarded",0).limit(500),
  ]);
  const mastery:Partial<Record<QuizCategory,number>>={};
  if(!history.error)for(const row of history.data??[]){const q=quizByKey(row.question_key,"en");if(q)mastery[q.category]=(mastery[q.category]??0)+1;}
  // Migration-free fallback: questions still work visually, but XP is disabled.
  return Response.json({ ok:true,quizDate,questions,case:caseData,progress:current.error?[]:current.data??[],mastery,offline:Boolean(current.error) });
}

export async function POST(request: Request) {
  let body: Record<string,unknown>;
  try { body = await request.json(); } catch { return Response.json({ok:false,error:"invalid_json"},{status:400}); }
  const plantId = typeof body.plantId === "string" ? body.plantId : "plant-01";
  const questionKey = typeof body.questionKey === "string" ? body.questionKey : "";
  const answerIndex = typeof body.answerIndex === "number" && Number.isInteger(body.answerIndex) ? body.answerIndex : -1;
  const round = typeof body.round === "number" && Number.isInteger(body.round) ? Math.max(0,Math.min(9999,body.round)) : 0;
  if (!validPlant(plantId) || answerIndex < -1 || answerIndex > 2) return Response.json({ok:false,error:"invalid_answer"},{status:400});
  const quizDate=wibDate();
  const seed=`${quizDate}:round:${round}`;
  const question=dailyQuiz(plantId,"en",seed).find(q=>q.key===questionKey);
  if(!question) return Response.json({ok:false,error:"not_todays_question"},{status:400});
  const locale=normalizeLocale(body.locale);
  const localized=dailyQuiz(plantId,locale,seed).find(q=>q.key===questionKey)!;
  const supabase=getServerSupabase();
  if(!supabase) return Response.json({ok:false,error:"quiz_xp_unavailable"},{status:503});
  const {data,error}=await supabase.rpc("answer_daily_quiz",{p_plant_id:plantId,p_quiz_date:quizDate,p_round_no:round,p_question_key:questionKey,p_answer_index:answerIndex,p_correct:answerIndex===question.correctIndex});
  if(error) return Response.json({ok:false,error:"quiz_migration_required",fallbackExplanation:localized.explanation},{status:503});
  if (data?.correct && !data?.duplicate) await Promise.all([evaluateBadges(supabase,plantId),evaluateChapters(supabase,plantId)]);
  const reveal = !data?.correct && Number(data?.attempts) >= 2;
  return Response.json({ok:true,...data,explanation:localized.explanation,hint:quizHint(localized.category,locale),...(reveal?{correctIndex:localized.correctIndex,correctAnswer:localized.choices[localized.correctIndex]}:{})});
}
