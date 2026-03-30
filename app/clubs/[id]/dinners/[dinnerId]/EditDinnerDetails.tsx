"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import { updateDinnerDetails } from "./actions";

const PRICE_OPTIONS = [
  { value: 1, label: "$",    desc: "Cheap eats" },
  { value: 2, label: "$$",   desc: "Mid-range" },
  { value: 3, label: "$$$",  desc: "Upscale" },
  { value: 4, label: "$$$$", desc: "Splurge" },
];

type Props = {
  dinnerId: string;
  initial: {
    cuisine: string | null;
    price: number | null;
    vibe: string | null;
    neighborhood: string | null;
    targetDate: string | null;
    pollClosesAt: string | null;
  };
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  // Converts ISO string to "YYYY-MM-DDTHH:MM" for datetime-local input
  return new Date(iso).toISOString().slice(0, 16);
}

export default function EditDinnerDetails({ dinnerId, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [cuisine, setCuisine] = useState(initial.cuisine ?? "");
  const [price, setPrice] = useState<number | null>(initial.price);
  const [vibe, setVibe] = useState(initial.vibe ?? "");
  const [neighborhood, setNeighborhood] = useState(initial.neighborhood ?? "");
  const [targetDate, setTargetDate] = useState(toDatetimeLocal(initial.targetDate));
  const [pollClosesAt, setPollClosesAt] = useState(toDatetimeLocal(initial.pollClosesAt));
  const [showVibeNeighborhood, setShowVibeNeighborhood] = useState(!!(initial.vibe || initial.neighborhood));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetDateRef = useRef<HTMLInputElement>(null);
  const pollClosesRef = useRef<HTMLInputElement>(null);

  const minDatetime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await updateDinnerDetails({
      dinnerId,
      cuisine: cuisine.trim() || null,
      price,
      vibe: vibe.trim() || null,
      neighborhood: neighborhood.trim() || null,
      targetDate: targetDate || null,
      pollClosesAt: pollClosesAt || null,
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
        className="text-xs text-ink-muted hover:text-ink transition-colors mt-1"
      >
        Edit details
      </button>
    );
  }

  return (
    <div className="mt-4 bg-white border border-black/8 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Edit dinner details</p>
        <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink text-lg leading-none">×</button>
      </div>

      {/* Name / Cuisine */}
      <div>
        <label className="block text-xs font-semibold text-ink-muted mb-1.5">Dinner name or theme</label>
        <input
          type="text"
          placeholder="e.g. Japanese, Italian, anything goes"
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          maxLength={50}
          className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
        />
      </div>

      {/* Price */}
      <div>
        <label className="block text-xs font-semibold text-ink-muted mb-1.5">Price range</label>
        <div className="grid grid-cols-4 gap-2">
          {PRICE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPrice(price === opt.value ? null : opt.value)}
              className={cn(
                "flex flex-col items-center py-2.5 rounded-xl border text-sm font-bold transition-all",
                price === opt.value
                  ? "bg-citrus/10 border-citrus-dark text-citrus-dark"
                  : "bg-white border-black/10 text-ink hover:border-slate/30"
              )}
            >
              <span>{opt.label}</span>
              <span className="text-xs font-normal text-ink-muted mt-0.5">{opt.desc}</span>
            </button>
          ))}
        </div>
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

      {/* Poll closes */}
      <div>
        <label className="block text-xs font-semibold text-ink-muted mb-1.5">Poll closes</label>
        <button
          type="button"
          onClick={() => pollClosesRef.current?.showPicker()}
          className="w-full flex items-center gap-3 bg-surface border border-slate/20 rounded-xl px-4 py-3 text-left hover:border-slate transition-colors"
        >
          <Calendar className="w-4 h-4 text-ink-muted shrink-0" />
          <span className={cn("text-sm", pollClosesAt ? "text-ink" : "text-ink-faint")}>
            {pollClosesAt
              ? new Date(pollClosesAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
              : "No deadline"}
          </span>
          {pollClosesAt && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPollClosesAt(""); }}
              className="ml-auto text-ink-muted hover:text-ink text-base leading-none"
            >×</button>
          )}
        </button>
        <input ref={pollClosesRef} type="datetime-local" value={pollClosesAt} onChange={(e) => setPollClosesAt(e.target.value)} min={minDatetime} className="sr-only" />
      </div>

      {/* Vibe + Neighborhood */}
      {showVibeNeighborhood ? (
        <>
          <input
            type="text"
            placeholder="Vibe — e.g. Cozy, Lively, Special occasion"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            maxLength={50}
            className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
          />
          <input
            type="text"
            placeholder="Neighborhood — e.g. Lower East Side, Midtown"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            maxLength={60}
            className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowVibeNeighborhood(true)}
          className="text-xs text-ink-muted hover:text-ink transition-colors self-start"
        >
          + Add vibe / neighborhood
        </button>
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
