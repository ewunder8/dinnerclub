"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { rsvpDinner } from "./actions";
import ReservationAttempts from "./ReservationAttempts";
import UserAvatar from "@/components/UserAvatar";
import type { ReservationAttempt, User } from "@/lib/supabase/database.types";

type RsvpMember = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  status: "going" | "not_going" | null;
  plus_ones: number;
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
  plusOnesEnabled: boolean;
  plusOnesMax: number | null;
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
  plusOnesEnabled,
  plusOnesMax,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"going" | "not_going" | null>(null);
  const [plusOnes, setPlusOnes] = useState(0);
  const [savingPlusOnes, setSavingPlusOnes] = useState(false);

  const myMember = members.find((m) => m.userId === userId);
  const myStatus = myMember?.status ?? null;
  const goingMembers = members.filter((m) => m.status === "going");
  const goingCount = goingMembers.length;
  const totalAttending = goingMembers.reduce((sum, m) => sum + 1 + m.plus_ones, 0);

  // Sync plus_ones stepper from RSVP data
  useEffect(() => {
    setPlusOnes(myMember?.plus_ones ?? 0);
  }, [myMember?.plus_ones]);

  const handleRsvp = async (status: "going" | "not_going") => {
    setLoading(status);
    const result = await rsvpDinner({ dinnerId, status });
    if (result.error) toast.error(result.error);
    router.refresh();
    setLoading(null);
  };

  const handleSavePlusOnes = async () => {
    setSavingPlusOnes(true);
    const result = await rsvpDinner({ dinnerId, status: "going", plus_ones: plusOnes });
    if (result.error) toast.error(result.error);
    router.refresh();
    setSavingPlusOnes(false);
  };

  const maxAllowed = plusOnesMax ?? 10;

  return (
    <div className="flex flex-col gap-6">

      {/* Big RSVP prompt — only when user hasn't responded yet */}
      {myStatus === null && (
        <div className="bg-white border border-black/8 rounded-2xl p-5">
          <p className="font-sans text-xl font-bold text-ink mb-1">Are you coming?</p>
          <p className="text-sm text-ink-muted mb-4">Let the group know so someone can book a table.</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleRsvp("going")}
              disabled={loading !== null}
              className="flex-1 py-4 rounded-xl font-bold text-sm bg-green-500 text-white hover:bg-green-600 transition-all disabled:opacity-40"
            >
              {loading === "going" ? "…" : "I'm in 🙌"}
            </button>
            <button
              onClick={() => handleRsvp("not_going")}
              disabled={loading !== null}
              className="flex-1 py-4 rounded-xl font-semibold text-sm bg-black/5 text-ink-muted hover:bg-black/10 hover:text-ink transition-all disabled:opacity-40"
            >
              {loading === "not_going" ? "…" : "Can't make it"}
            </button>
          </div>
        </div>
      )}

      {/* Who's in list */}
      <div className="bg-white border border-black/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">
            Who's in · {goingCount} going
            {plusOnesEnabled && totalAttending > goingCount && (
              <span className="ml-1 font-normal normal-case">({totalAttending} attending)</span>
            )}
          </p>
        </div>

        <div className="divide-y divide-black/5">
          {members.map((m) => (
            <div key={m.userId} className="px-5 py-3 flex items-center justify-between gap-3">
              <Link href={`/users/${m.userId}`} className="flex items-center gap-2.5 min-w-0 hover:opacity-75 transition-opacity">
                <UserAvatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                <span className="text-sm font-semibold text-ink truncate">{m.name}</span>
                {m.userId === userId && <span className="text-xs text-ink-muted shrink-0">you</span>}
                {plusOnesEnabled && m.status === "going" && m.plus_ones > 0 && (
                  <span className="text-xs text-ink-muted shrink-0">+{m.plus_ones}</span>
                )}
              </Link>
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

        {/* Change answer row — compact, only when already responded */}
        {myStatus !== null && (
          <div className="px-5 py-3 border-t border-black/5 flex items-center gap-3">
            <span className="text-xs text-ink-muted shrink-0">Change your answer:</span>
            <button
              onClick={() => handleRsvp("going")}
              disabled={loading !== null}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 ${
                myStatus === "going"
                  ? "bg-green-500 text-white"
                  : "bg-black/5 text-ink-muted hover:bg-green-50 hover:text-green-700"
              }`}
            >
              {loading === "going" ? "…" : "I'm in"}
            </button>
            <button
              onClick={() => handleRsvp("not_going")}
              disabled={loading !== null}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 ${
                myStatus === "not_going"
                  ? "bg-red-100 text-red-500 border border-red-200"
                  : "bg-black/5 text-ink-muted hover:bg-red-50 hover:text-red-400"
              }`}
            >
              {loading === "not_going" ? "…" : "Can't make it"}
            </button>
          </div>
        )}

        {/* Plus ones stepper — only when going and feature is enabled */}
        {plusOnesEnabled && myStatus === "going" && (
          <div className="px-5 py-3 border-t border-black/5 flex items-center gap-3">
            <span className="text-xs text-ink-muted shrink-0">Bringing guests?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlusOnes((n) => Math.max(0, n - 1))}
                disabled={plusOnes === 0}
                className="w-7 h-7 rounded-lg border border-black/15 text-ink-muted hover:bg-black/5 transition-colors disabled:opacity-30 text-base leading-none flex items-center justify-center"
              >
                −
              </button>
              <span className="text-sm font-semibold text-ink w-4 text-center">{plusOnes}</span>
              <button
                type="button"
                onClick={() => setPlusOnes((n) => Math.min(maxAllowed, n + 1))}
                disabled={plusOnes >= maxAllowed}
                className="w-7 h-7 rounded-lg border border-black/15 text-ink-muted hover:bg-black/5 transition-colors disabled:opacity-30 text-base leading-none flex items-center justify-center"
              >
                +
              </button>
            </div>
            {plusOnes !== (myMember?.plus_ones ?? 0) && (
              <button
                type="button"
                onClick={handleSavePlusOnes}
                disabled={savingPlusOnes}
                className="ml-auto text-xs font-semibold text-white bg-slate px-3 py-1.5 rounded-lg hover:bg-slate-light transition-colors disabled:opacity-40"
              >
                {savingPlusOnes ? "…" : "Save"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reservation claiming — show for both seeking and waitlisted */}
      {(dinnerStatus === "seeking_reservation" || dinnerStatus === "waitlisted") && (
        <div className="flex flex-col gap-4">
          {dinnerStatus === "seeking_reservation" && (
            <div className="bg-slate rounded-2xl px-5 py-4">
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Next step</p>
              <p className="font-semibold text-white text-sm">
                Someone needs to book a table.
                {totalAttending > 0 && (
                  <> Book for <strong>{totalAttending} {totalAttending === 1 ? "person" : "people"}</strong>
                  {plusOnesEnabled && totalAttending > goingCount && ` (${goingCount} members + ${totalAttending - goingCount} guests)`}
                  .</>
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

        </div>
      )}
    </div>
  );
}
