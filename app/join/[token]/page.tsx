import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isInviteExpired, getInviteExpiryLabel } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";

// This page is what people see when they click an invite link
// foodclub.app/join/abc123
// Shows club preview and CTA to join
export default async function JoinPage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = await createClient();

  // If already logged in, skip straight to completing the join
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(`/join/${params.token}/complete`);

  // Use admin client so unauthenticated visitors can see club info
  const admin = createAdminClient();

  // Look up the invite token
  const { data: invite } = await admin
    .from("invite_links")
    .select(`
      *,
      clubs (
        id, name, emoji, city,
        club_members (
          users ( id, name, avatar_url )
        )
      )
    `)
    .eq("token", params.token)
    .single();

  // Token doesn't exist
  if (!invite) notFound();

  // Token expired
  if (isInviteExpired(invite.expires_at) || invite.status !== "active") {
    return <ExpiredInvite clubName={invite.clubs?.name} />;
  }

  const club = invite.clubs;
  const members = club?.club_members?.map((m: { users: { name: string } }) => m.users) || [];
  const expiryLabel = getInviteExpiryLabel(invite.expires_at);

  return (
    <main className="min-h-screen bg-slate flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <p className="font-sans text-xl font-extrabold text-white/40 mb-12">
        dinner<span className="text-citrus">club</span>
      </p>

      {/* Club preview card */}
      <div className="w-full max-w-md bg-snow rounded-3xl overflow-hidden shadow-2xl">
        {/* Card header */}
        <div
          className="p-8 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #2D4A3E, #1C1C1A)" }}
        >
          <p className="text-white/60 text-sm mb-4">
            You&apos;ve been invited to join
          </p>
          <h1 className="font-sans text-3xl font-bold text-white mb-2">
            {club?.emoji} {club?.name}
          </h1>
          <p className="text-white/50 text-sm mb-6">
            {members.length} members · {club?.city}
          </p>

          {/* Member avatars */}
          <div className="flex items-center gap-1">
            {members.slice(0, 5).map((member: { name: string }, i: number) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-citrus-dark border-2 border-white/20 flex items-center justify-center text-white text-xs font-bold -ml-1 first:ml-0"
              >
                {member.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            ))}
            {members.length > 5 && (
              <span className="text-white/40 text-sm ml-2">
                +{members.length - 5} more
              </span>
            )}
          </div>
        </div>

        {/* Card body */}
        <div className="p-8">
          <a
            href={`/auth/login?signup=1&next=/join/${params.token}/complete`}
            className="block w-full bg-slate text-white text-center font-bold py-4 rounded-xl hover:bg-slate-light transition-colors mb-3"
          >
            Join {club?.name} →
          </a>
          <p className="text-ink-muted text-xs text-center">
            You&apos;ll create a free account or log in. Takes 30 seconds.
          </p>
        </div>
      </div>

      {/* Expiry */}
      <p className="text-white/25 text-xs mt-6">Valid until {expiryLabel}</p>
    </main>
  );
}

// Shown when the invite link has expired
function ExpiredInvite({ clubName }: { clubName?: string }) {
  return (
    <main className="min-h-screen bg-slate flex flex-col items-center justify-center p-6">
      <p className="font-sans text-xl font-extrabold text-white/40 mb-12">
        dinner<span className="text-citrus">club</span>
      </p>
      <div className="w-full max-w-sm bg-snow rounded-3xl p-10 text-center shadow-2xl">
        <div className="w-16 h-16 bg-citrus/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-5">
          ⏰
        </div>
        <h2 className="font-sans text-2xl font-bold mb-3">
          This link has expired
        </h2>
        <p className="text-ink-muted text-sm leading-relaxed mb-6">
          Invite links are valid for 30 days.
          {clubName && ` Ask a member of ${clubName} to send you a fresh one.`}
        </p>
        <a
          href="/"
          className="block w-full bg-slate text-white text-center font-bold py-3 rounded-xl hover:bg-slate-light transition-colors"
        >
          Go to dinnerclub
        </a>
      </div>
    </main>
  );
}
