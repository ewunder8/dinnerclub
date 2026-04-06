-- ============================================================
-- 024: One-off dinners (no club required)
-- - Add title to dinners
-- - Make dinners.club_id nullable
-- - Make invite_links.club_id nullable + add dinner_id FK
-- - New RLS helper + updated policies
-- ============================================================

-- 1. Add title column to dinners
ALTER TABLE public.dinners ADD COLUMN IF NOT EXISTS title text;

-- 2. Make club_id nullable on dinners
ALTER TABLE public.dinners ALTER COLUMN club_id DROP NOT NULL;

-- 3. Update invite_links: make club_id nullable, add dinner_id
ALTER TABLE public.invite_links ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.invite_links ADD COLUMN IF NOT EXISTS dinner_id uuid REFERENCES public.dinners(id) ON DELETE CASCADE;

-- 4. Helper: can the current user access a given dinner?
--    Works for both club dinners and one-off dinners.
CREATE OR REPLACE FUNCTION auth_can_access_dinner(p_dinner_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dinners d
    WHERE d.id = p_dinner_id
      AND (
        -- Club dinner: user is a member of the club
        (d.club_id IS NOT NULL AND auth_is_club_member(d.club_id))
        OR
        -- One-off dinner: user is the creator
        d.created_by = auth.uid()
        OR
        -- One-off dinner: user has an RSVP (accepted invite)
        EXISTS (
          SELECT 1 FROM public.rsvps r
          WHERE r.dinner_id = p_dinner_id
            AND r.user_id = auth.uid()
        )
      )
  );
$$;

-- 5. Update dinners policies to handle one-off dinners
DROP POLICY IF EXISTS "dinners: members can read" ON public.dinners;
DROP POLICY IF EXISTS "dinners: owners can create" ON public.dinners;
DROP POLICY IF EXISTS "dinners: members can update" ON public.dinners;

CREATE POLICY "dinners: members can read"
  ON public.dinners FOR SELECT TO authenticated
  USING (
    (club_id IS NOT NULL AND auth_is_club_member(club_id))
    OR (club_id IS NULL AND (created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.rsvps WHERE dinner_id = id AND user_id = auth.uid()
    )))
  );

CREATE POLICY "dinners: members can create"
  ON public.dinners FOR INSERT TO authenticated
  WITH CHECK (
    -- Club dinner: must be a club member (owner check done in app)
    (club_id IS NOT NULL AND auth_is_club_member(club_id))
    OR
    -- One-off dinner: any authenticated user, must be the creator
    (club_id IS NULL AND created_by = auth.uid())
  );

CREATE POLICY "dinners: members can update"
  ON public.dinners FOR UPDATE TO authenticated
  USING (
    (club_id IS NOT NULL AND auth_is_club_member(club_id))
    OR (club_id IS NULL AND (created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.rsvps WHERE dinner_id = id AND user_id = auth.uid()
    )))
  );

-- 6. Update poll_options, votes, dinner_ratings, reservation_attempts
--    to use auth_can_access_dinner instead of the club-only helper

DROP POLICY IF EXISTS "poll_options: members can read" ON public.poll_options;
DROP POLICY IF EXISTS "poll_options: members can suggest" ON public.poll_options;
DROP POLICY IF EXISTS "poll_options: members can update" ON public.poll_options;

CREATE POLICY "poll_options: members can read"
  ON public.poll_options FOR SELECT TO authenticated
  USING (auth_can_access_dinner(dinner_id));

CREATE POLICY "poll_options: members can suggest"
  ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (suggested_by = auth.uid() AND auth_can_access_dinner(dinner_id));

CREATE POLICY "poll_options: members can update"
  ON public.poll_options FOR UPDATE TO authenticated
  USING (auth_can_access_dinner(dinner_id));

DROP POLICY IF EXISTS "votes: members can read" ON public.votes;
DROP POLICY IF EXISTS "votes: members can cast own vote" ON public.votes;

CREATE POLICY "votes: members can read"
  ON public.votes FOR SELECT TO authenticated
  USING (auth_can_access_dinner(dinner_id));

CREATE POLICY "votes: members can cast own vote"
  ON public.votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND auth_can_access_dinner(dinner_id));

DROP POLICY IF EXISTS "rsvps: members can read" ON public.rsvps;
DROP POLICY IF EXISTS "rsvps: members can upsert own rsvp" ON public.rsvps;

CREATE POLICY "rsvps: members can read"
  ON public.rsvps FOR SELECT TO authenticated
  USING (auth_can_access_dinner(dinner_id));

CREATE POLICY "rsvps: can upsert own rsvp"
  ON public.rsvps FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Club dinner: must be a member
      auth_is_club_member((SELECT club_id FROM public.dinners WHERE id = dinner_id))
      OR
      -- One-off dinner: any authenticated user can join (invite link is the gate)
      (SELECT club_id FROM public.dinners WHERE id = dinner_id) IS NULL
    )
  );

DROP POLICY IF EXISTS "dinner_ratings: members can read" ON public.dinner_ratings;
DROP POLICY IF EXISTS "dinner_ratings: members can submit own rating" ON public.dinner_ratings;

CREATE POLICY "dinner_ratings: members can read"
  ON public.dinner_ratings FOR SELECT TO authenticated
  USING (auth_can_access_dinner(dinner_id));

CREATE POLICY "dinner_ratings: members can submit own rating"
  ON public.dinner_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND auth_can_access_dinner(dinner_id));

DROP POLICY IF EXISTS "reservation_attempts: members can read" ON public.reservation_attempts;
DROP POLICY IF EXISTS "reservation_attempts: members can create own" ON public.reservation_attempts;

CREATE POLICY "reservation_attempts: members can read"
  ON public.reservation_attempts FOR SELECT TO authenticated
  USING (auth_can_access_dinner(dinner_id));

CREATE POLICY "reservation_attempts: members can create own"
  ON public.reservation_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND auth_can_access_dinner(dinner_id));

-- 7. Update invite_links policies to allow one-off dinner invite creation
DROP POLICY IF EXISTS "invite_links: members can create" ON public.invite_links;
DROP POLICY IF EXISTS "invite_links: members can update (revoke)" ON public.invite_links;

CREATE POLICY "invite_links: members can create"
  ON public.invite_links FOR INSERT TO authenticated
  WITH CHECK (
    (club_id IS NOT NULL AND auth_is_club_member(club_id))
    OR
    (dinner_id IS NOT NULL AND (SELECT created_by FROM public.dinners WHERE id = dinner_id) = auth.uid())
  );

CREATE POLICY "invite_links: members can update (revoke)"
  ON public.invite_links FOR UPDATE TO authenticated
  USING (
    (club_id IS NOT NULL AND auth_is_club_member(club_id))
    OR
    (dinner_id IS NOT NULL AND (SELECT created_by FROM public.dinners WHERE id = dinner_id) = auth.uid())
  );
