-- ============================================================
-- Food Club — Initial Schema
-- Run this in Supabase SQL Editor to create all tables.
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
create table public.users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique not null,
  avatar_url  text,
  city        text,
  beli_connected boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- CLUBS
-- ============================================================
create table public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text default '🍽',
  city        text,
  vibe        text,        -- e.g. 'All cuisines', 'Japanese only'
  frequency   text,        -- e.g. 'Weekly', 'Monthly'
  owner_id    uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ============================================================
-- CLUB MEMBERS
-- ============================================================
create table public.club_members (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references public.clubs(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  unique (club_id, user_id)   -- prevent duplicate memberships
);

-- ============================================================
-- INVITE LINKS
-- 7 day expiry enforced at application level
-- ============================================================
create table public.invite_links (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  created_by  uuid not null references public.users(id),
  token       text unique not null,
  expires_at  timestamptz not null,
  used_count  integer default 0,
  status      text default 'active' check (status in ('active', 'expired', 'revoked')),
  created_at  timestamptz default now()
);

-- ============================================================
-- DINNERS
-- Central table — tracks full lifecycle from poll to completed
-- ============================================================
create table public.dinners (
  id                            uuid primary key default gen_random_uuid(),
  club_id                       uuid not null references public.clubs(id) on delete cascade,
  status                        text not null default 'polling'
                                  check (status in (
                                    'polling',
                                    'seeking_reservation',
                                    'waitlisted',
                                    'confirmed',
                                    'completed',
                                    'cancelled'
                                  )),
  poll_closes_at                timestamptz,
  winning_restaurant_place_id   text,   -- Google Place ID
  reservation_datetime          timestamptz,
  party_size                    integer,
  confirmation_number           text,
  reservation_platform          text check (reservation_platform in ('resy', 'opentable', 'tock', 'other')),
  reserved_by                   uuid references public.users(id),
  created_at                    timestamptz default now()
);

-- ============================================================
-- RESERVATION ATTEMPTS
-- Tracks who is trying to get a reservation and their status
-- Multiple people can attempt simultaneously
-- ============================================================
create table public.reservation_attempts (
  id          uuid primary key default gen_random_uuid(),
  dinner_id   uuid not null references public.dinners(id) on delete cascade,
  user_id     uuid not null references public.users(id),
  status      text not null default 'attempting'
                check (status in ('attempting', 'waitlisted', 'succeeded', 'abandoned')),
  notes       text,   -- e.g. "On Resy waitlist, position 3"
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- POLL OPTIONS
-- Each dinner can have multiple restaurant options to vote on
-- ============================================================
create table public.poll_options (
  id            uuid primary key default gen_random_uuid(),
  dinner_id     uuid not null references public.dinners(id) on delete cascade,
  place_id      text not null,   -- Google Place ID
  suggested_by  uuid not null references public.users(id),
  created_at    timestamptz default now()
);

-- ============================================================
-- VOTES
-- One vote per user per dinner — enforced by unique constraint
-- ============================================================
create table public.votes (
  id          uuid primary key default gen_random_uuid(),
  option_id   uuid not null references public.poll_options(id) on delete cascade,
  user_id     uuid not null references public.users(id),
  created_at  timestamptz default now(),
  -- Prevent voting twice for the same dinner
  unique (option_id, user_id)
);

-- ============================================================
-- RSVPs
-- ============================================================
create table public.rsvps (
  id          uuid primary key default gen_random_uuid(),
  dinner_id   uuid not null references public.dinners(id) on delete cascade,
  user_id     uuid not null references public.users(id),
  status      text not null default 'going'
                check (status in ('going', 'not_going', 'maybe')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (dinner_id, user_id)
);

-- ============================================================
-- RESTAURANT CACHE
-- Local cache of Google Places data
-- Keyed by Google Place ID
-- Refresh after 48 hours
-- ============================================================
create table public.restaurant_cache (
  place_id              text primary key,
  name                  text not null,
  address               text,
  lat                   numeric,
  lng                   numeric,
  phone                 text,
  website               text,
  price_level           integer,   -- 1-4
  rating                numeric,
  reservation_url       text,      -- from Google Places
  reservation_platform  text,
  photo_urls            text[],
  hours                 jsonb,
  cached_at             timestamptz default now()
);

-- ============================================================
-- DINNER RATINGS
-- Post-dinner ratings from each member
-- This is the data flywheel for Discover recommendations
-- ============================================================
create table public.dinner_ratings (
  id          uuid primary key default gen_random_uuid(),
  dinner_id   uuid not null references public.dinners(id) on delete cascade,
  user_id     uuid not null references public.users(id),
  place_id    text not null,   -- denormalized for easy querying by restaurant
  stars       integer not null check (stars between 1 and 5),
  tags        text[],          -- e.g. ['great for groups', 'loud', 'worth the price']
  note        text,
  created_at  timestamptz default now(),
  unique (dinner_id, user_id) -- one rating per person per dinner
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Enables per-user data access rules
-- Users can only see data for clubs they belong to
-- ============================================================

alter table public.users enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.invite_links enable row level security;
alter table public.dinners enable row level security;
alter table public.reservation_attempts enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
alter table public.rsvps enable row level security;
alter table public.restaurant_cache enable row level security;
alter table public.dinner_ratings enable row level security;

-- Users can read and update their own profile
create policy "Users can view own profile"
  on public.users for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert with check (auth.uid() = id);

-- Club members can see their clubs
create policy "Members can view their clubs"
  on public.clubs for select
  using (
    id in (
      select club_id from public.club_members where user_id = auth.uid()
    )
  );

-- Anyone can view invite links (needed for the join page before auth)
create policy "Anyone can view active invite links"
  on public.invite_links for select
  using (status = 'active');

-- Club members can see other members
create policy "Members can view club members"
  on public.club_members for select
  using (
    club_id in (
      select club_id from public.club_members where user_id = auth.uid()
    )
  );

-- Restaurant cache is public read (no sensitive data)
create policy "Anyone can read restaurant cache"
  on public.restaurant_cache for select using (true);

create policy "Authenticated users can upsert restaurant cache"
  on public.restaurant_cache for insert with check (auth.uid() is not null);

-- ============================================================
-- INDEXES
-- Speed up the most common queries
-- ============================================================

create index idx_club_members_user_id on public.club_members(user_id);
create index idx_club_members_club_id on public.club_members(club_id);
create index idx_dinners_club_id on public.dinners(club_id);
create index idx_dinners_status on public.dinners(status);
create index idx_poll_options_dinner_id on public.poll_options(dinner_id);
create index idx_votes_option_id on public.votes(option_id);
create index idx_votes_user_id on public.votes(user_id);
create index idx_rsvps_dinner_id on public.rsvps(dinner_id);
create index idx_dinner_ratings_place_id on public.dinner_ratings(place_id);
create index idx_dinner_ratings_user_id on public.dinner_ratings(user_id);
create index idx_invite_links_token on public.invite_links(token);
create index idx_reservation_attempts_dinner_id on public.reservation_attempts(dinner_id);
