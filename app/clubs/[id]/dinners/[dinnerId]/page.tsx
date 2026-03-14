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

// ─── Shared nav ──────────────────────────────────────────────
function Nav({
  clubId,
  userEmail,
}: {
  clubId: string;
  userEmail: string;
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
      <div className="w-9 h-9 rounded-full bg-clay flex items-center justify-center text-white text-sm font-bold">
        {getInitials(userEmail)}
      </div>
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

  // Verify membership
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", params.id)
    .eq("user_id", user.id)
    .single();

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
    const [{ data: restaurant }, { data: rawRsvps }] = await Promise.all([
      supabase
        .from("restaurant_cache")
        .select("*")
        .eq("place_id", dinner.winning_restaurant_place_id ?? "")
        .single(),
      supabase
        .from("rsvps")
        .select("*, users ( id, name, email, avatar_url )")
        .eq("dinner_id", params.dinnerId),
    ]);

    if (!restaurant) notFound();

    const rsvps = (rawRsvps ?? []) as (RSVP & { users: User })[];

    return (
      <main className="min-h-screen bg-warm-white">
        <Nav clubId={params.id} userEmail={user.email || "?"} />
        <div className="max-w-2xl mx-auto px-6 py-10">
          <CountdownView
            dinner={dinner}
            restaurant={restaurant as RestaurantCache}
            rsvps={rsvps}
            userId={user.id}
          />
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
        <Nav clubId={params.id} userEmail={user.email || "?"} />
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
    const { data: restaurant } = await supabase
      .from("restaurant_cache")
      .select("*")
      .eq("place_id", dinner.winning_restaurant_place_id)
      .single();

    return (
      <main className="min-h-screen bg-warm-white">
        <Nav clubId={params.id} userEmail={user.email || "?"} />
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
            </div>
          )}

          {isOwner && (
            <div className="bg-charcoal/5 border border-charcoal/10 rounded-2xl p-5">
              <p className="text-sm font-semibold text-charcoal mb-1">Got a reservation?</p>
              <p className="text-xs text-mid">
                Confirm it in the dinner settings to unlock the countdown view for the group.
              </p>
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
      <Nav clubId={params.id} userEmail={user.email || "?"} />

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
          <OwnerControls dinnerId={params.dinnerId} pollState={pollState} />
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
