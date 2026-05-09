import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import NavUser from "@/components/NavUser";
import EditDinnerDetails from "../EditDinnerDetails";

export default async function EditClubDinnerPage({
  params,
}: {
  params: { id: string; dinnerId: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase.from("club_members").select("role, clubs ( name )").eq("club_id", params.id).eq("user_id", user.id).single(),
    supabase.from("users").select("name, avatar_url").eq("id", user.id).single(),
  ]);

  if (!membership) notFound();

  const { data: dinner } = await supabase
    .from("dinners")
    .select("*")
    .eq("id", params.dinnerId)
    .eq("club_id", params.id)
    .single();

  if (!dinner) notFound();

  // Only creator or cohost can edit
  const isOriginalCreator = dinner.created_by === user.id;
  const { data: cohostRow } = await supabase
    .from("dinner_cohosts")
    .select("id")
    .eq("dinner_id", params.dinnerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isOriginalCreator && !cohostRow) redirect(`/clubs/${params.id}/dinners/${params.dinnerId}`);

  // Cohosts and eligible members (only original creator can manage cohosts)
  const [{ data: rawCohosts }, { data: clubMembers }] = await Promise.all([
    supabase.from("dinner_cohosts").select("user_id, users ( name, email )").eq("dinner_id", params.dinnerId),
    isOriginalCreator
      ? supabase.from("club_members").select("user_id, users ( name, email )").eq("club_id", params.id)
      : Promise.resolve({ data: [] }),
  ]);

  const cohostUserIds = new Set((rawCohosts ?? []).map((c: any) => c.user_id));
  const cohosts = (rawCohosts ?? []).map((c: any) => ({
    userId: c.user_id,
    name: c.users?.name || c.users?.email?.split("@")[0] || "Member",
  }));
  const eligibleCohostMembers = (clubMembers ?? [])
    .filter((m: any) => m.user_id !== user.id && !cohostUserIds.has(m.user_id))
    .map((m: any) => ({
      userId: m.user_id,
      name: m.users?.name || m.users?.email?.split("@")[0] || "Member",
    }));

  const backUrl = `/clubs/${params.id}/dinners/${params.dinnerId}`;
  const clubName = (membership.clubs as any)?.name ?? "Club";

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-4 py-4 flex items-center gap-3">
        <Link href={backUrl} className="inline-flex items-center justify-center border border-white/20 hover:bg-white/10 transition-colors text-white w-9 h-9 rounded-full text-lg leading-none shrink-0">←</Link>
        <h1 className="flex-1 min-w-0 font-sans text-base font-bold text-white text-center leading-tight">{clubName}</h1>
        <div className="flex justify-end shrink-0">
          <NavUser name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        </div>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="font-sans text-xl font-bold text-ink mb-6">Edit dinner</h2>
        <EditDinnerDetails
          dinnerId={params.dinnerId}
          initial={{ title: dinner.title ?? null, targetDate: dinner.target_date ?? null }}
          cohosts={isOriginalCreator ? cohosts : undefined}
          eligibleCohostMembers={isOriginalCreator ? eligibleCohostMembers : undefined}
          initialPlusOnesEnabled={(dinner as any).plus_ones_enabled ?? false}
          initialPlusOnesMax={(dinner as any).plus_ones_max ?? null}
          standalone
          backUrl={backUrl}
        />
      </div>
    </main>
  );
}
