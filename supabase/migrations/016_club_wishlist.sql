create table public.club_wishlist (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  place_id   text not null,
  added_by   uuid not null references public.users(id),
  note       text,
  created_at timestamptz default now(),
  unique (club_id, place_id)
);

alter table public.club_wishlist enable row level security;

create policy "wishlist: members can read"
  on public.club_wishlist for select to authenticated
  using (auth_is_club_member(club_id));

create policy "wishlist: members can add"
  on public.club_wishlist for insert to authenticated
  with check (added_by = auth.uid() and auth_is_club_member(club_id));

create policy "wishlist: adder or owner can remove"
  on public.club_wishlist for delete to authenticated
  using (added_by = auth.uid() or auth_is_club_owner(club_id));
