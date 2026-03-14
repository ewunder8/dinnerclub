// ============================================================
// DinnerClub — Countdown & Ratings Helpers
// Pure functions — no Supabase calls here.
// ============================================================

// ============================================================
// Countdown
// ============================================================

export type UrgencyLevel = "far" | "soon" | "imminent" | "past";

export type CountdownResult = {
  label: string;       // e.g. "3 days" / "Tomorrow" / "Tonight in 2h 30m"
  urgency: UrgencyLevel;
  daysUntil: number;   // negative if past
};

/** Derive a human-readable countdown and urgency level from a reservation datetime. */
export function getCountdown(reservationDatetime: string): CountdownResult {
  const now = new Date();
  const then = new Date(reservationDatetime);
  const diffMs = then.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < 0) {
    // Past
    const daysAgo = Math.ceil(Math.abs(diffHours) / 24);
    return {
      label: daysAgo <= 1 ? "Last night" : `${daysAgo} days ago`,
      urgency: "past",
      daysUntil: -daysAgo,
    };
  }

  if (diffHours < 24) {
    // Today — imminent
    const hours = Math.floor(diffHours);
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    let label = "Tonight";
    if (hours > 0 && minutes > 0) label += ` in ${hours}h ${minutes}m`;
    else if (hours > 0) label += ` in ${hours}h`;
    else if (minutes > 0) label += ` in ${minutes}m`;
    return { label, urgency: "imminent", daysUntil: 0 };
  }

  if (diffDays === 1) {
    return { label: "Tomorrow", urgency: "imminent", daysUntil: 1 };
  }

  if (diffDays <= 7) {
    return { label: `${diffDays} days`, urgency: "soon", daysUntil: diffDays };
  }

  return { label: `${diffDays} days`, urgency: "far", daysUntil: diffDays };
}

/**
 * Full formatted reservation time.
 * e.g. "Saturday, June 14 at 7:30 PM"
 */
export function formatReservationTime(reservationDatetime: string): string {
  return new Date(reservationDatetime).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================================
// Ratings
// ============================================================

/** True if the 48-hour post-dinner rating window is still open. */
export function isRatingWindowOpen(ratingsOpenUntil: string | null): boolean {
  if (!ratingsOpenUntil) return false;
  return new Date(ratingsOpenUntil) > new Date();
}

export const RATING_TAGS = [
  "Great for groups",
  "Hidden gem",
  "Loud / lively",
  "Romantic",
  "Good value",
  "Special occasion",
  "Cozy",
  "Trendy",
  "Service was excellent",
  "Worth the hype",
] as const;

export type RatingTag = (typeof RATING_TAGS)[number];

/** Convert a numeric score (1–5) to a star string. */
export function scoreToStars(score: number): string {
  const filled = Math.round(score);
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

/** Returns a validation error string, or null if valid. */
export function validateRating(data: { overall_score: number | null }): string | null {
  if (!data.overall_score || data.overall_score < 1 || data.overall_score > 5) {
    return "Overall rating is required.";
  }
  return null;
}

/**
 * Percentage of raters who would return.
 * Returns 0 if no ratings yet.
 */
export function wouldReturnPct(summary: {
  would_return_count: number;
  rating_count: number;
}): number {
  if (summary.rating_count === 0) return 0;
  return Math.round((summary.would_return_count / summary.rating_count) * 100);
}
