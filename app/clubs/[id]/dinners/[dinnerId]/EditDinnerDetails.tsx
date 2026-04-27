"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Calendar, Pencil } from "lucide-react";
import { updateDinnerDetails, addCohost, removeCohost } from "./actions";

type CoHost = { userId: string; name: string };

type Props = {
  dinnerId: string;
  initial: {
    title: string | null;
    targetDate: string | null;
  };
  cohosts?: CoHost[];
  eligibleCohostMembers?: CoHost[];
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

export default function EditDinnerDetails({ dinnerId, initial, cohosts = [], eligibleCohostMembers = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState(initial.title ?? "");
  const [targetDate, setTargetDate] = useState(toDatetimeLocal(initial.targetDate));
  const [cohostLoading, setCohostLoading] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetDateRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await updateDinnerDetails({
      dinnerId,
      title: title.trim() || null,
      cuisine: null,
      price: null,
      vibe: null,
      neighborhood: null,
      targetDate: targetDate || null,
      pollClosesAt: null,
    });
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setOpen(false);
    router.refresh();
    setSaving(false);
  };

  const handleAddCohost = async (userId: string) => {
    setCohostLoading(userId);
    const result = await addCohost({ dinnerId, userId });
    if (!result.error) router.refresh();
    setCohostLoading(null);
  };

  const handleRemoveCohost = async (userId: string) => {
    setCohostLoading(userId);
    const result = await removeCohost({ dinnerId, userId });
    if (!result.error) router.refresh();
    setCohostLoading(null);
  };

  const showCohostSection = cohosts.length > 0 || eligibleCohostMembers.length > 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center text-ink-muted hover:text-ink transition-colors"
        aria-label="Edit details"
      >
        <Pencil className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="mt-4 bg-white border border-black/8 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Edit dinner details</p>
        <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink text-lg leading-none">×</button>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-ink-muted mb-1.5">Dinner title</label>
        <input
          type="text"
          placeholder="e.g. Summer Omakase, Birthday dinner"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
        />
      </div>

      {/* Target date */}
      <div>
        <label className="block text-xs font-semibold text-ink-muted mb-1.5">Target date</label>
        <button
          type="button"
          onClick={() => targetDateRef.current?.showPicker()}
          className="w-full flex items-center gap-3 bg-surface border border-slate/20 rounded-xl px-4 py-3 text-left hover:border-slate transition-colors"
        >
          <Calendar className="w-4 h-4 text-ink-muted shrink-0" />
          <span className={cn("text-sm", targetDate ? "text-ink" : "text-ink-faint")}>
            {targetDate
              ? new Date(targetDate).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
              : "Pick a date & time"}
          </span>
          {targetDate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setTargetDate(""); }}
              className="ml-auto text-ink-muted hover:text-ink text-base leading-none"
            >×</button>
          )}
        </button>
        <input ref={targetDateRef} type="datetime-local" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="sr-only" />
      </div>

      {/* Cohosts */}
      {showCohostSection && (
        <div>
          <label className="block text-xs font-semibold text-ink-muted mb-2">Cohosts</label>
          <div className="flex flex-col gap-2">
            {cohosts.map((c) => (
              <div key={c.userId} className="flex items-center justify-between py-2 px-3 bg-black/3 rounded-xl">
                <span className="text-sm text-ink">{c.name}</span>
                <button
                  onClick={() => handleRemoveCohost(c.userId)}
                  disabled={cohostLoading === c.userId}
                  className="text-xs text-ink-muted hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  {cohostLoading === c.userId ? "…" : "Remove"}
                </button>
              </div>
            ))}
            {eligibleCohostMembers.map((m) => (
              <button
                key={m.userId}
                onClick={() => handleAddCohost(m.userId)}
                disabled={cohostLoading === m.userId}
                className="flex items-center justify-between py-2 px-3 rounded-xl border border-black/8 hover:border-slate/30 hover:bg-black/3 transition-colors disabled:opacity-40"
              >
                <span className="text-sm text-ink">{m.name}</span>
                <span className="text-xs text-citrus-dark font-semibold">
                  {cohostLoading === m.userId ? "…" : "+ Add"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-slate text-white font-bold py-3 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 text-sm"
      >
        {saving ? "Saving…" : "Save changes →"}
      </button>
    </div>
  );
}
