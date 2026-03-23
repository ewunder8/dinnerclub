"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { PlaceSearchResult } from "@/app/api/places/search/route";

type WishlistItem = {
  id: string;
  place_id: string;
  note: string | null;
  added_by: string;
  created_at: string;
  restaurant_name: string;
  restaurant_address: string | null;
  adder_name: string;
};

type Props = {
  clubId: string;
  userId: string;
  isOwner: boolean;
  items: WishlistItem[];
};

const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

function AddForm({ clubId, onAdded }: { clubId: string; onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PlaceSearchResult | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.places ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selected]);

  const handleClear = () => {
    setSelected(null); setQuery(""); setResults([]); setNote(""); setError(null);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    await supabase.from("restaurant_cache").upsert({
      place_id: selected.place_id,
      name: selected.name,
      address: selected.address,
      lat: selected.lat,
      lng: selected.lng,
      price_level: selected.price_level,
      rating: selected.rating,
      phone: null, website: null, reservation_url: null,
      reservation_platform: null, photo_urls: null, hours: null,
      beli_url: null, types: null, cached_at: new Date().toISOString(),
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated."); setSubmitting(false); return; }

    const { error: insertError } = await supabase.from("club_wishlist").insert({
      club_id: clubId,
      place_id: selected.place_id,
      added_by: user.id,
      note: note.trim() || null,
    });

    if (insertError) {
      setError(
        insertError.message.includes("unique")
          ? "Already on the wishlist."
          : "Failed to add. Try again."
      );
      setSubmitting(false);
      return;
    }

    toast.success(`${selected.name} added to wishlist!`);
    handleClear();
    onAdded();
  };

  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-black/5">
      <div className="relative">
        <input
          type="text"
          placeholder="Search restaurants…"
          value={query}
          onChange={(e) => { if (selected) handleClear(); setQuery(e.target.value); }}
          className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
        />
        {selected && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink text-lg leading-none">×</button>
        )}
        {searching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-muted">…</span>
        )}
        {results.length > 0 && !selected && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden">
            {results.map((place) => (
              <button
                key={place.place_id}
                onClick={() => { setSelected(place); setQuery(place.name); setResults([]); }}
                className="w-full text-left px-4 py-3 hover:bg-surface transition-colors border-b border-black/5 last:border-0"
              >
                <p className="font-semibold text-ink text-sm">{place.name}</p>
                <p className="text-xs text-ink-muted truncate mt-0.5">
                  {[place.address, place.price_level ? PRICE_LABELS[place.price_level] : null, place.rating ? `★ ${place.rating}` : null].filter(Boolean).join(" · ")}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <>
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            <p className="font-semibold text-ink text-sm">{selected.name}</p>
            {selected.address && <p className="text-xs text-ink-muted mt-0.5 truncate">{selected.address}</p>}
            {(selected.price_level || selected.rating) && (
              <p className="text-xs text-ink-muted mt-0.5">
                {[selected.price_level ? PRICE_LABELS[selected.price_level] : null, selected.rating ? `★ ${selected.rating}` : null].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <input
            type="text"
            placeholder="Why this place? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-slate text-white font-bold py-3 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 text-sm"
          >
            {submitting ? "Adding…" : "Add to wishlist →"}
          </button>
        </>
      )}
    </div>
  );
}

export default function WishlistSection({ clubId, userId, isOwner, items }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const handleRemove = async (itemId: string) => {
    setRemoving(itemId);
    const supabase = createClient();
    await supabase.from("club_wishlist").delete().eq("id", itemId);
    toast.success("Removed from wishlist.");
    router.refresh();
    setRemoving(null);
  };

  return (
    <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
        <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">
          Wishlist · {items.length}
        </h3>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs font-semibold text-citrus-dark hover:text-citrus transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add"}
        </button>
      </div>

      {items.length === 0 && !showAdd ? (
        <div className="px-5 py-10 text-center">
          <p className="text-3xl mb-3">🤩</p>
          <p className="font-semibold text-ink text-sm mb-1">Nothing on the list yet</p>
          <p className="text-xs text-ink-muted">Add places you want to try as a group.</p>
        </div>
      ) : (
        <div className="divide-y divide-black/5">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm truncate">{item.restaurant_name}</p>
                {item.restaurant_address && (
                  <p className="text-xs text-ink-muted mt-0.5 truncate">{item.restaurant_address.replace(/, USA$/, "")}</p>
                )}
                {item.note && (
                  <p className="text-xs text-ink-muted italic mt-1">&ldquo;{item.note}&rdquo;</p>
                )}
                <p className="text-xs text-ink-faint mt-1">Added by {item.adder_name}</p>
              </div>
              {(item.added_by === userId || isOwner) && (
                <button
                  onClick={() => handleRemove(item.id)}
                  disabled={removing === item.id}
                  className="text-xs text-ink-muted hover:text-red-500 transition-colors shrink-0 mt-0.5 disabled:opacity-40"
                >
                  {removing === item.id ? "…" : "Remove"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="px-5 pb-5">
          <AddForm clubId={clubId} onAdded={() => { setShowAdd(false); router.refresh(); }} />
        </div>
      )}
    </section>
  );
}
