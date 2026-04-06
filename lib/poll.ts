// ============================================================
// DinnerClub — Poll Logic
// State machine, vote counting, tie detection, theme formatting,
// and suggestion-mode helpers.
// All pure functions — no Supabase calls here.
// ============================================================

import type {
  Dinner,
  PollOption,
  PollState,
  RestaurantCache,
  Vote,
} from "@/lib/supabase/database.types";

// ============================================================
// Poll State Machine
// Derived from dinner fields + active option count.
// ============================================================

type DinnerForPollState = Pick<
  Dinner,
  | "voting_open"
  | "poll_closes_at"
  | "winning_restaurant_place_id"
  | "poll_min_options"
>;

/**
 * Derive the current poll state from dinner fields.
 * @param activeOptionCount — count of poll_options where removed_at is null
 */
export function getPollState(
  dinner: DinnerForPollState,
  activeOptionCount: number
): PollState {
  if (dinner.winning_restaurant_place_id) return "winner_selected";

  if (dinner.voting_open) {
    const deadlinePassed =
      dinner.poll_closes_at !== null &&
      new Date(dinner.poll_closes_at) <= new Date();
    return deadlinePassed ? "voting_closed" : "voting_open";
  }

  return activeOptionCount >= dinner.poll_min_options
    ? "ready_to_open"
    : "needs_suggestions";
}

/** Human-readable label for each poll state. */
export function getPollStateLabel(state: PollState): string {
  const labels: Record<PollState, string> = {
    needs_suggestions: "Collecting suggestions",
    ready_to_open:     "Ready to vote",
    voting_open:       "Voting open",
    voting_closed:     "Voting closed",
    winner_selected:   "Winner picked",
  };
  return labels[state];
}

// ============================================================
// Vote Counting & Ranking
// ============================================================

export type RankedOption = PollOption & {
  restaurant_cache: RestaurantCache;
  votes: Vote[];
  vote_count: number;
  vote_pct: number;  // 0–100, rounded
  rank: number;      // 1 = most votes
  is_tied: boolean;  // shares the top spot with another option
};

/**
 * Sort options by vote count and annotate each with rank,
 * vote percentage, and tie status.
 * @param totalVoters — total number of club members eligible to vote;
 *   used for percentage calculation. Pass 0 to skip pct.
 */
export function rankOptions(
  options: (PollOption & { votes: Vote[]; restaurant_cache: RestaurantCache })[],
  totalVoters: number
): RankedOption[] {
  const sorted = [...options].sort(
    (a, b) => b.votes.length - a.votes.length
  );

  const topVotes = sorted[0]?.votes.length ?? 0;
  const tiedAtTop =
    topVotes > 0
      ? sorted.filter((o) => o.votes.length === topVotes).length
      : 0;

  return sorted.map((opt, i) => ({
    ...opt,
    vote_count: opt.votes.length,
    vote_pct:
      totalVoters > 0
        ? Math.round((opt.votes.length / totalVoters) * 100)
        : 0,
    rank: i + 1,
    is_tied: opt.votes.length === topVotes && tiedAtTop > 1,
  }));
}

/** True if two or more options share the highest vote count (and at least 1 vote). */
export function hasTie(ranked: RankedOption[]): boolean {
  return ranked.length > 1 && ranked[0].is_tied;
}

/** Returns all options that share the top vote count. */
export function getTiedOptions(ranked: RankedOption[]): RankedOption[] {
  if (!hasTie(ranked)) return [];
  const topVotes = ranked[0].vote_count;
  return ranked.filter((o) => o.vote_count === topVotes);
}

/** Has this user cast a vote in this dinner's poll? */
export function hasUserVoted(
  options: (PollOption & { votes: Vote[] })[],
  userId: string
): boolean {
  return options.some((opt) => opt.votes.some((v) => v.user_id === userId));
}

/** Returns the option the user voted for, or null. */
export function getUserVote(
  options: (PollOption & { votes: Vote[] })[],
  userId: string
): PollOption | null {
  return (
    options.find((opt) => opt.votes.some((v) => v.user_id === userId)) ?? null
  );
}

// ============================================================
// Theme Formatting
// ============================================================

type DinnerForTheme = Pick<
  Dinner,
  "theme_cuisine" | "theme_price" | "theme_vibe" | "theme_neighborhood"
>;

const PRICE_LABELS: Record<number, string> = {
  1: "Cheap eats ($)",
  2: "Mid-range ($$)",
  3: "Upscale ($$$)",
  4: "Splurge ($$$$)",
};

export type DinnerTheme = {
  cuisine: string | null;
  price: string | null;        // formatted label e.g. "Upscale ($$$)"
  vibe: string | null;
  neighborhood: string | null;
  hasTheme: boolean;
};

/** Parse raw theme fields into a structured object. */
export function formatTheme(dinner: DinnerForTheme): DinnerTheme {
  const price =
    dinner.theme_price !== null
      ? (PRICE_LABELS[dinner.theme_price] ?? null)
      : null;

  return {
    cuisine: dinner.theme_cuisine,
    price,
    vibe: dinner.theme_vibe,
    neighborhood: dinner.theme_neighborhood,
    hasTheme: !!(
      dinner.theme_cuisine ||
      dinner.theme_price ||
      dinner.theme_vibe ||
      dinner.theme_neighborhood
    ),
  };
}

/**
 * One-liner summary of the dinner theme.
 * e.g. "Japanese · Upscale ($$$) · Cozy"
 * Returns empty string if no theme is set.
 */
export function formatThemeSummary(dinner: DinnerForTheme): string {
  const { cuisine, price, vibe, neighborhood } = formatTheme(dinner);
  return [cuisine, price, vibe, neighborhood].filter(Boolean).join(" · ");
}

// ============================================================
// Suggestion Mode Helpers
// ============================================================

type DinnerForSuggestions = Pick<
  Dinner,
  "suggestion_mode" | "voting_open" | "winning_restaurant_place_id" | "max_suggestions"
>;

/**
 * Can this user add a restaurant suggestion right now?
 * @param activeOptionCount — count of non-removed poll_options
 */
export function canSuggest(
  dinner: DinnerForSuggestions,
  isOwner: boolean,
  activeOptionCount: number
): boolean {
  // Locked once voting opens or a winner is selected
  if (dinner.voting_open || dinner.winning_restaurant_place_id) return false;

  // Enforce max suggestions cap
  if (
    dinner.max_suggestions !== null &&
    activeOptionCount >= dinner.max_suggestions
  ) {
    return false;
  }

  switch (dinner.suggestion_mode) {
    case "owner_only": return isOwner;
    case "members":    return true;
    case "hybrid":     return true;
  }
}

/**
 * Can the owner remove an existing suggestion?
 * Only allowed before voting opens.
 */
export function canRemoveSuggestion(
  dinner: Pick<Dinner, "voting_open" | "winning_restaurant_place_id">,
  isOwner: boolean
): boolean {
  if (!isOwner) return false;
  return !dinner.voting_open && !dinner.winning_restaurant_place_id;
}

/** Label for each suggestion mode, shown during dinner creation. */
export function getSuggestionModeLabel(
  mode: Dinner["suggestion_mode"]
): string {
  const labels: Record<Dinner["suggestion_mode"], string> = {
    owner_only: "I'll pick the options",
    members:    "Anyone can suggest",
    hybrid:     "I'll seed it, others can add more",
  };
  return labels[mode];
}
