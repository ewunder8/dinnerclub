-- Prevent club deletion when owner's user row is deleted.
-- Previously ON DELETE CASCADE would wipe the entire club if the owner
-- was removed from public.users. Now it just clears the owner field.
alter table public.clubs
  drop constraint clubs_owner_id_fkey;

alter table public.clubs
  add constraint clubs_owner_id_fkey
  foreign key (owner_id)
  references public.users(id)
  on delete set null;

-- Allow owner_id to be null
alter table public.clubs alter column owner_id drop not null;
