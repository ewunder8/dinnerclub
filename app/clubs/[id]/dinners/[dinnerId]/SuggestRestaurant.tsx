"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PlaceSearchResult } from "@/app/api/places/search/route";

type Props = {
  dinnerId: string;
};

export default function SuggestRestaurant({ dinnerId }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PlaceSearchResult | null>(null);
  const [note, setNote] = useState("");
  const [beliUrl, setBeliUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (selected) return; // don't search after selection

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/places/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(`Search error: ${data.error ?? res.status}`);
        }
        setResults(data.places ?? []);
      } catch (e) {
        setError(`Search failed: ${e instanceof Error ? e.message : "unknown error"}`);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  const handleSelect = (place: PlaceSearchResult) => {
    setSelected(place);
    setQuery(place.name);
    setResults([]);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    setNote("");
    setBeliUrl("");
    setError(null);
  };

  const cleanBeliUrl = (raw: string): string | null => {
    try {
      const url = new URL(raw.trim());
      if (url.hostname !== "beliapp.co") return null;
      return `${url.origin}${url.pathname}`;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);

    const parsedBeliUrl = beliUrl.trim() ? cleanBeliUrl(beliUrl) : null;
    if (beliUrl.trim() && !parsedBeliUrl) {
      setError("Beli link doesn't look right — paste the full beliapp.co URL.");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();

    // Upsert into restaurant_cache
    const { error: cacheError } = await supabase
      .from("restaurant_cache")
      .upsert({
        place_id: selected.place_id,
        name: selected.name,
        address: selected.address,
        lat: selected.lat,
        lng: selected.lng,
        price_level: selected.price_level,
        rating: selected.rating,
        phone: null,
        website: null,
        reservation_url: null,
        reservation_platform: null,
        photo_urls: null,
        hours: null,
        beli_url: parsedBeliUrl,
        cached_at: new Date().toISOString(),
      });

    if (cacheError) {
      setError("Failed to save restaurant. Try again.");
      setSubmitting(false);
      return;
    }

    // Get current user for suggested_by
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated.");
      setSubmitting(false);
      return;
    }

    // Insert poll option
    const { error: optionError } = await supabase.from("poll_options").insert({
      dinner_id: dinnerId,
      place_id: selected.place_id,
      suggested_by: user.id,
      note: note.trim() || null,
      removed_by: null,
      removed_at: null,
    });

    if (optionError) {
      setError(
        optionError.message.includes("duplicate")
          ? "That restaurant is already on the list."
          : "Failed to add suggestion. Try again."
      );
      setSubmitting(false);
      return;
    }

    // Reset form and refresh server data
    handleClear();
    router.refresh();
  };

  const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

  return (
    <div className="bg-white border border-black/8 rounded-2xl p-5 flex flex-col gap-4">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search restaurants…"
          value={query}
          onChange={(e) => {
            if (selected) handleClear();
            setQuery(e.target.value);
          }}
          className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors"
        />
        {selected && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink text-lg leading-none"
          >
            ×
          </button>
        )}
        {searching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
            …
          </span>
        )}

        {/* Dropdown */}
        {results.length > 0 && !selected && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden">
            {results.map((place) => (
              <button
                key={place.place_id}
                onClick={() => handleSelect(place)}
                className="w-full text-left px-4 py-3 hover:bg-surface transition-colors border-b border-black/5 last:border-0"
              >
                <p className="font-semibold text-ink text-sm">{place.name}</p>
                <p className="text-xs text-ink-muted truncate mt-0.5">
                  {[
                    place.address,
                    place.price_level ? PRICE_LABELS[place.price_level] : null,
                    place.rating ? `★ ${place.rating}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected restaurant details */}
      {selected && (
        <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-3">
          <p className="font-semibold text-ink text-sm">{selected.name}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {[
              selected.address,
              selected.price_level ? PRICE_LABELS[selected.price_level] : null,
              selected.rating ? `★ ${selected.rating}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      )}

      {/* Note field */}
      {selected && (
        <input
          type="text"
          placeholder="Add a note — why here? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
        />
      )}

      {/* Beli link */}
      {selected && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-ink">
              Beli link <span className="text-ink-muted font-normal">(optional)</span>
            </label>
          </div>
          <input
            type="url"
            placeholder="https://beliapp.co/…"
            value={beliUrl}
            onChange={(e) => setBeliUrl(e.target.value)}
            className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
          />
          <p className="text-xs text-ink-muted leading-relaxed">
            In Beli, find this restaurant → tap <span className="font-semibold">Share</span> → copy the link → paste it here. Anyone in the group can then tap straight into the Beli app.
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Submit */}
      {selected && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-slate text-white font-bold py-3 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          {submitting ? "Adding…" : "Add to poll →"}
        </button>
      )}
    </div>
  );
}
