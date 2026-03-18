"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "./actions";

export default function AcceptInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const { clubId } = await acceptInvite(inviteId);
      router.push(`/clubs/${clubId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleAccept}
        disabled={loading}
        className="text-xs font-semibold text-white bg-slate px-4 py-1.5 rounded-lg hover:bg-slate-light transition-colors disabled:opacity-40 shrink-0"
      >
        {loading ? "Joining…" : "Accept →"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
