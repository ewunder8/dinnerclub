"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; user_id: string; name: string };

export default function TransferOwnershipButton({
  clubId,
  currentUserId,
  members,
}: {
  clubId: string;
  currentUserId: string;
  members: Member[];
}) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = members.filter((m) => m.user_id !== currentUserId);

  const handleTransfer = async () => {
    if (!selectedUserId) return;
    const member = others.find((m) => m.user_id === selectedUserId);
    if (!confirm(`Transfer ownership to ${member?.name}? You'll become a regular member.`)) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Demote current owner, promote new owner
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("club_members").update({ role: "member" }).eq("club_id", clubId).eq("user_id", currentUserId),
      supabase.from("club_members").update({ role: "owner" }).eq("club_id", clubId).eq("user_id", selectedUserId),
    ]);

    if (e1 || e2) { setError("Transfer failed. Try again."); setLoading(false); return; }
    router.push(`/clubs/${clubId}`);
  };

  if (others.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <select
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        className="w-full border border-slate/20 rounded-xl px-4 py-3 text-ink bg-surface focus:outline-none focus:border-slate"
      >
        <option value="">Select a member…</option>
        {others.map((m) => (
          <option key={m.user_id} value={m.user_id}>{m.name}</option>
        ))}
      </select>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        onClick={handleTransfer}
        disabled={loading || !selectedUserId}
        className="text-sm font-semibold text-ink border border-black/10 px-4 py-2.5 rounded-xl hover:border-slate/40 transition-colors disabled:opacity-40"
      >
        {loading ? "Transferring…" : "Transfer ownership"}
      </button>
    </div>
  );
}
