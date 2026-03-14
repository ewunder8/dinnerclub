"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSuggestionModeLabel } from "@/lib/poll";
import { cn } from "@/lib/utils";
import type { Dinner } from "@/lib/supabase/database.types";

const PRICE_OPTIONS = [
  { value: 1, label: "$",    desc: "Cheap eats" },
  { value: 2, label: "$$",   desc: "Mid-range" },
  { value: 3, label: "$$$",  desc: "Upscale" },
  { value: 4, label: "$$$$", desc: "Splurge" },
];

const SUGGESTION_MODES: Dinner["suggestion_mode"][] = [
  "members",
  "owner_only",
  "hybrid",
];

type Props = {
  clubId: string;
  clubName: string;
  clubEmoji: string | null;
};

export default function CreateDinnerForm({ clubId, clubName, clubEmoji }: Props) {
  const router = useRouter();

  // Poll deadline
  const [pollClosesAt, setPollClosesAt] = useState("");

  // Theme (all optional)
  const [cuisine, setCuisine] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [vibe, setVibe] = useState("");
  const [neighborhood, setNeighborhood] = useState("");

  // Suggestion settings
  const [suggestionMode, setSuggestionMode] =
    useState<Dinner["suggestion_mode"]>("members");
  const [minSuggestions, setMinSuggestions] = useState(2);
  const [maxSuggestions, setMaxSuggestions] = useState(8);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data: dinner, error: dinnerError } = await supabase
      .from("dinners")
      .insert({
        club_id: clubId,
        poll_closes_at: pollClosesAt ? new Date(pollClosesAt).toISOString() : null,
        theme_cuisine: cuisine.trim() || null,
        theme_price: price,
        theme_vibe: vibe.trim() || null,
        theme_neighborhood: neighborhood.trim() || null,
        suggestion_mode: suggestionMode,
        poll_min_options: minSuggestions,
        max_suggestions: maxSuggestions,
        // Nullable fields required by Insert type
        winning_restaurant_place_id: null,
        reservation_datetime: null,
        party_size: null,
        confirmation_number: null,
        reservation_platform: null,
        reserved_by: null,
        ratings_open_until: null,
      })
      .select()
      .single();

    if (dinnerError || !dinner) {
      setError(dinnerError?.message || "Failed to create dinner");
      setLoading(false);
      return;
    }

    router.push(`/clubs/${clubId}/dinners/${dinner.id}`);
  };

  const stepMinSuggestions = (delta: number) => {
    setMinSuggestions((v) => Math.max(1, Math.min(maxSuggestions, v + delta)));
  };

  const stepMaxSuggestions = (delta: number) => {
    setMaxSuggestions((v) => {
      const next = Math.max(minSuggestions, Math.min(20, v + delta));
      return next;
    });
  };

  // Min datetime for the poll close input — at least 1 hour from now
  const minDatetime = new Date(Date.now() + 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  return (
    <main className="min-h-screen bg-warm-white">
      {/* Nav */}
      <nav className="bg-charcoal px-8 py-5 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-cream/50 hover:text-cream transition-colors text-sm"
        >
          ← Back
        </button>
        <h1 className="font-serif text-xl font-black text-cream">
          Dinner<span className="text-clay">Club</span>
        </h1>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-mid text-sm mb-1">
            {clubEmoji} {clubName}
          </p>
          <h2 className="font-serif text-3xl font-bold">Start a dinner</h2>
          <p className="text-mid text-sm mt-2">
            Set a theme and let the crew suggest where to eat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-10">

          {/* ── Poll deadline ── */}
          <section className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="poll-closes"
                className="block text-sm font-semibold text-charcoal mb-1"
              >
                Poll closes <span className="text-mid font-normal">(optional)</span>
              </label>
              <p className="text-xs text-mid mb-3">
                Voting auto-closes at this time. Leave blank to close manually.
              </p>
              <input
                id="poll-closes"
                type="datetime-local"
                value={pollClosesAt}
                onChange={(e) => setPollClosesAt(e.target.value)}
                min={minDatetime}
                className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-charcoal focus:outline-none focus:border-clay transition-colors"
              />
            </div>
          </section>

          {/* ── Theme ── */}
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-charcoal mb-1">
                Theme <span className="text-mid font-normal">(optional)</span>
              </h3>
              <p className="text-xs text-mid">
                Guide your crew&apos;s suggestions with a cuisine, price range, or vibe.
              </p>
            </div>

            {/* Cuisine */}
            <input
              type="text"
              placeholder="Cuisine — e.g. Japanese, Italian, anything goes"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              maxLength={50}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-charcoal placeholder-mid/50 focus:outline-none focus:border-clay transition-colors"
            />

            {/* Price */}
            <div>
              <p className="text-xs text-mid mb-2">Price range</p>
              <div className="grid grid-cols-4 gap-2">
                {PRICE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setPrice(price === opt.value ? null : opt.value)
                    }
                    className={cn(
                      "flex flex-col items-center py-3 rounded-xl border text-sm font-bold transition-all",
                      price === opt.value
                        ? "bg-clay/10 border-clay text-clay"
                        : "bg-white border-black/10 text-charcoal hover:border-clay/40"
                    )}
                  >
                    <span>{opt.label}</span>
                    <span className="text-xs font-normal text-mid mt-0.5">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Vibe */}
            <input
              type="text"
              placeholder="Vibe — e.g. Cozy, Lively, Special occasion"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              maxLength={50}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-charcoal placeholder-mid/50 focus:outline-none focus:border-clay transition-colors"
            />

            {/* Neighborhood */}
            <input
              type="text"
              placeholder="Neighborhood — e.g. Lower East Side, Midtown"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              maxLength={60}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-charcoal placeholder-mid/50 focus:outline-none focus:border-clay transition-colors"
            />
          </section>

          {/* ── Suggestion settings ── */}
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-charcoal mb-1">
                Who can suggest restaurants?
              </h3>
            </div>

            {/* Suggestion mode */}
            <div className="flex flex-col gap-2">
              {SUGGESTION_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSuggestionMode(mode)}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border text-left transition-all",
                    suggestionMode === mode
                      ? "bg-clay/8 border-clay"
                      : "bg-white border-black/10 hover:border-clay/30"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 shrink-0 transition-colors",
                      suggestionMode === mode
                        ? "border-clay bg-clay"
                        : "border-black/20 bg-white"
                    )}
                  />
                  <div>
                    <p className={cn(
                      "text-sm font-semibold",
                      suggestionMode === mode ? "text-clay" : "text-charcoal"
                    )}>
                      {getSuggestionModeLabel(mode)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Min / Max suggestions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-black/10 rounded-xl p-4">
                <p className="text-xs text-mid mb-3">Min to open voting</p>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => stepMinSuggestions(-1)}
                    disabled={minSuggestions <= 1}
                    className="w-8 h-8 rounded-lg bg-black/5 text-charcoal font-bold hover:bg-black/10 disabled:opacity-30 transition-colors"
                  >
                    −
                  </button>
                  <span className="font-bold text-lg text-charcoal">
                    {minSuggestions}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepMinSuggestions(1)}
                    disabled={minSuggestions >= maxSuggestions}
                    className="w-8 h-8 rounded-lg bg-black/5 text-charcoal font-bold hover:bg-black/10 disabled:opacity-30 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-white border border-black/10 rounded-xl p-4">
                <p className="text-xs text-mid mb-3">Max suggestions</p>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => stepMaxSuggestions(-1)}
                    disabled={maxSuggestions <= minSuggestions}
                    className="w-8 h-8 rounded-lg bg-black/5 text-charcoal font-bold hover:bg-black/10 disabled:opacity-30 transition-colors"
                  >
                    −
                  </button>
                  <span className="font-bold text-lg text-charcoal">
                    {maxSuggestions}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepMaxSuggestions(1)}
                    disabled={maxSuggestions >= 20}
                    className="w-8 h-8 rounded-lg bg-black/5 text-charcoal font-bold hover:bg-black/10 disabled:opacity-30 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </section>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-clay text-white font-bold py-4 rounded-xl hover:bg-clay-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Start the dinner →"}
          </button>

        </form>
      </div>
    </main>
  );
}
