"use server";

import { sendInviteToClub } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function emailInvite({
  to,
  token,
  clubName,
  inviterName,
}: {
  to: string;
  token: string;
  clubName: string;
  inviterName: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dinnerclub.app";
  const inviteUrl = `${baseUrl}/join/${token}`;

  // Store the invited email so it appears on their dashboard
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("invite_links") as any)
    .update({ invited_email: to.toLowerCase().trim() })
    .eq("token", token);

  // TODO: in-app notification — notify the invitee inside the app when they next log in
  await sendInviteToClub({ to, inviterName, clubName, inviteUrl });
}

export async function refreshInviteLink(clubId: string): Promise<{ token: string; expires_at: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { generateInviteToken, getInviteExpiry } = await import("@/lib/utils");

  // Revoke all existing active links for this club
  await supabase
    .from("invite_links")
    .update({ status: "revoked" })
    .eq("club_id", clubId)
    .eq("status", "active");

  // Generate a fresh one
  const token = generateInviteToken();
  const expires_at = getInviteExpiry().toISOString();

  const { error } = await supabase.from("invite_links").insert({
    club_id: clubId,
    created_by: user.id,
    token,
    expires_at,
    status: "active",
  });

  if (error) throw new Error("Failed to generate invite link");

  return { token, expires_at };
}

export async function updateMemberRole(clubId: string, targetUserId: string, newRole: "owner" | "member") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Caller must be an owner
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();
  if (membership?.role !== "owner") throw new Error("Not authorized");

  // Cannot change your own role
  if (targetUserId === user.id) throw new Error("Cannot change your own role");

  const admin = createAdminClient();
  const { error } = await admin
    .from("club_members")
    .update({ role: newRole })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId);

  if (error) throw new Error("Failed to update role");
}
