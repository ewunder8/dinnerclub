import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
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
  name,
  email,
  avatarUrl,
}: {
  clubId: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  return (
    <nav className="bg-slate px-8 py-5 flex items-center justify-between">
      <a
        href={`/clubs/${clubId}`}
        className="text-white/60 hover:text-white transition-colors text-sm"
      >
        ← Club
      </a>
      <h1 className="font-sans text-xl font-extrabold text-white">
        dinner<span className="text-citrus">club</span>
      </h1>
      <a href="/profile" title="Profile & sign out">
        <UserAvatar name={name} email={email} avatarUrl={avatarUrl} />
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
    supabase.from("users").select("name, avatar_url").eq("id", user.id).single(),
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

  // Auto-close poll if deadline passed and voting is still open
  if (dinner.voting_open && dinner.poll_closes_at && new Date(dinner.poll_closes_at) <= new Date()) {
    await supabase.from("dinners").update({ voting_open: false }).eq("id", dinner.id);
    dinner.voting_open = false;
  }

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
      <main className="min-h-screen bg-snow">
        <Nav clubId={params.id} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
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
              <MarkCompletedButton dinnerId={params.dinnerId} clubId={params.id} />
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
      <main className="min-h-screen bg-snow">
        <Nav clubId={params.id} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="mb-6">
            <span className="inline-block text-xs font-semibold text-ink-muted uppercase tracking-wide bg-black/5 px-3 py-1 rounded-full mb-3">
              Dinner completed
            </span>
            <h2 className="font-sans text-3xl font-bold text-ink">How was it?</h2>
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
    const [{ data: restaurant }, { data: rawAttempts }, { data: rawOptions }, { data: rawVotes }] = await Promise.all([
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
      supabase
        .from("poll_options")
        .select("id, place_id")
        .eq("dinner_id", params.dinnerId)
        .is("removed_at", null),
      supabase
        .from("votes")
        .select("option_id, user_id")
        .eq("dinner_id", params.dinnerId),
    ]);

    // Count distinct voters for party size hint
    const voterCount = new Set((rawVotes ?? []).map((v) => v.user_id)).size;

    // Compute top 3 alternatives (by vote count, excluding #1 winner)
    const voteCounts: Record<string, number> = {};
    for (const v of rawVotes ?? []) {
      voteCounts[v.option_id] = (voteCounts[v.option_id] ?? 0) + 1;
    }
    const sortedOptions = (rawOptions ?? [])
      .filter((o) => o.place_id !== dinner.winning_restaurant_place_id)
      .sort((a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0))
      .slice(0, 2); // top 2 fallbacks (#2 and #3)

    let fallbackRestaurants: { place_id: string; name: string }[] = [];
    if (sortedOptions.length > 0) {
      const { data: fallbackData } = await supabase
        .from("restaurant_cache")
        .select("place_id, name")
        .in("place_id", sortedOptions.map((o) => o.place_id));
      fallbackRestaurants = (fallbackData ?? []).map((r) => ({ place_id: r.place_id, name: r.name }));
      // preserve vote-order
      fallbackRestaurants.sort(
        (a, b) =>
          sortedOptions.findIndex((o) => o.place_id === a.place_id) -
          sortedOptions.findIndex((o) => o.place_id === b.place_id)
      );
    }

    const topOptions = [
      ...(restaurant ? [{ place_id: restaurant.place_id, name: restaurant.name }] : []),
      ...fallbackRestaurants,
    ];

    return (
      <main className="min-h-screen bg-snow">
        <Nav clubId={params.id} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
          <div>
            <span className="inline-block text-xs font-semibold text-ink-muted uppercase tracking-wide bg-black/5 px-3 py-1 rounded-full mb-3">
              Time to book
            </span>
            <h2 className="font-sans text-3xl font-bold text-ink">Seeking reservation</h2>
            <p className="text-ink-muted text-sm mt-2">
              Someone needs to book a table. First to confirm wins!
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
              {dinner.target_date && (
                <p className="text-sm text-ink">
                  🗓️{" "}
                  <span className="font-semibold">
                    {new Date(dinner.target_date).toLocaleDateString("en-US", {
                      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                </p>
              )}
              {voterCount > 0 && (
                <p className="text-sm text-ink">
                  🪑 <span className="font-semibold">{voterCount} people</span> voted
                </p>
              )}
            </div>
          </div>

          {/* Top picks */}
          <div className="bg-white border border-black/8 rounded-2xl divide-y divide-black/5">
            {topOptions.map((opt, i) => (
              <div key={opt.place_id} className="p-5">
                <div className="flex items-center gap-4">
                  <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-citrus text-ink" : "bg-black/5 text-ink-muted"}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${i === 0 ? "text-ink" : "text-ink-muted"}`}>
                      {opt.name}
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">{i === 0 ? "Top pick" : "Fallback"}</p>
                  </div>
                </div>
                {i === 0 && (
                  <div className="flex gap-3 mt-3 ml-11">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opt.name)}&query_place_id=${opt.place_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-ink-muted hover:text-ink border border-black/10 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      Google Maps →
                    </a>
                    {restaurant?.beli_url && (
                      <a
                        href={restaurant.beli_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-citrus-dark border border-citrus/30 rounded-lg px-3 py-1.5 hover:bg-citrus/5 transition-colors"
                      >
                        Beli →
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <ReservationAttempts
            dinnerId={params.dinnerId}
            clubId={params.id}
            userId={user.id}
            attempts={(rawAttempts ?? []) as Parameters<typeof ReservationAttempts>[0]["attempts"]}
            topOptions={topOptions}
          />

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
      <main className="min-h-screen bg-snow">
        <Nav clubId={params.id} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="text-4xl mb-4">🚫</p>
          <h2 className="font-sans text-2xl font-bold text-ink mb-2">Dinner cancelled</h2>
          <p className="text-ink-muted text-sm">This dinner was cancelled. Start a new one whenever you&apos;re ready.</p>
          <a
            href={`/clubs/${params.id}`}
            className="inline-block mt-8 bg-slate text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-light transition-colors"
          >
            Back to club
          </a>
        </div>
      </main>
    );
  }

  // ── Waitlisted ───────────────────────────────────────────────
  if (dinner.status === "waitlisted" && dinner.winning_restaurant_place_id) {
    const [{ data: restaurant }, { data: rawAttempts }, { data: rawOptions }, { data: rawVotes }] = await Promise.all([
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
      supabase
        .from("poll_options")
        .select("id, place_id")
        .eq("dinner_id", params.dinnerId)
        .is("removed_at", null),
      supabase
        .from("votes")
        .select("option_id")
        .eq("dinner_id", params.dinnerId),
    ]);

    // Compute top 3 alternatives (by vote count, excluding #1 winner)
    const waitlistVoteCounts: Record<string, number> = {};
    for (const v of rawVotes ?? []) {
      waitlistVoteCounts[v.option_id] = (waitlistVoteCounts[v.option_id] ?? 0) + 1;
    }
    const waitlistSortedOptions = (rawOptions ?? [])
      .filter((o) => o.place_id !== dinner.winning_restaurant_place_id)
      .sort((a, b) => (waitlistVoteCounts[b.id] ?? 0) - (waitlistVoteCounts[a.id] ?? 0))
      .slice(0, 2);

    let waitlistFallbacks: { place_id: string; name: string }[] = [];
    if (waitlistSortedOptions.length > 0) {
      const { data: fallbackData } = await supabase
        .from("restaurant_cache")
        .select("place_id, name")
        .in("place_id", waitlistSortedOptions.map((o) => o.place_id));
      waitlistFallbacks = (fallbackData ?? []).map((r) => ({ place_id: r.place_id, name: r.name }));
      waitlistFallbacks.sort(
        (a, b) =>
          waitlistSortedOptions.findIndex((o) => o.place_id === a.place_id) -
          waitlistSortedOptions.findIndex((o) => o.place_id === b.place_id)
      );
    }

    const waitlistTopOptions = [
      ...(restaurant ? [{ place_id: restaurant.place_id, name: restaurant.name }] : []),
      ...waitlistFallbacks,
    ];

    return (
      <main className="min-h-screen bg-snow">
        <Nav clubId={params.id} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
          <div>
            <span className="inline-block text-xs font-semibold text-ink-muted uppercase tracking-wide bg-black/5 px-3 py-1 rounded-full mb-3">
              On the waitlist
            </span>
            <h2 className="font-sans text-3xl font-bold text-ink">Fingers crossed 🤞</h2>
            <p className="text-ink-muted text-sm mt-2">
              You&apos;re on the waitlist. Someone will confirm as soon as a table opens up.
            </p>
          </div>

          {restaurant && (
            <div className="bg-white border border-black/8 rounded-2xl p-5">
              <p className="text-xs text-ink-muted mb-1">Waiting on a table at</p>
              <p className="font-sans text-xl font-bold text-ink">{restaurant.name}</p>
              {restaurant.address && (
                <p className="text-sm text-ink-muted mt-1">{restaurant.address}</p>
              )}
              {restaurant.beli_url && (
                <a
                  href={restaurant.beli_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-citrus-dark mt-2 hover:underline"
                >
                  View on Beli →
                </a>
              )}
            </div>
          )}

          <ReservationAttempts
            dinnerId={params.dinnerId}
            clubId={params.id}
            userId={user.id}
            attempts={(rawAttempts ?? []) as Parameters<typeof ReservationAttempts>[0]["attempts"]}
            topOptions={waitlistTopOptions}
          />

          {isOwner && <ConfirmReservationForm dinnerId={params.dinnerId} clubId={params.id} userId={user.id} topOptions={waitlistTopOptions} />}
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

  const targetDateLabel = dinner.target_date
    ? new Date(dinner.target_date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="min-h-screen bg-snow">
      <Nav clubId={params.id} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />

      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Header */}
        <div>
          <span className="inline-block text-xs font-semibold text-ink-muted uppercase tracking-wide bg-black/5 px-3 py-1 rounded-full mb-3">
            {getPollStateLabel(pollState)}
          </span>
          <h2 className="font-sans text-3xl font-bold text-ink">Dinner poll</h2>
          {themeSummary && (
            <p className="text-ink-muted text-sm mt-2">{themeSummary}</p>
          )}
          {targetDateLabel && (
            <p className="text-sm text-ink mt-2">🗓️ Aiming for {targetDateLabel}</p>
          )}
          {pollCloseLabel && (
            <p className="text-xs text-ink-muted mt-1">Poll closes {pollCloseLabel}</p>
          )}
        </div>

        {/* Owner controls */}
        {isOwner && (
          <OwnerControls dinnerId={params.dinnerId} clubId={params.id} pollState={pollState} />
        )}

        {/* Options list */}
        <section>
          <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide mb-4">
            Options · {activeOptionCount}
          </h3>

          {ranked.length === 0 ? (
            <div className="border-2 border-dashed border-slate/20 rounded-2xl p-10 text-center">
              <p className="text-3xl mb-3">🍽️</p>
              <p className="font-semibold text-ink mb-1">No suggestions yet</p>
              <p className="text-ink-muted text-sm">
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
                  showRemove={showRemove || (!dinner.voting_open && !dinner.winning_restaurant_place_id && opt.suggested_by === user.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Suggest a restaurant */}
        {showSuggest && (
          <section>
            <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide mb-4">
              Suggest a restaurant
            </h3>
            <SuggestRestaurant dinnerId={params.dinnerId} />
          </section>
        )}

      </div>
    </main>
  );
}
