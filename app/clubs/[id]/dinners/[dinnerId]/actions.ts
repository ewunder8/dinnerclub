"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReservationConfirmed, sendVotingOpen, sendRatingPrompt, sendDinnerCancelled, sendDateLocked, sendRestaurantPicked } from "@/lib/email";
import { generateUnsubscribeUrl } from "@/lib/unsubscribe";
import type { Dinner } from "@/lib/supabase/database.types";

function dinnerLabel(dinner: { title?: string | null; theme_cuisine?: string | null; theme_neighborhood?: string | null; theme_vibe?: string | null }) {
  if (dinner.title) return dinner.title;
  return [dinner.theme_cuisine, dinner.theme_neighborhood, dinner.theme_vibe]
    .filter(Boolean)
    .join(" · ") || "Dinner poll";
}

type Platform = NonNullable<Dinner["reservation_platform"]>;

export async function updateDinnerDetails({
  dinnerId,
  title,
  cuisine,
  price,
  vibe,
  neighborhood,
  targetDate,
  pollClosesAt,
  emoji,
  winningRestaurantPlaceId,
  plusOnesEnabled,
  plusOnesMax,
}: {
  dinnerId: string;
  title?: string | null;
  cuisine: string | null;
  price: number | null;
  vibe: string | null;
  neighborhood: string | null;
  targetDate: string | null;
  pollClosesAt: string | null;
  emoji?: string | null;
  winningRestaurantPlaceId?: string | null;
  plusOnesEnabled?: boolean;
  plusOnesMax?: number | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("created_by")
    .eq("id", dinnerId)
    .single();
  if (!dinner) return { error: "Dinner not found." };
  if (dinner.created_by !== user.id && !(await getIsCohost(dinnerId, user.id, supabase))) {
    return { error: "Only the dinner host can edit details." };
  }

  const { error } = await supabase
    .from("dinners")
    .update({
      ...(title !== undefined ? { title: title || null } : {}),
      theme_cuisine: cuisine || null,
      theme_price: price,
      theme_vibe: vibe || null,
      theme_neighborhood: neighborhood || null,
      target_date: targetDate ? new Date(targetDate).toISOString() : null,
      poll_closes_at: pollClosesAt ? new Date(pollClosesAt).toISOString() : null,
      ...(emoji !== undefined ? { emoji: emoji || null } : {}),
      ...(winningRestaurantPlaceId !== undefined ? { winning_restaurant_place_id: winningRestaurantPlaceId } : {}),
      ...(plusOnesEnabled !== undefined ? { plus_ones_enabled: plusOnesEnabled } : {}),
      ...(plusOnesMax !== undefined ? { plus_ones_max: plusOnesMax } : {}),
    })
    .eq("id", dinnerId);

  if (error) return { error: "Failed to update dinner." };
  return {};
}

export async function lockRsvps({ dinnerId }: { dinnerId: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("created_by, club_id, status, target_date, title, winning_restaurant_place_id")
    .eq("id", dinnerId)
    .single();
  if (!dinner) return { error: "Dinner not found." };
  if (dinner.created_by !== user.id) return { error: "Only the dinner creator can lock RSVPs." };
  if (dinner.club_id !== null) return { error: "This action is only for one-off dinners." };
  if (dinner.status === "confirmed") return { error: "RSVPs are already locked." };

  const { error } = await supabase
    .from("dinners")
    .update({
      status: "confirmed",
      reservation_datetime: dinner.target_date ?? null,
    })
    .eq("id", dinnerId);

  if (error) return { error: "Failed to lock RSVPs." };

  sendOneOffConfirmedEmails({ dinnerId, dinner });
  return {};
}

export async function cancelOneOffDinner({ dinnerId }: { dinnerId: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("created_by, club_id, title")
    .eq("id", dinnerId)
    .single();
  if (!dinner) return { error: "Dinner not found." };
  if (dinner.created_by !== user.id) return { error: "Only the dinner creator can cancel." };
  if (dinner.club_id !== null) return { error: "This action is only for one-off dinners." };

  const { error } = await supabase
    .from("dinners")
    .update({ status: "cancelled" })
    .eq("id", dinnerId);

  if (error) return { error: "Failed to cancel dinner." };
  sendOneOffCancellationEmails({ dinnerId, dinner });
  return {};
}

export async function markOneOffCompleted({ dinnerId }: { dinnerId: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("created_by, club_id, title, winning_restaurant_place_id, reservation_datetime, target_date")
    .eq("id", dinnerId)
    .single();
  if (!dinner) return { error: "Dinner not found." };
  if (dinner.created_by !== user.id) return { error: "Only the dinner creator can mark as completed." };
  if (dinner.club_id !== null) return { error: "This action is only for one-off dinners." };

  const ratingsOpenUntil = new Date();
  ratingsOpenUntil.setDate(ratingsOpenUntil.getDate() + 7);

  const { error } = await supabase
    .from("dinners")
    .update({ status: "completed", ratings_open_until: ratingsOpenUntil.toISOString() })
    .eq("id", dinnerId);

  if (error) return { error: "Failed to mark dinner as completed." };

  sendOneOffRatingPromptEmails({ dinnerId, dinner });
  return {};
}

async function sendOneOffRatingPromptEmails({
  dinnerId,
  dinner,
}: {
  dinnerId: string;
  dinner: {
    title: string | null;
    winning_restaurant_place_id: string | null;
    reservation_datetime: string | null;
    target_date: string | null;
  };
}) {
  const supabase = await createClient();

  const [{ data: rsvps }, { data: restaurant }] = await Promise.all([
    supabase
      .from("rsvps")
      .select("users ( id, email, email_notifications )")
      .eq("dinner_id", dinnerId)
      .eq("status", "going"),
    dinner.winning_restaurant_place_id
      ? supabase.from("restaurant_cache").select("name").eq("place_id", dinner.winning_restaurant_place_id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!rsvps || !restaurant) return;

  const ratingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dinners/${dinnerId}`;
  const dinnerName = dinner.title ?? "Dinner";
  const dateIso = dinner.reservation_datetime ?? dinner.target_date;
  const dinnerDate = dateIso
    ? new Date(dateIso).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  type RsvpRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
  const eligible = (rsvps as RsvpRow[]).filter(
    (r) => r.users?.email && r.users.email_notifications?.rating_prompt !== false
  );

  await Promise.allSettled(
    eligible.map((r) =>
      sendRatingPrompt({
        to: r.users.email,
        restaurantName: restaurant.name,
        dinnerName,
        dinnerDate,
        ratingUrl,
        unsubscribeUrl: generateUnsubscribeUrl(r.users.id, "rating_prompt"),
      })
    )
  );
}

async function sendOneOffConfirmedEmails({
  dinnerId,
  dinner,
}: {
  dinnerId: string;
  dinner: {
    title: string | null;
    winning_restaurant_place_id: string | null;
    target_date: string | null;
  };
}) {
  const supabase = await createClient();

  const [{ data: rsvps }, { data: restaurant }] = await Promise.all([
    supabase
      .from("rsvps")
      .select("users ( id, email, email_notifications )")
      .eq("dinner_id", dinnerId)
      .eq("status", "going"),
    dinner.winning_restaurant_place_id
      ? supabase.from("restaurant_cache").select("name, address").eq("place_id", dinner.winning_restaurant_place_id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!rsvps?.length) return;

  const dinnerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dinners/${dinnerId}`;
  const restaurantName = restaurant?.name ?? "your dinner";
  const restaurantAddress = restaurant?.address ?? "";
  const dateIso = dinner.target_date;
  const dinnerDate = dateIso
    ? new Date(dateIso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "TBD";
  const dinnerTime = dateIso
    ? new Date(dateIso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "TBD";

  type RsvpRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
  const eligible = (rsvps as RsvpRow[]).filter(
    (r) => r.users?.email && r.users.email_notifications?.reservation_confirmed !== false
  );

  await Promise.allSettled(
    eligible.map((r) =>
      sendReservationConfirmed({
        to: r.users.email,
        restaurantName,
        restaurantAddress,
        dinnerDate,
        dinnerTime,
        partySize: eligible.length,
        dinnerUrl,
        unsubscribeUrl: generateUnsubscribeUrl(r.users.id, "reservation_confirmed"),
      })
    )
  );
}

async function sendOneOffCancellationEmails({
  dinnerId,
  dinner,
}: {
  dinnerId: string;
  dinner: { title: string | null };
}) {
  const supabase = await createClient();

  const { data: rsvps } = await supabase
    .from("rsvps")
    .select("users ( id, email, email_notifications )")
    .eq("dinner_id", dinnerId)
    .in("status", ["going", "maybe"]);

  if (!rsvps?.length) return;

  const dinnerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dinners/${dinnerId}`;
  const dinnerName = dinner.title ?? "Dinner";

  type RsvpRow = { users: { id: string; email: string; email_notifications: Record<string, boolean> | null } };
  const eligible = (rsvps as RsvpRow[]).filter(
    (r) => r.users?.email && r.users.email_notifications?.dinner_cancelled !== false
  );

  await Promise.allSettled(
    eligible.map((r) =>
      sendDinnerCancelled({
        to: r.users.email,
        clubName: "your group",
        dinnerName,
        clubUrl: dinnerUrl,
        unsubscribeUrl: generateUnsubscribeUrl(r.users.id, "dinner_cancelled"),
      })
    )
  );
}

export async function addDinnerComment({ dinnerId, body }: { dinnerId: string; body: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Access check: creator, cohost, club member, or RSVP guest (one-off)
  const { data: dinner } = await supabase
    .from("dinners")
    .select("created_by, club_id")
    .eq("id", dinnerId)
    .single();
  if (!dinner) return { error: "Dinner not found." };

  let hasAccess = dinner.created_by === user.id;

  if (!hasAccess) {
    const { data: cohostRow } = await supabase
      .from("dinner_cohosts")
      .select("id")
      .eq("dinner_id", dinnerId)
      .eq("user_id", user.id)
      .maybeSingle();
    hasAccess = !!cohostRow;
  }

  if (!hasAccess && dinner.club_id) {
    const { data: membership } = await supabase
      .from("club_members")
      .select("id")
      .eq("club_id", dinner.club_id)
      .eq("user_id", user.id)
      .maybeSingle();
    hasAccess = !!membership;
  }

  if (!hasAccess) {
    const { data: rsvp } = await supabase
      .from("rsvps")
      .select("id")
      .eq("dinner_id", dinnerId)
      .eq("user_id", user.id)
      .maybeSingle();
    hasAccess = !!rsvp;
  }

  if (!hasAccess) return { error: "You don't have access to this dinner." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("dinner_comments")
    .insert({ dinner_id: dinnerId, user_id: user.id, body: body.trim().slice(0, 100) });

  if (error) return { error: "Failed to post comment." };

  if (dinner.club_id) {
    revalidatePath(`/clubs/${dinner.club_id}/dinners/${dinnerId}`);
  } else {
    revalidatePath(`/dinners/${dinnerId}`);
  }
  return {};
}

export async function deleteDinnerComment({ commentId }: { commentId: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: comment } = await supabase
    .from("dinner_comments")
    .select("dinner_id, dinners ( club_id )")
    .eq("id", commentId)
    .eq("user_id", user.id)
    .single();

  const admin = createAdminClient();
  const { error } = await admin
    .from("dinner_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to delete comment." };

  if (comment) {
    const clubId = (comment.dinners as any)?.club_id;
    if (clubId) {
      revalidatePath(`/clubs/${clubId}/dinners/${comment.dinner_id}`);
    } else {
      revalidatePath(`/dinners/${comment.dinner_id}`);
    }
  }
  return {};
}

export async function confirmReservation({
  dinnerId,
  reservationDatetime,
  partySize,
  platform,
  confirmationNumber,
  winningPlaceId,
}: {
  dinnerId: string;
  reservationDatetime: string;
  partySize: number;
  platform: Platform | null;
  confirmationNumber: string | null;
  winningPlaceId: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: dinner } = await supabase
    .from("dinners")
    .select("club_id")
    .eq("id", dinnerId)
    .single();
  if (!dinner?.club_id) throw new Error("Dinner not found.");

  // Any club member can report the booking they made
  const { data: membership } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", dinner.club_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) throw new Error("Only club members can confirm a reservation.");

  const { error: updateError } = await supabase
    .from("dinners")
    .update({
      status: "confirmed",
      reservation_datetime: new Date(reservationDatetime).toISOString(),
      party_size: partySize,
      reservation_platform: platform,
      confirmation_number: confirmationNumber || null,
      reserved_by: user.id,
      ...(winningPlaceId ? { winning_restaurant_place_id: winningPlaceId } : {}),
    })
    .eq("id", dinnerId);

  if (updateError) throw new Error(updateError.message);

  // Fire emails in the background — don't block the response
  sendConfirmationEmails({ dinnerId, clubId: dinner.club_id, reservationDatetime, partySize, winningPlaceId });
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

export async function openVoting({ dinnerId }: { dinnerId: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: dinner } = await supabase
    .from("dinners")
    .select("created_by, club_id")
    .eq("id", dinnerId)
    .single();
  if (!dinner?.club_id) throw new Error("Dinner not found.");
  if (dinner.created_by !== user.id && !(await getIsCohost(dinnerId, user.id, supabase))) {
    throw new Error("Only the dinner host can open voting.");
  }

  const { error: updateError } = await supabase
    .from("dinners")
    .update({ voting_open: true })
    .eq("id", dinnerId);

  if (updateError) throw new Error(updateError.message);

  sendVotingOpenEmails({ dinnerId, clubId: dinner.club_id });
}

async function sendVotingOpenEmails({ dinnerId, clubId }: { dinnerId: string; clubId: string }) {
  const supabase = await createClient();

  const [{ data: dinner }, { data: club }, { data: members }, { data: options }] = await Promise.all([
    supabase.from("dinners").select("title, theme_cuisine, theme_neighborhood, theme_vibe").eq("id", dinnerId).single(),
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

export async function markCompleted({ dinnerId }: { dinnerId: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: dinner } = await supabase
    .from("dinners")
    .select("created_by, club_id")
    .eq("id", dinnerId)
    .single();
  if (!dinner?.club_id) throw new Error("Dinner not found.");
  if (dinner.created_by !== user.id && !(await getIsCohost(dinnerId, user.id, supabase))) {
    throw new Error("Only the dinner host can mark this dinner completed.");
  }

  const ratingsOpenUntil = new Date();
  ratingsOpenUntil.setDate(ratingsOpenUntil.getDate() + 7);

  const { error: updateError } = await supabase
    .from("dinners")
    .update({ status: "completed", ratings_open_until: ratingsOpenUntil.toISOString() })
    .eq("id", dinnerId);

  if (updateError) throw new Error(updateError.message);

  // TODO: cron — ideally fire rating prompt email 2 hours after dinner, not at mark-completed time
  sendRatingPromptEmails({ dinnerId, clubId: dinner.club_id });
}

async function sendRatingPromptEmails({ dinnerId, clubId }: { dinnerId: string; clubId: string }) {
  const supabase = await createClient();

  const { data: dinner } = await supabase
    .from("dinners")
    .select("winning_restaurant_place_id, reservation_datetime, title, theme_cuisine, theme_neighborhood, theme_vibe")
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

async function getIsCohost(dinnerId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.from("dinner_cohosts").select("id").eq("dinner_id", dinnerId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function addCohost({ dinnerId, userId }: { dinnerId: string; userId: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase.from("dinners").select("created_by").eq("id", dinnerId).single();
  if (!dinner || dinner.created_by !== user.id) return { error: "Only the dinner creator can add cohosts." };

  const { error } = await supabase.from("dinner_cohosts").insert({ dinner_id: dinnerId, user_id: userId, added_by: user.id });
  if (error) return { error: "Failed to add cohost." };
  return {};
}

export async function removeCohost({ dinnerId, userId }: { dinnerId: string; userId: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase.from("dinners").select("created_by").eq("id", dinnerId).single();
  if (!dinner || dinner.created_by !== user.id) return { error: "Only the dinner creator can remove cohosts." };

  const { error } = await supabase.from("dinner_cohosts").delete().eq("dinner_id", dinnerId).eq("user_id", userId);
  if (error) return { error: "Failed to remove cohost." };
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
  const cohost = await getIsCohost(dinnerId, user.id, supabase);
  if (dinner.created_by !== user.id && !cohost) return { error: "Only the dinner host can lock a date." };
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
  const cohost2 = await getIsCohost(dinnerId, user.id, supabase);
  if (dinner.created_by !== user.id && !cohost2) return { error: "Only the dinner host can pick the restaurant." };
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
    supabase.from("dinners").select("title, theme_cuisine, theme_neighborhood, theme_vibe").eq("id", dinnerId).single(),
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
    supabase.from("dinners").select("title, theme_cuisine, theme_neighborhood, theme_vibe, target_date").eq("id", dinnerId).single(),
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

export async function removeRsvp({ dinnerId, targetUserId }: { dinnerId: string; targetUserId: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("created_by")
    .eq("id", dinnerId)
    .single();
  if (!dinner) return { error: "Dinner not found." };

  const isCreator = dinner.created_by === user.id;
  const isCohost = await getIsCohost(dinnerId, user.id, supabase);
  if (!isCreator && !isCohost) return { error: "Only the dinner host can remove RSVPs." };

  const { error } = await supabase
    .from("rsvps")
    .delete()
    .eq("dinner_id", dinnerId)
    .eq("user_id", targetUserId);
  if (error) return { error: "Failed to remove RSVP." };
  return {};
}

export async function rsvpDinner({
  dinnerId,
  status,
  plus_ones,
}: {
  dinnerId: string;
  status: "going" | "not_going";
  plus_ones?: number;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("rsvps")
    .upsert(
      {
        dinner_id: dinnerId,
        user_id: user.id,
        status,
        ...(plus_ones !== undefined ? { plus_ones } : {}),
      },
      { onConflict: "dinner_id,user_id" }
    );
  if (error) return { error: "Failed to save RSVP." };
  return {};
}

// ─── Cancel dinner ────────────────────────────────────────────

export async function cancelDinner({ dinnerId }: { dinnerId: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: dinner } = await supabase
    .from("dinners")
    .select("club_id, created_by, title, theme_cuisine, theme_neighborhood, theme_vibe")
    .eq("id", dinnerId)
    .single();

  if (!dinner?.club_id) return { error: "Dinner not found." };

  // Club owners and the dinner creator can cancel
  if (dinner.created_by !== user.id) {
    const { data: membership } = await supabase
      .from("club_members")
      .select("role")
      .eq("club_id", dinner.club_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership?.role !== "owner") {
      return { error: "Only club owners or the dinner creator can cancel a dinner." };
    }
  }

  const { error: updateError } = await supabase
    .from("dinners")
    .update({ status: "cancelled" })
    .eq("id", dinnerId);

  if (updateError) return { error: updateError.message };

  sendCancellationEmails({ dinnerId, clubId: dinner.club_id, dinner });
  return {};
}

async function sendCancellationEmails({
  clubId,
  dinner,
}: {
  dinnerId: string;
  clubId: string;
  dinner: { title?: string | null; theme_cuisine?: string | null; theme_neighborhood?: string | null; theme_vibe?: string | null };
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

