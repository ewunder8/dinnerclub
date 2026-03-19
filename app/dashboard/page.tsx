import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getCountdown } from "@/lib/countdown";
import { isInviteExpired } from "@/lib/utils";
import NavUser from "@/components/NavUser";
import AcceptInviteButton from "./AcceptInviteButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("users").select("name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase
      .from("club_members")
      .select("club_id, role, clubs ( id, name, emoji, city )")
      .eq("user_id", user.id),
  ]);

  if (!profile) redirect("/onboarding");

  const clubs = (memberships ?? []).map((m) => m.clubs as {
    id: string; name: string; emoji: string | null; city: string | null;
  });

  const memberClubIds = new Set(clubs.map((c) => c.id));

  // Pending invitations sent to this user's email — use admin client to bypass
  // RLS on clubs (invited user isn't a member yet so clubs RLS would block the join)
  const adminClient = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawInvites } = await (adminClient.from("invite_links") as any)
    .select("id, club_id, expires_at, status, clubs ( id, name, emoji ), users ( name, email )")
    .eq("invited_email", user.email!.toLowerCase().trim())
    .eq("status", "active");

  type PendingInvite = { id: string; club_id: string; expires_at: string; status: string; clubs: { id: string; name: string; emoji: string | null } | null; users: { name: string | null; email: string } | null };
  const pendingInvites = ((rawInvites ?? []) as PendingInvite[]).filter(
    (inv) =>
      !isInviteExpired(inv.expires_at) &&
      !memberClubIds.has(inv.club_id)
  );

  const clubIds = clubs.map((c) => c.id);
  const now = new Date().toISOString();
  const nowDate = new Date();

  const [{ data: rawDinners }, { data: rawCompletedDinners }] = await Promise.all([
    clubIds.length > 0
      ? supabase
          .from("dinners")
          .select("id, club_id, status, voting_open, theme_cuisine, theme_neighborhood, reservation_datetime, winning_restaurant_place_id, created_at")
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
    for (const r of restaurants ?? []) restaurantMap[r.place_id] = r.name;
  }

  const clubMap = Object.fromEntries(clubs.map((c) => [c.id, c]));

  // Split dinners into sections
  const upcoming = dinners.filter(
    (d) => d.status === "confirmed" && d.reservation_datetime && new Date(d.reservation_datetime) > nowDate
  );
  const polls = dinners.filter(
    (d) => d.status === "polling" || d.status === "seeking_reservation" || d.status === "waitlisted"
  );

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-white">
          dinner<span className="text-citrus">club</span>
        </h1>
        <NavUser name={profile.name} email={user.email} avatarUrl={profile.avatar_url} />
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Pending invitations ── */}
        {pendingInvites.length > 0 && (
          <section className="bg-white border border-slate/20 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5">
              <h2 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Invitations</h2>
            </div>
            <div className="divide-y divide-black/5">
              {pendingInvites.map((inv) => {
                const club = inv.clubs as { id: string; name: string; emoji: string | null } | null;
                const inviter = inv.users as { name: string | null; email: string } | null;
                const inviterName = inviter?.name || inviter?.email?.split("@")[0] || "Someone";
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{club?.emoji ?? "🍽️"}</span>
                      <div>
                        <p className="font-semibold text-ink text-sm">{club?.name ?? "A dinner club"}</p>
                        <p className="text-xs text-ink-muted mt-0.5">Invited by {inviterName}</p>
                      </div>
                    </div>
                    <AcceptInviteButton inviteId={inv.id} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Rate your dinner ── */}
        {unratedDinners.length > 0 && (
          <section className="bg-citrus/8 border border-citrus/20 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-citrus/15">
              <h2 className="text-xs font-bold text-citrus-dark uppercase tracking-widest">Rate your dinner</h2>
            </div>
            <div className="divide-y divide-citrus/10">
              {unratedDinners.map((dinner) => {
                const club = clubMap[dinner.club_id];
                const restaurantName = dinner.winning_restaurant_place_id ? restaurantMap[dinner.winning_restaurant_place_id] : null;
                return (
                  <a key={dinner.id} href={`/clubs/${dinner.club_id}/dinners/${dinner.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-citrus/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{club?.emoji ?? "⭐"}</span>
                      <div>
                        <p className="font-semibold text-ink text-sm">{restaurantName ?? "Dinner"}</p>
                        <p className="text-xs text-ink-muted mt-0.5">{club?.name}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-citrus-dark shrink-0">Rate →</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Upcoming reservations ── */}
        {upcoming.length > 0 && (
          <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5">
              <h2 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Upcoming</h2>
            </div>
            <div className="divide-y divide-black/5">
              {upcoming.map((dinner) => {
                const club = clubMap[dinner.club_id];
                const restaurantName = dinner.winning_restaurant_place_id ? restaurantMap[dinner.winning_restaurant_place_id] : null;
                const countdown = getCountdown(dinner.reservation_datetime!);
                return (
                  <a key={dinner.id} href={`/clubs/${dinner.club_id}/dinners/${dinner.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-snow transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{club?.emoji ?? "🍽️"}</span>
                      <div>
                        <p className="font-semibold text-ink text-sm">{restaurantName ?? "Dinner"}</p>
                        <p className="text-xs text-ink-muted mt-0.5">{club?.name}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-citrus-dark">{countdown.label}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {new Date(dinner.reservation_datetime!).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Open polls ── */}
        {polls.length > 0 && (
          <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5">
              <h2 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Polls</h2>
            </div>
            <div className="divide-y divide-black/5">
              {polls.map((dinner) => {
                const club = clubMap[dinner.club_id];
                const restaurantName = dinner.winning_restaurant_place_id ? restaurantMap[dinner.winning_restaurant_place_id] : null;
                const themeLabel = [dinner.theme_cuisine, dinner.theme_neighborhood].filter(Boolean).join(" · ");
                const dinnerLabel = restaurantName ?? (themeLabel || "Dinner poll");
                const votingOpen = dinner.status === "polling" && dinner.voting_open;
                return (
                  <a key={dinner.id} href={`/clubs/${dinner.club_id}/dinners/${dinner.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-snow transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{club?.emoji ?? "🍽️"}</span>
                      <div>
                        <p className="font-semibold text-ink text-sm">{dinnerLabel}</p>
                        <p className="text-xs text-ink-muted mt-0.5">{club?.name}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
                      votingOpen ? "text-citrus-dark bg-citrus/10" : "text-ink-muted bg-black/5"
                    }`}>
                      {votingOpen ? "Vote now!" : dinner.status === "seeking_reservation" ? "Finding a table" : dinner.status === "waitlisted" ? "Waitlisted" : "Taking suggestions"}
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Your clubs ── */}
        <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Your clubs</h2>
            <a href="/clubs/new" className="text-xs font-semibold text-citrus-dark hover:text-citrus transition-colors">
              + New club
            </a>
          </div>

          {clubs.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-4xl mb-4">🍜</p>
              <p className="font-semibold text-ink mb-2">No clubs yet</p>
              <p className="text-ink-muted text-sm mb-6">
                Create a club and invite your friends, or ask someone to share their invite link.
              </p>
              <a href="/clubs/new"
                className="inline-block bg-slate text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-light transition-colors"
              >
                Create your first club →
              </a>
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {clubs.map((club) => (
                <a key={club.id} href={`/clubs/${club.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-snow transition-colors"
                >
                  <span className="text-2xl">{club.emoji ?? "🍽️"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink">{club.name}</p>
                    {club.city && <p className="text-xs text-ink-muted mt-0.5">{club.city}</p>}
                  </div>
                  <span className="text-ink-faint text-sm">→</span>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* ── Discover ── */}
        <a href="/discover"
          className="flex items-center justify-between px-5 py-4 bg-white border border-black/8 rounded-2xl hover:border-slate/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍽️</span>
            <div>
              <p className="font-semibold text-ink text-sm">Past dinners & ratings</p>
              <p className="text-xs text-ink-muted mt-0.5">See where you've been and how you rated it</p>
            </div>
          </div>
          <span className="text-ink-faint text-sm">→</span>
        </a>

      </div>
    </main>
  );
}
