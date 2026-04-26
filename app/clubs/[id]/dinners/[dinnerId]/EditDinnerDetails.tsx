"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Calendar, Pencil } from "lucide-react";
import { updateDinnerDetails } from "./actions";

type Props = {
  dinnerId: string;
  initial: {
    title: string | null;
    targetDate: string | null;
  };
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

export default function EditDinnerDetails({ dinnerId, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState(initial.title ?? "");
  const [targetDate, setTargetDate] = useState(toDatetimeLocal(initial.targetDate));

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center text-ink-muted hover:text-ink transition-colors mt-1"
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
