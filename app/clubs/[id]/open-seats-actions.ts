"use server";

import { createClient } from "@/lib/supabase/server";
import {
  sendOpenSeatPosted,
  sendSeatRequestReceived,
  sendSeatRequestResponse,
} from "@/lib/email";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

type MemberRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };

export async function postOpenSeat({
  clubId,
  restaurantName,
  reservationDatetime,
  seatsAvailable,
  note,
}: {
  clubId: string;
  restaurantName: string;
  reservationDatetime: string;
  seatsAvailable: number;
  note: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error: insertError } = await supabase.from("open_seats").insert({
    club_id: clubId,
    created_by: user.id,
    restaurant_name: restaurantName,
    reservation_datetime: reservationDatetime,
    seats_available: seatsAvailable,
    note,
  });

  if (insertError) return { error: "Failed to post. Try again." };

  // Send notifications to club members (fire-and-forget)
  sendOpenSeatNotifications({ clubId, posterId: user.id, restaurantName, reservationDatetime, note });

  return {};
}

async function sendOpenSeatNotifications({
  clubId,
  posterId,
  restaurantName,
  reservationDatetime,
  note,
}: {
  clubId: string;
  posterId: string;
  restaurantName: string;
  reservationDatetime: string;
  note: string | null;
}) {
  const supabase = await createClient();

  const [{ data: members }, { data: poster }] = await Promise.all([
    supabase.from("club_members").select("users ( id, email, email_notifications )").eq("club_id", clubId),
    supabase.from("users").select("name, email").eq("id", posterId).single(),
  ]);

  if (!members || !poster) return;

  const clubUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${clubId}`;
  const dateTime = formatDateTime(reservationDatetime);
  const posterName = poster.name || poster.email.split("@")[0];

  const recipients = (members as MemberRow[]).filter(
    (m) => m.users.id !== posterId && m.users.email_notifications?.open_seat_posted !== false
  );

  await Promise.allSettled(
    recipients.map((m) =>
      sendOpenSeatPosted({
        to: m.users.email,
        posterName,
        restaurantName,
        dateTime,
        note,
        clubUrl,
      })
    )
  );
}

export async function requestSeat({
  seatId,
}: {
  seatId: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error: insertError } = await supabase
    .from("open_seat_requests")
    .insert({ open_seat_id: seatId, user_id: user.id });

  if (insertError) return { error: "Couldn't send request." };

  // Notify seat poster (fire-and-forget)
  sendRequestReceivedNotification({ seatId, requesterId: user.id });

  return {};
}

async function sendRequestReceivedNotification({
  seatId,
  requesterId,
}: {
  seatId: string;
  requesterId: string;
}) {
  const supabase = await createClient();

  const [{ data: seat }, { data: requester }] = await Promise.all([
    supabase.from("open_seats").select("created_by, restaurant_name, reservation_datetime").eq("id", seatId).single(),
    supabase.from("users").select("name, email").eq("id", requesterId).single(),
  ]);

  if (!seat || !requester) return;

  const { data: poster } = await supabase
    .from("users")
    .select("email, email_notifications")
    .eq("id", seat.created_by)
    .single();

  if (!poster || poster.email_notifications?.open_seat_update === false) return;

  const clubUrl = `${process.env.NEXT_PUBLIC_APP_URL}`;
  const requesterName = requester.name || requester.email.split("@")[0];

  await sendSeatRequestReceived({
    to: poster.email,
    requesterName,
    restaurantName: seat.restaurant_name,
    dateTime: formatDateTime(seat.reservation_datetime),
    clubUrl,
  });
}

export async function respondToSeatRequest({
  requestId,
  newStatus,
}: {
  requestId: string;
  newStatus: "confirmed" | "declined";
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error: updateError } = await supabase
    .from("open_seat_requests")
    .update({ status: newStatus })
    .eq("id", requestId);

  if (updateError) return { error: "Failed to update request." };

  // Notify requester (fire-and-forget)
  sendRequestResponseNotification({ requestId, confirmed: newStatus === "confirmed" });

  return {};
}

async function sendRequestResponseNotification({
  requestId,
  confirmed,
}: {
  requestId: string;
  confirmed: boolean;
}) {
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("open_seat_requests")
    .select("user_id, open_seats ( restaurant_name, reservation_datetime, club_id )")
    .eq("id", requestId)
    .single();

  if (!req) return;

  const { data: requester } = await supabase
    .from("users")
    .select("email, email_notifications")
    .eq("id", req.user_id)
    .single();

  if (!requester || requester.email_notifications?.open_seat_update === false) return;

  const seat = req.open_seats as unknown as { restaurant_name: string; reservation_datetime: string; club_id: string };

  await sendSeatRequestResponse({
    to: requester.email,
    confirmed,
    restaurantName: seat.restaurant_name,
    dateTime: formatDateTime(seat.reservation_datetime),
    clubUrl: `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${seat.club_id}`,
  });
}
