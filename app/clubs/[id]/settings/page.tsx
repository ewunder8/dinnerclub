import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getInitials } from "@/lib/utils";
import EditClubForm from "./EditClubForm";

export default async function ClubSettingsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name, emoji, city, club_members ( user_id, role )")
    .eq("id", params.id)
    .single();

  if (!club) notFound();

  const membership = club.club_members.find(
    (m: { user_id: string; role: string }) => m.user_id === user.id
  );

  if (!membership) notFound();
  // Only owners can access settings
  if (membership.role !== "owner") redirect(`/clubs/${params.id}`);

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.name || user.email || "?";

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

      <div className="max-w-lg mx-auto px-6 py-12">
        <h2 className="font-sans text-3xl font-bold mb-2">Club settings</h2>
        <p className="text-ink-muted text-sm mb-10">Update your club&apos;s name, emoji, and city.</p>
        <EditClubForm
          clubId={params.id}
          initialName={club.name}
          initialEmoji={club.emoji ?? "🍜"}
          initialCity={club.city ?? ""}
        />
      </div>
    </main>
  );
}
