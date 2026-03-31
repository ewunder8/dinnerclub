"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSuggestionModeLabel } from "@/lib/poll";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
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

  // Date options (up to 3) for the availability poll
  const [date1, setDate1] = useState("");
  const [date2, setDate2] = useState("");
  const [date3, setDate3] = useState("");
  const date1Ref = useRef<HTMLInputElement>(null);
  const date2Ref = useRef<HTMLInputElement>(null);
  const date3Ref = useRef<HTMLInputElement>(null);

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

  const [showVibeNeighborhood, setShowVibeNeighborhood] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Min date for date inputs — today
  const today = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date1) {
      setError("Pick at least one date option.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated."); setLoading(false); return; }

    // Create dinner
    const { data: dinner, error: dinnerError } = await supabase
      .from("dinners")
      .insert({
        club_id: clubId,
        created_by: user.id,
        theme_cuisine: cuisine.trim() || null,
        theme_price: price,
        theme_vibe: vibe.trim() || null,
        theme_neighborhood: neighborhood.trim() || null,
        suggestion_mode: suggestionMode,
        poll_min_options: minSuggestions,
        max_suggestions: maxSuggestions,
        planning_stage: "date_voting",
        // Nullable fields required by Insert type
        poll_closes_at: null,
        target_date: null,
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

    // Create availability poll linked to the dinner
    const { data: poll, error: pollError } = await supabase
      .from("availability_polls")
      .insert({
        club_id: clubId,
        created_by: user.id,
        title: "When works for dinner?",
        dinner_id: dinner.id,
      })
      .select("id")
      .single();

    if (pollError || !poll) {
      setError("Failed to create date poll.");
      setLoading(false);
      return;
    }

    // Insert date options
    const validDates = [date1, date2, date3].filter(Boolean);
    const { error: datesError } = await supabase
      .from("availability_poll_dates")
      .insert(validDates.map((d) => ({ poll_id: poll.id, proposed_date: d })));

    if (datesError) {
      setError("Failed to save date options.");
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

  function DatePickerButton({
    label,
    value,
    onChange,
    inputRef,
    required,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    inputRef: React.RefObject<HTMLInputElement>;
    required?: boolean;
  }) {
    const formatted = value
      ? (() => {
          const [y, m, d] = value.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric",
          });
        })()
      : null;

    return (
      <div>
        <p className="text-xs text-ink-muted mb-1.5">{label}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.showPicker()}
          className="w-full flex items-center gap-3 bg-surface border border-slate/20 rounded-xl px-4 py-3 text-left hover:border-slate transition-colors"
        >
          <Calendar className="w-4 h-4 text-ink-muted shrink-0" />
          <span className={formatted ? "text-ink text-sm" : "text-ink-faint text-sm"}>
            {formatted ?? "Pick a date"}
          </span>
          {value && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="ml-auto text-ink-faint hover:text-ink-muted text-base leading-none"
            >
              ×
            </button>
          )}
        </button>
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={today}
          required={required}
          className="sr-only"
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-snow">
      {/* Nav */}
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <button onClick={() => router.back()} className="text-white/60 hover:text-white transition-colors text-2xl font-light">‹</button>
        </div>
        <h1 className="font-sans text-base font-bold text-white">New dinner</h1>
        <div className="flex-1" />
      </nav>

      <div className="max-w-lg mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-ink-muted text-sm mb-1">
            {clubEmoji} {clubName}
          </p>
          <h2 className="font-sans text-3xl font-bold text-ink">Start a dinner</h2>
          <p className="text-ink-muted text-sm mt-2">
            Propose some dates so the group can say when they're free.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-10">

          {/* ── Date options ── */}
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-ink mb-1">
                Proposed dates <span className="text-red-400">*</span>
              </h3>
              <p className="text-xs text-ink-muted">
                Suggest up to 3 dates. The group votes, then you lock one in.
              </p>
            </div>
            <DatePickerButton label="Option 1" value={date1} onChange={setDate1} inputRef={date1Ref} required />
            <DatePickerButton label="Option 2 (optional)" value={date2} onChange={setDate2} inputRef={date2Ref} />
            <DatePickerButton label="Option 3 (optional)" value={date3} onChange={setDate3} inputRef={date3Ref} />
          </section>

          {/* ── Dinner name / theme ── */}
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-ink mb-1">
                Dinner name or theme <span className="text-ink-muted font-normal">(optional)</span>
              </h3>
              <p className="text-xs text-ink-muted">
                Guide your crew&apos;s suggestions with a cuisine, price range, or vibe.
              </p>
            </div>

            {/* Cuisine */}
            <input
              type="text"
              placeholder="e.g. Japanese, Italian, anything goes"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              maxLength={50}
              className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors"
            />

            {/* Price */}
            <div>
              <p className="text-xs text-ink-muted mb-2">Price range</p>
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
                        ? "bg-citrus/10 border-citrus-dark text-citrus-dark"
                        : "bg-white border-black/10 text-ink hover:border-slate/30"
                    )}
                  >
                    <span>{opt.label}</span>
                    <span className="text-xs font-normal text-ink-muted mt-0.5">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Vibe + Neighborhood — shown on demand */}
            {showVibeNeighborhood ? (
              <>
                <input
                  type="text"
                  placeholder="Vibe — e.g. Cozy, Lively, Special occasion"
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  maxLength={50}
                  className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors"
                />
                <input
                  type="text"
                  placeholder="Neighborhood — e.g. Lower East Side, Midtown"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  maxLength={60}
                  className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors"
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
          </section>

          {/* ── Suggestion settings ── */}
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-ink mb-1">
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
                      ? "bg-citrus/10 border-citrus-dark"
                      : "bg-white border-black/10 hover:border-slate/30"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 shrink-0 transition-colors",
                      suggestionMode === mode
                        ? "border-citrus-dark bg-citrus-dark"
                        : "border-black/20 bg-white"
                    )}
                  />
                  <div>
                    <p className={cn(
                      "text-sm font-semibold",
                      suggestionMode === mode ? "text-citrus-dark" : "text-ink"
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
                <p className="text-xs text-ink-muted mb-3">Min to open voting</p>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => stepMinSuggestions(-1)}
                    disabled={minSuggestions <= 1}
                    className="w-8 h-8 rounded-lg bg-black/5 text-ink font-bold hover:bg-black/10 disabled:opacity-30 transition-colors"
                  >
                    −
                  </button>
                  <span className="font-bold text-lg text-ink">
                    {minSuggestions}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepMinSuggestions(1)}
                    disabled={minSuggestions >= maxSuggestions}
                    className="w-8 h-8 rounded-lg bg-black/5 text-ink font-bold hover:bg-black/10 disabled:opacity-30 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-white border border-black/10 rounded-xl p-4">
                <p className="text-xs text-ink-muted mb-3">Max suggestions</p>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => stepMaxSuggestions(-1)}
                    disabled={maxSuggestions <= minSuggestions}
                    className="w-8 h-8 rounded-lg bg-black/5 text-ink font-bold hover:bg-black/10 disabled:opacity-30 transition-colors"
                  >
                    −
                  </button>
                  <span className="font-bold text-lg text-ink">
                    {maxSuggestions}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepMaxSuggestions(1)}
                    disabled={maxSuggestions >= 20}
                    className="w-8 h-8 rounded-lg bg-black/5 text-ink font-bold hover:bg-black/10 disabled:opacity-30 transition-colors"
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
            className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Start the dinner →"}
          </button>

        </form>
      </div>
    </main>
  );
}
