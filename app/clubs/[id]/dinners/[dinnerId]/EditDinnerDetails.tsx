"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Calendar, Pencil, Search } from "lucide-react";
import { FOOD_EMOJIS } from "@/lib/emojis";
import { updateDinnerDetails, addCohost, removeCohost } from "./actions";

type CoHost = { userId: string; name: string };

type Restaurant = {
  place_id: string;
  name: string;
  address: string | null;
  price_level: number | null;
  rating: number | null;
};

type Props = {
  dinnerId: string;
  initial: {
    title: string | null;
    targetDate: string | null;
  };
  cohosts?: CoHost[];
  eligibleCohostMembers?: CoHost[];
  // One-off only
  isOneOff?: boolean;
  initialEmoji?: string | null;
  initialRestaurant?: { place_id: string; name: string } | null;
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

export default function EditDinnerDetails({
  dinnerId,
  initial,
  cohosts = [],
  eligibleCohostMembers = [],
  isOneOff = false,
  initialEmoji = null,
  initialRestaurant = null,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState(initial.title ?? "");
  const [targetDate, setTargetDate] = useState(toDatetimeLocal(initial.targetDate));
  const [emoji, setEmoji] = useState(initialEmoji ?? "🍽️");
  const [restaurant, setRestaurant] = useState<{ place_id: string; name: string } | null>(initialRestaurant ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [searching, setSearching] = useState(false);

  const [cohostLoading, setCohostLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetDateRef = useRef<HTMLInputElement>(null);

  // Debounced restaurant search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        setSearchResults(json.places ?? []);
      } catch { /* non-fatal */ }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function selectRestaurant(r: Restaurant) {
    setRestaurant({ place_id: r.place_id, name: r.name });
    setSearchQuery("");
    setSearchResults([]);
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // For one-off: ensure new restaurant is in cache before updating
    if (isOneOff && restaurant && restaurant.place_id !== initialRestaurant?.place_id) {
      await fetch(`/api/places/details?id=${encodeURIComponent(restaurant.place_id)}`);
    }

    const result = await updateDinnerDetails({
      dinnerId,
      title: title.trim() || null,
      cuisine: null,
      price: null,
      vibe: null,
      neighborhood: null,
      targetDate: targetDate || null,
      pollClosesAt: null,
      ...(isOneOff ? { emoji: emoji || null } : {}),
      ...(isOneOff && restaurant ? { winningRestaurantPlaceId: restaurant.place_id } : {}),
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
        className="inline-flex items-center gap-1.5 border border-slate/40 text-slate px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate/5 transition-colors"
        aria-label="Edit details"
      >
        <Pencil className="w-3 h-3" />
        Edit
      </button>
    );
  }

  return (
    <div className="mt-4 bg-white border border-black/8 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Edit dinner details</p>
        <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink text-lg leading-none">×</button>
      </div>

      {/* Emoji picker — one-off only */}
      {isOneOff && (
        <div>
          <label className="block text-xs font-semibold text-ink-muted mb-2">Emoji</label>
          <div className="grid grid-cols-8 gap-1.5">
            {FOOD_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn(
                  "w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all",
                  emoji === e
                    ? "bg-citrus/15 ring-2 ring-citrus-dark scale-110"
                    : "bg-white border border-black/8 hover:border-slate/30"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-ink-muted mb-1.5">Dinner name</label>
        <input
          type="text"
          placeholder="e.g. Birthday dinner, Anniversary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
        />
      </div>

      {/* Restaurant search — one-off only */}
      {isOneOff && (
        <div>
          <label className="block text-xs font-semibold text-ink-muted mb-1.5">Restaurant</label>
          {restaurant && (
            <div className="flex items-center justify-between bg-citrus/8 border border-citrus/20 rounded-xl px-4 py-2.5 mb-2">
              <p className="text-sm font-medium text-ink">{restaurant.name}</p>
              <button type="button" onClick={() => setRestaurant(null)} className="text-ink-muted hover:text-ink text-base leading-none ml-2">×</button>
            </div>
          )}
          <div className="relative">
            <div className="flex items-center gap-2 bg-surface border border-slate/20 rounded-xl px-4 py-3 focus-within:border-slate transition-colors">
              <Search className="w-4 h-4 text-ink-muted shrink-0" />
              <input
                type="text"
                placeholder={restaurant ? "Search to change…" : "Search restaurants…"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-ink text-sm outline-none placeholder-ink-faint"
              />
              {searching && <div className="w-4 h-4 border-2 border-ink-muted/30 border-t-ink-muted rounded-full animate-spin shrink-0" />}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden z-10">
                {searchResults.slice(0, 5).map((r) => (
                  <button
                    key={r.place_id}
                    type="button"
                    onClick={() => selectRestaurant(r)}
                    className="w-full flex flex-col px-4 py-3 text-left hover:bg-black/5 transition-colors border-b border-black/5 last:border-0"
                  >
                    <span className="text-sm font-semibold text-ink">{r.name}</span>
                    {r.address && <span className="text-xs text-ink-muted mt-0.5">{r.address}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Target date / datetime */}
      <div>
        <label className="block text-xs font-semibold text-ink-muted mb-1.5">
          {isOneOff ? "Date & time" : "Target date"}
        </label>
        <button
          type="button"
          onClick={() => targetDateRef.current?.showPicker()}
          className="w-full flex items-center gap-3 bg-surface border border-slate/20 rounded-xl px-4 py-3 text-left hover:border-slate transition-colors"
        >
          <Calendar className="w-4 h-4 text-ink-muted shrink-0" />
          <span className={cn("text-sm", targetDate ? "text-ink" : "text-ink-faint")}>
            {targetDate
              ? new Date(targetDate).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
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
