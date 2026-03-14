import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getInitials } from "@/lib/utils";
import {
  getPollState,
  getPollStateLabel,
  rankOptions,
  getUserVote,
  formatThemeSummary,
  canSuggest,
  canRemoveSuggestion,
} from "@/lib/poll";
import { isRatingWindowOpen } from "@/lib/countdown";
import type { RestaurantCache, Vote, User, RSVP } from "@/lib/supabase/database.types";
import SuggestRestaurant from "./SuggestRestaurant";
import PollOptionCard from "./PollOptionCard";
import OwnerControls from "./OwnerControls";
import CountdownView from "./CountdownView";
import RatingsForm from "./RatingsForm";
import ConfirmReservationForm from "./ConfirmReservationForm";
import ReservationAttempts from "./ReservationAttempts";
import CancelDinnerButton from "./CancelDinnerButton";
import MarkCompletedButton from "./MarkCompletedButton";

// ─── Shared nav ──────────────────────────────────────────────
function Nav({
  clubId,
  displayName,
}: {
  clubId: string;
  displayName: string;
}) {
  return (
    <nav className="bg-charcoal px-8 py-5 flex items-center justify-between">
      <a
        href={`/clubs/${clubId}`}
        className="text-cream/50 hover:text-cream transition-colors text-sm"
      >
        ← Club
      </a>
      <h1 className="font-serif text-xl font-black text-cream">
        Dinner<span className="text-clay">Club</span>
      </h1>
      <a
        href="/profile"
        title="Profile & sign out"
        className="w-9 h-9 rounded-full bg-clay flex items-center justify-center text-white text-sm font-bold hover:bg-clay-dark transition-colors"
      >
        {getInitials(displayName)}
      </a>
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default async function DinnerPage({
  params,
}: {
  params: { id: string; dinnerId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch membership + user profile in parallel
  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("club_members")
      .select("role")
      .eq("club_id", params.id)
      .eq("user_id", user.id)
      .single(),
    supabase.from("users").select("name").eq("id", user.id).single(),
  ]);

  const displayName = profile?.name || user.email || "?";

  if (!membership) notFound();

  const isOwner = membership.role === "owner";

  // Fetch dinner
  const { data: dinner } = await supabase
    .from("dinners")
    .select("*")
    .eq("id", params.dinnerId)
    .eq("club_id", params.id)
    .single();

  if (!dinner) notFound();

  // ── Confirmed: show countdown view ───────────────────────────
  if (dinner.status === "confirmed" && dinner.reservation_datetime) {
    const [{ data: restaurant }, { data: rawRsvps }, { data: club }, { data: booker }] = await Promise.all([
      supabase
        .from("restaurant_cache")
        .select("*")
        .eq("place_id", dinner.winning_restaurant_place_id ?? "")
        .single(),
      supabase
        .from("rsvps")
        .select("*, users ( id, name, email, avatar_url )")
        .eq("dinner_id", params.dinnerId),
      supabase
        .from("clubs")
        .select("name")
        .eq("id", params.id)
        .single(),
      dinner.reserved_by
        ? supabase.from("users").select("name, email").eq("id", dinner.reserved_by).single()
        : Promise.resolve({ data: null }),
    ]);

    if (!restaurant) notFound();

    const rsvps = (rawRsvps ?? []) as (RSVP & { users: User })[];

    return (
      <main className="min-h-screen bg-warm-white">
        <Nav clubId={params.id} displayName={displayName} />
        <div className="max-w-2xl mx-auto px-6 py-10">
          <CountdownView
            dinner={dinner}
            restaurant={restaurant as RestaurantCache}
            rsvps={rsvps}
            userId={user.id}
            clubName={club?.name ?? ""}
            reservedByName={booker ? (booker.name || booker.email?.split("@")[0]) : null}
          />
          {isOwner && (
            <div className="flex items-center justify-end gap-4 mt-6">
              <MarkCompletedButton dinnerId={params.dinnerId} />
              <CancelDinnerButton dinnerId={params.dinnerId} clubId={params.id} />
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── Completed: show ratings view ─────────────────────────────
  if (dinner.status === "completed") {
    const placeId = dinner.winning_restaurant_place_id ?? "";
    const [
      { data: restaurant },
      { data: existingRating },
      { data: summary },
    ] = await Promise.all([
      supabase
        .from("restaurant_cache")
        .select("*")
        .eq("place_id", placeId)
        .single(),
      supabase
        .from("dinner_ratings")
        .select("*")
        .eq("dinner_id", params.dinnerId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("dinner_rating_summaries")
        .select("*")
        .eq("dinner_id", params.dinnerId)
        .maybeSingle(),
    ]);

    const windowOpen = isRatingWindowOpen(dinner.ratings_open_until);

    return (
      <main className="min-h-screen bg-warm-white">
        <Nav clubId={params.id} displayName={displayName} />
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="mb-6">
            <span className="inline-block text-xs font-semibold text-mid uppercase tracking-wide bg-black/5 px-3 py-1 rounded-full mb-3">
              Dinner completed
            </span>
            <h2 className="font-serif text-3xl font-bold">How was it?</h2>
          </div>
          <RatingsForm
            dinner={dinner}
            restaurant={restaurant as RestaurantCache}
            userId={user.id}
            existingRating={existingRating ?? null}
            summary={summary ?? null}
            ratingWindowOpen={windowOpen}
          />
        </div>
      </main>
    );
  }

  // ── Seeking reservation: winner picked, no reservation yet ───
  if (dinner.status === "seeking_reservation" && dinner.winning_restaurant_place_id) {
    const [{ data: restaurant }, { data: rawAttempts }] = await Promise.all([
      supabase
        .from("restaurant_cache")
        .select("*")
        .eq("place_id", dinner.winning_restaurant_place_id)
        .single(),
      supabase
        .from("reservation_attempts")
        .select("*, users ( id, name, email, avatar_url )")
        .eq("dinner_id", params.dinnerId)
        .in("status", ["attempting", "succeeded"])
        .order("created_at", { ascending: true }),
    ]);

    return (
      <main className="min-h-screen bg-warm-white">
        <Nav clubId={params.id} displayName={displayName} />
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
          <div>
            <span className="inline-block text-xs font-semibold text-mid uppercase tracking-wide bg-black/5 px-3 py-1 rounded-full mb-3">
              Winner selected
            </span>
            <h2 className="font-serif text-3xl font-bold">Seeking reservation</h2>
            <p className="text-mid text-sm mt-2">
              Someone needs to lock in a table. First to confirm wins!
            </p>
          </div>

          {restaurant && (
            <div className="bg-white border border-black/8 rounded-2xl p-5">
              <p className="text-xs text-mid mb-1">You&apos;re going to</p>
              <p className="font-serif text-xl font-bold text-charcoal">
                {restaurant.name}
              </p>
              {restaurant.address && (
                <p className="text-sm text-mid mt-1">{restaurant.address}</p>
              )}
              {restaurant.beli_url && (
                <a
                  href={restaurant.beli_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-clay mt-2 hover:underline"
                >
                  View on Beli →
                </a>
              )}
            </div>
          )}

          <ReservationAttempts
            dinnerId={params.dinnerId}
            userId={user.id}
            attempts={(rawAttempts ?? []) as Parameters<typeof ReservationAttempts>[0]["attempts"]}
          />

          {isOwner && (
            <ConfirmReservationForm dinnerId={params.dinnerId} userId={user.id} />
          )}
          {isOwner && (
            <div className="flex justify-end">
              <CancelDinnerButton dinnerId={params.dinnerId} clubId={params.id} />
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── Cancelled ────────────────────────────────────────────────
  if (dinner.status === "cancelled") {
    return (
      <main className="min-h-screen bg-warm-white">
        <Nav clubId={params.id} displayName={displayName} />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="text-4xl mb-4">🚫</p>
          <h2 className="font-serif text-2xl font-bold text-charcoal mb-2">Dinner cancelled</h2>
          <p className="text-mid text-sm">This dinner was cancelled. Start a new one whenever you&apos;re ready.</p>
          <a
            href={`/clubs/${params.id}`}
            className="inline-block mt-8 bg-clay text-white font-bold py-3 px-6 rounded-xl hover:bg-clay-dark transition-colors"
          >
            Back to club
          </a>
        </div>
      </main>
    );
  }

  // ── Waitlisted ───────────────────────────────────────────────
  if (dinner.status === "waitlisted" && dinner.winning_restaurant_place_id) {
    const [{ data: restaurant }, { data: rawAttempts }] = await Promise.all([
      supabase
        .from("restaurant_cache")
        .select("*")
        .eq("place_id", dinner.winning_restaurant_place_id)
        .single(),
      supabase
        .from("reservation_attempts")
        .select("*, users ( id, name, email, avatar_url )")
        .eq("dinner_id", params.dinnerId)
        .in("status", ["attempting", "waitlisted", "succeeded"])
        .order("created_at", { ascending: true }),
    ]);

    return (
      <main className="min-h-screen bg-warm-white">
        <Nav clubId={params.id} displayName={displayName} />
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
          <div>
            <span className="inline-block text-xs font-semibold text-mid uppercase tracking-wide bg-black/5 px-3 py-1 rounded-full mb-3">
              On the waitlist
            </span>
            <h2 className="font-serif text-3xl font-bold">Fingers crossed 🤞</h2>
            <p className="text-mid text-sm mt-2">
              You&apos;re on the waitlist. Someone will confirm as soon as a table opens up.
            </p>
          </div>

          {restaurant && (
            <div className="bg-white border border-black/8 rounded-2xl p-5">
              <p className="text-xs text-mid mb-1">Waiting on a table at</p>
              <p className="font-serif text-xl font-bold text-charcoal">{restaurant.name}</p>
              {restaurant.address && (
                <p className="text-sm text-mid mt-1">{restaurant.address}</p>
              )}
              {restaurant.beli_url && (
                <a
                  href={restaurant.beli_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-clay mt-2 hover:underline"
                >
                  View on Beli →
                </a>
              )}
            </div>
          )}

          <ReservationAttempts
            dinnerId={params.dinnerId}
            userId={user.id}
            attempts={(rawAttempts ?? []) as Parameters<typeof ReservationAttempts>[0]["attempts"]}
          />

          {isOwner && <ConfirmReservationForm dinnerId={params.dinnerId} />}
          {isOwner && (
            <div className="flex justify-end">
              <CancelDinnerButton dinnerId={params.dinnerId} clubId={params.id} />
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── Default: poll view ───────────────────────────────────────
  const [{ count: memberCount }, { data: rawOptions }, { data: rawVotes }] =
    await Promise.all([
      supabase
        .from("club_members")
        .select("*", { count: "exact", head: true })
        .eq("club_id", params.id),
      supabase
        .from("poll_options")
        .select("*")
        .eq("dinner_id", params.dinnerId)
        .is("removed_at", null),
      supabase
        .from("votes")
        .select("*")
        .eq("dinner_id", params.dinnerId),
    ]);

  const opts = rawOptions ?? [];

  // Group votes by option_id
  const votesByOption: Record<string, Vote[]> = {};
  for (const v of rawVotes ?? []) {
    if (!votesByOption[v.option_id]) votesByOption[v.option_id] = [];
    votesByOption[v.option_id].push(v as Vote);
  }

  // Fetch restaurant_cache for all option place_ids
  let restaurantMap: Record<string, RestaurantCache> = {};
  if (opts.length > 0) {
    const placeIds = opts.map((o) => o.place_id);
    const { data: restaurants } = await supabase
      .from("restaurant_cache")
      .select("*")
      .in("place_id", placeIds);

    for (const r of restaurants ?? []) {
      restaurantMap[r.place_id] = r as RestaurantCache;
    }
  }

  const mergedOptions = opts
    .filter((o) => restaurantMap[o.place_id])
    .map((o) => ({
      ...o,
      votes: votesByOption[o.id] ?? [],
      restaurant_cache: restaurantMap[o.place_id],
    }));

  const activeOptionCount = mergedOptions.length;
  const pollState = getPollState(dinner, activeOptionCount);
  const ranked = rankOptions(mergedOptions, memberCount ?? 0);
  const myVote = getUserVote(mergedOptions, user.id);
  const themeSummary = formatThemeSummary(dinner);
  const showSuggest = canSuggest(dinner, isOwner, activeOptionCount);
  const showRemove = canRemoveSuggestion(dinner, isOwner);

  const pollCloseLabel =
    dinner.poll_closes_at && pollState === "voting_open"
      ? new Date(dinner.poll_closes_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  return (
    <main className="min-h-screen bg-warm-white">
      <Nav clubId={params.id} displayName={displayName} />

      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Header */}
        <div>
          <span className="inline-block text-xs font-semibold text-mid uppercase tracking-wide bg-black/5 px-3 py-1 rounded-full mb-3">
            {getPollStateLabel(pollState)}
          </span>
          <h2 className="font-serif text-3xl font-bold">Dinner poll</h2>
          {themeSummary && (
            <p className="text-mid text-sm mt-2">{themeSummary}</p>
          )}
          {pollCloseLabel && (
            <p className="text-xs text-mid mt-1">Closes {pollCloseLabel}</p>
          )}
        </div>

        {/* Owner controls */}
        {isOwner && (
          <OwnerControls dinnerId={params.dinnerId} clubId={params.id} pollState={pollState} />
        )}

        {/* Options list */}
        <section>
          <h3 className="font-semibold text-sm text-mid uppercase tracking-wide mb-4">
            Options · {activeOptionCount}
          </h3>

          {ranked.length === 0 ? (
            <div className="border-2 border-dashed border-clay/20 rounded-2xl p-10 text-center">
              <p className="text-3xl mb-3">🍽️</p>
              <p className="font-semibold text-charcoal mb-1">No suggestions yet</p>
              <p className="text-mid text-sm">
                {showSuggest
                  ? "Search below to add the first restaurant."
                  : "Waiting for suggestions from the group."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {ranked.map((opt) => (
                <PollOptionCard
                  key={opt.id}
                  option={opt}
                  pollState={pollState}
                  myVoteOptionId={myVote?.id ?? null}
                  userId={user.id}
                  isOwner={isOwner}
                  dinnerId={params.dinnerId}
                  showRemove={showRemove}
                />
              ))}
            </div>
          )}
        </section>

        {/* Suggest a restaurant */}
        {showSuggest && (
          <section>
            <h3 className="font-semibold text-sm text-mid uppercase tracking-wide mb-4">
              Suggest a restaurant
            </h3>
            <SuggestRestaurant dinnerId={params.dinnerId} />
          </section>
        )}

      </div>
    </main>
  );
}
