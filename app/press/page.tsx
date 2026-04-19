import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavUser from "@/components/NavUser";
import EditorialFeed from "@/components/EditorialFeed";
import { normalizeCityKey } from "@/lib/editorial";

export default async function PressPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, avatar_url, city")
    .eq("id", user.id)
    .single();

  const city = normalizeCityKey(profile?.city);

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <a href="/dashboard" className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition-colors text-white text-sm font-semibold px-3 py-1.5 rounded-full"><span className="text-base leading-none">←</span><span>Back</span></a>
        </div>
        <h1 className="font-sans text-base font-bold text-white">From the Press</h1>
        <div className="flex-1 flex justify-end">
          <NavUser name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {!city ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📰</p>
            <p className="font-semibold text-ink mb-2">Not available in your city yet</p>
            <p className="text-ink-muted text-sm">
              Update your city in your profile to see local dining coverage.
            </p>
          </div>
        ) : (
          <EditorialFeed city={city} />
        )}
      </div>
    </main>
  );
}
