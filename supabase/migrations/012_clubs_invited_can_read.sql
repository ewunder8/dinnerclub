-- Allow users to read a club they've been invited to (even before accepting)
-- so the club name shows on the dashboard Invitations section.
CREATE POLICY "clubs: invited users can read"
  ON public.clubs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invite_links
      WHERE club_id = id
        AND invited_email = (SELECT email FROM public.users WHERE id = auth.uid())
        AND status = 'active'
    )
  );
