-- Allow users to read a club they've been invited to (even before accepting)
-- so the club name shows on the dashboard Invitations section.
-- Uses auth.jwt() to avoid a potentially RLS-blocked subquery on public.users.
CREATE POLICY "clubs: invited users can read"
  ON public.clubs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invite_links
      WHERE club_id = id
        AND invited_email = (auth.jwt() ->> 'email')
        AND status = 'active'
    )
  );
