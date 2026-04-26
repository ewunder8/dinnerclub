"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addCohost, removeCohost } from "./actions";

type CoHost = { userId: string; name: string };
type EligibleMember = { userId: string; name: string };

type Props = {
  dinnerId: string;
  cohosts: CoHost[];
  eligibleMembers: EligibleMember[];
};

export default function CoHostManager({ dinnerId, cohosts, eligibleMembers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleAdd = async (userId: string) => {
    setLoading(userId);
    const result = await addCohost({ dinnerId, userId });
    if (result.error) toast.error(result.error);
    else { toast.success("Cohost added."); router.refresh(); }
    setLoading(null);
  };

  const handleRemove = async (userId: string) => {
    setLoading(userId);
    const result = await removeCohost({ dinnerId, userId });
    if (result.error) toast.error(result.error);
    else { toast.success("Cohost removed."); router.refresh(); }
    setLoading(null);
  };

  return (
    <div className="bg-white border border-black/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">Cohosts</p>
          {cohosts.length > 0 && (
            <p className="text-sm text-ink mt-0.5">{cohosts.map((c) => c.name).join(", ")}</p>
          )}
        </div>
        <span className="text-ink-muted text-sm shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-black/5 px-5 pb-5 pt-4 flex flex-col gap-4">
          {/* Current cohosts */}
          {cohosts.length > 0 && (
            <div className="flex flex-col gap-2">
              {cohosts.map((c) => (
                <div key={c.userId} className="flex items-center justify-between">
                  <span className="text-sm text-ink">{c.name}</span>
                  <button
                    onClick={() => handleRemove(c.userId)}
                    disabled={loading === c.userId}
                    className="text-xs text-ink-muted hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {loading === c.userId ? "…" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add from eligible members */}
          {eligibleMembers.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-ink-muted mb-1">Add a cohost</p>
              {eligibleMembers.map((m) => (
                <button
                  key={m.userId}
                  onClick={() => handleAdd(m.userId)}
                  disabled={loading === m.userId}
                  className="flex items-center justify-between py-2.5 px-4 rounded-xl border border-black/8 hover:border-slate/30 hover:bg-black/5 transition-colors text-sm text-ink disabled:opacity-40"
                >
                  <span>{m.name}</span>
                  <span className="text-xs text-citrus-dark font-semibold">
                    {loading === m.userId ? "…" : "+ Add"}
                  </span>
                </button>
              ))}
            </div>
          ) : cohosts.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No eligible members yet. Cohosts can be added once people RSVP or join.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
