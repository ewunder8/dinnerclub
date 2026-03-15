"use server";

import { createClient } from "@/lib/supabase/server";
import { sendReservationConfirmed } from "@/lib/email";
import type { Dinner } from "@/lib/supabase/database.types";

type Platform = NonNullable<Dinner["reservation_platform"]>;

export async function confirmReservation({
  dinnerId,
  clubId,
  userId,
  reservationDatetime,
  partySize,
  platform,
  confirmationNumber,
  winningPlaceId,
}: {
  dinnerId: string;
  clubId: string;
  userId: string;
  reservationDatetime: string;
  partySize: number;
  platform: Platform | null;
  confirmationNumber: string | null;
  winningPlaceId: string | null;
}) {
  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("dinners")
    .update({
      status: "confirmed",
      reservation_datetime: new Date(reservationDatetime).toISOString(),
      party_size: partySize,
      reservation_platform: platform,
      confirmation_number: confirmationNumber || null,
      reserved_by: userId,
      ...(winningPlaceId ? { winning_restaurant_place_id: winningPlaceId } : {}),
    })
    .eq("id", dinnerId);

  if (updateError) throw new Error(updateError.message);

  // Fire emails in the background — don't block the response
  sendConfirmationEmails({ dinnerId, clubId, reservationDatetime, partySize, winningPlaceId });
}

async function sendConfirmationEmails({
  dinnerId,
  clubId,
  reservationDatetime,
  partySize,
  winningPlaceId,
}: {
  dinnerId: string;
  clubId: string;
  reservationDatetime: string;
  partySize: number;
  winningPlaceId: string | null;
}) {
  const supabase = await createClient();

  const [{ data: members }, { data: restaurant }] = await Promise.all([
    supabase
      .from("club_members")
      .select("users ( email )")
      .eq("club_id", clubId),
    winningPlaceId
      ? supabase
          .from("restaurant_cache")
          .select("name, address")
          .eq("place_id", winningPlaceId)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  if (!restaurant || !members) return;

  const dt = new Date(reservationDatetime);
  const dinnerDate = dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const dinnerTime = dt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dinnerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${clubId}/dinners/${dinnerId}`;

  const emails = (members as { users: { email: string } }[])
    .map((m) => m.users?.email)
    .filter(Boolean) as string[];

  await Promise.allSettled(
    emails.map((to) =>
      sendReservationConfirmed({
        to,
        restaurantName: restaurant.name,
        dinnerDate,
        dinnerTime,
        partySize,
        restaurantAddress: restaurant.address ?? "",
        dinnerUrl,
      })
    )
  );
}
