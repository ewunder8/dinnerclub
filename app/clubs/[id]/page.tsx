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
  const isMember = club.club_members.some(
    (m: { users: { id: string } }) => m.users.id === user.id
  );
  if (!isMember) notFound();

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
          Food<span className="text-clay">Club</span>
        </h1>
        <div className="w-9 h-9 rounded-full bg-clay flex items-center justify-center text-white text-sm font-bold">
          {getInitials(user.email || "?")}
        </div>
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

        {/* Dinners — empty state */}
        <section>
          <h3 className="font-semibold text-sm text-mid uppercase tracking-wide mb-4">
            Dinners
          </h3>
          <div className="border-2 border-dashed border-clay/20 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-4">🍽️</p>
            <p className="font-semibold text-charcoal mb-2">No dinners yet</p>
            <p className="text-mid text-sm mb-6">
              Start a poll and let the crew vote on where to eat.
            </p>
            <button
              disabled
              className="bg-clay text-white font-bold py-3 px-6 rounded-xl opacity-40 cursor-not-allowed"
              title="Coming soon"
            >
              Start a dinner →
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}
