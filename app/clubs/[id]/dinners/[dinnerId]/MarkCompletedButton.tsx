"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MarkCompletedButton({ dinnerId }: { dinnerId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleComplete = async () => {
    if (!confirm("Mark this dinner as completed? This will open the ratings window for 7 days.")) return;
    setLoading(true);

    const ratingsOpenUntil = new Date();
    ratingsOpenUntil.setDate(ratingsOpenUntil.getDate() + 7);

    const supabase = createClient();
    await supabase
      .from("dinners")
      .update({
        status: "completed",
        ratings_open_until: ratingsOpenUntil.toISOString(),
      })
      .eq("id", dinnerId);

    router.refresh();
  };

  return (
    <button
      onClick={handleComplete}
      disabled={loading}
      className="text-xs font-semibold text-mid border border-black/10 px-4 py-2 rounded-xl hover:border-forest/40 hover:text-forest transition-colors disabled:opacity-40"
    >
      {loading ? "Saving…" : "Mark as completed"}
    </button>
  );
}
