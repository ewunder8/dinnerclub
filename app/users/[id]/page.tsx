import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import NavUser from "@/components/NavUser";
import { scoreToStars } from "@/lib/countdown";
import { extractCuisineFromTypes, formatPriceLevel } from "@/lib/places";

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

  const admin = createAdminClient();
  const isOwnProfile = user.id === params.id;

  const [{ data: profile }, { data: viewer }] = await Promise.all([
    supabase.from("users").select("id, name, email, avatar_url, city, beli_username, dietary_restrictions, dietary_public").eq("id", params.id).single(),
    supabase.from("users").select("name, avatar_url").eq("id", user.id).single(),
  ]);

  if (!profile) notFound();

  // Fetch data for stats in parallel
  const [
    { data: profileGoingRsvps },
    { data: viewerGoingRsvps },
    { data: profileClubs },
    { data: viewerClubs },
    { data: rawTopRatings },
    { data: rawVotes },
    { data: rawSuggestions },
  ] = await Promise.all([
    admin.from("rsvps").select("dinner_id").eq("user_id", params.id).eq("status", "going"),
    isOwnProfile
      ? Promise.resolve({ data: [] as { dinner_id: string }[] })
      : admin.from("rsvps").select("dinner_id").eq("user_id", user.id).eq("status", "going"),
    admin.from("club_members").select("club_id, clubs ( id, name, emoji )").eq("user_id", params.id),
    supabase.from("club_members").select("club_id").eq("user_id", user.id),
    admin.from("dinner_ratings")
      .select("overall_score, place_id, restaurant_cache ( name )")
      .eq("user_id", params.id)
      .not("overall_score", "is", null)
      .order("overall_score", { ascending: false })
      .limit(10),
    // Votes → restaurant types for taste profile
    admin.from("votes")
      .select("poll_options ( place_id, restaurant_cache ( types, price_level ) )")
      .eq("user_id", params.id)
      .limit(50),
    // Suggestions → restaurant types for taste profile
    admin.from("poll_options")
      .select("place_id, restaurant_cache ( types, price_level )")
      .eq("suggested_by", params.id)
      .is("removed_at", null)
      .limit(50),
  ]);

  // Dinners attended (completed only)
  const profileDinnerIds = (profileGoingRsvps ?? []).map(r => r.dinner_id);
  let dinnersAttended = 0;
  if (profileDinnerIds.length > 0) {
    const { count } = await admin.from("dinners")
      .select("id", { count: "exact", head: true })
      .in("id", profileDinnerIds)
      .eq("status", "completed");
    dinnersAttended = count ?? 0;
  }

  // Eaten together (completed dinners both attended)
  let eatenTogether = 0;
  if (!isOwnProfile) {
    const viewerDinnerIdSet = new Set((viewerGoingRsvps ?? []).map(r => r.dinner_id));
    const sharedIds = profileDinnerIds.filter(id => viewerDinnerIdSet.has(id));
    if (sharedIds.length > 0) {
      const { count } = await admin.from("dinners")
        .select("id", { count: "exact", head: true })
        .in("id", sharedIds)
        .eq("status", "completed");
      eatenTogether = count ?? 0;
    }
  }

  // Clubs in common
  const viewerClubIdSet = new Set((viewerClubs ?? []).map(m => m.club_id));
  const clubsInCommon = (profileClubs ?? [])
    .filter(m => viewerClubIdSet.has(m.club_id))
    .map(m => m.clubs as { id: string; name: string; emoji: string | null } | null)
    .filter(Boolean) as { id: string; name: string; emoji: string | null }[];

  // Top-rated restaurants — dedupe by place_id
  const seenPlaceIds = new Set<string>();
  const topRatings: { place_id: string; overall_score: number; name: string }[] = [];
  for (const r of rawTopRatings ?? []) {
    if (!r.place_id || seenPlaceIds.has(r.place_id)) continue;
    seenPlaceIds.add(r.place_id);
    const restaurantName = (r.restaurant_cache as any)?.name;
    if (restaurantName && r.overall_score) {
      topRatings.push({ place_id: r.place_id, overall_score: r.overall_score, name: restaurantName });
    }
    if (topRatings.length >= 4) break;
  }

  // Taste profile — combine votes + suggestions, count cuisines + price levels
  const cuisineCount: Record<string, number> = {};
  const priceLevels: number[] = [];

  const collectRestaurant = (types: string[] | null, priceLevel: number | null) => {
    const cuisine = extractCuisineFromTypes(types);
    if (cuisine) cuisineCount[cuisine] = (cuisineCount[cuisine] ?? 0) + 1;
    if (priceLevel) priceLevels.push(priceLevel);
  };

  for (const v of rawVotes ?? []) {
    const opt = v.poll_options as any;
    const rc = opt?.restaurant_cache;
    collectRestaurant(rc?.types ?? null, rc?.price_level ?? null);
  }
  for (const s of rawSuggestions ?? []) {
    const rc = (s as any).restaurant_cache;
    collectRestaurant(rc?.types ?? null, rc?.price_level ?? null);
  }

  const topCuisines = Object.entries(cuisineCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cuisine]) => cuisine);

  const avgPriceLevel = priceLevels.length > 0
    ? Math.round(priceLevels.reduce((a, b) => a + b, 0) / priceLevels.length)
    : null;

  const hasTasteProfile = topCuisines.length > 0 || avgPriceLevel !== null;

  const displayName = profile.name || profile.email?.split("@")[0] || "Member";

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <a href="/dashboard" className="inline-flex items-center justify-center border border-white/20 hover:bg-white/10 transition-colors text-white w-9 h-9 rounded-full text-lg leading-none">←</a>
        </div>
        <h1 className="font-sans text-base font-bold text-white truncate max-w-[180px] text-center">{displayName}</h1>
        <div className="flex-1 flex justify-end">
          <NavUser name={viewer?.name} email={user.email} avatarUrl={viewer?.avatar_url} />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-4">

        {/* Header card */}
        <div className="bg-white border border-black/8 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
          <UserAvatar name={profile.name} email={profile.email} avatarUrl={profile.avatar_url} size="lg" />
          <div>
            <h2 className="font-sans text-2xl font-bold text-ink">{displayName}</h2>
            {profile.city && <p className="text-ink-muted text-sm mt-0.5">{profile.city}</p>}
          </div>
          {profile.beli_username && (
            <a
              href={`https://beliapp.co/app/${profile.beli_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-light transition-colors"
            >
              🍴 View on Beli
            </a>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-black/8 rounded-2xl p-4 text-center">
            <p className="font-sans text-2xl font-bold text-ink">{dinnersAttended}</p>
            <p className="text-xs text-ink-muted mt-1">Dinners attended</p>
          </div>
          <div className="bg-white border border-black/8 rounded-2xl p-4 text-center">
            <p className="font-sans text-2xl font-bold text-ink">{(profileClubs ?? []).length}</p>
            <p className="text-xs text-ink-muted mt-1">Clubs</p>
          </div>
        </div>

        {/* Eaten together callout */}
        {!isOwnProfile && eatenTogether > 0 && (
          <div className="bg-citrus/10 border border-citrus/20 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-2xl">🍽️</span>
            <p className="text-sm font-semibold text-ink">
              You&apos;ve eaten together{" "}
              <span className="text-citrus-dark">{eatenTogether} {eatenTogether === 1 ? "time" : "times"}</span>
            </p>
          </div>
        )}

        {/* Taste profile */}
        {(hasTasteProfile || isOwnProfile) && (
          <section className="bg-white border border-black/8 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-3">
              {isOwnProfile ? "Your taste profile" : "Taste profile"}
            </h3>
            {hasTasteProfile ? (
              <div className="flex flex-wrap gap-2">
                {topCuisines.map((cuisine) => (
                  <span key={cuisine} className="px-3 py-1.5 bg-slate/8 text-slate text-sm font-semibold rounded-full">
                    {cuisine}
                  </span>
                ))}
                {avgPriceLevel && (
                  <span className="px-3 py-1.5 bg-citrus/10 text-citrus-dark text-sm font-semibold rounded-full">
                    {formatPriceLevel(avgPriceLevel)} typical
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                Your taste profile will appear here as you attend dinners, vote on restaurants, and suggest places. Get your crew together and start exploring!
              </p>
            )}
          </section>
        )}

        {/* Clubs in common — only when viewing another user */}
        {!isOwnProfile && clubsInCommon.length > 0 && (
          <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5">
              <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Clubs in common</h3>
            </div>
            <div className="divide-y divide-black/5">
              {clubsInCommon.map((club) => (
                <a key={club.id} href={`/clubs/${club.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-snow transition-colors">
                  <span className="text-xl">{club.emoji ?? "🍽️"}</span>
                  <span className="text-sm font-semibold text-ink">{club.name}</span>
                  <span className="ml-auto text-ink-faint text-sm">→</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Top-rated restaurants */}
        {topRatings.length > 0 && (
          <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5">
              <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">
                {isOwnProfile ? "Your top-rated spots" : `${displayName.split(" ")[0]}'s top-rated spots`}
              </h3>
            </div>
            <div className="divide-y divide-black/5">
              {topRatings.map((r) => (
                <div key={r.place_id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-semibold text-ink">{r.name}</span>
                  <span className="text-sm text-citrus-dark shrink-0 ml-3">{scoreToStars(r.overall_score)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Dietary restrictions */}
        {profile.dietary_public && profile.dietary_restrictions && profile.dietary_restrictions.length > 0 && (
          <section className="bg-white border border-black/8 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-3">Dietary needs</h3>
            <div className="flex flex-wrap gap-2">
              {profile.dietary_restrictions.map((d) => (
                <span key={d} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 rounded-full text-sm text-ink font-medium">
                  {DIETARY_EMOJI[d] && <span>{DIETARY_EMOJI[d]}</span>}
                  <span>{d}</span>
                </span>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
