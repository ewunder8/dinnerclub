"use server";

import { sendInviteToClub } from "@/lib/email";

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
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join/${token}`;
  await sendInviteToClub({ to, inviterName, clubName, inviteUrl });
}
