import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import NavUser from "@/components/NavUser";

const DIETARY_EMOJI: Record<string, string> = {
  "Vegetarian": "🌱",
  "Vegan": "🌿",
  "Pescatarian": "🐟",
  "Gluten-free": "🌾",
  "Dairy-free": "🥛",
  "Nut allergy": "🥜",
  "Shellfish allergy": "🦐",
  "Halal": "🍖",
  "Kosher": "✡️",
  "No pork": "🚫🐷",
  "No beef": "🚫🥩",
};

export default async function UserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: viewer }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, avatar_url, city, beli_username, dietary_restrictions, dietary_public")
      .eq("id", params.id)
      .single(),
    supabase
      .from("users")
      .select("name, avatar_url")
      .eq("id", user.id)
      .single(),
  ]);

  if (!profile) notFound();

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <a href="/dashboard" className="flex items-center gap-1.5 inline-flex border border-white/20 hover:bg-white/10 transition-colors text-white text-sm font-semibold px-3 py-1.5 rounded-full"><span className="text-base leading-none">←</span><span>Back</span></a>
        </div>
        <h1 className="font-sans text-base font-bold text-white">Profile</h1>
        <div className="flex-1 flex justify-end">
          <NavUser name={viewer?.name} email={user.email} avatarUrl={viewer?.avatar_url} />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white border border-black/8 rounded-2xl p-6 flex flex-col items-center text-center gap-4">
          <UserAvatar
            name={profile.name}
            email={profile.email}
            avatarUrl={profile.avatar_url}
            size="lg"
          />

          <div>
            <h2 className="font-sans text-2xl font-bold text-ink">
              {profile.name || profile.email}
            </h2>
            {profile.city && (
              <p className="text-ink-muted mt-1">{profile.city}</p>
            )}
          </div>

          {profile.beli_username && (
            <a
              href={`https://beliapp.co/app/${profile.beli_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-citrus/40 rounded-xl text-sm font-semibold text-citrus-dark hover:bg-citrus/5 transition-colors"
            >
              View on Beli →
            </a>
          )}

          {profile.dietary_public && profile.dietary_restrictions && profile.dietary_restrictions.length > 0 && (
            <div className="w-full pt-4 border-t border-black/5">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Dietary restrictions</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {profile.dietary_restrictions.map((d) => (
                  <span key={d} className="flex items-center gap-1.5 px-3 py-1 bg-black/5 rounded-full text-sm text-ink font-medium">
                    {DIETARY_EMOJI[d] && <span>{DIETARY_EMOJI[d]}</span>}
                    <span>{d}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
