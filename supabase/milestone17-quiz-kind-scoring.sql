-- Kind scoring: a wrong/timed-out Daily Quiz answer now awards exactly 0 XP.
-- The previous answer_daily_quiz (milestone13) set v_xp := -1 on a miss and
-- called award_xp with a negative amount, which could demote total_xp/bond_level
-- right after the player saw "LEVEL UP!" -- XP/Bond Level must never decrease
-- (see AGENTS.md sensor-truth invariant). Misses now skip award_xp entirely
-- instead of passing a negative amount. Correct-answer behavior is unchanged.
-- Re-runnable (CREATE OR REPLACE). Run after milestone13-daily-quiz.sql.
-- Numbering: milestone15 = light-percentage (shipped); milestone16 is reserved
-- by the in-flight companion evolution ladder plan.

create or replace function public.answer_daily_quiz(
  p_plant_id text, p_quiz_date date, p_round_no integer, p_question_key text,
  p_answer_index integer, p_correct boolean
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.daily_quiz_attempts%rowtype;
  v_xp integer := 0;
  v_award jsonb;
  v_actual integer := 0;
begin
  insert into public.daily_quiz_attempts(plant_id, quiz_date, round_no, question_key)
  values (p_plant_id, p_quiz_date, p_round_no, p_question_key)
  on conflict do nothing;

  select * into v_row from public.daily_quiz_attempts
  where plant_id=p_plant_id and quiz_date=p_quiz_date and round_no=p_round_no and question_key=p_question_key
  for update;

  if v_row.completed_at is not null then
    return jsonb_build_object('correct', true, 'completed', true, 'duplicate', true,
      'attempts', v_row.attempts, 'xp_awarded', 0);
  end if;

  v_row.attempts := v_row.attempts + 1;
  -- Kind scoring: correct answers still roll 1-3 XP; a miss is worth 0, never negative.
  if p_correct then v_xp := 1 + floor(random()*3)::integer;
  else v_xp := 0; end if;
  v_actual := v_xp;

  update public.daily_quiz_attempts set
    attempts=v_row.attempts,
    selected_answers=array_append(selected_answers,p_answer_index),
    completed_at=case when p_correct or v_row.attempts >= 2 then now() else null end,
    xp_awarded=case when p_correct then v_actual else xp_awarded end,
    updated_at=now()
  where plant_id=p_plant_id and quiz_date=p_quiz_date and round_no=p_round_no and question_key=p_question_key;

  -- Misses never touch award_xp -- XP and Bond Level must never decrease.
  if p_correct then
    select public.award_xp(p_plant_id,
      'daily_quiz:' || p_quiz_date::text || ':' || p_round_no::text || ':' || p_question_key || ':complete',
      v_actual, 'DAILY_QUIZ') into v_award;
  end if;

  return jsonb_build_object('correct',p_correct,'completed',p_correct or v_row.attempts >= 2,'duplicate',false,
    'attempts',v_row.attempts,'xp_awarded',v_actual,
    'total_xp',case when v_award is null then null else v_award->'total_xp' end,
    'bond_level',case when v_award is null then null else v_award->'bond_level' end,
    'leveled_up',coalesce((v_award->>'leveled_up')::boolean,false));
end;
$$;

revoke all on function public.answer_daily_quiz(text,date,integer,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.answer_daily_quiz(text,date,integer,text,integer,boolean) to service_role;
