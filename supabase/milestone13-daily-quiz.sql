-- Daily Quiz: server-written attempts plus atomic, replay-safe XP settlement.
create table if not exists public.daily_quiz_attempts (
  plant_id text not null references public.plants(id) on delete cascade,
  quiz_date date not null,
  round_no integer not null default 0 check (round_no >= 0),
  question_key text not null,
  attempts integer not null default 0 check (attempts >= 0),
  selected_answers integer[] not null default '{}',
  completed_at timestamptz,
  xp_awarded integer not null default 0 check (xp_awarded between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plant_id, quiz_date, round_no, question_key)
);

alter table public.daily_quiz_attempts enable row level security;
drop policy if exists "public read daily quiz attempts" on public.daily_quiz_attempts;
create policy "public read daily quiz attempts" on public.daily_quiz_attempts for select using (true);

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
  v_total integer := 0;
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
  select coalesce(total_xp,0) into v_total from public.bond_state where plant_id=p_plant_id;
  if p_correct then v_xp := 1 + floor(random()*3)::integer;
  else v_xp := -1; end if;
  v_actual := case when v_xp < 0 then -least(abs(v_xp),v_total) else v_xp end;

  update public.daily_quiz_attempts set
    attempts=v_row.attempts,
    selected_answers=array_append(selected_answers,p_answer_index),
    completed_at=case when p_correct then now() else null end,
    xp_awarded=case when p_correct then v_actual else xp_awarded end,
    updated_at=now()
  where plant_id=p_plant_id and quiz_date=p_quiz_date and round_no=p_round_no and question_key=p_question_key;

  if p_correct or v_actual < 0 then
    select public.award_xp(p_plant_id,
      'daily_quiz:' || p_quiz_date::text || ':' || p_round_no::text || ':' || p_question_key ||
        case when p_correct then ':complete' else ':miss:' || v_row.attempts::text end,
      v_actual, case when p_correct then 'DAILY_QUIZ' else 'DAILY_QUIZ_MISS' end) into v_award;
  end if;

  return jsonb_build_object('correct',p_correct,'completed',p_correct,'duplicate',false,
    'attempts',v_row.attempts,'xp_awarded',v_actual,
    'total_xp',case when v_award is null then null else v_award->'total_xp' end,
    'bond_level',case when v_award is null then null else v_award->'bond_level' end,
    'leveled_up',coalesce((v_award->>'leveled_up')::boolean,false));
end;
$$;

revoke all on function public.answer_daily_quiz(text,date,integer,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.answer_daily_quiz(text,date,integer,text,integer,boolean) to service_role;
