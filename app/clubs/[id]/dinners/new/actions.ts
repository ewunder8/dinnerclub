"use server";

import { createClient } from "@/lib/supabase/server";
import { sendDinnerPollCreated } from "@/lib/email";
import { generateUnsubscribeUrl } from "@/lib/unsubscribe";

function dinnerLabel(dinner: { title?: string | null; theme_cuisine?: string | null; theme_neighborhood?: string | null; theme_vibe?: string | null }) {
  if (dinner.title) return dinner.title;
  return [dinner.theme_cuisine, dinner.theme_neighborhood, dinner.theme_vibe]
    .filter(Boolean)
    .join(" · ") || "Dinner poll";
}

export async function notifyDinnerPollCreated({
  dinnerId,
  clubId,
}: {
  dinnerId: string;
  clubId: string;
}): Promise<void> {
  const supabase = await createClient();

  const [{ data: dinner }, { data: club }, { data: members }] = await Promise.all([
    supabase.from("dinners").select("title, theme_cuisine, theme_neighborhood, theme_vibe").eq("id", dinnerId).single(),
    supabase.from("clubs").select("name").eq("id", clubId).single(),
    supabase.from("club_members").select("users ( id, email, email_notifications )").eq("club_id", clubId),
  ]);

  if (!dinner || !club || !members) return;

  const pollUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${clubId}/dinners/${dinnerId}`;
  const dinnerName = dinnerLabel(dinner);
  const theme = [dinner.theme_cuisine, dinner.theme_neighborhood, dinner.theme_vibe].filter(Boolean).join(", ") || "No theme set";

  type MemberRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
  const eligible = (members as MemberRow[]).filter(
    (m) => m.users?.email && m.users.email_notifications?.voting_open !== false
  );

  await Promise.allSettled(
    eligible.map((m) =>
      sendDinnerPollCreated({
        to: m.users.email,
        clubName: club.name,
        dinnerName,
        dinnerTheme: theme,
        pollUrl,
        unsubscribeUrl: generateUnsubscribeUrl(m.users.id, "voting_open"),
      })
    )
  );
}
