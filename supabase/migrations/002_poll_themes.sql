-- ============================================================
-- Migration 002 — Poll Themes & Restaurant Suggestions
-- ============================================================

alter table public.dinners
  add column if not exists theme_cuisine      text,
  add column if not exists theme_price        integer,
  add column if not exists theme_vibe         text,
  add column if not exists theme_neighborhood text,
  add column if not exists voting_open        boolean default false,
  add column if not exists poll_min_options   integer default 2;

alter table public.poll_options
  add column if not exists removed_by   uuid references public.users(id),
  add column if not exists removed_at   timestamptz,
  add column if not exists note         text;

create index if not exists idx_poll_options_active
  on public.poll_options(dinner_id)
  where removed_at is null;