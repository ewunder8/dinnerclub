"use server";

import { sendInviteToClub } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function emailInvite({ to, token }: { to: string; token: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Validate the recipient address
  const email = to.toLowerCase().trim();
  if (email.length > 254 || !EMAIL_REGEX.test(email)) throw new Error("Invalid email address");

  // The token must be an active, unexpired club invite link
  const { data: invite } = await supabase
    .from("invite_links")
    .select("club_id, expires_at, status")
    .eq("token", token)
    .maybeSingle();
  if (!invite || !invite.club_id || invite.status !== "active" || new Date(invite.expires_at) < new Date()) {
    throw new Error("Invalid invite link");
  }

  // Caller must be a member of the club the link belongs to
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", invite.club_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) throw new Error("Not authorized");

  // Derive club + inviter names server-side (never trust client-supplied values)
  const [{ data: club }, { data: inviter }] = await Promise.all([
    supabase.from("clubs").select("name").eq("id", invite.club_id).single<{ name: string }>(),
    supabase.from("users").select("name").eq("id", user.id).single<{ name: string | null }>(),
  ]);
  if (!club) throw new Error("Club not found");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dinnerclub.app";
  const inviteUrl = `${baseUrl}/join/${token}`;

  // Store the invited email so it appears on their dashboard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("invite_links") as any)
    .update({ invited_email: email })
    .eq("token", token);

  // TODO: in-app notification — notify the invitee inside the app when they next log in
  await sendInviteToClub({
    to: email,
    inviterName: inviter?.name ?? "A friend",
    clubName: club.name,
    inviteUrl,
  });
}

export async function refreshInviteLink(clubId: string): Promise<{ token: string; expires_at: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Caller must be a member of the club; non-owners also need members_can_invite enabled
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) throw new Error("Not authorized");

  if (membership.role !== "owner") {
    const { data: club } = await supabase
      .from("clubs")
      .select("*")
      .eq("id", clubId)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!club || (club as any).members_can_invite === false) throw new Error("Not authorized");
  }

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
