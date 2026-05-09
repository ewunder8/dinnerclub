import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import NavUser from "@/components/NavUser";
import EditDinnerDetails from "@/app/clubs/[id]/dinners/[dinnerId]/EditDinnerDetails";

export default async function EditOneOffDinnerPage({
  params,
}: {
  params: { dinnerId: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, avatar_url, city")
    .eq("id", user.id)
    .single();

  const adminClient = createAdminClient();
  const { data: dinner } = await adminClient
    .from("dinners")
    .select("*")
    .eq("id", params.dinnerId)
    .is("club_id", null)
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
  if (!isOriginalCreator && !cohostRow) redirect(`/dinners/${params.dinnerId}`);

  const { data: restaurant } = dinner.winning_restaurant_place_id
    ? await supabase.from("restaurant_cache").select("place_id, name, beli_url").eq("place_id", dinner.winning_restaurant_place_id).single()
    : { data: null };

  const backUrl = `/dinners/${params.dinnerId}`;
  const label = [dinner.emoji, dinner.title].filter(Boolean).join(" ") || "Dinner";

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-4 py-4 flex items-center gap-3">
        <Link href={backUrl} className="inline-flex items-center justify-center border border-white/20 hover:bg-white/10 transition-colors text-white w-9 h-9 rounded-full text-lg leading-none shrink-0">←</Link>
        <h1 className="flex-1 min-w-0 font-sans text-base font-bold text-white text-center leading-tight">{label}</h1>
        <div className="flex justify-end shrink-0">
          <NavUser name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        </div>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="font-sans text-xl font-bold text-ink mb-6">Edit dinner</h2>
        <EditDinnerDetails
          dinnerId={params.dinnerId}
          initial={{ title: dinner.title ?? null, targetDate: dinner.target_date ?? null }}
          isOneOff
          showEmojiPicker
          initialEmoji={dinner.emoji ?? null}
          initialRestaurant={restaurant ? { place_id: restaurant.place_id, name: restaurant.name } : null}
          initialBeliUrl={restaurant?.beli_url ?? null}
          userCity={profile?.city ?? null}
          initialPlusOnesEnabled={(dinner as any).plus_ones_enabled ?? false}
          initialPlusOnesMax={(dinner as any).plus_ones_max ?? null}
          standalone
          backUrl={backUrl}
        />
      </div>
    </main>
  );
}
