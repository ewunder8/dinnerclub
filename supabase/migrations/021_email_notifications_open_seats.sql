-- Update default for new users
alter table public.users
  alter column email_notifications set default '{"reservation_confirmed": true, "dinner_reminder": true, "voting_open": true, "rating_prompt": true, "open_seat_posted": true, "open_seat_update": true}'::jsonb;

-- Backfill existing users
update public.users
set email_notifications = email_notifications || '{"open_seat_posted": true, "open_seat_update": true}'::jsonb
where not (email_notifications ? 'open_seat_posted');
