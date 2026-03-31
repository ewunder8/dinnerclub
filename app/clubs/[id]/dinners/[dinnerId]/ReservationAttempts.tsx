"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ConfirmReservationForm from "./ConfirmReservationForm";
import { setWaitlisted, giveUpWaitlist } from "./actions";
import type { ReservationAttempt, User } from "@/lib/supabase/database.types";

type AttemptWithUser = ReservationAttempt & { users: User };

type Props = {
  dinnerId: string;
  clubId: string;
  userId: string;
  attempts: AttemptWithUser[];
  topOptions?: { place_id: string; name: string }[];
  dinnerStatus?: string;
};

export default function ReservationAttempts({ dinnerId, clubId, userId, attempts, topOptions, dinnerStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myAttempt = attempts.find((a) => a.user_id === userId);
  const activeAttempts = attempts.filter((a) => a.status === "attempting");
  const waitlistedAttempts = attempts.filter((a) => a.status === "waitlisted");
  const succeededAttempt = attempts.find((a) => a.status === "succeeded");

  const isAttempting = myAttempt?.status === "attempting";
  const isWaitlisted = myAttempt?.status === "waitlisted";
  const isSucceeded = myAttempt?.status === "succeeded";
  const isWaitlistedDinner = dinnerStatus === "waitlisted";

  const handleToggleAttempt = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    if (isAttempting) {
      const { error: e } = await supabase
        .from("reservation_attempts")
        .update({ status: "abandoned" })
        .eq("id", myAttempt!.id);
      if (e) { setError("Something went wrong. Try again."); setLoading(false); return; }
    } else if (myAttempt) {
      const { error: e } = await supabase
        .from("reservation_attempts")
        .update({ status: "attempting" })
        .eq("id", myAttempt.id);
      if (e) { setError("Something went wrong. Try again."); setLoading(false); return; }
    } else {
      const { error: e } = await supabase.from("reservation_attempts").upsert(
        { dinner_id: dinnerId, user_id: userId, status: "attempting", notes: null },
        { onConflict: "dinner_id,user_id" }
      );
      if (e) { setError("Something went wrong. Try again."); setLoading(false); return; }
    }

    router.refresh();
    setLoading(false);
  };

  const handleGotIt = async () => {
    if (!myAttempt) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase
      .from("reservation_attempts")
      .update({ status: "succeeded" })
      .eq("id", myAttempt.id);
    if (e) { setError("Something went wrong. Try again."); setLoading(false); return; }
    router.refresh();
    setLoading(false);
  };

  const handleSetWaitlisted = async () => {
    setLoading(true);
    const result = await setWaitlisted({ dinnerId });
    if (result.error) toast.error(result.error);
    else toast.success("Marked as waitlisted.");
    router.refresh();
    setLoading(false);
  };

  const handleGiveUp = async () => {
    setLoading(true);
    const result = await giveUpWaitlist({ dinnerId });
    if (result.error) toast.error(result.error);
    else if (result.revertedToVoting) toast.success("Back to picking a restaurant.");
    else toast.success("Removed from waitlist.");
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Waitlisted banner — visible to everyone */}
      {isWaitlistedDinner && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-xl shrink-0">⏳</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              {waitlistedAttempts.length === 0
                ? "On the waitlist"
                : waitlistedAttempts.length === 1
                ? `${waitlistedAttempts[0].users.name || waitlistedAttempts[0].users.email.split("@")[0]} is on the waitlist`
                : `${waitlistedAttempts.length} people on the waitlist`}
            </p>
            {waitlistedAttempts.length > 1 && (
              <p className="text-xs text-amber-700 mt-0.5">
                {waitlistedAttempts.map((a) => a.users.name || a.users.email.split("@")[0]).join(", ")}
              </p>
            )}
            <p className="text-xs text-amber-700 mt-0.5">
              Fingers crossed — they'll update the group when a table opens up.
            </p>
          </div>
        </div>
      )}

      {/* Who's trying */}
      {!isSucceeded && (
        <div className="bg-white border border-black/8 rounded-2xl p-5">
          <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide mb-4">
            Trying to get a table · {activeAttempts.length}
          </h3>

          {activeAttempts.length === 0 ? (
            <p className="text-sm text-ink-muted">No one&apos;s on it yet — be the first!</p>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {activeAttempts.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-citrus/15 flex items-center justify-center text-citrus-dark text-xs font-bold shrink-0">
                    {(a.users.name || a.users.email).slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm text-ink">
                    {a.users.name || a.users.email.split("@")[0]}
                  </span>
                  {a.user_id === userId && <span className="text-xs text-ink-muted">(you)</span>}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

          <div className="flex gap-2 mt-3 flex-wrap">
            {/* Can't toggle attempt once waitlisted — just show the join waitlist option */}
            {!isWaitlistedDinner && (
              <button
                onClick={handleToggleAttempt}
                disabled={loading}
                className={cn(
                  "flex-1 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40",
                  isAttempting
                    ? "bg-black/5 text-ink hover:bg-black/10"
                    : "bg-slate text-white hover:bg-slate-light"
                )}
              >
                {loading ? "…" : isAttempting ? "Never mind" : "I'll try to get a table"}
              </button>
            )}

            {isAttempting && !isWaitlistedDinner && (
              <>
                <button
                  onClick={handleSetWaitlisted}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-40"
                >
                  {loading ? "…" : "We're on the waitlist"}
                </button>
                <button
                  onClick={handleGotIt}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-green-100 text-green-600 border border-green-300 hover:bg-green-200 transition-all disabled:opacity-40"
                >
                  {loading ? "…" : "I got it! →"}
                </button>
              </>
            )}

            {/* When dinner is waitlisted, attempting members can also join the waitlist */}
            {isAttempting && isWaitlistedDinner && (
              <button
                onClick={handleSetWaitlisted}
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-semibold text-sm bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-40"
              >
                {loading ? "…" : "I'm also on the waitlist"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Waitlist management — for anyone who joined the waitlist */}
      {isWaitlistedDinner && isWaitlisted && !isSucceeded && (
        <div className="bg-white border border-black/8 rounded-2xl p-5">
          <p className="text-sm font-semibold text-ink mb-1">You&apos;re on the waitlist</p>
          <p className="text-xs text-ink-muted mb-4">
            {waitlistedAttempts.length > 1
              ? `You and ${waitlistedAttempts.length - 1} other${waitlistedAttempts.length - 1 > 1 ? "s" : ""} are trying — first one in gets it.`
              : "Let the group know when you hear back."}
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleGotIt}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-green-100 text-green-600 border border-green-300 hover:bg-green-200 transition-all disabled:opacity-40"
            >
              {loading ? "…" : "I got the table! →"}
            </button>
            <button
              onClick={handleGiveUp}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-black/5 text-ink-muted hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
            >
              {loading ? "…" : "No luck"}
            </button>
          </div>
        </div>
      )}

      {/* Crown — show who got it */}
      {succeededAttempt && (
        <div className="bg-citrus-light border border-citrus/30 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">👑</span>
          <div>
            <p className="font-semibold text-ink text-sm">
              {succeededAttempt.users.name || succeededAttempt.users.email.split("@")[0]}
              {succeededAttempt.user_id === userId && " (you)"}
            </p>
            <p className="text-xs text-ink-muted">Booked the table</p>
          </div>
        </div>
      )}

      {/* Confirm form — shown to whoever got the reservation */}
      {isSucceeded && (
        <div>
          <p className="text-sm font-semibold text-green-600 mb-3">
            Nice work! Fill in the details to confirm for the group.
          </p>
          <ConfirmReservationForm dinnerId={dinnerId} clubId={clubId} userId={userId} topOptions={topOptions} />
        </div>
      )}

    </div>
  );
}
