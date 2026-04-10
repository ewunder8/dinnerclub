import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import NavUser from "@/components/NavUser";
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
import type { RestaurantCache, Vote, User, RSVP, ReservationAttempt } from "@/lib/supabase/database.types";
import SuggestRestaurant from "./SuggestRestaurant";
import PollOptionCard from "./PollOptionCard";
import OwnerControls from "./OwnerControls";
import CountdownView from "./CountdownView";
import RatingsForm from "./RatingsForm";
import ConfirmReservationForm from "./ConfirmReservationForm";
import ReservationAttempts from "./ReservationAttempts";
import CancelDinnerButton from "./CancelDinnerButton";
import MarkCompletedButton from "./MarkCompletedButton";
import DinnerComments from "./DinnerComments";
import type { DinnerComment } from "./DinnerComments";
import SharePollButton from "./SharePollButton";
import RefreshButton from "./RefreshButton";
import EditDinnerDetails from "./EditDinnerDetails";
import DinnerPlanningView from "./DinnerPlanningView";

// ─── Shared nav ──────────────────────────────────────────────
function Nav({
  clubId,
  title,
  name,
  email,
  avatarUrl,
}: {
  clubId: string;
  title?: string | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  return (
    <nav className="bg-slate px-6 py-4 flex items-center">
      <div className="flex-1">
        <a href={`/clubs/${clubId}`} className="text-white/60 hover:text-white transition-colors text-2xl font-light">‹</a>
      </div>
      <h1 className="font-sans text-base font-bold text-white truncate max-w-[180px] text-center">{title ?? "Dinner"}</h1>
      <div className="flex-1 flex justify-end">
        <NavUser name={name} email={email} avatarUrl={avatarUrl} />
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

  // Fetch membership + user profile in parallel
  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("club_members")
      .select("role, clubs ( name )")
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

  // ── Planning flow (date voting → restaurant voting → winner) ──
  const planningStage = dinner.planning_stage;
  const isCreator = dinner.created_by === user.id;

  const inPlanningFlow =
    (planningStage === "date_voting" || planningStage === "restaurant_voting") ||
    (planningStage === "winner" && dinner.status !== "completed" && !(dinner.status === "confirmed" && dinner.reservation_datetime));

  if (inPlanningFlow) {
    // Fetch availability poll linked to this dinner
    const { data: availPoll } = await supabase
      .from("availability_polls")
      .select("*")
      .eq("dinner_id", params.dinnerId)
      .maybeSingle();

    // Only enter planning flow if a linked poll exists (guards old dinners)
    if (availPoll) {
      const [
        { data: pollDates },
        { data: availResponses },
        { data: clubMembers },
        { count: memberCount },
        { data: rawOptions },
        { data: rawVotes },
        { data: rawRsvps },
        { data: rawAttempts },
        { data: clubData },
        { data: rawWishlist },
      ] = await Promise.all([
        supabase.from("availability_poll_dates").select("*").eq("poll_id", availPoll.id).order("proposed_date"),
        supabase.from("availability_responses").select("*").eq("poll_id", availPoll.id),
        supabase.from("club_members").select("user_id, users ( name, email, avatar_url )").eq("club_id", params.id),
        supabase.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", params.id),
        supabase.from("poll_options").select("*").eq("dinner_id", params.dinnerId).is("removed_at", null),
        supabase.from("votes").select("*").eq("dinner_id", params.dinnerId),
        supabase.from("rsvps").select("*, users ( id, name, email, avatar_url )").eq("dinner_id", params.dinnerId),
        supabase.from("reservation_attempts").select("*, users ( id, name, email, avatar_url )").eq("dinner_id", params.dinnerId).in("status", ["attempting", "waitlisted", "succeeded"]).order("created_at", { ascending: true }),
        supabase.from("clubs").select("city").eq("id", params.id).single(),
        supabase.from("club_wishlist").select("place_id").eq("club_id", params.id),
      ]);

      // Build restaurant map for poll options
      const opts = rawOptions ?? [];
      let restaurantMap: Record<string, RestaurantCache> = {};
      if (opts.length > 0) {
        const { data: restaurants } = await supabase
          .from("restaurant_cache")
          .select("*")
          .in("place_id", opts.map((o) => o.place_id));
        for (const r of restaurants ?? []) {
          restaurantMap[r.place_id] = r as RestaurantCache;
        }
      }

      const votesByOption: Record<string, Vote[]> = {};
      for (const v of rawVotes ?? []) {
        if (!votesByOption[v.option_id]) votesByOption[v.option_id] = [];
        votesByOption[v.option_id].push(v as Vote);
      }

      const mergedOptions = opts
        .filter((o) => restaurantMap[o.place_id])
        .map((o) => ({ ...o, votes: votesByOption[o.id] ?? [], restaurant_cache: restaurantMap[o.place_id] }));

      // Wishlist items not already in the poll
      const pollPlaceIds = new Set(opts.map((o) => o.place_id));
      const wishlistPlaceIds = (rawWishlist ?? []).map((w) => w.place_id).filter((id) => !pollPlaceIds.has(id));
      let wishlistForPoll: { place_id: string; name: string; address: string | null }[] = [];
      if (wishlistPlaceIds.length > 0) {
        const { data: wRestaurants } = await supabase
          .from("restaurant_cache")
          .select("place_id, name, address")
          .in("place_id", wishlistPlaceIds);
        wishlistForPoll = (wRestaurants ?? []).map((r) => ({ place_id: r.place_id, name: r.name, address: r.address }));
      }

      // Winner restaurant for stage 3
      let winnerRestaurant: RestaurantCache | null = null;
      if (dinner.winning_restaurant_place_id) {
        const { data: wr } = await supabase
          .from("restaurant_cache")
          .select("*")
          .eq("place_id", dinner.winning_restaurant_place_id)
          .single();
        winnerRestaurant = (wr as RestaurantCache) ?? null;
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

      return (
        <main className="min-h-screen bg-snow">
          <Nav clubId={params.id} title={(membership.clubs as any)?.name} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
          <div className="max-w-2xl mx-auto px-6 py-10">
            <DinnerPlanningView
              dinner={dinner}
              availPoll={availPoll}
              pollDates={(pollDates ?? []) as { id: string; proposed_date: string }[]}
              availResponses={(availResponses ?? []) as any[]}
              clubMembers={(clubMembers ?? []) as any[]}
              memberCount={memberCount ?? 0}
              mergedOptions={mergedOptions as any[]}
              rawVotes={(rawVotes ?? []) as Vote[]}
              rawRsvps={(rawRsvps ?? []) as (RSVP & { users: User })[]}
              rawAttempts={(rawAttempts ?? []) as (ReservationAttempt & { users: User })[]}
              winnerRestaurant={winnerRestaurant}
              userId={user.id}
              clubId={params.id}
              dinnerId={params.dinnerId}
              isCreator={isCreator}
              clubCity={(clubData as any)?.city ?? null}
              wishlistForPoll={wishlistForPoll}
              appUrl={appUrl}
            />
          </div>
        </main>
      );
    }
  }

  // ── Confirmed: show countdown view ───────────────────────────
  if (dinner.status === "confirmed" && dinner.reservation_datetime) {
    const [{ data: restaurant }, { data: rawRsvps }, { data: club }, { data: booker }, { data: rawComments }] = await Promise.all([
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
        .select("name, city")
        .eq("id", params.id)
        .single(),
      dinner.reserved_by
        ? supabase.from("users").select("name, email").eq("id", dinner.reserved_by).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("dinner_comments")
        .select("id, user_id, body, created_at, users ( name, email )")
        .eq("dinner_id", params.dinnerId)
        .order("created_at", { ascending: true }),
    ]);

    if (!restaurant) notFound();

    const rsvps = (rawRsvps ?? []) as (RSVP & { users: User })[];

    const comments: DinnerComment[] = (rawComments ?? []).map((c: any) => ({
      id: c.id,
      user_id: c.user_id,
      body: c.body,
      created_at: c.created_at,
      author_name: c.users?.name || c.users?.email?.split("@")[0] || "Member",
    }));

    return (
      <main className="min-h-screen bg-snow">
        <Nav clubId={params.id} title={(membership.clubs as any)?.name} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-5">
          <CountdownView
            dinner={dinner}
            restaurant={restaurant as RestaurantCache}
            rsvps={rsvps}
            userId={user.id}
            clubName={club?.name ?? ""}
            reservedByName={booker ? (booker.name || booker.email?.split("@")[0]) : null}
          />
          <DinnerComments dinnerId={params.dinnerId} userId={user.id} comments={comments} />
          {isOwner && (
            <div className="flex items-center justify-end gap-4">
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
        <Nav clubId={params.id} title={(membership.clubs as any)?.name} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
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
        <Nav clubId={params.id} title={(membership.clubs as any)?.name} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
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
            dinnerStatus="seeking_reservation"
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
        <Nav clubId={params.id} title={(membership.clubs as any)?.name} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
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
        <Nav clubId={params.id} title={(membership.clubs as any)?.name} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
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
            dinnerStatus="waitlisted"
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

  // ── Default: poll view ───────────────────────────────────────
  const [{ count: memberCount }, { data: rawOptions }, { data: rawVotes }, { data: memberProfiles }, { data: rawWishlist }, { data: clubData }] =
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
      supabase
        .from("club_members")
        .select("user_id, users ( name, email, dietary_restrictions, dietary_public )")
        .eq("club_id", params.id),
      supabase
        .from("club_wishlist")
        .select("place_id")
        .eq("club_id", params.id),
      supabase
        .from("clubs")
        .select("city")
        .eq("id", params.id)
        .single(),
    ]);

  // Aggregate public dietary restrictions across all members
  const dietarySet = new Set<string>();
  for (const m of memberProfiles ?? []) {
    const u = (m as any).users;
    if (u?.dietary_public && Array.isArray(u.dietary_restrictions)) {
      for (const r of u.dietary_restrictions) dietarySet.add(r);
    }
  }
  const dietaryRestrictions = Array.from(dietarySet);

  // Vote status — who has/hasn't voted
  const voterIds = new Set((rawVotes ?? []).map((v) => v.user_id));
  const voteStatus = (memberProfiles ?? []).map((m: any) => ({
    userId: m.user_id,
    name: m.users?.name || m.users?.email?.split("@")[0] || "Member",
    voted: voterIds.has(m.user_id),
  }));

  const opts = rawOptions ?? [];

  // Wishlist items not already in the poll
  const pollPlaceIds = new Set(opts.map((o) => o.place_id));
  const wishlistPlaceIds = (rawWishlist ?? []).map((w) => w.place_id).filter((id) => !pollPlaceIds.has(id));
  let wishlistForPoll: { place_id: string; name: string; address: string | null }[] = [];
  if (wishlistPlaceIds.length > 0) {
    const { data: wRestaurants } = await supabase
      .from("restaurant_cache")
      .select("place_id, name, address")
      .in("place_id", wishlistPlaceIds);
    wishlistForPoll = (wRestaurants ?? []).map((r) => ({ place_id: r.place_id, name: r.name, address: r.address }));
  }

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
      <Nav clubId={params.id} title={(membership.clubs as any)?.name} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />

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
          {isOwner && (
            <EditDinnerDetails
              dinnerId={params.dinnerId}
              initial={{
                cuisine: dinner.theme_cuisine ?? null,
                price: dinner.theme_price ?? null,
                vibe: dinner.theme_vibe ?? null,
                neighborhood: dinner.theme_neighborhood ?? null,
                targetDate: dinner.target_date ?? null,
                pollClosesAt: dinner.poll_closes_at ?? null,
              }}
            />
          )}
        </div>

        {/* Dietary restrictions banner */}
        {dietaryRestrictions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">Group dietary needs</p>
            <p className="text-sm text-amber-800">{dietaryRestrictions.join(" · ")}</p>
          </div>
        )}

        {/* Owner controls */}
        {isOwner && (
          <OwnerControls dinnerId={params.dinnerId} clubId={params.id} pollState={pollState} />
        )}

        {/* Vote status */}
        {pollState === "voting_open" && voteStatus.length > 0 && (
          <div className="bg-white border border-black/8 rounded-2xl px-5 py-4">
            <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-3">
              Voted · {voterIds.size}/{voteStatus.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {voteStatus.map((m) => (
                <span
                  key={m.userId}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                    m.voted
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-surface text-ink-muted border-black/10"
                  }`}
                >
                  {m.voted ? "✓" : "○"} {m.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Options list */}
        <section>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide">
                Suggest a restaurant
              </h3>
              <RefreshButton />
            </div>
            <SuggestRestaurant dinnerId={params.dinnerId} wishlist={wishlistForPoll} clubCity={(clubData as any)?.city ?? null} />
          </section>
        )}

        {/* Share poll */}
        <SharePollButton dinnerLabel={themeSummary ?? "our next dinner"} />

      </div>
    </main>
  );
}
