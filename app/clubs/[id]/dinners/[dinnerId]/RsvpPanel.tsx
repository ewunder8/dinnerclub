"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { rsvpDinner } from "./actions";
import ReservationAttempts from "./ReservationAttempts";
import ConfirmReservationForm from "./ConfirmReservationForm";
import type { ReservationAttempt, User } from "@/lib/supabase/database.types";

type RsvpMember = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  status: "going" | "not_going" | null;
};

type AttemptWithUser = ReservationAttempt & { users: User };

type TopOption = { place_id: string; name: string };

type Props = {
  dinnerId: string;
  clubId: string;
  userId: string;
  isCreator: boolean;
  members: RsvpMember[];
  attempts: AttemptWithUser[];
  topOptions: TopOption[];
  dinnerStatus: string;
};

export default function RsvpPanel({
  dinnerId,
  clubId,
  userId,
  isCreator,
  members,
  attempts,
  topOptions,
  dinnerStatus,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"going" | "not_going" | null>(null);

  const myStatus = members.find((m) => m.userId === userId)?.status ?? null;
  const goingCount = members.filter((m) => m.status === "going").length;

  const handleRsvp = async (status: "going" | "not_going") => {
    setLoading(status);
    const result = await rsvpDinner({ dinnerId, status });
    if (result.error) toast.error(result.error);
    router.refresh();
    setLoading(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* RSVP section */}
      <div className="bg-white border border-black/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">
            Who's in · {goingCount} going
          </p>
        </div>

        <div className="divide-y divide-black/5">
          {members.map((m) => (
            <div key={m.userId} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt={m.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-citrus/20 flex items-center justify-center text-citrus-dark text-xs font-bold shrink-0">
                    {m.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold text-ink truncate">{m.name}</span>
                {m.userId === userId && <span className="text-xs text-ink-muted shrink-0">you</span>}
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                  m.status === "going"
                    ? "bg-green-100 text-green-700"
                    : m.status === "not_going"
                    ? "bg-red-50 text-red-400"
                    : "bg-black/5 text-ink-muted"
                }`}
              >
                {m.status === "going" ? "✓ Going" : m.status === "not_going" ? "Can't make it" : "Pending"}
              </span>
            </div>
          ))}
        </div>

        {/* My RSVP buttons */}
        <div className="px-5 py-4 border-t border-black/5 flex gap-3">
          <button
            onClick={() => handleRsvp("going")}
            disabled={loading !== null}
            className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 ${
              myStatus === "going"
                ? "bg-green-500 text-white"
                : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
            }`}
          >
            {loading === "going" ? "…" : myStatus === "going" ? "✓ I'm in" : "I'm in"}
          </button>
          <button
            onClick={() => handleRsvp("not_going")}
            disabled={loading !== null}
            className={`flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 ${
              myStatus === "not_going"
                ? "bg-red-100 text-red-500 border border-red-200"
                : "bg-black/5 text-ink-muted hover:bg-black/8 hover:text-ink"
            }`}
          >
            {loading === "not_going" ? "…" : "Can't make it"}
          </button>
        </div>
      </div>

      {/* Reservation claiming — show for both seeking and waitlisted */}
      {(dinnerStatus === "seeking_reservation" || dinnerStatus === "waitlisted") && (
        <div className="flex flex-col gap-4">
          {dinnerStatus === "seeking_reservation" && (
            <div className="bg-slate rounded-2xl px-5 py-4">
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Next step</p>
              <p className="font-semibold text-white text-sm">
                Someone needs to book a table.
                {goingCount > 0 && (
                  <> Book for <strong>{goingCount} {goingCount === 1 ? "person" : "people"}</strong> going so far.</>
                )}
              </p>
            </div>
          )}

          <ReservationAttempts
            dinnerId={dinnerId}
            clubId={clubId}
            userId={userId}
            attempts={attempts}
            topOptions={topOptions}
            dinnerStatus={dinnerStatus}
          />

          {isCreator && dinnerStatus === "seeking_reservation" && (
            <ConfirmReservationForm
              dinnerId={dinnerId}
              clubId={clubId}
              userId={userId}
              topOptions={topOptions}
            />
          )}
        </div>
      )}
    </div>
  );
}
