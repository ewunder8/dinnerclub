import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendDinnerReminder } from "@/lib/email";
import { generateUnsubscribeUrl } from "@/lib/unsubscribe";

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Find confirmed dinners with reservation_datetime tomorrow (UTC)
  const tomorrowStart = new Date();
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  tomorrowStart.setUTCHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setUTCHours(23, 59, 59, 999);

  const { data: dinners } = await supabase
    .from("dinners")
    .select("id, club_id, reservation_datetime, winning_restaurant_place_id")
    .eq("status", "confirmed")
    .gte("reservation_datetime", tomorrowStart.toISOString())
    .lte("reservation_datetime", tomorrowEnd.toISOString());

  if (!dinners || dinners.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  await Promise.allSettled(
    dinners.map(async (dinner) => {
      if (!dinner.winning_restaurant_place_id) return;

      const [{ data: members }, { data: restaurant }] = await Promise.all([
        supabase.from("club_members").select("users ( id, email, email_notifications )").eq("club_id", dinner.club_id!),
        supabase.from("restaurant_cache").select("name, address").eq("place_id", dinner.winning_restaurant_place_id).single(),
      ]);

      if (!members || !restaurant) return;

      const dt = new Date(dinner.reservation_datetime!);
      const dinnerTime = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const dinnerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${dinner.club_id}/dinners/${dinner.id}`;

      type MemberRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
      const eligibleMembers = (members as MemberRow[])
        .filter((m) => m.users?.email_notifications?.dinner_reminder !== false);

      await Promise.allSettled(
        eligibleMembers.map((m) =>
          sendDinnerReminder({
            to: m.users.email,
            restaurantName: restaurant.name,
            dinnerTime,
            restaurantAddress: restaurant.address ?? "",
            dinnerUrl,
            unsubscribeUrl: generateUnsubscribeUrl(m.users.id, "dinner_reminder"),
          })
        )
      );

      sent += eligibleMembers.length;
    })
  );

  return NextResponse.json({ sent });
}
