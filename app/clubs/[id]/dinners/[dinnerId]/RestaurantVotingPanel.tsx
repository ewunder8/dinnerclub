"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { lockRestaurant } from "./actions";
import PollOptionCard from "./PollOptionCard";
import SuggestRestaurant from "./SuggestRestaurant";
import RefreshButton from "./RefreshButton";
import type { RankedOption } from "@/lib/poll";
import type { PollState } from "@/lib/supabase/database.types";

type WishlistItem = {
  place_id: string;
  name: string;
  address: string | null;
};

type Props = {
  dinnerId: string;
  clubId: string;
  ranked: RankedOption[];
  pollState: PollState;
  myVoteOptionId: string | null;
  userId: string;
  isCreator: boolean;
  canSuggest: boolean;
  showRemove: boolean;
  wishlist: WishlistItem[];
  clubCity: string | null;
  voterCount: number;
  memberCount: number;
};

export default function RestaurantVotingPanel({
  dinnerId,
  clubId,
  ranked,
  pollState,
  myVoteOptionId,
  userId,
  isCreator,
  canSuggest,
  showRemove,
  wishlist,
  clubCity,
  voterCount,
  memberCount,
}: Props) {
  const router = useRouter();

  const handleLockRestaurant = async (placeId: string) => {
    const result = await lockRestaurant({ dinnerId, clubId, placeId });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Restaurant picked!");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-muted">
        <span className="font-semibold text-ink">{voterCount}</span> of {memberCount} voted
      </p>

      {/* Options list */}
      <section>
        {ranked.length === 0 ? (
          <div className="border-2 border-dashed border-slate/20 rounded-2xl p-10 text-center">
            <p className="text-3xl mb-3">🍽️</p>
            <p className="font-semibold text-ink mb-1">No suggestions yet</p>
            <p className="text-ink-muted text-sm">
              {canSuggest
                ? "Search below to add the first restaurant."
                : "Waiting for the organizer to seed some options."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ranked.map((opt) => (
              <PollOptionCard
                key={opt.id}
                option={opt}
                pollState={pollState}
                myVoteOptionId={myVoteOptionId}
                userId={userId}
                isOwner={isCreator}
                dinnerId={dinnerId}
                showRemove={showRemove}
                onLockRestaurant={isCreator ? handleLockRestaurant : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* Suggest a restaurant */}
      {canSuggest && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide">
              Suggest a restaurant
            </h3>
            <RefreshButton />
          </div>
          <SuggestRestaurant dinnerId={dinnerId} wishlist={wishlist} clubCity={clubCity} />
        </section>
      )}
    </div>
  );
}
