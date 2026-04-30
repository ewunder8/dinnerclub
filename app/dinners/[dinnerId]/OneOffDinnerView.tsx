"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dinner, RestaurantCache, RSVP, User } from "@/lib/supabase/database.types";
import { rsvpDinner, lockRsvps, cancelOneOffDinner, removeRsvp } from "@/app/clubs/[id]/dinners/[dinnerId]/actions";
import UserAvatar from "@/components/UserAvatar";
import { toast } from "sonner";
import ShareActions from "@/components/ShareActions";
import DinnerComments from "@/app/clubs/[id]/dinners/[dinnerId]/DinnerComments";
import type { DinnerComment } from "@/app/clubs/[id]/dinners/[dinnerId]/DinnerComments";
import EditDinnerDetails from "@/app/clubs/[id]/dinners/[dinnerId]/EditDinnerDetails";
import { buildDinnerCalendarEvent, downloadICSFile, generateGoogleCalendarURL } from "@/lib/calendar";

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
  userCity: string | null;
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
  userCity,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const myRsvp = rawRsvps.find((r) => r.user_id === userId);
  const goingRsvps = rawRsvps.filter((r) => r.status === "going");
  const notGoingRsvps = rawRsvps.filter((r) => r.status === "not_going");

  const dinnerName = dinner.title ?? "Dinner";
  const emoji = dinner.emoji ?? "🍽️";
  const shareMessage = restaurant
    ? `You're invited to ${dinnerName} at ${restaurant.name}! RSVP here 🎉`
    : `You're invited to ${dinnerName}! RSVP here 🎉`;

  async function handleRsvp(status: "going" | "not_going") {
    setRsvpError(null);
    startTransition(async () => {
      const result = await rsvpDinner({ dinnerId: dinner.id, status });
      if (result.error) { setRsvpError(result.error); return; }
      router.refresh();
    });
  }

  async function handleCancelConfirm() {
    setCancelling(true);
    const result = await cancelOneOffDinner({ dinnerId: dinner.id });
    if (result.error) { toast.error(result.error); setCancelling(false); return; }
    router.refresh();
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
          {isCreator && (
            <EditDinnerDetails
              dinnerId={dinner.id}
              initial={{
                title: dinner.title ?? null,
                targetDate: dinner.target_date ?? null,
              }}
              isOneOff
              initialRestaurant={restaurant ? { place_id: restaurant.place_id, name: restaurant.name } : null}
              initialBeliUrl={restaurant?.beli_url ?? null}
              userCity={userCity}
            />
          )}
        </div>
        {hosts.length > 0 && (
          <p className="text-sm text-ink-muted mt-1">
            Hosted by <span className="font-semibold text-ink">{hosts.map((h) => h.name).join(" & ")}</span>
          </p>
        )}
      </div>

      {/* Restaurant card — citrus excitement style */}
      {restaurant && (
        <div className="bg-citrus/10 border border-citrus/20 rounded-2xl px-5 py-5">
          <p className="text-xs font-bold text-citrus-dark uppercase tracking-widest mb-2">Restaurant 🎉</p>
          <p className="font-sans text-2xl font-bold text-ink">{restaurant.name}</p>
          {restaurant.address && (
            <p className="text-sm text-ink-muted mt-0.5">{restaurant.address}</p>
          )}
          {dinner.target_date && (
            <p className="text-sm font-semibold text-ink mt-2">📅 {formatDateTime(dinner.target_date)}</p>
          )}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}&query_place_id=${restaurant.place_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-ink border border-black/15 bg-white rounded-lg px-3 py-2 hover:bg-black/5 transition-colors"
            >
              Google Maps →
            </a>
            {restaurant.beli_url && (
              <a
                href={restaurant.beli_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-citrus-dark border border-citrus/30 bg-white rounded-lg px-3 py-2 hover:bg-citrus/5 transition-colors"
              >
                Beli →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Share Details — always visible */}
      {inviteUrl && (
        <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          <div className="p-5">
            <ShareActions message={shareMessage} url={inviteUrl} />
          </div>
        </section>
      )}

      {/* RSVP panel */}
      <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-black/5">
          <h2 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Who&apos;s coming · {goingRsvps.length}</h2>
        </div>

        {/* Current user RSVP toggle */}
        <div className="p-5">
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => handleRsvp("going")}
              disabled={isPending}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40 ${
                myRsvp?.status === "going"
                  ? "bg-green-100 text-green-700 border-green-300"
                  : "bg-surface text-ink-muted border-black/10 hover:bg-black/5"
              }`}
            >
              ✓ Going
            </button>
            <button
              type="button"
              onClick={() => handleRsvp("not_going")}
              disabled={isPending}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40 ${
                myRsvp?.status === "not_going"
                  ? "bg-black/8 text-ink border-black/20"
                  : "bg-surface text-ink-muted border-black/10 hover:bg-black/5"
              }`}
            >
              Can&apos;t make it
            </button>
          </div>

          {rsvpError && <p className="text-red-500 text-xs mb-3">{rsvpError}</p>}

          {/* Guest list */}
          {rawRsvps.length === 0 ? (
            <p className="text-sm text-ink-muted">No RSVPs yet — be the first!</p>
          ) : (
            <div className="flex flex-col gap-2">
              {goingRsvps.map((r) => (
                <div key={r.user_id} className="flex items-center gap-3">
                  <UserAvatar name={(r.users as any)?.name} email={(r.users as any)?.email} avatarUrl={(r.users as any)?.avatar_url} size="sm" />
                  <span className="text-sm font-medium text-ink">
                    {(r.users as any)?.name || (r.users as any)?.email?.split("@")[0] || "Guest"}
                    {r.user_id === userId && <span className="text-ink-muted font-normal"> (you)</span>}
                  </span>
                  <span className="ml-auto text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">Going</span>
                  {isCreator && r.user_id !== userId && (
                    <button
                      type="button"
                      onClick={async () => { await removeRsvp({ dinnerId: dinner.id, targetUserId: r.user_id }); router.refresh(); }}
                      className="text-xs text-ink-muted hover:text-red-500 transition-colors ml-1"
                      title="Remove RSVP"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {notGoingRsvps.map((r) => (
                <div key={r.user_id} className="flex items-center gap-3">
                  <UserAvatar name={(r.users as any)?.name} email={(r.users as any)?.email} avatarUrl={(r.users as any)?.avatar_url} size="sm" />
                  <span className="text-sm font-medium text-ink-muted">
                    {(r.users as any)?.name || (r.users as any)?.email?.split("@")[0] || "Guest"}
                    {r.user_id === userId && <span className="font-normal"> (you)</span>}
                  </span>
                  <span className="ml-auto text-xs font-semibold text-ink-muted bg-black/5 px-2.5 py-1 rounded-full">Can&apos;t make it</span>
                  {isCreator && r.user_id !== userId && (
                    <button
                      type="button"
                      onClick={async () => { await removeRsvp({ dinnerId: dinner.id, targetUserId: r.user_id }); router.refresh(); }}
                      className="text-xs text-ink-muted hover:text-red-500 transition-colors ml-1"
                      title="Remove RSVP"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Add to Calendar — shown when date is set */}
      {dinner.target_date && restaurant && (
        <div>
          <button
            onClick={() => setCalendarOpen((o) => !o)}
            className="w-full bg-white border border-black/10 text-ink font-semibold py-4 rounded-xl hover:border-black/25 transition-colors text-sm"
          >
            Add to Calendar
          </button>
          {calendarOpen && (() => {
            const calEvent = buildDinnerCalendarEvent({
              clubName: dinnerName,
              restaurantName: restaurant.name,
              restaurantAddress: restaurant.address ?? undefined,
              restaurantPhone: restaurant.phone ?? undefined,
              reservationDatetime: new Date(dinner.target_date!),
              appUrl: typeof window !== "undefined" ? window.location.href : undefined,
            });
            return (
              <div className="mt-2 bg-white border border-black/8 rounded-2xl p-4 flex flex-col gap-2">
                <a
                  href={generateGoogleCalendarURL(calEvent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm font-semibold text-ink hover:text-citrus-dark transition-colors px-2 py-1.5"
                >
                  Google Calendar
                </a>
                <button
                  onClick={() => { downloadICSFile(calEvent); setCalendarOpen(false); }}
                  className="text-left text-sm font-semibold text-ink hover:text-citrus-dark transition-colors px-2 py-1.5"
                >
                  Apple / Outlook (.ics)
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Lock RSVPs button — creator only */}
      {isCreator && (
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

      {/* Cancel — creator only */}
      {isCreator && (
        <div className="text-center">
          {!showCancelConfirm ? (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-xs text-ink-muted hover:text-red-500 transition-colors"
            >
              Cancel dinner
            </button>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <span className="text-xs text-ink-muted">Cancel this dinner?</span>
              <button
                onClick={handleCancelConfirm}
                disabled={cancelling}
                className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-40"
              >
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="text-xs text-ink-muted hover:text-ink transition-colors"
              >
                Never mind
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <DinnerComments dinnerId={dinner.id} userId={userId} comments={comments} />
    </div>
  );
}
