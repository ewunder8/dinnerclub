import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getInviteTimeRemaining } from "@/lib/utils";
import UserAvatar from "@/components/UserAvatar";
import NavUser from "@/components/NavUser";

import InviteButton from "./InviteButton";
import GenerateInviteButton from "./GenerateInviteButton";
import EmailInviteForm from "./EmailInviteForm";
import LeaveClubButton from "./LeaveClubButton";
import RemoveMemberButton from "./RemoveMemberButton";
import CoOwnerButton from "./CoOwnerButton";

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
    supabase.from("users").select("name, avatar_url").eq("id", user.id).single(),
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
    (m: { id: string; users: { id: string }; role: string }) => m.users.id === user.id
  );
  if (!currentMembership) notFound();

  const isOwner = currentMembership.role === "owner";
  const isMainOwner = isOwner && club.owner_id === user.id;

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
    <main className="min-h-screen bg-snow">
      {/* Nav */}
      <nav className="bg-slate px-8 py-5 flex items-center justify-between">
        <a href="/dashboard" className="text-white/60 hover:text-white transition-colors text-sm">
          ← Dashboard
        </a>
        <h1 className="font-sans text-xl font-extrabold text-white">
          dinner<span className="text-citrus">club</span>
        </h1>
        <NavUser name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Club header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{club.emoji}</span>
            <div>
              <h2 className="font-sans text-3xl font-bold text-ink">{club.name}</h2>
              {club.city && (
                <p className="text-ink-muted text-sm mt-1">{club.city}</p>
              )}
            </div>
          </div>
          {isOwner && (
            <a
              href={`/clubs/${params.id}/settings`}
              className="text-xs font-semibold text-ink-muted border border-black/10 px-3 py-1.5 rounded-xl hover:bg-black/5 transition-colors shrink-0"
            >
              Settings
            </a>
          )}
        </div>

        {/* Members */}
        <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">
              Members · {members.length}
            </h3>
            {!isOwner && (
              <LeaveClubButton clubId={params.id} memberId={currentMembership.id} />
            )}
          </div>
          <div className="divide-y divide-black/5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-4">
                <UserAvatar name={m.users.name} email={m.users.email} avatarUrl={m.users.avatar_url} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink truncate">
                    {m.users.name || m.users.email}
                  </p>
                  {m.role === "owner" && (
                    <p className="text-xs text-ink-muted">Owner</p>
                  )}
                </div>
                {m.users.id === user.id ? (
                  <span className="text-xs text-ink-muted bg-black/5 px-2 py-1 rounded-full">You</span>
                ) : isOwner ? (
                  <div className="flex items-center gap-2">
                    <CoOwnerButton
                      clubId={params.id}
                      targetUserId={m.users.id}
                      currentRole={m.role}
                      memberName={m.users.name || m.users.email.split("@")[0]}
                    />
                    <RemoveMemberButton
                      memberId={m.id}
                      memberName={m.users.name || m.users.email.split("@")[0]}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* Invite link — hidden from members when owner has disabled it */}
        {(isOwner || (club as any).members_can_invite) && (
          <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5">
              <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Invite friends</h3>
            </div>
            <div className="p-5">
              {invite ? (
                <>
                  <p className="text-sm text-ink-muted mb-3">
                    Anyone with this link can join · {getInviteTimeRemaining(invite.expires_at)}
                  </p>
                  <InviteButton token={invite.token} />
                  <EmailInviteForm
                    token={invite.token}
                    clubName={club.name}
                    inviterName={displayName}
                  />
                </>
              ) : (
                <>
                  <p className="text-sm text-ink-muted mb-4">No active invite link.</p>
                  <GenerateInviteButton clubId={params.id} />
                </>
              )}
            </div>
          </section>
        )}

        {/* Dinners */}
        <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">
              Dinners · {dinners?.length ?? 0}
            </h3>
            <a
              href={`/clubs/${params.id}/dinners/new`}
              className="text-xs font-semibold text-citrus-dark hover:text-citrus transition-colors"
            >
              + Start a dinner
            </a>
          </div>

          {!dinners || dinners.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-4">🍽️</p>
              <p className="font-semibold text-ink mb-2">No dinners yet</p>
              <p className="text-ink-muted text-sm mb-6">
                Start a poll and let the crew vote on where to eat.
              </p>
              <a
                href={`/clubs/${params.id}/dinners/new`}
                className="inline-block bg-slate text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-light transition-colors"
              >
                Start a dinner →
              </a>
            </div>
          ) : (
            <div className="divide-y divide-black/5">
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
                    className="flex items-center justify-between px-5 py-4 hover:bg-surface transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-ink text-sm">{label}</p>
                      <p className="text-xs text-ink-muted mt-0.5 capitalize">
                        {dinner.status.replace(/_/g, " ")} ·{" "}
                        {new Date(dateStr).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="text-ink-muted text-sm">→</span>
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
