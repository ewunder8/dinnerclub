import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { sendDinnerReminder } from "@/lib/email";
import { generateUnsubscribeUrl } from "@/lib/unsubscribe";

// Constant-time comparison to prevent timing attacks on the cron secret
function isAuthorized(authHeader: string | null): boolean {
  if (!authHeader || !process.env.CRON_SECRET) return false;
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const received = Buffer.from(authHeader);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

// TODO: cron — this route must be registered in vercel.json under "crons" to run automatically.
// Schedule suggestion: {"path": "/api/cron/dinner-reminder", "schedule": "0 12 * * *"} (noon UTC daily)
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  if (!isAuthorized(request.headers.get("authorization"))) {
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

      const { data: restaurant } = await supabase
        .from("restaurant_cache")
        .select("name, address")
        .eq("place_id", dinner.winning_restaurant_place_id)
        .single();

      if (!restaurant) return;

      const dt = new Date(dinner.reservation_datetime!);
      const dinnerTime = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      type RecipientRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
      let recipients: RecipientRow[] = [];
      let dinnerUrl: string;

      if (dinner.club_id) {
        // Club dinner — notify all club members
        dinnerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${dinner.club_id}/dinners/${dinner.id}`;
        const { data: members } = await supabase
          .from("club_members")
          .select("users ( id, email, email_notifications )")
          .eq("club_id", dinner.club_id);
        recipients = (members ?? []) as RecipientRow[];
      } else {
        // One-off dinner — notify RSVPed guests
        dinnerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dinners/${dinner.id}`;
        const { data: rsvps } = await supabase
          .from("rsvps")
          .select("users ( id, email, email_notifications )")
          .eq("dinner_id", dinner.id)
          .eq("status", "going");
        recipients = (rsvps ?? []) as RecipientRow[];
      }

      const eligible = recipients.filter(
        (r) => r.users?.email_notifications?.dinner_reminder !== false
      );

      await Promise.allSettled(
        eligible.map((r) =>
          sendDinnerReminder({
            to: r.users.email,
            restaurantName: restaurant.name,
            dinnerTime,
            restaurantAddress: restaurant.address ?? "",
            dinnerUrl,
            unsubscribeUrl: generateUnsubscribeUrl(r.users.id, "dinner_reminder"),
          })
        )
      );

      sent += eligible.length;
    })
  );

  return NextResponse.json({ sent });
}
