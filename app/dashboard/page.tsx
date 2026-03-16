import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCountdown } from "@/lib/countdown";
import UserAvatar from "@/components/UserAvatar";

const DINNER_STATUS_LABEL: Record<string, string> = {
  polling:             "Taking suggestions",
  seeking_reservation: "Finding a table",
  waitlisted:          "On the waitlist",
  confirmed:           "Confirmed",
  completed:           "Completed",
  cancelled:           "Cancelled",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch user profile + memberships in parallel
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("users").select("name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase
    .from("club_members")
      .select("club_id, role, clubs ( id, name, emoji, city )")
      .eq("user_id", user.id),
  ]);

  if (!profile) redirect("/onboarding");

  const displayName = profile.name || user.email || "?";

  const clubs = (memberships ?? []).map((m) => m.clubs as {
    id: string; name: string; emoji: string | null; city: string | null;
  });

  const clubIds = clubs.map((c) => c.id);

  const now = new Date().toISOString();

  // Fetch active dinners + pending-rating dinners in parallel
  const [{ data: rawDinners }, { data: rawCompletedDinners }] = await Promise.all([
    clubIds.length > 0
      ? supabase
          .from("dinners")
          .select("id, club_id, status, reservation_datetime, winning_restaurant_place_id, created_at")
          .in("club_id", clubIds)
          .in("status", ["confirmed", "polling", "seeking_reservation", "waitlisted"])
          .order("reservation_datetime", { ascending: true })
      : Promise.resolve({ data: [] }),
    clubIds.length > 0
      ? supabase
          .from("dinners")
          .select("id, club_id, winning_restaurant_place_id, ratings_open_until")
          .in("club_id", clubIds)
          .eq("status", "completed")
          .not("ratings_open_until", "is", null)
          .gt("ratings_open_until", now)
      : Promise.resolve({ data: [] }),
  ]);

  const dinners = rawDinners ?? [];
  const completedDinners = rawCompletedDinners ?? [];

  // Filter completed dinners to those the user hasn't rated yet
  let unratedDinners: typeof completedDinners = [];
  if (completedDinners.length > 0) {
    const { data: myRatings } = await supabase
      .from("dinner_ratings")
      .select("dinner_id")
      .eq("user_id", user.id)
      .in("dinner_id", completedDinners.map((d) => d.id));

    const ratedIds = new Set((myRatings ?? []).map((r) => r.dinner_id));
    unratedDinners = completedDinners.filter((d) => !ratedIds.has(d.id));
  }

  // Fetch restaurant names for active + unrated dinners
  const allPlaceIds = [
    ...dinners.filter((d) => d.winning_restaurant_place_id).map((d) => d.winning_restaurant_place_id!),
    ...unratedDinners.filter((d) => d.winning_restaurant_place_id).map((d) => d.winning_restaurant_place_id!),
  ];

  const restaurantMap: Record<string, string> = {};
  if (allPlaceIds.length > 0) {
    const { data: restaurants } = await supabase
      .from("restaurant_cache")
      .select("place_id, name")
      .in("place_id", Array.from(new Set(allPlaceIds)));
    for (const r of restaurants ?? []) {
      restaurantMap[r.place_id] = r.name;
    }
  }

  // Build a club lookup for dinner cards
  const clubMap = Object.fromEntries(clubs.map((c) => [c.id, c]));

  // Split into upcoming (confirmed, future) vs active (polling etc.)
  const nowDate = new Date();
  const upcoming = dinners.filter(
    (d) =>
      d.status === "confirmed" &&
      d.reservation_datetime &&
      new Date(d.reservation_datetime) > nowDate
  );
  const active = dinners.filter((d) => d.status !== "confirmed" || !d.reservation_datetime || new Date(d.reservation_datetime) <= nowDate);

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-8 py-5 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-white">
          dinner<span className="text-citrus">club</span>
        </h1>
        <a href="/profile" title="Profile">
          <UserAvatar name={profile.name} email={user.email} avatarUrl={profile.avatar_url} />
        </a>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-10">

        {/* Quick links */}
        <div className="flex gap-3">
          <a
            href="/discover"
            className="text-sm font-semibold text-ink bg-white border border-black/8 px-4 py-2 rounded-xl hover:border-slate/30 transition-colors"
          >
            🍽️ Discover
          </a>
        </div>

        {/* ── Coming up ── */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="font-sans text-2xl font-bold mb-4">Coming up</h2>
            <div className="flex flex-col gap-3">
              {upcoming.map((dinner) => {
                const club = clubMap[dinner.club_id];
                const restaurantName = dinner.winning_restaurant_place_id
                  ? restaurantMap[dinner.winning_restaurant_place_id]
                  : null;
                const countdown = getCountdown(dinner.reservation_datetime!);
                return (
                  <a
                    key={dinner.id}
                    href={`/clubs/${dinner.club_id}/dinners/${dinner.id}`}
                    className="bg-white border border-slate/20 rounded-2xl p-5 hover:border-slate/40 hover:shadow-sm transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{club?.emoji ?? "🍽️"}</span>
                      <div>
                        <p className="font-semibold text-ink">
                          {restaurantName ?? "Dinner"}
                        </p>
                        <p className="text-sm text-ink-muted mt-0.5">{club?.name}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-sans font-bold text-citrus-dark text-sm">{countdown.label}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {new Date(dinner.reservation_datetime!).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Rate your dinner ── */}
        {unratedDinners.length > 0 && (
          <section>
            <h2 className="font-sans text-2xl font-bold mb-4">Rate your dinner</h2>
            <div className="flex flex-col gap-3">
              {unratedDinners.map((dinner) => {
                const club = clubMap[dinner.club_id];
                const restaurantName = dinner.winning_restaurant_place_id
                  ? restaurantMap[dinner.winning_restaurant_place_id]
                  : null;
                return (
                  <a
                    key={dinner.id}
                    href={`/clubs/${dinner.club_id}/dinners/${dinner.id}`}
                    className="bg-white border border-citrus/30 rounded-2xl p-5 hover:border-citrus/60 hover:shadow-sm transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{club?.emoji ?? "⭐"}</span>
                      <div>
                        <p className="font-semibold text-ink">
                          {restaurantName ?? "Dinner"}
                        </p>
                        <p className="text-sm text-ink-muted mt-0.5">{club?.name}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-citrus-dark bg-citrus-light px-3 py-1 rounded-full shrink-0">
                      Leave a rating
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Active polls / reservations ── */}
        {active.length > 0 && (
          <section>
            <h2 className="font-sans text-2xl font-bold mb-4">Active</h2>
            <div className="flex flex-col gap-3">
              {active.map((dinner) => {
                const club = clubMap[dinner.club_id];
                const restaurantName = dinner.winning_restaurant_place_id
                  ? restaurantMap[dinner.winning_restaurant_place_id]
                  : null;
                return (
                  <a
                    key={dinner.id}
                    href={`/clubs/${dinner.club_id}/dinners/${dinner.id}`}
                    className="bg-white border border-black/8 rounded-2xl p-5 hover:border-black/20 hover:shadow-sm transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{club?.emoji ?? "🍽️"}</span>
                      <div>
                        <p className="font-semibold text-ink">
                          {restaurantName ?? "Dinner poll"}
                        </p>
                        <p className="text-sm text-ink-muted mt-0.5">{club?.name}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-ink-muted bg-slate-faint px-3 py-1 rounded-full shrink-0">
                      {DINNER_STATUS_LABEL[dinner.status] ?? dinner.status}
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Clubs ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans text-2xl font-bold">Your clubs</h2>
            <a
              href="/clubs/new"
              className="text-sm font-semibold text-citrus-dark hover:text-citrus transition-colors"
            >
              + New club
            </a>
          </div>

          {clubs.length === 0 ? (
            <div className="border-2 border-dashed border-slate/20 rounded-2xl p-16 text-center">
              <p className="text-4xl mb-4">🍜</p>
              <p className="font-semibold text-ink mb-2">No clubs yet</p>
              <p className="text-ink-muted text-sm mb-6">
                Create a club and invite your friends, or ask someone to share their invite link.
              </p>
              <a
                href="/clubs/new"
                className="inline-block bg-slate text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-light transition-colors"
              >
                Create your first club →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clubs.map((club) => (
                <a
                  key={club.id}
                  href={`/clubs/${club.id}`}
                  className="bg-white border border-slate/15 rounded-2xl p-6 hover:border-slate/30 hover:shadow-md transition-all"
                >
                  <p className="text-2xl mb-2">{club.emoji}</p>
                  <h3 className="font-sans text-xl font-bold text-ink">{club.name}</h3>
                  {club.city && <p className="text-sm text-ink-muted mt-1">{club.city}</p>}
                </a>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
