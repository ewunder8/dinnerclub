"use client";

import { useState } from "react";
import Link from "next/link";

type Dinner = {
  id: string;
  status: string;
  winning_restaurant_place_id: string | null;
  theme_cuisine: string | null;
  theme_neighborhood: string | null;
  reservation_datetime: string | null;
  created_at: string;
};

type ConfirmedSeat = {
  id: string;
  restaurantName: string;
  reservationDatetime: string;
};

type Props = {
  dinners: Dinner[];
  clubId: string;
  restaurantNameMap: Record<string, string>;
  confirmedSeats?: ConfirmedSeat[];
};

const PAGE_SIZE = 5;

export default function DinnersList({ dinners, clubId, restaurantNameMap, confirmedSeats = [] }: Props) {
  const [showing, setShowing] = useState(PAGE_SIZE);
  const visible = dinners.slice(0, showing);
  const remaining = dinners.length - showing;

  if (dinners.length === 0 && confirmedSeats.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-4xl mb-4">🍽️</p>
        <p className="font-semibold text-ink mb-2">No dinners yet</p>
        <p className="text-ink-muted text-sm mb-6">
          Start a poll and let the crew vote on where to eat.
        </p>
        <Link
          href={`/clubs/${clubId}/dinners/new`}
          className="inline-block bg-slate text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-light transition-colors"
        >
          Start a dinner →
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-black/5">
      {/* Confirmed open seats shown at the top */}
      {confirmedSeats.map((seat) => (
        <div key={seat.id} className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="font-semibold text-ink text-sm">{seat.restaurantName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs bg-citrus/15 text-citrus-dark font-semibold px-2 py-0.5 rounded-full">Open seat</span>
              <p className="text-xs text-ink-muted">
                {new Date(seat.reservationDatetime).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <span className="text-ink-muted text-sm">→</span>
        </div>
      ))}

      {visible.map((dinner) => {
        const restaurantName = dinner.winning_restaurant_place_id
          ? restaurantNameMap[dinner.winning_restaurant_place_id]
          : null;
        const theme = [dinner.theme_cuisine, dinner.theme_neighborhood]
          .filter(Boolean)
          .join(" · ");
        const label = restaurantName ?? theme ?? "Dinner poll";
        const dateStr = dinner.reservation_datetime ?? dinner.created_at;
        return (
          <Link
            key={dinner.id}
            href={`/clubs/${clubId}/dinners/${dinner.id}`}
            className="flex items-center justify-between px-5 py-4 hover:bg-surface transition-colors"
          >
            <div>
              <p className="font-semibold text-ink text-sm">{label}</p>
              <p className="text-xs text-ink-muted mt-0.5 capitalize">
                {dinner.status.replace(/_/g, " ")} ·{" "}
                {new Date(dateStr).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <span className="text-ink-muted text-sm">→</span>
          </Link>
        );
      })}
      {remaining > 0 && (
        <button
          onClick={() => setShowing((s) => s + PAGE_SIZE)}
          className="w-full px-5 py-3 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface transition-colors text-center"
        >
          Show {Math.min(remaining, PAGE_SIZE)} more ({remaining} remaining)
        </button>
      )}
    </div>
  );
}
