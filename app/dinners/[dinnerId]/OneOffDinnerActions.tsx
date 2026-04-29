"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOneOffDinner, markOneOffCompleted } from "@/app/clubs/[id]/dinners/[dinnerId]/actions";
import { toast } from "sonner";

export default function OneOffDinnerActions({ dinnerId }: { dinnerId: string }) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    const result = await markOneOffCompleted({ dinnerId });
    if (result.error) {
      toast.error(result.error);
      setCompleting(false);
      return;
    }
    router.refresh();
  };

  const handleCancel = async () => {
    setCancelling(true);
    const result = await cancelOneOffDinner({ dinnerId });
    if (result.error) {
      toast.error(result.error);
      setCancelling(false);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleComplete}
        disabled={completing}
        className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 text-sm"
      >
        {completing ? "Saving…" : "Mark dinner as completed →"}
      </button>

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
              onClick={handleCancel}
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
    </div>
  );
}
