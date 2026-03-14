"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CancelDinnerButton({ dinnerId, clubId }: { dinnerId: string; clubId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCancel = async () => {
    if (!confirm("Cancel this dinner? This can't be undone.")) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("dinners").update({ status: "cancelled" }).eq("id", dinnerId);
    router.push(`/clubs/${clubId}`);
  };

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="text-xs text-ink-muted hover:text-red-500 transition-colors disabled:opacity-40"
    >
      {loading ? "Cancelling…" : "Cancel dinner"}
    </button>
  );
}
