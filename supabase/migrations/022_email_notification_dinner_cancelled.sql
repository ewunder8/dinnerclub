-- Add dinner_cancelled to email_notifications default
alter table public.users
  alter column email_notifications set default '{
    "reservation_confirmed": true,
    "dinner_reminder": true,
    "voting_open": true,
    "rating_prompt": true,
    "open_seat_posted": true,
    "open_seat_update": true,
    "dinner_cancelled": true
  }'::jsonb;

-- Backfill existing users
update public.users
set email_notifications = email_notifications || '{"dinner_cancelled": true}'::jsonb
where not (email_notifications ? 'dinner_cancelled');
