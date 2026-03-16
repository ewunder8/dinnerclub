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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dinnerclub.app";
  const inviteUrl = `${baseUrl}/join/${token}`;
  await sendInviteToClub({ to, inviterName, clubName, inviteUrl });
}
