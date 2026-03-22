create table public.dinner_comments (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null references public.dinners(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) <= 100),
  created_at timestamptz default now()
);

alter table public.dinner_comments enable row level security;

-- Club members can read comments on their club's dinners
create policy "Club members can read dinner comments"
  on public.dinner_comments for select
  using (
    exists (
      select 1 from public.dinners d
      join public.club_members cm on cm.club_id = d.club_id
      where d.id = dinner_comments.dinner_id
        and cm.user_id = auth.uid()
    )
  );

-- Authenticated users can insert their own comments
create policy "Users can insert their own comments"
  on public.dinner_comments for insert
  with check (auth.uid() = user_id);

-- Users can delete their own comments
create policy "Users can delete their own comments"
  on public.dinner_comments for delete
  using (auth.uid() = user_id);
