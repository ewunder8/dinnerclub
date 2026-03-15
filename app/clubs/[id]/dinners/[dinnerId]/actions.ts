"use server";

import { createClient } from "@/lib/supabase/server";
import { sendReservationConfirmed, sendVotingOpen, sendRatingPrompt } from "@/lib/email";
import type { Dinner } from "@/lib/supabase/database.types";

function dinnerLabel(dinner: { theme_cuisine?: string | null; theme_neighborhood?: string | null; theme_vibe?: string | null }) {
  return [dinner.theme_cuisine, dinner.theme_neighborhood, dinner.theme_vibe]
    .filter(Boolean)
    .join(" · ") || "Dinner poll";
}

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

// ─── Open voting ──────────────────────────────────────────────

export async function openVoting({ dinnerId, clubId }: { dinnerId: string; clubId: string }) {
  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("dinners")
    .update({ voting_open: true })
    .eq("id", dinnerId);

  if (updateError) throw new Error(updateError.message);

  sendVotingOpenEmails({ dinnerId, clubId });
}

async function sendVotingOpenEmails({ dinnerId, clubId }: { dinnerId: string; clubId: string }) {
  const supabase = await createClient();

  const [{ data: dinner }, { data: club }, { data: members }, { data: options }] = await Promise.all([
    supabase.from("dinners").select("theme_cuisine, theme_neighborhood, theme_vibe").eq("id", dinnerId).single(),
    supabase.from("clubs").select("name").eq("id", clubId).single(),
    supabase.from("club_members").select("users ( email )").eq("club_id", clubId),
    supabase.from("poll_options").select("id").eq("dinner_id", dinnerId).is("removed_at", null),
  ]);

  if (!dinner || !club || !members) return;

  const pollUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${clubId}/dinners/${dinnerId}`;
  const name = dinnerLabel(dinner);
  const theme = [dinner.theme_cuisine, dinner.theme_neighborhood, dinner.theme_vibe].filter(Boolean).join(", ") || "No theme set";
  const emails = (members as { users: { email: string } }[]).map((m) => m.users?.email).filter(Boolean) as string[];

  await Promise.allSettled(
    emails.map((to) =>
      sendVotingOpen({
        to,
        clubName: club.name,
        dinnerName: name,
        dinnerTheme: theme,
        restaurantCount: options?.length ?? 0,
        pollUrl,
      })
    )
  );
}

// ─── Mark completed ───────────────────────────────────────────

export async function markCompleted({ dinnerId, clubId }: { dinnerId: string; clubId: string }) {
  const supabase = await createClient();

  const ratingsOpenUntil = new Date();
  ratingsOpenUntil.setDate(ratingsOpenUntil.getDate() + 7);

  const { error: updateError } = await supabase
    .from("dinners")
    .update({ status: "completed", ratings_open_until: ratingsOpenUntil.toISOString() })
    .eq("id", dinnerId);

  if (updateError) throw new Error(updateError.message);

  sendRatingPromptEmails({ dinnerId, clubId });
}

async function sendRatingPromptEmails({ dinnerId, clubId }: { dinnerId: string; clubId: string }) {
  const supabase = await createClient();

  const { data: dinner } = await supabase
    .from("dinners")
    .select("winning_restaurant_place_id, reservation_datetime, theme_cuisine, theme_neighborhood, theme_vibe")
    .eq("id", dinnerId)
    .single();

  if (!dinner) return;

  const [{ data: members }, { data: restaurant }] = await Promise.all([
    supabase.from("club_members").select("users ( email )").eq("club_id", clubId),
    dinner.winning_restaurant_place_id
      ? supabase.from("restaurant_cache").select("name").eq("place_id", dinner.winning_restaurant_place_id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!members || !restaurant) return;

  const ratingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${clubId}/dinners/${dinnerId}`;
  const name = dinnerLabel(dinner);
  const dinnerDate = dinner.reservation_datetime
    ? new Date(dinner.reservation_datetime).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const emails = (members as { users: { email: string } }[]).map((m) => m.users?.email).filter(Boolean) as string[];

  await Promise.allSettled(
    emails.map((to) =>
      sendRatingPrompt({
        to,
        restaurantName: restaurant.name,
        dinnerName: name,
        dinnerDate,
        ratingUrl,
      })
    )
  );
}
