"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dinner, RestaurantCache, RSVP, User } from "@/lib/supabase/database.types";
import { rsvpDinner, lockRsvps } from "@/app/clubs/[id]/dinners/[dinnerId]/actions";
import ShareInviteLink from "./ShareInviteLink";
import DinnerComments from "@/app/clubs/[id]/dinners/[dinnerId]/DinnerComments";
import type { DinnerComment } from "@/app/clubs/[id]/dinners/[dinnerId]/DinnerComments";
import EditDinnerDetails from "@/app/clubs/[id]/dinners/[dinnerId]/EditDinnerDetails";

type RsvpWithUser = RSVP & { users: User };

type Props = {
  dinner: Dinner;
  restaurant: RestaurantCache | null;
  rawRsvps: RsvpWithUser[];
  userId: string;
  isCreator: boolean;
  inviteUrl: string | null;
  comments: DinnerComment[];
  hosts: { name: string }[];
  appUrl: string;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  }) + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function OneOffDinnerView({
  dinner,
  restaurant,
  rawRsvps,
  userId,
  isCreator,
  inviteUrl,
  comments,
  hosts,
  appUrl,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  const isLocked = dinner.status === "confirmed";
  const myRsvp = rawRsvps.find((r) => r.user_id === userId);
  const goingRsvps = rawRsvps.filter((r) => r.status === "going");
  const notGoingRsvps = rawRsvps.filter((r) => r.status === "not_going");
  const nonCreatorRsvps = rawRsvps.filter((r) => r.user_id !== dinner.created_by);
  const showShareBanner = isCreator && !isLocked && nonCreatorRsvps.length === 0;

  const dinnerName = dinner.title ?? "Dinner";
  const emoji = dinner.emoji ?? "🍽️";

  async function handleRsvp(status: "going" | "not_going") {
    setRsvpError(null);
    startTransition(async () => {
      const result = await rsvpDinner({ dinnerId: dinner.id, status });
      if (result.error) { setRsvpError(result.error); return; }
      router.refresh();
    });
  }

  async function handleLockConfirm() {
    setLocking(true);
    setLockError(null);
    const result = await lockRsvps({ dinnerId: dinner.id });
    if (result.error) { setLockError(result.error); setLocking(false); return; }
    setShowLockConfirm(false);
    setLocking(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Dinner header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-3xl">{emoji}</span>
          <h1 className="font-sans text-3xl font-bold text-ink">{dinnerName}</h1>
          {isCreator && !isLocked && (
            <EditDinnerDetails
              dinnerId={dinner.id}
              initial={{
                title: dinner.title ?? null,
                targetDate: dinner.target_date ?? null,
              }}
              isOneOff
              initialEmoji={dinner.emoji ?? null}
              initialRestaurant={restaurant ? { place_id: restaurant.place_id, name: restaurant.name } : null}
            />
          )}
        </div>
        {hosts.length > 0 && (
          <p className="text-sm text-ink-muted mt-1">
            Hosted by <span className="font-semibold text-ink">{hosts.map((h) => h.name).join(" & ")}</span>
          </p>
        )}
      </div>

      {/* Dinner details card */}
      <div className="bg-white border border-black/8 rounded-2xl px-5 py-5 flex flex-col gap-3">
        {restaurant && (
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">🍴</span>
            <div>
              <p className="font-semibold text-ink text-sm">{restaurant.name}</p>
              {restaurant.address && (
                <p className="text-xs text-ink-muted mt-0.5">{restaurant.address}</p>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}&query_place_id=${restaurant.place_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-citrus-dark hover:underline mt-1 inline-block"
              >
                Google Maps →
              </a>
            </div>
          </div>
        )}
        {dinner.target_date && (
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">📅</span>
            <p className="text-sm text-ink">{formatDateTime(dinner.target_date)}</p>
          </div>
        )}
        {isLocked && (
          <div className="flex items-center gap-2 pt-1 border-t border-black/5">
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
              RSVPs locked
            </span>
            <span className="text-xs text-ink-muted">{goingRsvps.length} going</span>
          </div>
        )}
      </div>

      {/* Locked celebration */}
      {isLocked && (
        <div className="bg-citrus/10 border border-citrus/20 rounded-2xl px-5 py-5 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="font-sans font-bold text-ink text-lg">RSVPs are locked. See you there!</p>
          <p className="text-sm text-ink-muted mt-1">{goingRsvps.length} {goingRsvps.length === 1 ? "person" : "people"} going</p>
        </div>
      )}

      {/* Share banner — creator only, pre-lock, no guests yet */}
      {showShareBanner && inviteUrl && (
        <ShareInviteLink link={inviteUrl} dinnerName={dinnerName} />
      )}

      {/* RSVP panel */}
      <div className="bg-white border border-black/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
          <h2 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Who&apos;s coming</h2>
          <span className="text-xs text-ink-muted">{goingRsvps.length} going</span>
        </div>

        {/* Current user RSVP toggle */}
        {!isLocked && (
          <div className="px-5 py-4 border-b border-black/5">
            <p className="text-xs font-semibold text-ink-muted mb-3">Are you going?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleRsvp("going")}
                disabled={isPending}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  myRsvp?.status === "going"
                    ? "bg-slate text-white"
                    : "bg-white border border-black/10 text-ink hover:border-slate/30"
                }`}
              >
                {myRsvp?.status === "going" ? "✓ Going" : "Going"}
              </button>
              <button
                type="button"
                onClick={() => handleRsvp("not_going")}
                disabled={isPending}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  myRsvp?.status === "not_going"
                    ? "bg-black/10 text-ink"
                    : "bg-white border border-black/10 text-ink hover:border-slate/30"
                }`}
              >
                {myRsvp?.status === "not_going" ? "✗ Can't make it" : "Can't make it"}
              </button>
            </div>
            {rsvpError && <p className="text-red-500 text-xs mt-2">{rsvpError}</p>}
          </div>
        )}

        {/* Guest list */}
        {rawRsvps.length > 0 ? (
          <div className="divide-y divide-black/5">
            {goingRsvps.map((r) => (
              <div key={r.user_id} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm font-medium text-ink">
                  {(r.users as any)?.name || (r.users as any)?.email?.split("@")[0] || "Guest"}
                  {r.user_id === userId && <span className="text-ink-muted font-normal"> (you)</span>}
                </p>
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">Going</span>
              </div>
            ))}
            {notGoingRsvps.map((r) => (
              <div key={r.user_id} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm font-medium text-ink-muted">
                  {(r.users as any)?.name || (r.users as any)?.email?.split("@")[0] || "Guest"}
                  {r.user_id === userId && <span className="font-normal"> (you)</span>}
                </p>
                <span className="text-xs font-semibold text-ink-muted bg-black/5 px-2.5 py-1 rounded-full">Can&apos;t make it</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-ink-muted">No RSVPs yet. Share the invite link above!</p>
          </div>
        )}
      </div>

      {/* Lock RSVPs button — creator only, pre-lock */}
      {isCreator && !isLocked && (
        <div>
          {!showLockConfirm ? (
            <button
              type="button"
              onClick={() => setShowLockConfirm(true)}
              className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors text-sm"
            >
              Lock RSVPs
            </button>
          ) : (
            <div className="bg-white border border-black/8 rounded-2xl p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-ink">Lock RSVPs?</p>
              <p className="text-sm text-ink-muted">No new people can join after this.</p>
              {lockError && <p className="text-red-500 text-xs">{lockError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLockConfirm}
                  disabled={locking}
                  className="flex-1 bg-slate text-white font-bold py-3 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 text-sm"
                >
                  {locking ? "Locking…" : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLockConfirm(false)}
                  disabled={locking}
                  className="flex-1 bg-white border border-black/10 text-ink font-semibold py-3 rounded-xl hover:border-slate/30 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comments */}
      <DinnerComments dinnerId={dinner.id} userId={userId} comments={comments} />
    </div>
  );
}
