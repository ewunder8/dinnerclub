"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AutocompleteResult } from "@/app/api/places/autocomplete/route";

type WishlistItem = {
  place_id: string;
  name: string;
  address: string | null;
};

type Props = {
  dinnerId: string;
  wishlist?: WishlistItem[];
};

type SelectedPlace = AutocompleteResult & {
  lat: number | null;
  lng: number | null;
  price_level: number | null;
  rating: number | null;
  types: string[] | null;
};

const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

export default function SuggestRestaurant({ dinnerId, wishlist = [] }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [note, setNote] = useState("");
  const [beliUrl, setBeliUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch (e) {
        setError(`Search failed: ${e instanceof Error ? e.message : "unknown error"}`);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selected]);

  const handleSelect = async (suggestion: AutocompleteResult) => {
    setSuggestions([]);
    setQuery(suggestion.name);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/places/details?id=${encodeURIComponent(suggestion.place_id)}`);
      const data = await res.json();
      const place = data.place;
      setSelected({
        ...suggestion,
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
        price_level: place?.price_level ?? null,
        rating: place?.rating ?? null,
        types: place?.types ?? null,
      });
    } catch {
      setSelected({ ...suggestion, lat: null, lng: null, price_level: null, rating: null, types: null });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    setSuggestions([]);
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

    const { error: cacheError } = await supabase.from("restaurant_cache").upsert({
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
      types: selected.types,
      beli_url: parsedBeliUrl,
      cached_at: new Date().toISOString(),
    });

    if (cacheError) {
      setError(`Cache error: ${cacheError.message}`);
      setSubmitting(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated.");
      setSubmitting(false);
      return;
    }

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

    handleClear();
    router.refresh();
  };

  const handleAddFromWishlist = async (item: WishlistItem) => {
    setSuggestions([]);
    setQuery(item.name);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/places/details?id=${encodeURIComponent(item.place_id)}`);
      const data = await res.json();
      const place = data.place;
      setSelected({
        place_id: item.place_id,
        name: item.name,
        address: item.address ?? "",
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
        price_level: place?.price_level ?? null,
        rating: place?.rating ?? null,
        types: place?.types ?? null,
      });
    } catch {
      setSelected({ place_id: item.place_id, name: item.name, address: item.address ?? "", lat: null, lng: null, price_level: null, rating: null, types: null });
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="bg-white border border-black/8 rounded-2xl p-5 flex flex-col gap-4">
      {wishlist.length > 0 && !selected && (
        <div>
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-2">From wishlist</p>
          <div className="flex flex-col gap-1">
            {wishlist.map((item) => (
              <button
                key={item.place_id}
                onClick={() => handleAddFromWishlist(item)}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-black/8 hover:border-citrus/40 hover:bg-citrus/5 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">{item.name}</p>
                  {item.address && <p className="text-xs text-ink-muted truncate mt-0.5">{item.address.replace(/, USA$/, "")}</p>}
                </div>
                <span className="text-xs font-semibold text-citrus-dark shrink-0 ml-3">+ Add</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 mb-1">
            <div className="flex-1 h-px bg-black/8" />
            <span className="text-xs text-ink-faint">or search</span>
            <div className="flex-1 h-px bg-black/8" />
          </div>
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          placeholder="Search restaurants…"
          value={query}
          onChange={(e) => { if (selected) handleClear(); setQuery(e.target.value); }}
          className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors"
        />
        {selected && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink text-lg leading-none">×</button>
        )}
        {(searching || loadingDetails) && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-muted">…</span>
        )}

        {suggestions.length > 0 && !selected && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.place_id}
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-3 hover:bg-surface transition-colors border-b border-black/5 last:border-0"
              >
                <p className="font-semibold text-ink text-sm">{s.name}</p>
                {s.address && <p className="text-xs text-ink-muted truncate mt-0.5">{s.address}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-3">
          <p className="font-semibold text-ink text-sm">{selected.name}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {[
              selected.address,
              selected.price_level ? PRICE_LABELS[selected.price_level] : null,
              selected.rating ? `★ ${selected.rating}` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}

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
            In Beli, find this restaurant → tap <span className="font-semibold">Share</span> → copy the link → paste it here.
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

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
