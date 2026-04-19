import {
  getPollState,
  rankOptions,
  getUserVote,
  canSuggest,
  canRemoveSuggestion,
} from "@/lib/poll";
import type {
  Dinner,
  RestaurantCache,
  Vote,
  RSVP,
  User,
  ReservationAttempt,
} from "@/lib/supabase/database.types";
import DateVotingPanel from "./DateVotingPanel";
import RestaurantVotingPanel from "./RestaurantVotingPanel";
import RsvpPanel from "./RsvpPanel";
import ShareButton from "./ShareButton";

type PollDate = { id: string; proposed_date: string };

type AvailResponse = {
  user_id: string;
  date_id: string | null;
  available: "yes" | "maybe" | "no";
  none_of_the_above: boolean;
};

type ClubMember = {
  user_id: string;
  users: { name: string | null; email: string | null; avatar_url: string | null } | null;
};

type RawOption = {
  id: string;
  place_id: string;
  dinner_id: string;
  suggested_by: string;
  removed_by: string | null;
  removed_at: string | null;
  note: string | null;
  created_at: string;
  restaurant_cache: RestaurantCache;
  votes: Vote[];
};

type RsvpWithUser = RSVP & { users: User };
type AttemptWithUser = ReservationAttempt & { users: User };

type Props = {
  dinner: Dinner;
  availPoll: { id: string; status: string } | null;
  pollDates: PollDate[];
  availResponses: AvailResponse[];
  clubMembers: ClubMember[];
  memberCount: number;
  mergedOptions: RawOption[];
  rawVotes: Vote[];
  rawRsvps: RsvpWithUser[];
  rawAttempts: AttemptWithUser[];
  winnerRestaurant: RestaurantCache | null;
  userId: string;
  clubId: string;
  dinnerId: string;
  isCreator: boolean;
  clubCity: string | null;
  wishlistForPoll: { place_id: string; name: string; address: string | null }[];
  dietaryRestrictions: string[];
  appUrl: string;
};

function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateShort(dateStr: string) {
  return parseLocalDate(dateStr).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatDateLong(iso: string) {
  // target_date is a full ISO timestamp
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function StageTracker({
  stage,
  targetDate,
  winnerName,
}: {
  stage: "date_voting" | "restaurant_voting" | "winner";
  targetDate: string | null;
  winnerName: string | null;
}) {
  const steps = [
    {
      key: "date_voting",
      label: "Vote on a date",
      doneLabel: targetDate ? formatDateLong(targetDate) : "Date confirmed",
    },
    {
      key: "restaurant_voting",
      label: "Vote on a restaurant",
      doneLabel: "Restaurant chosen",
    },
    {
      key: "winner",
      label: winnerName ? `Going to ${winnerName}` : "RSVP",
      doneLabel: null,
    },
  ] as const;

  const stageOrder = { date_voting: 0, restaurant_voting: 1, winner: 2 };
  const current = stageOrder[stage];

  return (
    <div className="bg-white border border-black/8 rounded-2xl px-5 py-4">
      <div className="flex flex-col gap-3">
        {steps.map((step, i) => {
          const isDone = i < current;
          const isActive = i === current;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isDone
                    ? "bg-green-500"
                    : isActive
                    ? "bg-blue-500"
                    : "bg-black/15"
                }`}
              />
              <span
                className={`text-sm ${
                  isDone
                    ? "text-green-600 font-medium"
                    : isActive
                    ? "text-ink font-bold"
                    : "text-ink-muted"
                }`}
              >
                {isDone && step.doneLabel ? step.doneLabel : step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DinnerPlanningView({
  dinner,
  availPoll,
  pollDates,
  availResponses,
  clubMembers,
  memberCount,
  mergedOptions,
  rawVotes,
  rawRsvps,
  rawAttempts,
  winnerRestaurant,
  userId,
  clubId,
  dinnerId,
  isCreator,
  clubCity,
  wishlistForPoll,
  dietaryRestrictions,
  appUrl,
}: Props) {
  const stage = dinner.planning_stage as "date_voting" | "restaurant_voting" | "winner";
  const dinnerUrl = `${appUrl}/clubs/${clubId}/dinners/${dinnerId}`;

  // ── Stage 2: restaurant voting data ────────────────────────
  const activeOptionCount = mergedOptions.length;
  const pollState = getPollState(dinner, activeOptionCount);
  const ranked = rankOptions(mergedOptions, memberCount);
  const myVote = getUserVote(mergedOptions, userId);
  const voterCount = new Set(rawVotes.map((v) => v.user_id)).size;
  const showSuggest = isCreator || stage === "restaurant_voting"
    ? canSuggest(dinner, isCreator, activeOptionCount)
    : false;
  const showRemove = canRemoveSuggestion(dinner, isCreator);

  // ── Stage 3: RSVP data ─────────────────────────────────────
  const rsvpByUser = new Map<string, "going" | "not_going">();
  for (const r of rawRsvps) {
    if (r.status === "going" || r.status === "not_going") {
      rsvpByUser.set(r.user_id, r.status);
    }
  }

  const rsvpMembers = clubMembers.map((m) => ({
    userId: m.user_id,
    name: m.users?.name || m.users?.email?.split("@")[0] || "Member",
    status: rsvpByUser.get(m.user_id) ?? null,
  }));

  const topWinnerOption = winnerRestaurant
    ? [{ place_id: winnerRestaurant.place_id, name: winnerRestaurant.name }]
    : [];

  // Share messages per stage
  const goingCount = rsvpMembers.filter((m) => m.status === "going").length;
  const shareMessages: Record<typeof stage, string> = {
    date_voting: "Hey! Vote on dates for our next dinner 🍽",
    restaurant_voting: "Vote on where we're eating! 🍽",
    winner: winnerRestaurant && dinner.target_date
      ? `Dinner is sorted! We're going to ${winnerRestaurant.name} on ${formatDateLong(dinner.target_date)}${goingCount > 0 ? ` — ${goingCount} ${goingCount === 1 ? "person" : "people"} going so far` : ""}. RSVP here 🎉`
      : "Our next dinner is sorted — RSVP here! 🎉",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Stage progress */}
      <StageTracker
        stage={stage}
        targetDate={dinner.target_date}
        winnerName={winnerRestaurant?.name ?? null}
      />

      {/* ── Stage 1: Date voting ─────────────────────────────── */}
      {stage === "date_voting" && availPoll && (
        <>
          <div>
            <h2 className="font-sans text-2xl font-bold text-ink mb-1">Pick a date</h2>
            <p className="text-ink-muted text-sm">
              Vote on when you're free. The organizer will lock in the best date.
            </p>
          </div>

          <DateVotingPanel
            dinnerId={dinnerId}
            clubId={clubId}
            pollId={availPoll.id}
            pollDates={pollDates}
            responses={availResponses}
            members={clubMembers}
            userId={userId}
            isCreator={isCreator}
            memberCount={memberCount}
          />
        </>
      )}

      {/* ── Stage 2: Restaurant voting ──────────────────────── */}
      {stage === "restaurant_voting" && (
        <>
          <div>
            {dinner.target_date && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-100 text-green-700 px-3 py-1 rounded-full mb-3">
                ✓ {formatDateLong(dinner.target_date)}
              </span>
            )}
            <h2 className="font-sans text-2xl font-bold text-ink mb-1">Where should we eat?</h2>
            <p className="text-ink-muted text-sm">
              Suggest and vote on restaurants. The organizer will pick the winner.
            </p>
          </div>

          {dietaryRestrictions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Group dietary needs</p>
              <p className="text-sm text-amber-800">{dietaryRestrictions.join(" · ")}</p>
            </div>
          )}

          <RestaurantVotingPanel
            dinnerId={dinnerId}
            clubId={clubId}
            ranked={ranked}
            pollState={pollState}
            myVoteOptionId={myVote?.id ?? null}
            userId={userId}
            isCreator={isCreator}
            canSuggest={showSuggest}
            showRemove={showRemove}
            wishlist={wishlistForPoll}
            clubCity={clubCity}
            voterCount={voterCount}
            memberCount={memberCount}
          />
        </>
      )}

      {/* ── Stage 3: Winner + RSVP ───────────────────────────── */}
      {stage === "winner" && (
        <>
          <div>
            <h2 className="font-sans text-2xl font-bold text-ink mb-1">We're going!</h2>
            {dinner.target_date && (
              <p className="text-ink-muted text-sm mt-1">
                {formatDateLong(dinner.target_date)}
              </p>
            )}
          </div>

          {winnerRestaurant && (
            <div className="bg-white border border-black/8 rounded-2xl p-5">
              <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-2">
                Where we're eating
              </p>
              <p className="font-sans text-xl font-bold text-ink">{winnerRestaurant.name}</p>
              {winnerRestaurant.address && (
                <p className="text-sm text-ink-muted mt-1">{winnerRestaurant.address}</p>
              )}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(winnerRestaurant.name)}&query_place_id=${winnerRestaurant.place_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-ink-muted hover:text-ink border border-black/10 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Google Maps →
                </a>
                {winnerRestaurant.beli_url && (
                  <a
                    href={winnerRestaurant.beli_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-citrus-dark border border-citrus/30 rounded-lg px-3 py-1.5 hover:bg-citrus/5 transition-colors"
                  >
                    Beli →
                  </a>
                )}
              </div>
            </div>
          )}

          <RsvpPanel
            dinnerId={dinnerId}
            clubId={clubId}
            userId={userId}
            isCreator={isCreator}
            members={rsvpMembers}
            attempts={rawAttempts}
            topOptions={topWinnerOption}
            dinnerStatus={dinner.status}
          />
        </>
      )}

      {/* Share button */}
      <ShareButton
        label={stage === "date_voting" ? "Share date poll" : stage === "restaurant_voting" ? "Share restaurant poll" : "Share dinner"}
        message={shareMessages[stage]}
        url={dinnerUrl}
      />
    </div>
  );
}
