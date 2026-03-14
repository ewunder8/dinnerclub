import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Main dashboard — shows clubs, upcoming dinners
// Protected route: redirects to login if not authenticated
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch user's clubs
  const { data: memberships } = await supabase
    .from("club_members")
    .select(`
      clubs (
        id, name, emoji, city,
        club_members ( count )
      )
    `)
    .eq("user_id", user.id);

  const clubs = memberships?.map((m: { clubs: unknown }) => m.clubs) || [];

  return (
    <main className="min-h-screen bg-warm-white">
      {/* TODO: Replace with full Nav component */}
      <nav className="bg-charcoal px-8 py-5 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-black text-cream">
          Food<span className="text-clay">Club</span>
        </h1>
        <div className="w-9 h-9 rounded-full bg-clay flex items-center justify-center text-white text-sm font-bold">
          {user.email?.slice(0, 2).toUpperCase()}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-3xl font-bold">Your Clubs</h2>
          <a
            href="/clubs/new"
            className="text-sm font-semibold text-clay hover:text-clay-dark transition-colors"
          >
            + New club
          </a>
        </div>

        {clubs.length === 0 ? (
          // Empty state
          <div className="border-2 border-dashed border-clay/20 rounded-2xl p-16 text-center">
            <p className="text-4xl mb-4">🍜</p>
            <p className="font-semibold text-charcoal mb-2">No clubs yet</p>
            <p className="text-mid text-sm mb-6">
              Create a club and invite your friends, or ask someone to share
              their invite link.
            </p>
            <a
              href="/clubs/new"
              className="inline-block bg-clay text-white font-bold py-3 px-6 rounded-xl hover:bg-clay-dark transition-colors"
            >
              Create your first club →
            </a>
          </div>
        ) : (
          // Club grid
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TODO: Replace with ClubCard component */}
            {(clubs as { id: string; name: string; emoji: string }[]).map((club) => (
              <a
                key={club.id}
                href={`/clubs/${club.id}`}
                className="bg-white border border-clay/15 rounded-2xl p-6 hover:border-clay/40 hover:shadow-md transition-all"
              >
                <p className="text-2xl mb-2">{club.emoji}</p>
                <h3 className="font-serif text-xl font-bold">{club.name}</h3>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
