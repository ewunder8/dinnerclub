"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markCompleted } from "./actions";

export default function MarkCompletedButton({ dinnerId, clubId }: { dinnerId: string; clubId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleComplete = async () => {
    if (!confirm("Mark this dinner as completed? This will open the ratings window for 7 days.")) return;
    setLoading(true);
    try {
      await markCompleted({ dinnerId, clubId });
      router.refresh();
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleComplete}
      disabled={loading}
      className="text-xs font-semibold text-ink-muted border border-black/10 px-4 py-2 rounded-xl hover:border-green-300 hover:text-green-600 transition-colors disabled:opacity-40"
    >
      {loading ? "Saving…" : "Mark as completed"}
    </button>
  );
}
