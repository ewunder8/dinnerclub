import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getInitials, getInviteTimeRemaining } from "@/lib/utils";

import InviteButton from "./InviteButton";

export default async function ClubPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch user profile + club in parallel
  const [{ data: profile }] = await Promise.all([
    supabase.from("users").select("name").eq("id", user.id).single(),
  ]);
  const displayName = profile?.name || user.email || "?";

  // Fetch club + members
  const { data: club } = await supabase
    .from("clubs")
    .select(`
      *,
      club_members (
        id, role,
        users ( id, name, email, avatar_url )
      )
    `)
    .eq("id", params.id)
    .single();

  if (!club) notFound();

  // Verify the current user is a member
  const currentMembership = club.club_members.find(
    (m: { users: { id: string }; role: string }) => m.users.id === user.id
  );
  if (!currentMembership) notFound();

  const isOwner = currentMembership.role === "owner";

  // Fetch dinners for this club
  const { data: dinners } = await supabase
    .from("dinners")
    .select("id, status, created_at, winning_restaurant_place_id, theme_cuisine, theme_neighborhood, reservation_datetime")
    .eq("club_id", params.id)
    .order("created_at", { ascending: false });

  // Fetch restaurant names for dinners that have a winner
  const placeIds = (dinners ?? [])
    .map((d) => d.winning_restaurant_place_id)
    .filter(Boolean) as string[];

  const restaurantNameMap: Record<string, string> = {};
  if (placeIds.length > 0) {
    const { data: restaurants } = await supabase
      .from("restaurant_cache")
      .select("place_id, name")
      .in("place_id", placeIds);
    for (const r of restaurants ?? []) {
      restaurantNameMap[r.place_id] = r.name;
    }
  }

  // Fetch active invite link
  const { data: invite } = await supabase
    .from("invite_links")
    .select("token, expires_at")
    .eq("club_id", params.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const members = club.club_members as {
    id: string;
    role: string;
    users: { id: string; name: string; email: string; avatar_url: string | null };
  }[];

  return (
    <main className="min-h-screen bg-warm-white">
      {/* Nav */}
      <nav className="bg-charcoal px-8 py-5 flex items-center justify-between">
        <a href="/dashboard" className="text-cream/50 hover:text-cream transition-colors text-sm">
          ← Dashboard
        </a>
        <h1 className="font-serif text-xl font-black text-cream">
          Dinner<span className="text-clay">Club</span>
        </h1>
        <a
          href="/profile"
          title="Profile & sign out"
          className="w-9 h-9 rounded-full bg-clay flex items-center justify-center text-white text-sm font-bold hover:bg-clay-dark transition-colors"
        >
          {getInitials(displayName)}
        </a>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Club header */}
        <div className="flex items-center gap-4">
          <span className="text-5xl">{club.emoji}</span>
          <div>
            <h2 className="font-serif text-3xl font-bold">{club.name}</h2>
            {club.city && (
              <p className="text-mid text-sm mt-1">{club.city}</p>
            )}
          </div>
        </div>

        {/* Members */}
        <section>
          <h3 className="font-semibold text-sm text-mid uppercase tracking-wide mb-4">
            Members · {members.length}
          </h3>
          <div className="bg-white border border-black/8 rounded-2xl divide-y divide-black/5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-clay/15 flex items-center justify-center text-clay font-bold text-sm shrink-0">
                  {getInitials(m.users.name || m.users.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-charcoal truncate">
                    {m.users.name || m.users.email}
                  </p>
                  {m.role === "owner" && (
                    <p className="text-xs text-mid">Owner</p>
                  )}
                </div>
                {m.users.id === user.id && (
                  <span className="text-xs text-mid bg-black/5 px-2 py-1 rounded-full">You</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Invite link */}
        <section>
          <h3 className="font-semibold text-sm text-mid uppercase tracking-wide mb-4">
            Invite friends
          </h3>
          {invite ? (
            <div className="bg-white border border-black/8 rounded-2xl p-5">
              <p className="text-sm text-mid mb-3">
                Anyone with this link can join · {getInviteTimeRemaining(invite.expires_at)}
              </p>
              <InviteButton token={invite.token} />
            </div>
          ) : (
            <div className="bg-white border border-black/8 rounded-2xl p-5">
              <p className="text-sm text-mid">No active invite link. Generate one from settings.</p>
            </div>
          )}
        </section>

        {/* Dinners */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-mid uppercase tracking-wide">
              Dinners · {dinners?.length ?? 0}
            </h3>
            {isOwner && (
              <a
                href={`/clubs/${params.id}/dinners/new`}
                className="text-sm font-semibold text-clay hover:text-clay-dark transition-colors"
              >
                + Start a dinner
              </a>
            )}
          </div>

          {!dinners || dinners.length === 0 ? (
            <div className="border-2 border-dashed border-clay/20 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-4">🍽️</p>
              <p className="font-semibold text-charcoal mb-2">No dinners yet</p>
              <p className="text-mid text-sm mb-6">
                {isOwner
                  ? "Start a poll and let the crew vote on where to eat."
                  : "Your club owner will start a dinner soon."}
              </p>
              {isOwner && (
                <a
                  href={`/clubs/${params.id}/dinners/new`}
                  className="inline-block bg-clay text-white font-bold py-3 px-6 rounded-xl hover:bg-clay-dark transition-colors"
                >
                  Start a dinner →
                </a>
              )}
            </div>
          ) : (
            <div className="bg-white border border-black/8 rounded-2xl divide-y divide-black/5">
              {dinners.map((dinner) => {
                const restaurantName = dinner.winning_restaurant_place_id
                  ? restaurantNameMap[dinner.winning_restaurant_place_id]
                  : null;
                const theme = [dinner.theme_cuisine, dinner.theme_neighborhood]
                  .filter(Boolean)
                  .join(" · ");
                const label = restaurantName ?? theme ?? "Dinner poll";
                const dateStr = (dinner.reservation_datetime ?? dinner.created_at);
                return (
                  <a
                    key={dinner.id}
                    href={`/clubs/${params.id}/dinners/${dinner.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-warm-white transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-charcoal text-sm">{label}</p>
                      <p className="text-xs text-mid mt-0.5 capitalize">
                        {dinner.status.replace(/_/g, " ")} ·{" "}
                        {new Date(dateStr).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="text-mid text-sm">→</span>
                  </a>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
