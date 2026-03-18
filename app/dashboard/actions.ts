"use server";

import { createClient } from "@/lib/supabase/server";
import { isInviteExpired } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export async function acceptInvite(inviteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: invite } = await supabase
    .from("invite_links")
    .select("id, club_id, expires_at, status, used_count")
    .eq("id", inviteId)
    .single();

  if (!invite || invite.status !== "active" || isInviteExpired(invite.expires_at)) {
    throw new Error("This invite is no longer valid.");
  }

  const { data: existing } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", invite.club_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("club_members").insert({
      club_id: invite.club_id,
      user_id: user.id,
      role: "member",
    });
    await supabase
      .from("invite_links")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);
  }

  revalidatePath("/dashboard");
  return { clubId: invite.club_id };
}
