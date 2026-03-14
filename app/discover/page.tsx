import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getInitials } from "@/lib/utils";
import { scoreToStars, wouldReturnPct } from "@/lib/countdown";
import type { DinnerRatingSummary, RestaurantCache } from "@/lib/supabase/database.types";

const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

export default async function DiscoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("users").select("name").eq("id", user.id).single(),
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
        <Nav displayName={displayName} />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="text-4xl mb-4">🍽️</p>
          <p className="font-semibold text-ink mb-2">No past dinners yet</p>
          <p className="text-ink-muted text-sm">
            Once your club completes a dinner and rates it, you&apos;ll see it here.
          </p>
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

  return (
    <main className="min-h-screen bg-snow">
      <Nav displayName={displayName} />

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-sans text-3xl font-bold">Discover</h2>
            <p className="text-ink-muted text-sm mt-1">Where your groups have eaten</p>
          </div>
          <span className="text-xs font-semibold text-ink-muted bg-black/5 px-3 py-1 rounded-full">
            {pastDinners.length} {pastDinners.length === 1 ? "dinner" : "dinners"}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {pastDinners.map((dinner) => {
            const restaurant = restaurantMap[dinner.winning_restaurant_place_id!];
            const summary = summaryMap[dinner.id];
            const club = clubMap[dinner.club_id];
            if (!restaurant) return null;

            const returnPct = summary ? wouldReturnPct(summary) : null;

            return (
              <div
                key={dinner.id}
                className="bg-white border border-black/8 rounded-2xl p-5"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-xl font-bold text-ink">
                      {restaurant.name}
                    </p>
                    {restaurant.address && (
                      <p className="text-sm text-ink-muted mt-0.5 truncate">
                        {restaurant.address}
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
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function Nav({ displayName }: { displayName: string }) {
  return (
    <nav className="bg-slate px-8 py-5 flex items-center justify-between">
      <a
        href="/dashboard"
        className="text-white/60 hover:text-white transition-colors text-sm"
      >
        ← Dashboard
      </a>
      <h1 className="font-sans text-xl font-extrabold text-white">
        dinner<span className="text-citrus">club</span>
      </h1>
      <a
        href="/profile"
        title="Profile & sign out"
        className="w-9 h-9 rounded-full bg-citrus-dark flex items-center justify-center text-white text-sm font-bold hover:bg-citrus transition-colors"
      >
        {getInitials(displayName)}
      </a>
    </nav>
  );
}
