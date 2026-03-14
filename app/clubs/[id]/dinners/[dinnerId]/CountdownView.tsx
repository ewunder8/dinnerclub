"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  getCountdown,
  formatReservationTime,
  type UrgencyLevel,
} from "@/lib/countdown";
import {
  getReservationShareText,
  shareViaNative,
  shareViaWhatsApp,
  copyToClipboard,
} from "@/lib/sharing";
import { getPlatformName, getReservationURL } from "@/lib/reservations";
import {
  buildDinnerCalendarEvent,
  downloadICSFile,
  generateGoogleCalendarURL,
} from "@/lib/calendar";
import type { Dinner, RestaurantCache, RSVP, User } from "@/lib/supabase/database.types";

type RsvpWithUser = RSVP & { users: User };

type Props = {
  dinner: Dinner;
  restaurant: RestaurantCache;
  rsvps: RsvpWithUser[];
  userId: string;
  clubName: string;
  reservedByName?: string | null;
};

const URGENCY_STYLES: Record<UrgencyLevel, { banner: string; countdown: string }> = {
  far:      { banner: "bg-slate/5 border-slate/10",       countdown: "text-ink" },
  soon:     { banner: "bg-citrus/10 border-citrus/20",    countdown: "text-citrus-dark" },
  imminent: { banner: "bg-citrus/15 border-citrus/40",    countdown: "text-citrus-dark" },
  past:     { banner: "bg-black/5 border-black/10",       countdown: "text-ink-muted" },
};

export default function CountdownView({ dinner, restaurant, rsvps, userId, clubName, reservedByName }: Props) {
  const router = useRouter();
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const countdown = getCountdown(dinner.reservation_datetime!);
  const styles = URGENCY_STYLES[countdown.urgency];

  const myRsvp = rsvps.find((r) => r.user_id === userId);
  const goingRsvps = rsvps.filter((r) => r.status === "going");

  const handleRsvp = async (status: RSVP["status"]) => {
    if (rsvpLoading) return;
    setRsvpLoading(true);
    setRsvpError(null);
    const supabase = createClient();
    const { error } = await supabase.from("rsvps").upsert(
      { dinner_id: dinner.id, user_id: userId, status },
      { onConflict: "dinner_id,user_id" }
    );
    if (error) { setRsvpError("Failed to save RSVP. Try again."); setRsvpLoading(false); return; }
    router.refresh();
    setRsvpLoading(false);
  };

  const shareText = getReservationShareText({
    restaurantName: restaurant.name,
    datetime: dinner.reservation_datetime!,
    partySize: dinner.party_size ?? goingRsvps.length,
    confirmationNumber: dinner.confirmation_number,
  });

  const handleShare = async () => {
    const shared = await shareViaNative({ title: "Dinner details", text: shareText });
    if (!shared) setShareOpen(true);
  };

  const handleCopy = async () => {
    await copyToClipboard(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reservationUrl =
    dinner.reservation_platform && dinner.reservation_platform !== "other"
      ? getReservationURL({ platform: dinner.reservation_platform })
      : null;

  const calendarEvent = buildDinnerCalendarEvent({
    clubName,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address ?? undefined,
    restaurantPhone: restaurant.phone ?? undefined,
    reservationDatetime: new Date(dinner.reservation_datetime!),
    confirmationNumber: dinner.confirmation_number ?? undefined,
    appUrl: typeof window !== "undefined" ? window.location.href : undefined,
  });

  const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

  return (
    <div className="flex flex-col gap-8">

      {/* Countdown banner */}
      <div className={cn("border rounded-2xl p-6 text-center", styles.banner)}>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">
          {countdown.urgency === "past" ? "Dinner was" : "Dinner in"}
        </p>
        <p className={cn("font-sans text-5xl font-bold", styles.countdown)}>
          {countdown.label}
        </p>
        <p className="text-sm text-ink-muted mt-3">
          {formatReservationTime(dinner.reservation_datetime!)}
        </p>
      </div>

      {/* Restaurant info */}
      <div className="bg-white border border-black/8 rounded-2xl p-5">
        <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide mb-3">
          Restaurant
        </h3>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-sans text-xl font-bold text-ink">{restaurant.name}</p>
            {restaurant.address && (
              <p className="text-sm text-ink-muted mt-1">{restaurant.address}</p>
            )}
            <p className="text-sm text-ink-muted mt-0.5">
              {[
                restaurant.price_level ? PRICE_LABELS[restaurant.price_level] : null,
                restaurant.rating ? `★ ${restaurant.rating}` : null,
                dinner.party_size ? `Party of ${dinner.party_size}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {restaurant.beli_url && (
            <a
              href={restaurant.beli_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-semibold text-citrus-dark border border-slate/30 px-3 py-1.5 rounded-xl hover:bg-citrus/10 transition-colors"
            >
              View on Beli →
            </a>
          )}
        </div>

        {/* Booker crown */}
        {reservedByName && (
          <div className="mt-4 pt-4 border-t border-black/5 flex items-center gap-2">
            <span className="text-base">👑</span>
            <p className="text-sm text-ink-muted">
              Reserved by <span className="font-semibold text-ink">{reservedByName}</span>
            </p>
          </div>
        )}

        {/* Reservation details */}
        {dinner.reservation_platform && (
          <div className="mt-4 pt-4 border-t border-black/5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-ink-muted">Reserved via</p>
              <p className="font-semibold text-ink text-sm">
                {getPlatformName(dinner.reservation_platform)}
                {dinner.confirmation_number && (
                  <span className="text-ink-muted font-normal ml-2">
                    #{dinner.confirmation_number}
                  </span>
                )}
              </p>
            </div>
            {reservationUrl && (
              <a
                href={reservationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-citrus-dark border border-slate/30 px-4 py-2 rounded-xl hover:bg-citrus/10 transition-colors"
              >
                Manage →
              </a>
            )}
          </div>
        )}
      </div>

      {/* RSVP */}
      <div className="bg-white border border-black/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide">
            Who&apos;s coming · {goingRsvps.length}
          </h3>

          {/* RSVP buttons */}
          <div className="flex gap-2">
            {(["going", "not_going"] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleRsvp(s)}
                disabled={rsvpLoading}
                className={cn(
                  "text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40",
                  myRsvp?.status === s
                    ? s === "going"
                      ? "bg-green-100 text-green-600 border border-green-300"
                      : "bg-black/10 text-ink border border-black/20"
                    : "bg-black/5 text-ink-muted hover:bg-black/10"
                )}
              >
                {s === "going" ? "Going ✓" : "Can't make it"}
              </button>
            ))}
          </div>
        </div>

        {rsvpError && <p className="text-red-500 text-xs mb-2">{rsvpError}</p>}

        {goingRsvps.length === 0 ? (
          <p className="text-sm text-ink-muted">No RSVPs yet — be the first!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {goingRsvps.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 bg-surface border border-black/5 rounded-full px-3 py-1.5"
              >
                <div className="w-5 h-5 rounded-full bg-citrus/20 flex items-center justify-center text-citrus-dark text-xs font-bold">
                  {(r.users.name || r.users.email).slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm text-ink">
                  {r.users.name || r.users.email.split("@")[0]}
                </span>
                {r.user_id === userId && (
                  <span className="text-xs text-ink-muted">(you)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {/* Share */}
        <div>
          <button
            onClick={handleShare}
            className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors text-sm"
          >
            Share dinner details
          </button>
          {shareOpen && (
            <div className="mt-2 bg-white border border-black/8 rounded-2xl p-4 flex flex-col gap-2">
              <button
                onClick={() => { shareViaWhatsApp(shareText); setShareOpen(false); }}
                className="text-left text-sm font-semibold text-ink hover:text-citrus-dark transition-colors px-2 py-1.5"
              >
                WhatsApp
              </button>
              <button
                onClick={handleCopy}
                className="text-left text-sm font-semibold text-ink hover:text-citrus-dark transition-colors px-2 py-1.5"
              >
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
            </div>
          )}
        </div>

        {/* Add to Calendar */}
        <div>
          <button
            onClick={() => setCalendarOpen((o) => !o)}
            className="w-full bg-white border border-black/10 text-ink font-semibold py-4 rounded-xl hover:border-black/25 transition-colors text-sm"
          >
            Add to Calendar
          </button>
          {calendarOpen && (
            <div className="mt-2 bg-white border border-black/8 rounded-2xl p-4 flex flex-col gap-2">
              <a
                href={generateGoogleCalendarURL(calendarEvent)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-left text-sm font-semibold text-ink hover:text-citrus-dark transition-colors px-2 py-1.5"
              >
                Google Calendar
              </a>
              <button
                onClick={() => { downloadICSFile(calendarEvent); setCalendarOpen(false); }}
                className="text-left text-sm font-semibold text-ink hover:text-citrus-dark transition-colors px-2 py-1.5"
              >
                Apple / Outlook (.ics)
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
