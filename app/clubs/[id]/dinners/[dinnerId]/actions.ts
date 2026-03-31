"use server";

import { createClient } from "@/lib/supabase/server";
import { sendReservationConfirmed, sendVotingOpen, sendRatingPrompt, sendDinnerCancelled, sendDateLocked, sendRestaurantPicked } from "@/lib/email";
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

// ─── Planning flow actions ────────────────────────────────────

export async function voteDate({
  dinnerId,
  pollId,
  dateId,
  available,
}: {
  dinnerId: string;
  pollId: string;
  dateId: string;
  available: "yes" | "maybe" | "no";
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("planning_stage")
    .eq("id", dinnerId)
    .single();
  if (dinner?.planning_stage !== "date_voting") return { error: "Date voting is not open." };

  // Clear any none_of_the_above entry first
  await supabase
    .from("availability_responses")
    .delete()
    .eq("poll_id", pollId)
    .eq("user_id", user.id)
    .eq("none_of_the_above", true);

  // Upsert this date response
  const { error } = await supabase
    .from("availability_responses")
    .upsert(
      { poll_id: pollId, user_id: user.id, date_id: dateId, available, none_of_the_above: false },
      { onConflict: "poll_id,user_id,date_id" }
    );

  if (error) return { error: "Failed to save response." };
  return {};
}

export async function noneOfTheAbove({
  dinnerId,
  pollId,
}: {
  dinnerId: string;
  pollId: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("planning_stage")
    .eq("id", dinnerId)
    .single();
  if (dinner?.planning_stage !== "date_voting") return { error: "Date voting is not open." };

  // Delete all existing responses for this user + poll
  await supabase
    .from("availability_responses")
    .delete()
    .eq("poll_id", pollId)
    .eq("user_id", user.id);

  // Insert none_of_the_above row
  const { error } = await supabase
    .from("availability_responses")
    .insert({ poll_id: pollId, user_id: user.id, date_id: null, available: "no", none_of_the_above: true });

  if (error) return { error: "Failed to save response." };
  return {};
}

export async function lockDate({
  dinnerId,
  clubId,
  date,
}: {
  dinnerId: string;
  clubId: string;
  date: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("created_by, planning_stage")
    .eq("id", dinnerId)
    .single();
  if (!dinner) return { error: "Dinner not found." };
  if (dinner.created_by !== user.id) return { error: "Only the dinner creator can lock a date." };
  if (dinner.planning_stage !== "date_voting") return { error: "Not in date voting stage." };

  const { error: dinnerError } = await supabase
    .from("dinners")
    .update({ target_date: date, planning_stage: "restaurant_voting", voting_open: true })
    .eq("id", dinnerId);
  if (dinnerError) return { error: "Failed to lock date." };

  await supabase
    .from("availability_polls")
    .update({ status: "closed" })
    .eq("dinner_id", dinnerId);

  sendDateLockedEmails({ dinnerId, clubId, date });

  return {};
}

export async function lockRestaurant({
  dinnerId,
  clubId,
  placeId,
}: {
  dinnerId: string;
  clubId: string;
  placeId: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("created_by, planning_stage")
    .eq("id", dinnerId)
    .single();
  if (!dinner) return { error: "Dinner not found." };
  if (dinner.created_by !== user.id) return { error: "Only the dinner creator can pick the restaurant." };
  if (dinner.planning_stage !== "restaurant_voting") return { error: "Not in restaurant voting stage." };

  const { error } = await supabase
    .from("dinners")
    .update({
      winning_restaurant_place_id: placeId,
      planning_stage: "winner",
      voting_open: false,
      status: "seeking_reservation",
    })
    .eq("id", dinnerId);
  if (error) return { error: "Failed to lock restaurant." };

  sendRestaurantPickedEmails({ dinnerId, clubId, placeId });

  return {};
}

async function sendDateLockedEmails({ dinnerId, clubId, date }: { dinnerId: string; clubId: string; date: string }) {
  const supabase = await createClient();

  const [{ data: dinner }, { data: club }, { data: members }] = await Promise.all([
    supabase.from("dinners").select("theme_cuisine, theme_neighborhood, theme_vibe").eq("id", dinnerId).single(),
    supabase.from("clubs").select("name").eq("id", clubId).single(),
    supabase.from("club_members").select("users ( id, email, email_notifications )").eq("club_id", clubId),
  ]);

  if (!dinner || !club || !members) return;

  const dinnerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${clubId}/dinners/${dinnerId}`;
  const dinnerName = dinnerLabel(dinner);
  const lockedDate = new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  type MemberRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
  const eligibleMembers = (members as MemberRow[])
    .filter((m) => m.users?.email_notifications?.voting_open !== false);

  await Promise.allSettled(
    eligibleMembers.map((m) =>
      sendDateLocked({
        to: m.users.email,
        clubName: club.name,
        dinnerName,
        lockedDate,
        dinnerUrl,
        unsubscribeUrl: generateUnsubscribeUrl(m.users.id, "voting_open"),
      })
    )
  );
}

async function sendRestaurantPickedEmails({ dinnerId, clubId, placeId }: { dinnerId: string; clubId: string; placeId: string }) {
  const supabase = await createClient();

  const [{ data: dinner }, { data: club }, { data: members }, { data: restaurant }] = await Promise.all([
    supabase.from("dinners").select("theme_cuisine, theme_neighborhood, theme_vibe, target_date").eq("id", dinnerId).single(),
    supabase.from("clubs").select("name").eq("id", clubId).single(),
    supabase.from("club_members").select("users ( id, email, email_notifications )").eq("club_id", clubId),
    supabase.from("restaurant_cache").select("name").eq("place_id", placeId).single(),
  ]);

  if (!dinner || !club || !members || !restaurant) return;

  const dinnerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clubs/${clubId}/dinners/${dinnerId}`;
  const dinnerName = dinnerLabel(dinner);
  const lockedDate = dinner.target_date
    ? new Date(dinner.target_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "TBD";

  type MemberRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
  const eligibleMembers = (members as MemberRow[])
    .filter((m) => m.users?.email_notifications?.restaurant_picked !== false);

  await Promise.allSettled(
    eligibleMembers.map((m) =>
      sendRestaurantPicked({
        to: m.users.email,
        clubName: club.name,
        dinnerName,
        restaurantName: restaurant.name,
        lockedDate,
        dinnerUrl,
        unsubscribeUrl: generateUnsubscribeUrl(m.users.id, "restaurant_picked"),
      })
    )
  );
}


export async function setWaitlisted({ dinnerId }: { dinnerId: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("status")
    .eq("id", dinnerId)
    .single();
  if (dinner?.status !== "seeking_reservation" && dinner?.status !== "waitlisted") {
    return { error: "Dinner is not seeking a reservation." };
  }

  const [{ error: dinnerErr }, { error: attemptErr }] = await Promise.all([
    supabase.from("dinners").update({ status: "waitlisted" }).eq("id", dinnerId),
    supabase.from("reservation_attempts")
      .update({ status: "waitlisted" })
      .eq("dinner_id", dinnerId)
      .eq("user_id", user.id),
  ]);

  if (dinnerErr || attemptErr) return { error: "Failed to update waitlist status." };
  return {};
}

export async function giveUpWaitlist({ dinnerId }: { dinnerId: string }): Promise<{ error?: string; revertedToVoting?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: myAttempt } = await supabase
    .from("reservation_attempts")
    .select("status")
    .eq("dinner_id", dinnerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (myAttempt?.status !== "waitlisted") return { error: "You are not on the waitlist." };

  const { error: attemptErr } = await supabase
    .from("reservation_attempts")
    .update({ status: "abandoned" })
    .eq("dinner_id", dinnerId)
    .eq("user_id", user.id);
  if (attemptErr) return { error: "Failed to give up waitlist." };

  // Only revert dinner status if no one else is still waitlisted
  const { data: remaining } = await supabase
    .from("reservation_attempts")
    .select("id")
    .eq("dinner_id", dinnerId)
    .eq("status", "waitlisted");

  if (!remaining || remaining.length === 0) {
    // No one left on the waitlist — go back to restaurant voting so the group can pick somewhere else
    await supabase.from("dinners").update({
      status: "seeking_reservation",
      planning_stage: "restaurant_voting",
      voting_open: true,
      winning_restaurant_place_id: null,
    }).eq("id", dinnerId);
    return { revertedToVoting: true };
  }

  return {};
}

export async function rsvpDinner({
  dinnerId,
  status,
}: {
  dinnerId: string;
  status: "going" | "not_going";
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("rsvps")
    .upsert(
      { dinner_id: dinnerId, user_id: user.id, status },
      { onConflict: "dinner_id,user_id" }
    );
  if (error) return { error: "Failed to save RSVP." };
  return {};
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
