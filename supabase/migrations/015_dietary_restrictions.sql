alter table public.users add column dietary_restrictions text[] default '{}';
alter table public.users add column dietary_public boolean default true;
