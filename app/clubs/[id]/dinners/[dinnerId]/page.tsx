import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getInitials } from "@/lib/utils";
import {
  getPollState,
  getPollStateLabel,
  rankOptions,
  getUserVote,
  formatThemeSummary,
  canSuggest,
  canRemoveSuggestion,
} from "@/lib/poll";
import type { RestaurantCache, Vote } from "@/lib/supabase/database.types";
import SuggestRestaurant from "./SuggestRestaurant";
import PollOptionCard from "./PollOptionCard";
import OwnerControls from "./OwnerControls";

export default async function DinnerPage({
  params,
}: {
  params: { id: string; dinnerId: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Verify membership
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) notFound();

  const isOwner = membership.role === "owner";

  // Fetch dinner
  const { data: dinner } = await supabase
    .from("dinners")
    .select("*")
    .eq("id", params.dinnerId)
    .eq("club_id", params.id)
    .single();

  if (!dinner) notFound();

  // Fetch member count (for vote percentages) and active poll options in parallel
  const [{ count: memberCount }, { data: rawOptions }, { data: rawVotes }] =
    await Promise.all([
      supabase
        .from("club_members")
        .select("*", { count: "exact", head: true })
        .eq("club_id", params.id),
      supabase
        .from("poll_options")
        .select("*")
        .eq("dinner_id", params.dinnerId)
        .is("removed_at", null),
      supabase
        .from("votes")
        .select("*")
        .eq("dinner_id", params.dinnerId),
    ]);

  const opts = rawOptions ?? [];

  // Group votes by option_id
  const votesByOption: Record<string, Vote[]> = {};
  for (const v of rawVotes ?? []) {
    if (!votesByOption[v.option_id]) votesByOption[v.option_id] = [];
    votesByOption[v.option_id].push(v as Vote);
  }

  // Fetch restaurant_cache for all option place_ids
  let restaurantMap: Record<string, RestaurantCache> = {};
  if (opts.length > 0) {
    const placeIds = opts.map((o) => o.place_id);
    const { data: restaurants } = await supabase
      .from("restaurant_cache")
      .select("*")
      .in("place_id", placeIds);

    for (const r of restaurants ?? []) {
      restaurantMap[r.place_id] = r as RestaurantCache;
    }
  }

  // Merge options with restaurant data and votes
  const mergedOptions = opts
    .filter((o) => restaurantMap[o.place_id])
    .map((o) => ({
      ...o,
      votes: votesByOption[o.id] ?? [],
      restaurant_cache: restaurantMap[o.place_id],
    }));

  const activeOptionCount = mergedOptions.length;
  const pollState = getPollState(dinner, activeOptionCount);
  const ranked = rankOptions(mergedOptions, memberCount ?? 0);
  const myVote = getUserVote(mergedOptions, user.id);
  const themeSummary = formatThemeSummary(dinner);
  const showSuggest = canSuggest(dinner, isOwner, activeOptionCount);
  const showRemove = canRemoveSuggestion(dinner, isOwner);

  const pollCloseLabel =
    dinner.poll_closes_at && pollState === "voting_open"
      ? new Date(dinner.poll_closes_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  return (
    <main className="min-h-screen bg-warm-white">
      {/* Nav */}
      <nav className="bg-charcoal px-8 py-5 flex items-center justify-between">
        <a
          href={`/clubs/${params.id}`}
          className="text-cream/50 hover:text-cream transition-colors text-sm"
        >
          ← Club
        </a>
        <h1 className="font-serif text-xl font-black text-cream">
          Dinner<span className="text-clay">Club</span>
        </h1>
        <div className="w-9 h-9 rounded-full bg-clay flex items-center justify-center text-white text-sm font-bold">
          {getInitials(user.email || "?")}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Header */}
        <div>
          <span className="inline-block text-xs font-semibold text-mid uppercase tracking-wide bg-black/5 px-3 py-1 rounded-full mb-3">
            {getPollStateLabel(pollState)}
          </span>
          <h2 className="font-serif text-3xl font-bold">Dinner poll</h2>
          {themeSummary && (
            <p className="text-mid text-sm mt-2">{themeSummary}</p>
          )}
          {pollCloseLabel && (
            <p className="text-xs text-mid mt-1">Closes {pollCloseLabel}</p>
          )}
        </div>

        {/* Owner controls */}
        {isOwner && (
          <OwnerControls dinnerId={params.dinnerId} pollState={pollState} />
        )}

        {/* Options list */}
        <section>
          <h3 className="font-semibold text-sm text-mid uppercase tracking-wide mb-4">
            Options · {activeOptionCount}
          </h3>

          {ranked.length === 0 ? (
            <div className="border-2 border-dashed border-clay/20 rounded-2xl p-10 text-center">
              <p className="text-3xl mb-3">🍽️</p>
              <p className="font-semibold text-charcoal mb-1">No suggestions yet</p>
              <p className="text-mid text-sm">
                {showSuggest
                  ? "Search below to add the first restaurant."
                  : "Waiting for suggestions from the group."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {ranked.map((opt) => (
                <PollOptionCard
                  key={opt.id}
                  option={opt}
                  pollState={pollState}
                  myVoteOptionId={myVote?.id ?? null}
                  userId={user.id}
                  isOwner={isOwner}
                  dinnerId={params.dinnerId}
                  showRemove={showRemove}
                />
              ))}
            </div>
          )}
        </section>

        {/* Suggest a restaurant */}
        {showSuggest && (
          <section>
            <h3 className="font-semibold text-sm text-mid uppercase tracking-wide mb-4">
              Suggest a restaurant
            </h3>
            <SuggestRestaurant dinnerId={params.dinnerId} />
          </section>
        )}

      </div>
    </main>
  );
}
