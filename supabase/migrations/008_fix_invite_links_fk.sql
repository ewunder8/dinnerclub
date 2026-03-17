-- Fix invite_links.created_by to cascade on user deletion
alter table public.invite_links
  drop constraint invite_links_created_by_fkey;

alter table public.invite_links
  add constraint invite_links_created_by_fkey
  foreign key (created_by)
  references public.users(id)
  on delete cascade;
