import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavUser from "@/components/NavUser";
import { scoreToStars, wouldReturnPct } from "@/lib/countdown";
import { extractCuisineFromTypes } from "@/lib/places";
import type { DinnerRatingSummary, RestaurantCache } from "@/lib/supabase/database.types";
import ClubStatsCard from "@/app/clubs/[id]/ClubStatsCard";

const STATS_THRESHOLD = 3;

const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

export default async function DiscoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("users").select("name, avatar_url").eq("id", user.id).single(),
    supabase.from("club_members").select("club_id, clubs(id, name, emoji)").eq("user_id", user.id),
  ]);

  const displayName = profile?.name || user.email || "?";
  const clubIds = (memberships ?? []).map((m) => m.club_id);
  const clubMap = Object.fromEntries(
    (memberships ?? []).map((m) => [
      m.club_id,
      m.clubs as { id: string; name: string; emoji: string | null },
    ])
  );

  // Fetch completed dinners across all clubs
  const { data: dinners } = clubIds.length > 0
    ? await supabase
        .from("dinners")
        .select("id, club_id, winning_restaurant_place_id, created_at")
        .in("club_id", clubIds)
        .eq("status", "completed")
        .not("winning_restaurant_place_id", "is", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const pastDinners = dinners ?? [];

  if (pastDinners.length === 0) {
    return (
      <main className="min-h-screen bg-snow">
        <Nav name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="text-center py-10">
            <p className="text-4xl mb-4">🍽️</p>
            <p className="font-semibold text-ink mb-2">No past dinners yet</p>
            <p className="text-ink-muted text-sm">
              Once your club completes a dinner and rates it, you&apos;ll see it here.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const dinnerIds = pastDinners.map((d) => d.id);
  const placeIds = Array.from(new Set(pastDinners.map((d) => d.winning_restaurant_place_id!)));

  // Fetch rating summaries + restaurant cache in parallel
  const [{ data: rawSummaries }, { data: rawRestaurants }] = await Promise.all([
    supabase
      .from("dinner_rating_summaries")
      .select("*")
      .in("dinner_id", dinnerIds),
    supabase
      .from("restaurant_cache")
      .select("*")
      .in("place_id", placeIds),
  ]);

  const summaryMap = Object.fromEntries(
    (rawSummaries ?? []).map((s) => [s.dinner_id, s as DinnerRatingSummary])
  );
  const restaurantMap = Object.fromEntries(
    (rawRestaurants ?? []).map((r) => [r.place_id, r as RestaurantCache])
  );

  // ── Per-club stats (unlocks after STATS_THRESHOLD completed dinners) ──
  const dinnersByClub: Record<string, typeof pastDinners> = {};
  for (const d of pastDinners) {
    if (!d.club_id) continue;
    if (!dinnersByClub[d.club_id]) dinnersByClub[d.club_id] = [];
    dinnersByClub[d.club_id].push(d);
  }
  const qualifyingClubIds = Object.keys(dinnersByClub).filter(
    (id) => dinnersByClub[id].length >= STATS_THRESHOLD
  );
  const qualifyingDinnerIds = qualifyingClubIds.flatMap((id) =>
    dinnersByClub[id].map((d) => d.id)
  );

  type ClubStatsMap = Record<string, {
    mostDinnersAttended: { name: string; count: number } | null;
    topVoter: { name: string; count: number } | null;
    mostSuggestionsAccepted: { name: string; count: number } | null;
    cuisineBreakdown: { cuisine: string; count: number }[];
    avgRating: number | null;
    totalDinners: number;
  }>;

  let clubStatsMap: ClubStatsMap = {};

  if (qualifyingClubIds.length > 0) {
    const [
      { data: rsvpData },
      { data: voteData },
      { data: pollOptionData },
      { data: memberData },
    ] = await Promise.all([
      supabase.from("rsvps").select("user_id, dinner_id").in("dinner_id", qualifyingDinnerIds).eq("status", "going"),
      supabase.from("votes").select("user_id, dinner_id").in("dinner_id", qualifyingDinnerIds),
      supabase.from("poll_options").select("dinner_id, place_id, suggested_by").in("dinner_id", qualifyingDinnerIds),
      supabase.from("club_members").select("club_id, user_id, users(id, name, email)").in("club_id", qualifyingClubIds),
    ]);

    // Build member name lookup per club
    const memberNames: Record<string, Record<string, string>> = {};
    for (const m of (memberData ?? []) as { club_id: string; user_id: string; users: { id: string; name: string | null; email: string } }[]) {
      if (!memberNames[m.club_id]) memberNames[m.club_id] = {};
      memberNames[m.club_id][m.user_id] = m.users.name || m.users.email.split("@")[0] || "Member";
    }

    for (const clubId of qualifyingClubIds) {
      const clubDinners = dinnersByClub[clubId];
      const clubDinnerIds = new Set(clubDinners.map((d) => d.id));
      const names = memberNames[clubId] ?? {};

      // Most dinners attended
      const attendanceCounts: Record<string, number> = {};
      for (const r of rsvpData ?? []) {
        if (!clubDinnerIds.has(r.dinner_id)) continue;
        attendanceCounts[r.user_id] = (attendanceCounts[r.user_id] ?? 0) + 1;
      }
      const topAttendee = Object.entries(attendanceCounts).sort((a, b) => b[1] - a[1])[0];

      // Top voter
      const voteCounts: Record<string, number> = {};
      for (const v of voteData ?? []) {
        if (!v.dinner_id || !clubDinnerIds.has(v.dinner_id)) continue;
        voteCounts[v.user_id] = (voteCounts[v.user_id] ?? 0) + 1;
      }
      const topVoterEntry = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0];

      // Most suggestions accepted
      const winnerKeys = new Set(
        clubDinners
          .filter((d) => d.winning_restaurant_place_id)
          .map((d) => `${d.id}:${d.winning_restaurant_place_id}`)
      );
      const suggestionCounts: Record<string, number> = {};
      for (const opt of pollOptionData ?? []) {
        if (!clubDinnerIds.has(opt.dinner_id)) continue;
        if (opt.suggested_by && winnerKeys.has(`${opt.dinner_id}:${opt.place_id}`)) {
          suggestionCounts[opt.suggested_by] = (suggestionCounts[opt.suggested_by] ?? 0) + 1;
        }
      }
      const topSuggester = Object.entries(suggestionCounts).sort((a, b) => b[1] - a[1])[0];

      // Cuisine breakdown
      const cuisineCounts: Record<string, number> = {};
      for (const d of clubDinners) {
        if (!d.winning_restaurant_place_id) continue;
        const restaurant = restaurantMap[d.winning_restaurant_place_id];
        const cuisine = extractCuisineFromTypes(restaurant?.types ?? null);
        if (cuisine) cuisineCounts[cuisine] = (cuisineCounts[cuisine] ?? 0) + 1;
      }

      // Avg rating from already-fetched summaries
      const ratingVals = clubDinners
        .map((d) => summaryMap[d.id]?.avg_overall)
        .filter((v): v is number => v != null);

      clubStatsMap[clubId] = {
        mostDinnersAttended: topAttendee ? { name: names[topAttendee[0]] ?? "Member", count: topAttendee[1] } : null,
        topVoter: topVoterEntry ? { name: names[topVoterEntry[0]] ?? "Member", count: topVoterEntry[1] } : null,
        mostSuggestionsAccepted: topSuggester ? { name: names[topSuggester[0]] ?? "Member", count: topSuggester[1] } : null,
        cuisineBreakdown: Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cuisine, count]) => ({ cuisine, count })),
        avgRating: ratingVals.length > 0 ? ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length : null,
        totalDinners: clubDinners.length,
      };
    }
  }

  return (
    <main className="min-h-screen bg-snow">
      <Nav name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-sans text-3xl font-bold text-ink">Discover</h2>
            <p className="text-ink-muted text-sm mt-1">Where your groups have eaten</p>
          </div>
          <span className="text-xs font-semibold text-ink-muted bg-black/5 px-3 py-1 rounded-full">
            {pastDinners.length} {pastDinners.length === 1 ? "dinner" : "dinners"}
          </span>
        </div>

        {/* Club stats — one card per qualifying club */}
        {qualifyingClubIds.length > 0 && (
          <div className="flex flex-col gap-4 mb-2">
            {qualifyingClubIds.map((clubId) => {
              const club = clubMap[clubId];
              return (
                <div key={clubId}>
                  {qualifyingClubIds.length > 1 && club && (
                    <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-2 px-1">
                      {club.emoji} {club.name}
                    </p>
                  )}
                  <ClubStatsCard stats={clubStatsMap[clubId]} />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-4 mb-4">
          {pastDinners.map((dinner) => {
            const restaurant = restaurantMap[dinner.winning_restaurant_place_id!];
            const summary = summaryMap[dinner.id];
            const club = clubMap[dinner.club_id!];
            if (!restaurant) return null;

            const returnPct = summary ? wouldReturnPct(summary) : null;

            return (
              <a
                key={dinner.id}
                href={`/clubs/${dinner.club_id}/dinners/${dinner.id}`}
                className="bg-white border border-black/8 rounded-2xl p-5 hover:border-black/20 hover:shadow-sm transition-all block"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-xl font-bold text-ink">
                      {restaurant.name}
                    </p>
                    {restaurant.address && (
                      <p className="text-sm text-ink-muted mt-0.5 truncate">
                        {restaurant.address.replace(/, USA$/, "")}
                      </p>
                    )}
                    <p className="text-xs text-ink-muted mt-0.5">
                      {[
                        restaurant.price_level
                          ? PRICE_LABELS[restaurant.price_level]
                          : null,
                        restaurant.rating ? `Google ★ ${restaurant.rating}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  {/* Group overall score */}
                  {summary?.avg_overall && (
                    <div className="text-right shrink-0">
                      <p className="text-citrus-dark font-bold text-lg leading-none">
                        {scoreToStars(summary.avg_overall)}
                      </p>
                      <p className="text-xs text-ink-muted mt-1">
                        {summary.avg_overall.toFixed(1)} group avg
                      </p>
                    </div>
                  )}
                </div>

                {/* Sub-scores */}
                {summary && (summary.avg_food || summary.avg_vibe || summary.avg_value) && (
                  <div className="flex gap-4 mb-4">
                    {summary.avg_food && (
                      <div>
                        <p className="text-xs text-ink-muted">Food</p>
                        <p className="text-sm font-semibold text-ink">
                          {summary.avg_food.toFixed(1)}
                        </p>
                      </div>
                    )}
                    {summary.avg_vibe && (
                      <div>
                        <p className="text-xs text-ink-muted">Vibe</p>
                        <p className="text-sm font-semibold text-ink">
                          {summary.avg_vibe.toFixed(1)}
                        </p>
                      </div>
                    )}
                    {summary.avg_value && (
                      <div>
                        <p className="text-xs text-ink-muted">Value</p>
                        <p className="text-sm font-semibold text-ink">
                          {summary.avg_value.toFixed(1)}
                        </p>
                      </div>
                    )}
                    {returnPct !== null && summary.rating_count > 0 && (
                      <div>
                        <p className="text-xs text-ink-muted">Would return</p>
                        <p className="text-sm font-semibold text-ink">
                          {returnPct}%
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {summary?.notes && summary.notes.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-4">
                    {summary.notes.slice(0, 2).map((note, i) => (
                      <p key={i} className="text-sm text-ink-muted italic">
                        &ldquo;{note}&rdquo;
                      </p>
                    ))}
                  </div>
                )}

                {/* Beli link */}
                {restaurant.beli_url && (
                  <a
                    href={restaurant.beli_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-citrus-dark hover:underline mb-4"
                  >
                    View on Beli →
                  </a>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-black/5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{club?.emoji ?? "🍽️"}</span>
                    <span className="text-sm text-ink-muted">{club?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {summary?.rating_count > 0 && (
                      <span className="text-xs text-ink-muted">
                        {summary.rating_count} {summary.rating_count === 1 ? "rating" : "ratings"}
                      </span>
                    )}
                    <span className="text-xs text-ink-muted">
                      {new Date(dinner.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

      </div>
    </main>
  );
}

function Nav({ name, email, avatarUrl }: { name?: string | null; email?: string | null; avatarUrl?: string | null }) {
  return (
    <nav className="bg-slate px-6 py-4 flex items-center">
      <div className="flex-1">
        <a href="/dashboard" className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition-colors text-white text-sm font-semibold px-3 py-1.5 rounded-full"><span className="text-base leading-none">←</span><span>Back</span></a>
      </div>
      <h1 className="font-sans text-base font-bold text-white">Discover</h1>
      <div className="flex-1 flex justify-end">
        <NavUser name={name} email={email} avatarUrl={avatarUrl} />
      </div>
    </nav>
  );
}
