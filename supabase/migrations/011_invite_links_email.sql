-- Track which email address was invited so we can surface pending
-- invitations on the dashboard without requiring a link click.
ALTER TABLE public.invite_links ADD COLUMN invited_email text;

-- Allow users to see invite links sent to their email address
CREATE POLICY "Users can view invites sent to their email"
  ON public.invite_links FOR SELECT
  USING (invited_email = (SELECT email FROM public.users WHERE id = auth.uid()));
