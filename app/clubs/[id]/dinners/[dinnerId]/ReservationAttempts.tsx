"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import ConfirmReservationForm from "./ConfirmReservationForm";
import type { ReservationAttempt, User } from "@/lib/supabase/database.types";

type AttemptWithUser = ReservationAttempt & { users: User };

type Props = {
  dinnerId: string;
  userId: string;
  attempts: AttemptWithUser[];
  topOptions?: { place_id: string; name: string }[];
};

export default function ReservationAttempts({ dinnerId, userId, attempts, topOptions }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myAttempt = attempts.find((a) => a.user_id === userId);
  const activeAttempts = attempts.filter((a) => a.status === "attempting");
  const succeededAttempt = attempts.find((a) => a.status === "succeeded");
  const isAttempting = myAttempt?.status === "attempting";
  const isSucceeded = myAttempt?.status === "succeeded";

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
      const { error: e } = await supabase.from("reservation_attempts").insert({
        dinner_id: dinnerId,
        user_id: userId,
        status: "attempting",
        notes: null,
      });
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

  return (
    <div className="flex flex-col gap-4">

      {/* Who's trying */}
      <div className="bg-white border border-black/8 rounded-2xl p-5">
        <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide mb-4">
          Trying to get a table · {activeAttempts.length}
        </h3>

        {activeAttempts.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No one&apos;s on it yet — be the first!
          </p>
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
                {a.user_id === userId && (
                  <span className="text-xs text-ink-muted">(you)</span>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

        {/* Toggle button */}
        {!isSucceeded && (
          <div className="flex gap-2 mt-3">
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

            {isAttempting && (
              <button
                onClick={handleGotIt}
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-semibold text-sm bg-green-100 text-green-600 border border-green-300 hover:bg-green-200 transition-all disabled:opacity-40"
              >
                {loading ? "…" : "I got it! →"}
              </button>
            )}
          </div>
        )}
      </div>

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
          <ConfirmReservationForm dinnerId={dinnerId} userId={userId} topOptions={topOptions} />
        </div>
      )}

    </div>
  );
}
