import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getInitials } from "@/lib/utils";
import EditClubForm from "./EditClubForm";
import DeleteClubButton from "./DeleteClubButton";
import TransferOwnershipButton from "./TransferOwnershipButton";
import MembersCanInviteToggle from "./MembersCanInviteToggle";

export default async function ClubSettingsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: club } = await (supabase.from("clubs") as any)
    .select("id, name, emoji, city, members_can_invite, club_members ( id, user_id, role, users ( name, email ) )")
    .eq("id", params.id)
    .single();

  if (!club) notFound();

  const membership = (club.club_members as { id: string; user_id: string; role: string; users: { name: string; email: string } }[])
    .find((m) => m.user_id === user.id);

  if (!membership) notFound();
  if (membership.role !== "owner") redirect(`/clubs/${params.id}`);

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.name || user.email || "?";

  const members = (club.club_members as { id: string; user_id: string; role: string; users: { name: string; email: string } }[])
    .map((m) => ({
      id: m.id,
      user_id: m.user_id,
      name: m.users.name || m.users.email.split("@")[0],
    }));

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-8 py-5 flex items-center justify-between">
        <a
          href={`/clubs/${params.id}`}
          className="text-white/60 hover:text-white transition-colors text-sm"
        >
          ← Club
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

      <div className="max-w-lg mx-auto px-6 py-12 flex flex-col gap-12">

        {/* Edit club */}
        <div>
          <h2 className="font-sans text-3xl font-bold mb-2">Club settings</h2>
          <p className="text-ink-muted text-sm mb-8">Update your club&apos;s name, emoji, and city.</p>
          <EditClubForm
            clubId={params.id}
            initialName={club.name}
            initialEmoji={club.emoji ?? "🍜"}
            initialCity={club.city ?? ""}
          />
        </div>

        {/* Members can invite */}
        <div>
          <h3 className="font-sans text-lg font-bold mb-1">Invitations</h3>
          <p className="text-ink-muted text-sm mb-4">Control who can invite new members to this club.</p>
          <div className="bg-white border border-black/8 rounded-2xl px-5 py-4">
            <MembersCanInviteToggle
              clubId={params.id}
              initialValue={(club as any).members_can_invite ?? true}
            />
          </div>
        </div>

        {/* Transfer ownership */}
        {members.length > 1 && (
          <div>
            <h3 className="font-sans text-lg font-bold mb-1">Transfer ownership</h3>
            <p className="text-ink-muted text-sm mb-4">Hand over the club to another member. You&apos;ll become a regular member.</p>
            <TransferOwnershipButton
              clubId={params.id}
              currentUserId={user.id}
              members={members}
            />
          </div>
        )}

        {/* Danger zone */}
        <div className="border-t border-black/8 pt-8">
          <h3 className="font-sans text-lg font-bold mb-1 text-red-500">Danger zone</h3>
          <p className="text-ink-muted text-sm mb-4">Permanently delete this club and all its dinners.</p>
          <DeleteClubButton clubId={params.id} clubName={club.name} />
        </div>

      </div>
    </main>
  );
}
