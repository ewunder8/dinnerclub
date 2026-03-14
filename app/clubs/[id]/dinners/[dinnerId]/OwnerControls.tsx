"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PollState } from "@/lib/supabase/database.types";

type Props = {
  dinnerId: string;
  pollState: PollState;
};

export default function OwnerControls({ dinnerId, pollState }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (pollState !== "ready_to_open" && pollState !== "voting_open") {
    return null;
  }

  const handleOpenVoting = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("dinners")
      .update({ voting_open: true })
      .eq("id", dinnerId);
    router.refresh();
    setLoading(false);
  };

  const handleCloseVoting = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("dinners")
      .update({ voting_open: false })
      .eq("id", dinnerId);
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="bg-charcoal/5 border border-charcoal/10 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
      <p className="text-sm text-charcoal font-semibold">Owner controls</p>
      <div className="flex gap-2">
        {pollState === "ready_to_open" && (
          <button
            onClick={handleOpenVoting}
            disabled={loading}
            className="bg-clay text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-clay-dark transition-colors disabled:opacity-40"
          >
            {loading ? "Opening…" : "Open voting →"}
          </button>
        )}
        {pollState === "voting_open" && (
          <button
            onClick={handleCloseVoting}
            disabled={loading}
            className="bg-black/10 text-charcoal text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-black/20 transition-colors disabled:opacity-40"
          >
            {loading ? "Closing…" : "Close voting"}
          </button>
        )}
      </div>
    </div>
  );
}
