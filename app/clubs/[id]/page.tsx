import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getInviteTimeRemaining } from "@/lib/utils";
import { extractCuisineFromTypes } from "@/lib/places";
import UserAvatar from "@/components/UserAvatar";
import NavUser from "@/components/NavUser";
import Link from "next/link";

import InviteButton from "./InviteButton";
import GenerateInviteButton from "./GenerateInviteButton";
import EmailInviteForm from "./EmailInviteForm";
import LeaveClubButton from "./LeaveClubButton";
import RemoveMemberButton from "./RemoveMemberButton";
import CoOwnerButton from "./CoOwnerButton";
import WishlistSection from "./WishlistSection";
import OpenSeatsSection from "./OpenSeatsSection";
import ClubStatsCard from "./ClubStatsCard";
import ActiveDinnerCard from "./ActiveDinnerCard";
import ActivityFeed from "./ActivityFeed";
import DinnersList from "./DinnersList";

export default async function ClubPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch user profile + club in parallel
  const [{ data: profile }] = await Promise.all([
    supabase.from("users").select("name, avatar_url").eq("id", user.id).single(),
  ]);
  const displayName = profile?.name || user.email || "?";

  // Fetch club + members
  const { data: club } = await supabase
    .from("clubs")
    .select(`
      *,
      club_members (
        id, role,
        users ( id, name, email, avatar_url, beli_username )
      )
    `)
    .eq("id", params.id)
    .single();

  if (!club) notFound();

  // Verify the current user is a member
  const currentMembership = club.club_members.find(
    (m: { id: string; users: { id: string }; role: string }) => m.users.id === user.id
  );
  if (!currentMembership) notFound();

  const isOwner = currentMembership.role === "owner";
  const isMainOwner = isOwner && club.owner_id === user.id;

  // Fetch dinners for this club
  const { data: dinners } = await supabase
    .from("dinners")
    .select("id, status, planning_stage, created_at, winning_restaurant_place_id, theme_cuisine, theme_neighborhood, reservation_datetime, target_date")
    .eq("club_id", params.id)
    .order("created_at", { ascending: false });

  // Fetch restaurant names for dinners that have a winner
  const placeIds = (dinners ?? [])
    .map((d) => d.winning_restaurant_place_id)
    .filter(Boolean) as string[];

  const restaurantNameMap: Record<string, string> = {};
  const restaurantTypesMap: Record<string, string[] | null> = {};
  if (placeIds.length > 0) {
    const { data: restaurants } = await supabase
      .from("restaurant_cache")
      .select("place_id, name, types")
      .in("place_id", placeIds);
    for (const r of restaurants ?? []) {
      restaurantNameMap[r.place_id] = r.name;
      restaurantTypesMap[r.place_id] = r.types;
    }
  }

  // Fetch wishlist
  const { data: rawWishlist } = await supabase
    .from("club_wishlist")
    .select("id, place_id, note, added_by, created_at, users ( name, email )")
    .eq("club_id", params.id)
    .order("created_at", { ascending: false });

  const wishlistPlaceIds = (rawWishlist ?? []).map((w) => w.place_id);
  const wishlistRestaurantMap: Record<string, { name: string; address: string | null }> = {};
  if (wishlistPlaceIds.length > 0) {
    const { data: wRestaurants } = await supabase
      .from("restaurant_cache")
      .select("place_id, name, address")
      .in("place_id", wishlistPlaceIds);
    for (const r of wRestaurants ?? []) {
      wishlistRestaurantMap[r.place_id] = { name: r.name, address: r.address };
    }
  }

  const wishlistItems = (rawWishlist ?? []).map((w) => {
    const u = w.users as unknown as { name: string | null; email: string } | null;
    const r = wishlistRestaurantMap[w.place_id];
    return {
      id: w.id,
      place_id: w.place_id,
      note: w.note,
      added_by: w.added_by,
      created_at: w.created_at,
      restaurant_name: r?.name ?? "Unknown",
      restaurant_address: r?.address ?? null,
      adder_name: u?.name || u?.email?.split("@")[0] || "Someone",
    };
  });

  // Fetch open seats with requests
  const { data: rawOpenSeats } = await supabase
    .from("open_seats")
    .select(`
      *,
      users ( name, email ),
      open_seat_requests ( id, user_id, status, created_at, users ( name, email ) )
    `)
    .eq("club_id", params.id)
    .order("reservation_datetime", { ascending: true });

  const openSeats = (rawOpenSeats ?? []).map((s: any) => ({
    id: s.id,
    club_id: s.club_id,
    created_by: s.created_by,
    restaurant_name: s.restaurant_name,
    place_id: s.place_id,
    reservation_datetime: s.reservation_datetime,
    seats_available: s.seats_available,
    note: s.note,
    status: s.status as "open" | "closed",
    created_at: s.created_at,
    poster_name: s.users?.name || s.users?.email?.split("@")[0] || "Someone",
    requests: (s.open_seat_requests ?? []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      status: r.status as "pending" | "confirmed" | "declined",
      user_name: r.users?.name || r.users?.email?.split("@")[0] || "Someone",
      created_at: r.created_at,
    })),
  }));

  // Fetch confirmed open seat requests for current user (show as upcoming dinners)
  const { data: rawConfirmedSeats } = await supabase
    .from("open_seat_requests")
    .select("id, open_seats ( restaurant_name, reservation_datetime )")
    .eq("user_id", user.id)
    .eq("status", "confirmed");

  const confirmedSeats = (rawConfirmedSeats ?? [])
    .map((r: any) => {
      const seat = r.open_seats;
      if (!seat) return null;
      return {
        id: r.id,
        restaurantName: seat.restaurant_name as string,
        reservationDatetime: seat.reservation_datetime as string,
      };
    })
    .filter(Boolean) as { id: string; restaurantName: string; reservationDatetime: string }[];

  // Fetch club stats data
  const dinnerIds = (dinners ?? []).map((d) => d.id);
  const [
    { data: rsvpData },
    { data: voteData },
    { data: pollOptionData },
    { data: ratingData },
  ] = await Promise.all([
    dinnerIds.length > 0
      ? supabase.from("rsvps").select("user_id, dinner_id").in("dinner_id", dinnerIds).eq("status", "going")
      : Promise.resolve({ data: [] as { user_id: string; dinner_id: string }[] }),
    dinnerIds.length > 0
      ? supabase.from("votes").select("user_id, dinner_id").in("dinner_id", dinnerIds)
      : Promise.resolve({ data: [] as { user_id: string; dinner_id: string }[] }),
    dinnerIds.length > 0
      ? supabase.from("poll_options").select("dinner_id, place_id, suggested_by").in("dinner_id", dinnerIds)
      : Promise.resolve({ data: [] as { dinner_id: string; place_id: string; suggested_by: string | null }[] }),
    dinnerIds.length > 0
      ? supabase.from("dinner_rating_summaries").select("dinner_id, avg_overall").in("dinner_id", dinnerIds)
      : Promise.resolve({ data: [] as { dinner_id: string; avg_overall: number | null }[] }),
  ]);

  // Build member name lookup from club_members
  const memberNameMap: Record<string, string> = {};
  for (const m of club.club_members as { users: { id: string; name: string | null; email: string } }[]) {
    memberNameMap[m.users.id] = m.users.name || m.users.email.split("@")[0] || "Member";
  }

  // Most dinners attended
  const attendanceCounts: Record<string, number> = {};
  for (const r of rsvpData ?? []) {
    attendanceCounts[r.user_id] = (attendanceCounts[r.user_id] ?? 0) + 1;
  }
  const topAttendeeEntry = Object.entries(attendanceCounts).sort((a, b) => b[1] - a[1])[0];
  const mostDinnersAttended = topAttendeeEntry
    ? { name: memberNameMap[topAttendeeEntry[0]] ?? "Member", count: topAttendeeEntry[1] }
    : null;

  // Top voter
  const voteCounts: Record<string, number> = {};
  for (const v of voteData ?? []) {
    voteCounts[v.user_id] = (voteCounts[v.user_id] ?? 0) + 1;
  }
  const topVoterEntry = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0];
  const topVoter = topVoterEntry
    ? { name: memberNameMap[topVoterEntry[0]] ?? "Member", count: topVoterEntry[1] }
    : null;

  // Most suggestions accepted (poll option whose place_id matches the dinner's winner)
  const winnerKeys = new Set(
    (dinners ?? [])
      .filter((d) => d.winning_restaurant_place_id)
      .map((d) => `${d.id}:${d.winning_restaurant_place_id}`)
  );
  const suggestionCounts: Record<string, number> = {};
  for (const opt of pollOptionData ?? []) {
    if (opt.suggested_by && winnerKeys.has(`${opt.dinner_id}:${opt.place_id}`)) {
      suggestionCounts[opt.suggested_by] = (suggestionCounts[opt.suggested_by] ?? 0) + 1;
    }
  }
  const topSuggesterEntry = Object.entries(suggestionCounts).sort((a, b) => b[1] - a[1])[0];
  const mostSuggestionsAccepted = topSuggesterEntry
    ? { name: memberNameMap[topSuggesterEntry[0]] ?? "Member", count: topSuggesterEntry[1] }
    : null;

  // Cuisine breakdown from winning restaurant types (actual cuisine eaten)
  const cuisineCounts: Record<string, number> = {};
  for (const d of dinners ?? []) {
    if (!d.winning_restaurant_place_id) continue;
    const types = restaurantTypesMap[d.winning_restaurant_place_id];
    const cuisine = extractCuisineFromTypes(types);
    if (cuisine) {
      cuisineCounts[cuisine] = (cuisineCounts[cuisine] ?? 0) + 1;
    }
  }
  const cuisineBreakdown = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cuisine, count]) => ({ cuisine, count }));

  // Avg rating
  const ratingValues = (ratingData ?? [])
    .map((r) => r.avg_overall)
    .filter((v): v is number => v !== null);
  const avgRating =
    ratingValues.length > 0
      ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
      : null;

  const clubStats = { mostDinnersAttended, topVoter, mostSuggestionsAccepted, cuisineBreakdown, avgRating, totalDinners: dinners?.length ?? 0 };

  // Fetch active invite link
  const { data: invite } = await supabase
    .from("invite_links")
    .select("token, expires_at")
    .eq("club_id", params.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const members = club.club_members as {
    id: string;
    role: string;
    users: { id: string; name: string; email: string; avatar_url: string | null; beli_username: string | null };
  }[];

  return (
    <main className="min-h-screen bg-snow">
      {/* Nav */}
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <Link href="/dashboard" className="text-white/60 hover:text-white transition-colors text-2xl font-light">‹</Link>
        </div>
        <h1 className="font-sans text-base font-bold text-white truncate max-w-[180px] text-center">{club.name}</h1>
        <div className="flex-1 flex justify-end">
          <NavUser name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Club header */}
        <div className="text-center pt-2 pb-4">
          <div className="text-6xl mb-3">{club.emoji}</div>
          <h2 className="font-sans text-2xl font-bold text-ink">{club.name}</h2>
          {club.city && <p className="text-ink-muted text-sm mt-1">{club.city}</p>}
          {isOwner && (
            <Link
              href={`/clubs/${params.id}/settings`}
              className="inline-block mt-3 text-xs font-semibold text-ink-muted border border-black/10 px-3 py-1.5 rounded-xl hover:bg-black/5 transition-colors"
            >
              Settings
            </Link>
          )}
        </div>

        {/* Active dinner — most recent non-completed dinner */}
        {(() => {
          const activeDinner = (dinners ?? []).find(
            (d) => d.status !== "completed" && d.status !== "cancelled"
          );
          if (!activeDinner) return null;
          const restaurantName = activeDinner.winning_restaurant_place_id
            ? restaurantNameMap[activeDinner.winning_restaurant_place_id] ?? null
            : null;
          return (
            <ActiveDinnerCard
              dinner={activeDinner as any}
              clubId={params.id}
              restaurantName={restaurantName}
            />
          );
        })()}

        {/* Start a dinner CTA */}
        <Link
          href={`/clubs/${params.id}/dinners/new`}
          className="group block border-2 border-dashed border-citrus-dark/40 bg-citrus/5 hover:bg-citrus/10 hover:border-citrus-dark/60 rounded-2xl px-6 py-7 transition-all"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-2xl mb-2">🍽️</p>
              <p className="font-sans text-lg font-bold text-ink">Plan a dinner</p>
              <p className="text-sm text-ink-muted mt-0.5">Propose dates, vote on restaurants, lock it in.</p>
            </div>
            <span className="shrink-0 bg-slate group-hover:bg-slate-light text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors">
              Start →
            </span>
          </div>
        </Link>

        {/* Dinners */}
        <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">
              Dinners · {dinners?.length ?? 0}
            </h3>
            <Link
              href="/discover"
              className="border border-black/10 text-ink-muted font-semibold rounded-xl px-4 py-2 hover:text-ink transition-colors text-sm"
            >
              Discover
            </Link>
          </div>

          <DinnersList
            dinners={dinners ?? []}
            clubId={params.id}
            restaurantNameMap={restaurantNameMap}
            confirmedSeats={confirmedSeats}
          />
        </section>

        {/* Invite Friends */}
        {(isOwner || (club as any).members_can_invite) && (
          <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5">
              <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Invite friends</h3>
            </div>
            <div className="p-5">
              {invite ? (
                <>
                  <p className="text-sm text-ink-muted mb-3">
                    Anyone with this link can join · {getInviteTimeRemaining(invite.expires_at)}
                  </p>
                  <InviteButton token={invite.token} />
                  <EmailInviteForm
                    token={invite.token}
                    clubName={club.name}
                    inviterName={displayName}
                  />
                </>
              ) : (
                <>
                  <p className="text-sm text-ink-muted mb-4">No active invite link.</p>
                  <GenerateInviteButton clubId={params.id} />
                </>
              )}
            </div>
          </section>
        )}

        {/* Activity Feed */}
        <ActivityFeed clubId={params.id} />

        {/* Club Stats */}
        <ClubStatsCard stats={clubStats} />

        {/* Wishlist */}
        <WishlistSection
          clubId={params.id}
          userId={user.id}
          isOwner={isOwner}
          items={wishlistItems}
          clubCity={(club as any).city ?? null}
        />

        {/* Open Seats */}
        {(club as any).open_seats_enabled !== false && (
          <OpenSeatsSection
            clubId={params.id}
            userId={user.id}
            clubCity={(club as any).city ?? null}
            openSeats={openSeats}
          />
        )}

        {/* Members */}
        <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">
              Members · {members.length}
            </h3>
            {!isOwner && (
              <LeaveClubButton clubId={params.id} memberId={currentMembership.id} />
            )}
          </div>
          <div className="divide-y divide-black/5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-4">
                <a href={`/users/${m.users.id}`}>
                  <UserAvatar name={m.users.name} email={m.users.email} avatarUrl={m.users.avatar_url} />
                </a>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink truncate">
                    {m.users.name || m.users.email}
                  </p>
                  <div className="flex items-center gap-2">
                    {m.role === "owner" && (
                      <p className="text-xs text-ink-muted">Owner</p>
                    )}
                    {m.users.beli_username && (
                      <a
                        href={`https://beliapp.co/app/${m.users.beli_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-citrus-dark font-semibold hover:underline"
                      >
                        Beli
                      </a>
                    )}
                  </div>
                </div>
                {m.users.id === user.id ? (
                  <span className="text-xs text-ink-muted bg-black/5 px-2 py-1 rounded-full">You</span>
                ) : isOwner ? (
                  <div className="flex items-center gap-2">
                    <CoOwnerButton
                      clubId={params.id}
                      targetUserId={m.users.id}
                      currentRole={m.role}
                      memberName={m.users.name || m.users.email.split("@")[0]}
                    />
                    <RemoveMemberButton
                      memberId={m.id}
                      memberName={m.users.name || m.users.email.split("@")[0]}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
