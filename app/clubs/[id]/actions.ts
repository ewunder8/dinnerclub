"use server";

import { sendInviteToClub } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

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

  await sendInviteToClub({ to, inviterName, clubName, inviteUrl });
}
