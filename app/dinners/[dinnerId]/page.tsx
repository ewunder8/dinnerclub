import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import NavUser from "@/components/NavUser";
import Link from "next/link";
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
import SuggestRestaurant from "@/app/clubs/[id]/dinners/[dinnerId]/SuggestRestaurant";
import PollOptionCard from "@/app/clubs/[id]/dinners/[dinnerId]/PollOptionCard";
import OwnerControls from "@/app/clubs/[id]/dinners/[dinnerId]/OwnerControls";
import CountdownView from "@/app/clubs/[id]/dinners/[dinnerId]/CountdownView";
import RatingsForm from "@/app/clubs/[id]/dinners/[dinnerId]/RatingsForm";
import ConfirmReservationForm from "@/app/clubs/[id]/dinners/[dinnerId]/ConfirmReservationForm";
import ReservationAttempts from "@/app/clubs/[id]/dinners/[dinnerId]/ReservationAttempts";
import CancelDinnerButton from "@/app/clubs/[id]/dinners/[dinnerId]/CancelDinnerButton";
import MarkCompletedButton from "@/app/clubs/[id]/dinners/[dinnerId]/MarkCompletedButton";
import DinnerComments from "@/app/clubs/[id]/dinners/[dinnerId]/DinnerComments";
import type { DinnerComment } from "@/app/clubs/[id]/dinners/[dinnerId]/DinnerComments";
import DinnerPlanningView from "@/app/clubs/[id]/dinners/[dinnerId]/DinnerPlanningView";
import ShareInviteLink from "./ShareInviteLink";

function Nav({
  title,
  name,
  email,
  avatarUrl,
}: {
  title?: string | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  return (
    <nav className="bg-slate px-6 py-4 flex items-center">
      <div className="flex-1">
        <Link href="/dashboard" className="text-white/60 hover:text-white transition-colors text-2xl font-light">‹</Link>
      </div>
      <h1 className="font-sans text-base font-bold text-white truncate max-w-[180px] text-center">{title ?? "Dinner"}</h1>
      <div className="flex-1 flex justify-end">
        <NavUser name={name} email={email} avatarUrl={avatarUrl} />
      </div>
    </nav>
  );
}

export default async function OneOffDinnerPage({
  params,
}: {
  params: { dinnerId: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single();

  // Fetch the one-off dinner (club_id IS NULL)
  const { data: dinner } = await supabase
    .from("dinners")
    .select("*")
    .eq("id", params.dinnerId)
    .is("club_id", null)
    .single();

  if (!dinner) notFound();

  // Access check: must be creator or have an RSVP
  const isCreator = dinner.created_by === user.id;
  if (!isCreator) {
    const { data: rsvp } = await supabase
      .from("rsvps")
      .select("user_id")
      .eq("dinner_id", params.dinnerId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!rsvp) {
      // Look up active invite link so they can be redirected to join
      const { data: inviteLink } = await supabase
        .from("invite_links")
        .select("token")
        .eq("dinner_id", params.dinnerId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inviteLink) {
        redirect(`/dinners/join/${inviteLink.token}`);
      }
      notFound();
    }
  }

  // Auto-close poll if deadline passed
  if (dinner.voting_open && dinner.poll_closes_at && new Date(dinner.poll_closes_at) <= new Date()) {
    await supabase.from("dinners").update({ voting_open: false }).eq("id", dinner.id);
    dinner.voting_open = false;
  }

  const dinnerTitle = dinner.title ?? "Dinner";

  // ── Planning flow ──────────────────────────────────────────────
  const planningStage = dinner.planning_stage;

  const inPlanningFlow =
    planningStage === "restaurant_voting" ||
    (planningStage === "winner" && dinner.status !== "completed" && !(dinner.status === "confirmed" && dinner.reservation_datetime));

  if (inPlanningFlow) {
    const [
      { data: rawOptions },
      { data: rawVotes },
      { data: rawRsvps },
      { data: rawAttempts },
    ] = await Promise.all([
      supabase.from("poll_options").select("*").eq("dinner_id", params.dinnerId).is("removed_at", null),
      supabase.from("votes").select("*").eq("dinner_id", params.dinnerId),
      supabase.from("rsvps").select("*, users ( id, name, email, avatar_url )").eq("dinner_id", params.dinnerId),
      supabase.from("reservation_attempts")
        .select("*, users ( id, name, email, avatar_url )")
        .eq("dinner_id", params.dinnerId)
        .in("status", ["attempting", "waitlisted", "succeeded"])
        .order("created_at", { ascending: true }),
    ]);

    const opts = rawOptions ?? [];
    let restaurantMap: Record<string, RestaurantCache> = {};
    if (opts.length > 0) {
      const { data: restaurants } = await supabase
        .from("restaurant_cache")
        .select("*")
        .in("place_id", opts.map((o) => o.place_id));
      for (const r of restaurants ?? []) restaurantMap[r.place_id] = r as RestaurantCache;
    }

    const votesByOption: Record<string, Vote[]> = {};
    for (const v of rawVotes ?? []) {
      if (!votesByOption[v.option_id]) votesByOption[v.option_id] = [];
      votesByOption[v.option_id].push(v as Vote);
    }

    const mergedOptions = opts
      .filter((o) => restaurantMap[o.place_id])
      .map((o) => ({ ...o, votes: votesByOption[o.id] ?? [], restaurant_cache: restaurantMap[o.place_id] }));

    let winnerRestaurant: RestaurantCache | null = null;
    if (dinner.winning_restaurant_place_id) {
      const { data: wr } = await supabase
        .from("restaurant_cache")
        .select("*")
        .eq("place_id", dinner.winning_restaurant_place_id)
        .single();
      winnerRestaurant = (wr as RestaurantCache) ?? null;
    }

    // Fetch invite link for creator to share
    let inviteToken: string | null = null;
    if (isCreator) {
      const { data: inviteLink } = await supabase
        .from("invite_links")
        .select("token")
        .eq("dinner_id", params.dinnerId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      inviteToken = inviteLink?.token ?? null;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    return (
      <main className="min-h-screen bg-snow">
        <Nav title={dinnerTitle} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10">
          {/* Invite link banner for creator */}
          {isCreator && inviteToken && (
            <ShareInviteLink link={`${appUrl}/dinners/join/${inviteToken}`} />
          )}
          <DinnerPlanningView
            dinner={dinner}
            availPoll={null}
            pollDates={[]}
            availResponses={[]}
            clubMembers={[]}
            memberCount={(rawRsvps ?? []).length || 1}
            mergedOptions={mergedOptions as any[]}
            rawVotes={(rawVotes ?? []) as Vote[]}
            rawRsvps={(rawRsvps ?? []) as (RSVP & { users: User })[]}
            rawAttempts={(rawAttempts ?? []) as (ReservationAttempt & { users: User })[]}
            winnerRestaurant={winnerRestaurant}
            userId={user.id}
            clubId=""
            dinnerId={params.dinnerId}
            isCreator={isCreator}
            clubCity={null}
            wishlistForPoll={[]}
            dietaryRestrictions={[]}
            appUrl={appUrl}
          />
        </div>
      </main>
    );
  }

  // ── Confirmed ─────────────────────────────────────────────────
  if (dinner.status === "confirmed" && dinner.reservation_datetime) {
    const [{ data: restaurant }, { data: rawRsvps }, { data: booker }, { data: rawComments }] = await Promise.all([
      supabase.from("restaurant_cache").select("*").eq("place_id", dinner.winning_restaurant_place_id ?? "").single(),
      supabase.from("rsvps").select("*, users ( id, name, email, avatar_url )").eq("dinner_id", params.dinnerId),
      dinner.reserved_by
        ? supabase.from("users").select("name, email").eq("id", dinner.reserved_by).single()
        : Promise.resolve({ data: null }),
      supabase.from("dinner_comments")
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
      author_name: c.users?.name || c.users?.email?.split("@")[0] || "Guest",
    }));

    return (
      <main className="min-h-screen bg-snow">
        <Nav title={dinnerTitle} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-5">
          <CountdownView
            dinner={dinner}
            restaurant={restaurant as RestaurantCache}
            rsvps={rsvps}
            userId={user.id}
            clubName=""
            reservedByName={booker ? (booker.name || booker.email?.split("@")[0]) : null}
          />
          <DinnerComments dinnerId={params.dinnerId} userId={user.id} comments={comments} />
          {isCreator && (
            <div className="flex items-center justify-end gap-4">
              <MarkCompletedButton dinnerId={params.dinnerId} clubId="" />
              <CancelDinnerButton dinnerId={params.dinnerId} clubId="" />
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── Completed ─────────────────────────────────────────────────
  if (dinner.status === "completed") {
    const placeId = dinner.winning_restaurant_place_id ?? "";
    const [{ data: restaurant }, { data: existingRating }, { data: summary }] = await Promise.all([
      supabase.from("restaurant_cache").select("*").eq("place_id", placeId).single(),
      supabase.from("dinner_ratings").select("*").eq("dinner_id", params.dinnerId).eq("user_id", user.id).maybeSingle(),
      supabase.from("dinner_rating_summaries").select("*").eq("dinner_id", params.dinnerId).maybeSingle(),
    ]);

    const windowOpen = isRatingWindowOpen(dinner.ratings_open_until);

    return (
      <main className="min-h-screen bg-snow">
        <Nav title={dinnerTitle} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
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

  // ── Cancelled ─────────────────────────────────────────────────
  if (dinner.status === "cancelled") {
    return (
      <main className="min-h-screen bg-snow">
        <Nav title={dinnerTitle} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10 text-center">
          <p className="text-4xl mb-4">❌</p>
          <h2 className="font-sans text-2xl font-bold text-ink mb-2">Dinner cancelled</h2>
          <p className="text-ink-muted text-sm">This dinner has been cancelled.</p>
          <Link href="/dashboard" className="inline-block mt-6 text-sm font-semibold text-citrus-dark hover:underline">
            Back to dashboard →
          </Link>
        </div>
      </main>
    );
  }

  notFound();
}

