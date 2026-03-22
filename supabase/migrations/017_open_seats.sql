-- Open seats: someone has a reservation and wants to fill spots
create table public.open_seats (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id) on delete cascade,
  created_by           uuid not null references public.users(id),
  restaurant_name      text not null,
  place_id             text,  -- optional link to restaurant_cache
  reservation_datetime timestamptz not null,
  seats_available      integer not null default 1 check (seats_available >= 1),
  note                 text,
  status               text not null default 'open' check (status in ('open', 'closed')),
  created_at           timestamptz default now()
);

-- Who has raised their hand for a seat
create table public.open_seat_requests (
  id           uuid primary key default gen_random_uuid(),
  open_seat_id uuid not null references public.open_seats(id) on delete cascade,
  user_id      uuid not null references public.users(id),
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  created_at   timestamptz default now(),
  unique (open_seat_id, user_id)
);

alter table public.open_seats         enable row level security;
alter table public.open_seat_requests enable row level security;

-- open_seats policies
create policy "open_seats: members can read"
  on public.open_seats for select to authenticated
  using (auth_is_club_member(club_id));

create policy "open_seats: members can post"
  on public.open_seats for insert to authenticated
  with check (created_by = auth.uid() and auth_is_club_member(club_id));

create policy "open_seats: creator can update"
  on public.open_seats for update to authenticated
  using (created_by = auth.uid());

create policy "open_seats: creator can delete"
  on public.open_seats for delete to authenticated
  using (created_by = auth.uid());

-- open_seat_requests policies
create policy "open_seat_requests: club members can read"
  on public.open_seat_requests for select to authenticated
  using (
    exists (
      select 1 from public.open_seats os
      join public.club_members cm on cm.club_id = os.club_id
      where os.id = open_seat_id and cm.user_id = auth.uid()
    )
  );

create policy "open_seat_requests: members can request own"
  on public.open_seat_requests for insert to authenticated
  with check (user_id = auth.uid());

create policy "open_seat_requests: poster can confirm/decline"
  on public.open_seat_requests for update to authenticated
  using (
    exists (
      select 1 from public.open_seats os
      where os.id = open_seat_id and os.created_by = auth.uid()
    )
  );

create policy "open_seat_requests: user can withdraw own"
  on public.open_seat_requests for delete to authenticated
  using (user_id = auth.uid());
