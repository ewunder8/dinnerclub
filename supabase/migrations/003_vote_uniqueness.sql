-- ============================================================
-- Migration 003 — Vote Uniqueness & Suggestion Mode
-- ============================================================

alter table public.votes
  add column if not exists dinner_id uuid references public.dinners(id) on delete cascade;

update public.votes v
set dinner_id = po.dinner_id
from public.poll_options po
where po.id = v.option_id;

alter table public.votes
  drop constraint if exists votes_option_id_user_id_key;

alter table public.votes
  add constraint votes_dinner_user_unique unique (dinner_id, user_id);

alter table public.dinners
  add column if not exists suggestion_mode text
    not null default 'members'
    check (suggestion_mode in ('owner_only', 'members', 'hybrid')),
  add column if not exists max_suggestions integer default 8;

create index if not exists idx_votes_dinner_id on public.votes(dinner_id);
create index if not exists idx_votes_user_dinner on public.votes(user_id, dinner_id);