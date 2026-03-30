"use server";

import { createClient } from "@/lib/supabase/server";
import { sendReservationConfirmed, sendVotingOpen, sendRatingPrompt, sendDinnerCancelled } from "@/lib/email";
import { generateUnsubscribeUrl } from "@/lib/unsubscribe";
import type { Dinner } from "@/lib/supabase/database.types";

function dinnerLabel(dinner: { theme_cuisine?: string | null; theme_neighborhood?: string | null; theme_vibe?: string | null }) {
  return [dinner.theme_cuisine, dinner.theme_neighborhood, dinner.theme_vibe]
    .filter(Boolean)
    .join(" · ") || "Dinner poll";
}

type Platform = NonNullable<Dinner["reservation_platform"]>;

export async function updateDinnerDetails({
  dinnerId,
  cuisine,
  price,
  vibe,
  neighborhood,
  targetDate,
  pollClosesAt,
}: {
  dinnerId: string;
  cuisine: string | null;
  price: number | null;
  vibe: string | null;
  neighborhood: string | null;
  targetDate: string | null;
  pollClosesAt: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("dinners")
    .update({
      theme_cuisine: cuisine || null,
      theme_price: price,
      theme_vibe: vibe || null,
      theme_neighborhood: neighborhood || null,
      target_date: targetDate ? new Date(targetDate).toISOString() : null,
      poll_closes_at: pollClosesAt ? new Date(pollClosesAt).toISOString() : null,
    })
    .eq("id", dinnerId);

  if (error) return { error: "Failed to update dinner." };
  return {};
}

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
      .select("users ( id, email, email_notifications )")
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

  type MemberRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
  const eligibleMembers = (members as MemberRow[])
    .filter((m) => m.users?.email_notifications?.reservation_confirmed !== false);

  await Promise.allSettled(
    eligibleMembers.map((m) =>
      sendReservationConfirmed({
        to: m.users.email,
        restaurantName: restaurant.name,
        dinnerDate,
        dinnerTime,
        partySize,
        restaurantAddress: restaurant.address ?? "",
        dinnerUrl,
        unsubscribeUrl: generateUnsubscribeUrl(m.users.id, "reservation_confirmed"),
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
    supabase.from("club_members").select("users ( id, email, email_notifications )").eq("club_id", clubId),
    supabase.from("poll_options").select("id").eq("dinner_id", dinnerId).is("removed_at", null),
  ]);

  if (!dinner || !club || !members) return;

  const pollUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${clubId}/dinners/${dinnerId}`;
  const name = dinnerLabel(dinner);
  const theme = [dinner.theme_cuisine, dinner.theme_neighborhood, dinner.theme_vibe].filter(Boolean).join(", ") || "No theme set";
  type MemberRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
  const eligibleMembers = (members as MemberRow[])
    .filter((m) => m.users?.email_notifications?.voting_open !== false);

  await Promise.allSettled(
    eligibleMembers.map((m) =>
      sendVotingOpen({
        to: m.users.email,
        clubName: club.name,
        dinnerName: name,
        dinnerTheme: theme,
        restaurantCount: options?.length ?? 0,
        pollUrl,
        unsubscribeUrl: generateUnsubscribeUrl(m.users.id, "voting_open"),
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
    supabase.from("club_members").select("users ( id, email, email_notifications )").eq("club_id", clubId),
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

  type MemberRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
  const eligibleMembers = (members as MemberRow[])
    .filter((m) => m.users?.email_notifications?.rating_prompt !== false);

  await Promise.allSettled(
    eligibleMembers.map((m) =>
      sendRatingPrompt({
        to: m.users.email,
        restaurantName: restaurant.name,
        dinnerName: name,
        dinnerDate,
        ratingUrl,
        unsubscribeUrl: generateUnsubscribeUrl(m.users.id, "rating_prompt"),
      })
    )
  );
}

// ─── Cancel dinner ────────────────────────────────────────────

export async function cancelDinner({ dinnerId, clubId }: { dinnerId: string; clubId: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("theme_cuisine, theme_neighborhood, theme_vibe")
    .eq("id", dinnerId)
    .single();

  if (!dinner) return { error: "Dinner not found." };

  const { error: updateError } = await supabase
    .from("dinners")
    .update({ status: "cancelled" })
    .eq("id", dinnerId);

  if (updateError) return { error: updateError.message };

  sendCancellationEmails({ dinnerId, clubId, dinner });
  return {};
}

async function sendCancellationEmails({
  clubId,
  dinner,
}: {
  dinnerId: string;
  clubId: string;
  dinner: { theme_cuisine?: string | null; theme_neighborhood?: string | null; theme_vibe?: string | null };
}) {
  const supabase = await createClient();

  const [{ data: members }, { data: club }] = await Promise.all([
    supabase.from("club_members").select("users ( id, email, email_notifications )").eq("club_id", clubId),
    supabase.from("clubs").select("name").eq("id", clubId).single(),
  ]);

  if (!members || !club) return;

  const dinnerName = dinnerLabel(dinner);
  const clubUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${clubId}`;

  type MemberRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
  const eligibleMembers = (members as MemberRow[])
    .filter((m) => m.users?.email_notifications?.dinner_cancelled !== false);

  await Promise.allSettled(
    eligibleMembers.map((m) =>
      sendDinnerCancelled({
        to: m.users.email,
        clubName: club.name,
        dinnerName,
        clubUrl,
        unsubscribeUrl: generateUnsubscribeUrl(m.users.id, "dinner_cancelled"),
      })
    )
  );
}
