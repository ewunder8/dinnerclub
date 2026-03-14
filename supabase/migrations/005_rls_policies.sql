-- ============================================================
-- DinnerClub — Row Level Security Policies
-- Run this in Supabase SQL Editor after the initial schema.
-- Ensures users can only access data for clubs they belong to.
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- SECURITY DEFINER so they run with elevated privileges and
-- can query club_members without triggering their own RLS.
-- ============================================================

-- Is the current user a member of this club?
CREATE OR REPLACE FUNCTION auth_is_club_member(p_club_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
  );
$$;

-- Is the current user the owner of this club?
CREATE OR REPLACE FUNCTION auth_is_club_owner(p_club_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

-- Resolve a dinner_id → club_id (used by tables that only store dinner_id)
CREATE OR REPLACE FUNCTION dinner_club_id(p_dinner_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT club_id FROM public.dinners WHERE id = p_dinner_id LIMIT 1;
$$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_links         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dinners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_cache     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dinner_ratings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS
-- Any authenticated user can read the users table (display info
-- for member lists). Users can only write their own row.
-- ============================================================

CREATE POLICY "users: authenticated can read all"
  ON public.users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "users: insert own row"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "users: update own row"
  ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ============================================================
-- CLUBS
-- ============================================================

CREATE POLICY "clubs: members can read"
  ON public.clubs FOR SELECT TO authenticated
  USING (auth_is_club_member(id));

CREATE POLICY "clubs: authenticated can create"
  ON public.clubs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "clubs: owners can update"
  ON public.clubs FOR UPDATE TO authenticated
  USING (auth_is_club_owner(id));

-- ============================================================
-- CLUB MEMBERS
-- ============================================================

CREATE POLICY "club_members: members can read their club"
  ON public.club_members FOR SELECT TO authenticated
  USING (auth_is_club_member(club_id));

-- Any authenticated user can insert themselves (join via invite link)
CREATE POLICY "club_members: can join"
  ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Members can leave; owners can remove anyone
CREATE POLICY "club_members: can leave or be removed"
  ON public.club_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR auth_is_club_owner(club_id));

-- ============================================================
-- INVITE LINKS
-- Any authenticated user can read invite links — the token
-- itself is the secret, and non-members need to read it to join.
-- ============================================================

CREATE POLICY "invite_links: authenticated can read"
  ON public.invite_links FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "invite_links: members can create"
  ON public.invite_links FOR INSERT TO authenticated
  WITH CHECK (auth_is_club_member(club_id));

CREATE POLICY "invite_links: members can update (revoke)"
  ON public.invite_links FOR UPDATE TO authenticated
  USING (auth_is_club_member(club_id));

-- ============================================================
-- DINNERS
-- ============================================================

CREATE POLICY "dinners: members can read"
  ON public.dinners FOR SELECT TO authenticated
  USING (auth_is_club_member(club_id));

-- Only owners can create dinners
CREATE POLICY "dinners: owners can create"
  ON public.dinners FOR INSERT TO authenticated
  WITH CHECK (auth_is_club_owner(club_id));

-- Any member can update (vote, confirm reservation, etc.)
-- Finer-grained role checks (owner-only actions) are enforced in the app.
CREATE POLICY "dinners: members can update"
  ON public.dinners FOR UPDATE TO authenticated
  USING (auth_is_club_member(club_id));

-- ============================================================
-- POLL OPTIONS
-- ============================================================

CREATE POLICY "poll_options: members can read"
  ON public.poll_options FOR SELECT TO authenticated
  USING (auth_is_club_member(dinner_club_id(dinner_id)));

CREATE POLICY "poll_options: members can suggest"
  ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (
    suggested_by = auth.uid()
    AND auth_is_club_member(dinner_club_id(dinner_id))
  );

-- Members can update (owner removes; app enforces who can do what)
CREATE POLICY "poll_options: members can update"
  ON public.poll_options FOR UPDATE TO authenticated
  USING (auth_is_club_member(dinner_club_id(dinner_id)));

-- ============================================================
-- VOTES
-- ============================================================

CREATE POLICY "votes: members can read"
  ON public.votes FOR SELECT TO authenticated
  USING (auth_is_club_member(dinner_club_id(dinner_id)));

CREATE POLICY "votes: members can cast own vote"
  ON public.votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND auth_is_club_member(dinner_club_id(dinner_id))
  );

-- Members can only delete their own vote
CREATE POLICY "votes: can delete own vote"
  ON public.votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- RSVPS
-- ============================================================

CREATE POLICY "rsvps: members can read"
  ON public.rsvps FOR SELECT TO authenticated
  USING (auth_is_club_member(dinner_club_id(dinner_id)));

CREATE POLICY "rsvps: members can upsert own rsvp"
  ON public.rsvps FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND auth_is_club_member(dinner_club_id(dinner_id))
  );

CREATE POLICY "rsvps: can update own rsvp"
  ON public.rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- RESTAURANT CACHE
-- Shared read/write cache — not club-scoped.
-- Any authenticated user can read and upsert restaurant data.
-- ============================================================

CREATE POLICY "restaurant_cache: authenticated can read"
  ON public.restaurant_cache FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "restaurant_cache: authenticated can upsert"
  ON public.restaurant_cache FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "restaurant_cache: authenticated can update"
  ON public.restaurant_cache FOR UPDATE TO authenticated
  USING (true);

-- ============================================================
-- DINNER RATINGS
-- ============================================================

CREATE POLICY "dinner_ratings: members can read"
  ON public.dinner_ratings FOR SELECT TO authenticated
  USING (auth_is_club_member(dinner_club_id(dinner_id)));

CREATE POLICY "dinner_ratings: members can submit own rating"
  ON public.dinner_ratings FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND auth_is_club_member(dinner_club_id(dinner_id))
  );

CREATE POLICY "dinner_ratings: can update own rating"
  ON public.dinner_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- RESERVATION ATTEMPTS
-- ============================================================

CREATE POLICY "reservation_attempts: members can read"
  ON public.reservation_attempts FOR SELECT TO authenticated
  USING (auth_is_club_member(dinner_club_id(dinner_id)));

CREATE POLICY "reservation_attempts: members can create own"
  ON public.reservation_attempts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND auth_is_club_member(dinner_club_id(dinner_id))
  );

CREATE POLICY "reservation_attempts: can update own"
  ON public.reservation_attempts FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
