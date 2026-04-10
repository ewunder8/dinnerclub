import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavUser from "@/components/NavUser";
import EditorialFeed from "@/components/EditorialFeed";
import { normalizeCityKey, SUPPORTED_CITIES } from "@/lib/editorial";

export default async function PressPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("users").select("name, avatar_url").eq("id", user.id).single(),
    supabase.from("club_members").select("clubs ( city )").eq("user_id", user.id),
  ]);

  // Find which supported cities the user has clubs in (deduplicated)
  const userCities = Array.from(
    new Set(
      (memberships ?? [])
        .map((m) => normalizeCityKey((m.clubs as { city: string | null } | null)?.city))
        .filter(Boolean) as string[]
    )
  );

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <a href="/dashboard" className="text-white/60 hover:text-white transition-colors text-2xl font-light">‹</a>
        </div>
        <h1 className="font-sans text-base font-bold text-white">From the Press</h1>
        <div className="flex-1 flex justify-end">
          <NavUser name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {userCities.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📰</p>
            <p className="font-semibold text-ink mb-2">Not available in your city yet</p>
            <p className="text-ink-muted text-sm">
              We currently have editorial coverage for {SUPPORTED_CITIES.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")}.
              More cities coming soon.
            </p>
          </div>
        ) : (
          userCities.map((city) => (
            <div key={city}>
              {userCities.length > 1 && (
                <h2 className="font-sans text-xl font-bold text-ink mb-4 capitalize">{city}</h2>
              )}
              <EditorialFeed city={city} />
            </div>
          ))
        )}
      </div>
    </main>
  );
}
