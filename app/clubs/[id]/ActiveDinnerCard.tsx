import Link from "next/link";

type ActiveDinner = {
  id: string;
  status: string;
  planning_stage: string | null;
  winning_restaurant_place_id: string | null;
  theme_cuisine: string | null;
  theme_neighborhood: string | null;
  reservation_datetime: string | null;
  target_date: string | null;
};

type Props = {
  dinner: ActiveDinner;
  clubId: string;
  restaurantName: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function getStageInfo(dinner: ActiveDinner, restaurantName: string | null): {
  emoji: string;
  label: string;
  sublabel: string;
  chipColor: string;
} {
  const stage = dinner.planning_stage;

  if (stage === "date_voting") {
    return {
      emoji: "📅",
      label: "Voting on dates",
      sublabel: "Help the group pick when to meet.",
      chipColor: "bg-blue-100 text-blue-600",
    };
  }

  if (stage === "restaurant_voting") {
    const dateStr = dinner.target_date ? formatDate(dinner.target_date) : null;
    return {
      emoji: "🗳️",
      label: "Voting on restaurants",
      sublabel: dateStr ? `Locked in for ${dateStr}` : "Vote on where to eat.",
      chipColor: "bg-purple-100 text-purple-600",
    };
  }

  if (stage === "winner" || (dinner.status === "seeking_reservation" && restaurantName)) {
    return {
      emoji: "🪑",
      label: restaurantName ?? "Gathering RSVPs",
      sublabel: dinner.target_date
        ? `${formatDate(dinner.target_date)} · Are you in?`
        : "RSVP and claim a reservation.",
      chipColor: "bg-amber-100 text-amber-600",
    };
  }

  if (dinner.status === "confirmed" && dinner.reservation_datetime) {
    return {
      emoji: "✅",
      label: restaurantName ?? "Dinner confirmed",
      sublabel: formatDateTime(dinner.reservation_datetime),
      chipColor: "bg-green-100 text-green-700",
    };
  }

  if (dinner.status === "waitlisted") {
    return {
      emoji: "⏳",
      label: restaurantName ?? "On the waitlist",
      sublabel: "Fingers crossed for a table.",
      chipColor: "bg-black/8 text-ink-muted",
    };
  }

  // Generic polling fallback
  const theme = [dinner.theme_cuisine, dinner.theme_neighborhood].filter(Boolean).join(" · ");
  return {
    emoji: "🍽️",
    label: theme || "Dinner poll",
    sublabel: "Collecting restaurant suggestions.",
    chipColor: "bg-black/8 text-ink-muted",
  };
}

export default function ActiveDinnerCard({ dinner, clubId, restaurantName }: Props) {
  const { emoji, label, sublabel, chipColor } = getStageInfo(dinner, restaurantName);

  return (
    <Link
      href={`/clubs/${clubId}/dinners/${dinner.id}`}
      className="block bg-white border border-black/8 rounded-2xl px-5 py-4 hover:border-black/20 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{emoji}</span>
          <div className="min-w-0">
            <p className="font-sans font-bold text-ink truncate">{label}</p>
            <p className="text-xs text-ink-muted mt-0.5 truncate">{sublabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${chipColor}`}>
            Active
          </span>
          <span className="text-ink-muted">→</span>
        </div>
      </div>
    </Link>
  );
}
