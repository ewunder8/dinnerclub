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
import type { Dinner, RestaurantCache, RSVP, User } from "@/lib/supabase/database.types";

type RsvpWithUser = RSVP & { users: User };

type Props = {
  dinner: Dinner;
  restaurant: RestaurantCache;
  rsvps: RsvpWithUser[];
  userId: string;
};

const URGENCY_STYLES: Record<UrgencyLevel, { banner: string; countdown: string }> = {
  far:      { banner: "bg-charcoal/5 border-charcoal/10", countdown: "text-charcoal" },
  soon:     { banner: "bg-clay/8 border-clay/20",         countdown: "text-clay" },
  imminent: { banner: "bg-clay/15 border-clay/40",        countdown: "text-clay" },
  past:     { banner: "bg-black/5 border-black/10",       countdown: "text-mid" },
};

export default function CountdownView({ dinner, restaurant, rsvps, userId }: Props) {
  const router = useRouter();
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const countdown = getCountdown(dinner.reservation_datetime!);
  const styles = URGENCY_STYLES[countdown.urgency];

  const myRsvp = rsvps.find((r) => r.user_id === userId);
  const goingRsvps = rsvps.filter((r) => r.status === "going");

  const handleRsvp = async (status: RSVP["status"]) => {
    if (rsvpLoading) return;
    setRsvpLoading(true);
    const supabase = createClient();
    await supabase.from("rsvps").upsert(
      { dinner_id: dinner.id, user_id: userId, status },
      { onConflict: "dinner_id,user_id" }
    );
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

  const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

  return (
    <div className="flex flex-col gap-8">

      {/* Countdown banner */}
      <div className={cn("border rounded-2xl p-6 text-center", styles.banner)}>
        <p className="text-xs font-semibold text-mid uppercase tracking-wide mb-2">
          {countdown.urgency === "past" ? "Dinner was" : "Dinner in"}
        </p>
        <p className={cn("font-serif text-5xl font-bold", styles.countdown)}>
          {countdown.label}
        </p>
        <p className="text-sm text-mid mt-3">
          {formatReservationTime(dinner.reservation_datetime!)}
        </p>
      </div>

      {/* Restaurant info */}
      <div className="bg-white border border-black/8 rounded-2xl p-5">
        <h3 className="font-semibold text-sm text-mid uppercase tracking-wide mb-3">
          Restaurant
        </h3>
        <p className="font-serif text-xl font-bold text-charcoal">{restaurant.name}</p>
        {restaurant.address && (
          <p className="text-sm text-mid mt-1">{restaurant.address}</p>
        )}
        <p className="text-sm text-mid mt-0.5">
          {[
            restaurant.price_level ? PRICE_LABELS[restaurant.price_level] : null,
            restaurant.rating ? `★ ${restaurant.rating}` : null,
            dinner.party_size ? `Party of ${dinner.party_size}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {/* Reservation details */}
        {dinner.reservation_platform && (
          <div className="mt-4 pt-4 border-t border-black/5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-mid">Reserved via</p>
              <p className="font-semibold text-charcoal text-sm">
                {getPlatformName(dinner.reservation_platform)}
                {dinner.confirmation_number && (
                  <span className="text-mid font-normal ml-2">
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
                className="text-sm font-semibold text-clay border border-clay/30 px-4 py-2 rounded-xl hover:bg-clay/5 transition-colors"
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
          <h3 className="font-semibold text-sm text-mid uppercase tracking-wide">
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
                      ? "bg-forest/15 text-forest border border-forest/30"
                      : "bg-black/10 text-charcoal border border-black/20"
                    : "bg-black/5 text-mid hover:bg-black/10"
                )}
              >
                {s === "going" ? "Going ✓" : "Can't make it"}
              </button>
            ))}
          </div>
        </div>

        {goingRsvps.length === 0 ? (
          <p className="text-sm text-mid">No RSVPs yet — be the first!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {goingRsvps.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 bg-warm-white border border-black/5 rounded-full px-3 py-1.5"
              >
                <div className="w-5 h-5 rounded-full bg-clay/20 flex items-center justify-center text-clay text-xs font-bold">
                  {(r.users.name || r.users.email).slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm text-charcoal">
                  {r.users.name || r.users.email.split("@")[0]}
                </span>
                {r.user_id === userId && (
                  <span className="text-xs text-mid">(you)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share button */}
      <div>
        <button
          onClick={handleShare}
          className="w-full bg-charcoal text-cream font-bold py-4 rounded-xl hover:bg-charcoal/90 transition-colors text-sm"
        >
          Share dinner details
        </button>

        {/* Fallback share sheet */}
        {shareOpen && (
          <div className="mt-3 bg-white border border-black/8 rounded-2xl p-4 flex flex-col gap-2">
            <button
              onClick={() => { shareViaWhatsApp(shareText); setShareOpen(false); }}
              className="text-left text-sm font-semibold text-charcoal hover:text-clay transition-colors px-2 py-1.5"
            >
              WhatsApp
            </button>
            <button
              onClick={handleCopy}
              className="text-left text-sm font-semibold text-charcoal hover:text-clay transition-colors px-2 py-1.5"
            >
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
