"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PollState } from "@/lib/supabase/database.types";

type Props = {
  dinnerId: string;
  clubId: string;
  pollState: PollState;
};

export default function OwnerControls({ dinnerId, clubId, pollState }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenVoting = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("dinners")
      .update({ voting_open: true })
      .eq("id", dinnerId);
    if (updateError) { setError("Failed to open voting. Try again."); setLoading(false); return; }
    router.refresh();
    setLoading(false);
  };

  const handleCloseVoting = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("dinners")
      .update({ voting_open: false })
      .eq("id", dinnerId);
    if (updateError) { setError("Failed to close voting. Try again."); setLoading(false); return; }
    router.refresh();
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this dinner? This can't be undone.")) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("dinners").update({ status: "cancelled" }).eq("id", dinnerId);
    router.push(`/clubs/${clubId}`);
  };

  return (
    <div className="bg-slate/5 border border-slate/10 rounded-2xl px-5 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink font-semibold">Owner controls</p>
        <div className="flex items-center gap-3">
          {pollState === "ready_to_open" && (
            <button
              onClick={handleOpenVoting}
              disabled={loading}
              className="bg-slate text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40"
            >
              {loading ? "Opening…" : "Open voting →"}
            </button>
          )}
          {pollState === "voting_open" && (
            <button
              onClick={handleCloseVoting}
              disabled={loading}
              className="bg-black/10 text-ink text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-black/20 transition-colors disabled:opacity-40"
            >
              {loading ? "Closing…" : "Close voting"}
            </button>
          )}
          <button
            onClick={handleCancel}
            disabled={loading}
            className="text-xs text-ink-muted hover:text-red-500 transition-colors disabled:opacity-40"
          >
            Cancel dinner
          </button>
        </div>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}
