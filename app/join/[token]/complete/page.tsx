import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isInviteExpired } from "@/lib/utils";

// Called after login/signup when joining via invite link.
// Adds the user to the club and redirects to the club page.
export default async function JoinCompletePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/auth/login?next=/join/${params.token}/complete`);

  // Look up the invite
  const { data: invite } = await supabase
    .from("invite_links")
    .select("id, club_id, expires_at, status, used_count")
    .eq("token", params.token)
    .single();

  if (!invite || invite.status !== "active" || isInviteExpired(invite.expires_at)) {
    redirect("/dashboard?error=invite_expired");
  }

  if (!invite.club_id) redirect("/dashboard?error=invalid_invite");
  const clubId = invite.club_id;

  // Check if already a member
  const { data: existing } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    // Add them as a member
    await supabase.from("club_members").insert({
      club_id: clubId,
      user_id: user.id,
      role: "member",
    });

    // Increment used_count
    await supabase
      .from("invite_links")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);
  }

  redirect(`/clubs/${clubId}`);
}
