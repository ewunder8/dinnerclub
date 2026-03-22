alter table public.users
  add column if not exists email_notifications jsonb not null default '{"reservation_confirmed": true, "dinner_reminder": true, "voting_open": true, "rating_prompt": true}'::jsonb;
