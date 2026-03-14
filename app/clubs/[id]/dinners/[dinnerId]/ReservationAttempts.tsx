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
};

export default function ReservationAttempts({ dinnerId, userId, attempts }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const myAttempt = attempts.find((a) => a.user_id === userId);
  const activeAttempts = attempts.filter((a) => a.status === "attempting");
  const isAttempting = myAttempt?.status === "attempting";
  const isSucceeded = myAttempt?.status === "succeeded";

  const handleToggleAttempt = async () => {
    setLoading(true);
    const supabase = createClient();

    if (isAttempting) {
      // Back out
      await supabase
        .from("reservation_attempts")
        .update({ status: "abandoned" })
        .eq("id", myAttempt!.id);
    } else if (myAttempt) {
      // Re-join
      await supabase
        .from("reservation_attempts")
        .update({ status: "attempting" })
        .eq("id", myAttempt.id);
    } else {
      // First time
      await supabase.from("reservation_attempts").insert({
        dinner_id: dinnerId,
        user_id: userId,
        status: "attempting",
        notes: null,
      });
    }

    router.refresh();
    setLoading(false);
  };

  const handleGotIt = async () => {
    if (!myAttempt) return;
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("reservation_attempts")
      .update({ status: "succeeded" })
      .eq("id", myAttempt.id);
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Who's trying */}
      <div className="bg-white border border-black/8 rounded-2xl p-5">
        <h3 className="font-semibold text-sm text-mid uppercase tracking-wide mb-4">
          Trying to get a table · {activeAttempts.length}
        </h3>

        {activeAttempts.length === 0 ? (
          <p className="text-sm text-mid">
            No one&apos;s on it yet — be the first!
          </p>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {activeAttempts.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-clay/15 flex items-center justify-center text-clay text-xs font-bold shrink-0">
                  {(a.users.name || a.users.email).slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm text-charcoal">
                  {a.users.name || a.users.email.split("@")[0]}
                </span>
                {a.user_id === userId && (
                  <span className="text-xs text-mid">(you)</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Toggle button */}
        {!isSucceeded && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleToggleAttempt}
              disabled={loading}
              className={cn(
                "flex-1 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40",
                isAttempting
                  ? "bg-black/5 text-charcoal hover:bg-black/10"
                  : "bg-clay text-white hover:bg-clay-dark"
              )}
            >
              {loading ? "…" : isAttempting ? "Never mind" : "I'll try to get a table"}
            </button>

            {isAttempting && (
              <button
                onClick={handleGotIt}
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-semibold text-sm bg-forest/15 text-forest border border-forest/30 hover:bg-forest/25 transition-all disabled:opacity-40"
              >
                {loading ? "…" : "I got it! →"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirm form — shown to whoever got the reservation */}
      {isSucceeded && (
        <div>
          <p className="text-sm font-semibold text-forest mb-3">
            Nice work! Fill in the details to confirm for the group.
          </p>
          <ConfirmReservationForm dinnerId={dinnerId} />
        </div>
      )}

    </div>
  );
}
