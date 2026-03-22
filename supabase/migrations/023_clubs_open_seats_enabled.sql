alter table public.clubs
  add column if not exists open_seats_enabled boolean not null default true;
