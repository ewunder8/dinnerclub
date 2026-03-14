import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCountdown } from "@/lib/countdown";

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

  // Fetch memberships + basic club info
  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id, role, clubs ( id, name, emoji, city )")
    .eq("user_id", user.id);

  const clubs = (memberships ?? []).map((m) => m.clubs as {
    id: string; name: string; emoji: string | null; city: string | null;
  });

  const clubIds = clubs.map((c) => c.id);

  // Fetch active dinners across all clubs (excluding completed/cancelled)
  const { data: rawDinners } = clubIds.length > 0
    ? await supabase
        .from("dinners")
        .select("id, club_id, status, reservation_datetime, winning_restaurant_place_id, created_at")
        .in("club_id", clubIds)
        .in("status", ["confirmed", "polling", "seeking_reservation", "waitlisted"])
        .order("reservation_datetime", { ascending: true })
    : { data: [] };

  const dinners = rawDinners ?? [];

  // Fetch restaurant names for confirmed dinners
  const confirmedPlaceIds = dinners
    .filter((d) => d.winning_restaurant_place_id)
    .map((d) => d.winning_restaurant_place_id!);

  const restaurantMap: Record<string, string> = {};
  if (confirmedPlaceIds.length > 0) {
    const { data: restaurants } = await supabase
      .from("restaurant_cache")
      .select("place_id, name")
      .in("place_id", confirmedPlaceIds);
    for (const r of restaurants ?? []) {
      restaurantMap[r.place_id] = r.name;
    }
  }

  // Build a club lookup for dinner cards
  const clubMap = Object.fromEntries(clubs.map((c) => [c.id, c]));

  // Split into upcoming (confirmed, future) vs active (polling etc.)
  const now = new Date();
  const upcoming = dinners.filter(
    (d) =>
      d.status === "confirmed" &&
      d.reservation_datetime &&
      new Date(d.reservation_datetime) > now
  );
  const active = dinners.filter((d) => d.status !== "confirmed" || !d.reservation_datetime || new Date(d.reservation_datetime) <= now);

  return (
    <main className="min-h-screen bg-warm-white">
      <nav className="bg-charcoal px-8 py-5 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-black text-cream">
          Dinner<span className="text-clay">Club</span>
        </h1>
        <div className="w-9 h-9 rounded-full bg-clay flex items-center justify-center text-white text-sm font-bold">
          {user.email?.slice(0, 2).toUpperCase()}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-10">

        {/* ── Coming up ── */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-bold mb-4">Coming up</h2>
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
                    className="bg-white border border-clay/20 rounded-2xl p-5 hover:border-clay/50 hover:shadow-sm transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{club?.emoji ?? "🍽️"}</span>
                      <div>
                        <p className="font-semibold text-charcoal">
                          {restaurantName ?? "Dinner"}
                        </p>
                        <p className="text-sm text-mid mt-0.5">{club?.name}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-clay text-sm">{countdown.label}</p>
                      <p className="text-xs text-mid mt-0.5">
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

        {/* ── Active polls / reservations ── */}
        {active.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-bold mb-4">Active</h2>
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
                        <p className="font-semibold text-charcoal">
                          {restaurantName ?? "Dinner poll"}
                        </p>
                        <p className="text-sm text-mid mt-0.5">{club?.name}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-mid bg-black/5 px-3 py-1 rounded-full shrink-0">
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
            <h2 className="font-serif text-2xl font-bold">Your clubs</h2>
            <a
              href="/clubs/new"
              className="text-sm font-semibold text-clay hover:text-clay-dark transition-colors"
            >
              + New club
            </a>
          </div>

          {clubs.length === 0 ? (
            <div className="border-2 border-dashed border-clay/20 rounded-2xl p-16 text-center">
              <p className="text-4xl mb-4">🍜</p>
              <p className="font-semibold text-charcoal mb-2">No clubs yet</p>
              <p className="text-mid text-sm mb-6">
                Create a club and invite your friends, or ask someone to share their invite link.
              </p>
              <a
                href="/clubs/new"
                className="inline-block bg-clay text-white font-bold py-3 px-6 rounded-xl hover:bg-clay-dark transition-colors"
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
                  className="bg-white border border-clay/15 rounded-2xl p-6 hover:border-clay/40 hover:shadow-md transition-all"
                >
                  <p className="text-2xl mb-2">{club.emoji}</p>
                  <h3 className="font-serif text-xl font-bold">{club.name}</h3>
                  {club.city && <p className="text-sm text-mid mt-1">{club.city}</p>}
                </a>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
