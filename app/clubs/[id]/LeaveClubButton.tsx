"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LeaveClubButton({ clubId, memberId }: { clubId: string; memberId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLeave = async () => {
    if (!confirm("Leave this club? You'll need a new invite to rejoin.")) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("club_members").delete().eq("id", memberId);
    router.push("/dashboard");
  };

  return (
    <button
      onClick={handleLeave}
      disabled={loading}
      className="text-sm text-ink-muted hover:text-red-500 transition-colors disabled:opacity-40"
    >
      {loading ? "Leaving…" : "Leave club"}
    </button>
  );
}
