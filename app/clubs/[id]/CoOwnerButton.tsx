"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMemberRole } from "./actions";

export default function CoOwnerButton({
  clubId,
  targetUserId,
  currentRole,
  memberName,
}: {
  clubId: string;
  targetUserId: string;
  currentRole: string;
  memberName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isCoOwner = currentRole === "owner";

  const handleClick = async () => {
    const newRole = isCoOwner ? "member" : "owner";
    const msg = isCoOwner
      ? `Remove co-owner status from ${memberName}?`
      : `Make ${memberName} a co-owner? They'll have the same permissions as you.`;
    if (!confirm(msg)) return;

    setLoading(true);
    try {
      await updateMemberRole(clubId, targetUserId, newRole);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs font-semibold text-ink-muted border border-black/10 px-2.5 py-1 rounded-lg hover:bg-black/5 transition-colors disabled:opacity-40"
    >
      {loading ? "…" : isCoOwner ? "Co-owner ✓" : "Make co-owner"}
    </button>
  );
}
