import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import NavUser from "@/components/NavUser";
import EditClubForm from "./EditClubForm";
import DeleteClubButton from "./DeleteClubButton";
import TransferOwnershipButton from "./TransferOwnershipButton";
import MembersCanInviteToggle from "./MembersCanInviteToggle";
import OpenSeatsToggle from "./OpenSeatsToggle";

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
    .select("id, name, emoji, city, owner_id, members_can_invite, open_seats_enabled, club_members ( id, user_id, role, users ( name, email ) )")
    .eq("id", params.id)
    .single();

  if (!club) notFound();

  const membership = (club.club_members as { id: string; user_id: string; role: string; users: { name: string; email: string } }[])
    .find((m) => m.user_id === user.id);

  if (!membership) notFound();
  if (membership.role !== "owner") redirect(`/clubs/${params.id}`);

  const isMainOwner = club.owner_id === user.id;

  const { data: profile } = await supabase
    .from("users")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single();

  const members = (club.club_members as { id: string; user_id: string; role: string; users: { name: string; email: string } }[])
    .map((m) => ({
      id: m.id,
      user_id: m.user_id,
      name: m.users.name || m.users.email.split("@")[0],
    }));

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <a href={`/clubs/${params.id}`} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition-colors text-white text-sm font-semibold px-3 py-1.5 rounded-full"><span className="text-base leading-none">←</span><span>Back</span></a>
        </div>
        <h1 className="font-sans text-base font-bold text-white">Settings</h1>
        <div className="flex-1 flex justify-end">
          <NavUser name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-4">

        <h2 className="font-sans text-2xl font-bold text-ink px-1">Club settings</h2>

        {/* Edit club */}
        <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-black/5">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Details</h3>
          </div>
          <div className="p-5">
            <EditClubForm
              clubId={params.id}
              initialName={club.name}
              initialEmoji={club.emoji ?? "🍜"}
              initialCity={club.city ?? ""}
            />
          </div>
        </section>

        {/* Members can invite */}
        <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-black/5">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Invitations</h3>
          </div>
          <div className="px-5 py-4">
            <MembersCanInviteToggle
              clubId={params.id}
              initialValue={(club as any).members_can_invite ?? true}
            />
          </div>
        </section>

        {/* Features */}
        <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-black/5">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Features</h3>
          </div>
          <div className="px-5 py-4">
            <OpenSeatsToggle
              clubId={params.id}
              initialValue={(club as any).open_seats_enabled ?? true}
            />
          </div>
        </section>

        {/* Transfer ownership — main owner only */}
        {isMainOwner && members.length > 1 && (
          <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5">
              <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Transfer ownership</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-ink-muted mb-4">Hand over the club to another member. You&apos;ll become a regular member.</p>
              <TransferOwnershipButton
                clubId={params.id}
                currentUserId={user.id}
                members={members}
              />
            </div>
          </section>
        )}

        {/* Danger zone — main owner only */}
        {isMainOwner && (
          <section className="bg-white border border-red-100 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-red-100">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest">Danger zone</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-ink-muted mb-4">Permanently delete this club and all its dinners.</p>
              <DeleteClubButton clubId={params.id} clubName={club.name} />
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
