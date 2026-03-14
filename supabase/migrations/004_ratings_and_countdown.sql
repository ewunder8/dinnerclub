-- ============================================================
-- Migration 004 — Rating Dimensions & Auto-Complete Trigger
-- ============================================================

alter table public.dinner_ratings
  add column if not exists food_score    integer check (food_score between 1 and 5),
  add column if not exists vibe_score    integer check (vibe_score between 1 and 5),
  add column if not exists value_score   integer check (value_score between 1 and 5),
  add column if not exists would_return  boolean,
  add column if not exists recommend     boolean,
  add column if not exists overall_score integer check (overall_score between 1 and 5);

alter table public.dinners
  add column if not exists ratings_open_until timestamptz;

create or replace function public.complete_past_dinners()
returns void
language plpgsql
security definer
as $$
begin
  update public.dinners
  set
    status             = 'completed',
    ratings_open_until = now() + interval '48 hours'
  where
    status               = 'confirmed'
    and reservation_datetime < now();
end;
$$;

create or replace view public.dinner_rating_summaries as
select
  dr.dinner_id,
  dr.place_id,
  count(*)                          as rating_count,
  round(avg(dr.overall_score), 1)   as avg_overall,
  round(avg(dr.food_score), 1)      as avg_food,
  round(avg(dr.vibe_score), 1)      as avg_vibe,
  round(avg(dr.value_score), 1)     as avg_value,
  sum(case when dr.would_return  then 1 else 0 end) as would_return_count,
  sum(case when dr.recommend     then 1 else 0 end) as recommend_count,
  array_agg(dr.note) filter (where dr.note is not null) as notes
from public.dinner_ratings dr
group by dr.dinner_id, dr.place_id;

create index if not exists idx_dinner_ratings_dinner_id
  on public.dinner_ratings(dinner_id);