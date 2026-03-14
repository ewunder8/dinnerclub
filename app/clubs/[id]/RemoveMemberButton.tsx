"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RemoveMemberButton({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    if (!confirm(`Remove ${memberName} from the club?`)) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("club_members").delete().eq("id", memberId);
    router.refresh();
    setLoading(false);
  };

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      className="text-xs text-ink-muted hover:text-red-500 transition-colors disabled:opacity-40"
    >
      {loading ? "…" : "Remove"}
    </button>
  );
}
