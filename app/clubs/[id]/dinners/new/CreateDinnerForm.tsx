"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Search, Check, X } from "lucide-react";
import ShareActions from "@/components/ShareActions";

// ─── Types ────────────────────────────────────────────────────────────────────

type SeededRestaurant = {
  place_id: string;
  name: string;
  address: string | null;
  price_level: number | null;
};

type SearchResult = {
  place_id: string;
  name: string;
  address: string | null;
  price_level: number | null;
  rating: number | null;
};

type Props = {
  clubId: string | null;
  clubName?: string | null;
  clubEmoji?: string | null;
  clubCity?: string | null;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ─── StepDots ─────────────────────────────────────────────────────────────────

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {([1, 2, 3] as const).map((s) => (
        <div
          key={s}
          className={cn(
            "rounded-full transition-all",
            step === s
              ? "w-5 h-2 bg-slate"
              : s < step
              ? "w-2 h-2 bg-slate/40"
              : "w-2 h-2 bg-black/15"
          )}
        />
      ))}
    </div>
  );
}

// ─── CalendarMonth ────────────────────────────────────────────────────────────

function CalendarMonth({
  year,
  month,
  selected,
  onToggle,
  minDate,
  maxDates = 3,
}: {
  year: number;
  month: number; // 1-indexed
  selected: string[];
  onToggle: (date: string) => void;
  minDate: string;
  maxDates?: number;
}) {
  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => isoDate(year, month, i + 1)),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs text-ink-faint font-medium py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} />;
          const isPast = date < minDate;
          const isSelected = selected.includes(date);
          const atLimit = selected.length >= maxDates && !isSelected;
          const disabled = isPast || atLimit;
          return (
            <button
              key={date}
              type="button"
              onClick={() => !disabled && onToggle(date)}
              disabled={disabled}
              className={cn(
                "aspect-square w-full rounded-lg text-sm font-medium transition-all",
                isSelected
                  ? "bg-slate text-white font-bold"
                  : isPast
                  ? "text-ink-faint cursor-not-allowed"
                  : atLimit
                  ? "text-ink-faint opacity-40 cursor-not-allowed"
                  : "text-ink hover:bg-black/5"
              )}
            >
              {new Date(date + "T12:00:00").getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── RestaurantCard ───────────────────────────────────────────────────────────

function RestaurantCard({
  restaurant,
  selected,
  onToggle,
}: {
  restaurant: SeededRestaurant;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all",
        selected
          ? "bg-citrus/10 border-citrus-dark"
          : "bg-white border-black/10 hover:border-slate/30"
      )}
    >
      <div
        className={cn(
          "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          selected ? "border-citrus-dark bg-citrus-dark" : "border-black/20"
        )}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-semibold leading-snug",
            selected ? "text-citrus-dark" : "text-ink"
          )}
        >
          {restaurant.name}
        </p>
        {restaurant.address && (
          <p className="text-xs text-ink-muted mt-0.5 truncate">{restaurant.address}</p>
        )}
      </div>
    </button>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  return (
    <nav className="bg-slate px-6 py-4 flex items-center">
      <div className="flex-1">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 inline-flex border border-white/20 hover:bg-white/10 transition-colors text-white text-sm font-semibold px-3 py-1.5 rounded-full"
          >
            <span className="text-base leading-none">←</span>
            <span>Back</span>
          </button>
        )}
      </div>
      <h1 className="font-sans text-base font-bold text-white">New dinner</h1>
      <div className="flex-1" />
    </nav>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateDinnerForm({ clubId, clubName, clubEmoji, clubCity }: Props) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: date selection
  const today = getToday();
  const now = new Date();
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Paginated calendar
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1); // 1-indexed

  function prevMonth() {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  }
  const isPrevDisabled = calYear === now.getFullYear() && calMonth === now.getMonth() + 1;

  // Step 2: restaurant suggestions
  const [suggestions, setSuggestions] = useState<SeededRestaurant[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsFetched, setSuggestionsFetched] = useState(false);
  const [selectedRestaurants, setSelectedRestaurants] = useState<SeededRestaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Step 3: created dinner data for the confirmation preview
  const [createdDinnerId, setCreatedDinnerId] = useState<string | null>(null);
  const [confirmedDates, setConfirmedDates] = useState<string[]>([]);
  const [confirmedRestaurants, setConfirmedRestaurants] = useState<SeededRestaurant[]>([]);

  // ── Load suggestions when entering Step 2 ──────────────────────

  useEffect(() => {
    if (step !== 2 || suggestionsFetched) return;
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function loadSuggestions() {
    if (!clubId) {
      // One-off dinner: no wishlist
      setSuggestionsFetched(true);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    const supabase = createClient();

    // Get wishlist place_ids for this club
    const { data: wishlistRows } = await supabase
      .from("club_wishlist")
      .select("place_id")
      .eq("club_id", clubId)
      .limit(10);

    const wishlistIds = (wishlistRows ?? []).map((r) => r.place_id);

    // Exclude place_ids already used as poll_options in this club's dinners
    let usedIds: Set<string> = new Set();
    if (wishlistIds.length > 0) {
      const { data: usedOptions } = await supabase
        .from("poll_options")
        .select("place_id, dinners!inner(club_id)")
        .eq("dinners.club_id", clubId)
        .is("removed_at", null);
      usedIds = new Set((usedOptions ?? []).map((o) => o.place_id));
    }

    const freshIds = wishlistIds.filter((id) => !usedIds.has(id)).slice(0, 3);

    let found: SeededRestaurant[] = [];

    if (freshIds.length > 0) {
      const { data: cached } = await supabase
        .from("restaurant_cache")
        .select("place_id, name, address, price_level")
        .in("place_id", freshIds);
      found = (cached ?? []).map((r) => ({
        place_id: r.place_id,
        name: r.name,
        address: r.address,
        price_level: r.price_level,
      }));
    }

    // Only show wishlist items — no generic Places API fallback
    setSuggestions(found);
    setSuggestionsFetched(true);
    setSuggestionsLoading(false);
  }

  // ── Debounced restaurant search ────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: searchQuery });
        if (clubCity) params.set("city", clubCity);
        const res = await fetch(`/api/places/search?${params}`);
        const json = await res.json();
        setSearchResults(json.places ?? []);
      } catch {
        // non-fatal
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, clubCity]);

  // ── Toggle helpers ─────────────────────────────────────────────

  const maxDates = clubId ? 3 : 1;

  function toggleDate(date: string) {
    setSelectedDates((prev) => {
      if (prev.includes(date)) return prev.filter((d) => d !== date);
      if (prev.length >= maxDates) return clubId ? prev : [date]; // one-off: replace selection
      return [...prev, date].sort();
    });
  }

  function toggleRestaurant(r: SeededRestaurant) {
    setSelectedRestaurants((prev) => {
      const exists = prev.find((x) => x.place_id === r.place_id);
      return exists
        ? prev.filter((x) => x.place_id !== r.place_id)
        : [...prev, r];
    });
  }

  function selectFromSearch(r: SearchResult) {
    const sr: SeededRestaurant = {
      place_id: r.place_id,
      name: r.name,
      address: r.address,
      price_level: r.price_level,
    };
    setSuggestions((prev) =>
      prev.find((x) => x.place_id === r.place_id) ? prev : [...prev, sr]
    );
    setSelectedRestaurants((prev) =>
      prev.find((x) => x.place_id === r.place_id) ? prev : [...prev, sr]
    );
    setSearchQuery("");
    setSearchResults([]);
  }

  // ── Submit (fires between Step 2 and Step 3) ───────────────────

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated.");
      setLoading(false);
      return;
    }

    // Auto-generate title from the earliest selected date
    const [y, m] = selectedDates[0].split("-").map(Number);
    const title = `Dinner · ${new Date(y, m - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })}`;

    const isOneOff = !clubId;

    // 1. Create the dinner row
    const { data: dinner, error: dinnerError } = await supabase
      .from("dinners")
      .insert({
        club_id: clubId ?? null,
        created_by: user.id,
        title,
        // One-off: date is known upfront, go straight to restaurant voting
        planning_stage: isOneOff ? "restaurant_voting" : "date_voting",
        target_date: isOneOff ? `${selectedDates[0]}T18:00:00.000Z` : null,
        voting_open: false,
        suggestion_mode: "members",
        poll_min_options: 2,
        max_suggestions: null,
        poll_closes_at: null,
        winning_restaurant_place_id: null,
        reservation_datetime: null,
        party_size: null,
        confirmation_number: null,
        reservation_platform: null,
        reserved_by: null,
        ratings_open_until: null,
        theme_cuisine: null,
        theme_price: null,
        theme_vibe: null,
        theme_neighborhood: null,
      })
      .select()
      .single();

    if (dinnerError || !dinner) {
      setError(dinnerError?.message ?? "Failed to create dinner.");
      setLoading(false);
      return;
    }

    if (!isOneOff) {
      // 2. Create availability poll linked to the dinner
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
        // Clean up the orphaned dinner row
        await supabase.from("dinners").delete().eq("id", dinner.id);
        setError("Failed to create date poll.");
        setLoading(false);
        return;
      }

      // 3. Create availability_poll_dates (up to 3)
      const { error: datesError } = await supabase
        .from("availability_poll_dates")
        .insert(selectedDates.map((d) => ({ poll_id: poll.id, proposed_date: d })));

      if (datesError) {
        setError("Failed to save date options.");
        setLoading(false);
        return;
      }
    }

    // 4. Seed restaurant poll_options (if any were selected)
    if (selectedRestaurants.length > 0) {
      // Ensure restaurants are in cache (ignoreDuplicates = no-op for existing rows)
      for (const r of selectedRestaurants) {
        await supabase
          .from("restaurant_cache")
          .upsert(
            {
              place_id: r.place_id,
              name: r.name,
              address: r.address,
              lat: null,
              lng: null,
              phone: null,
              website: null,
              price_level: r.price_level,
              rating: null,
              reservation_url: null,
              reservation_platform: null,
              photo_urls: null,
              hours: null,
              beli_url: null,
              types: null,
              cached_at: new Date().toISOString(),
            },
            { onConflict: "place_id", ignoreDuplicates: true }
          );
      }

      const { error: optionsError } = await supabase.from("poll_options").insert(
        selectedRestaurants.map((r) => ({
          dinner_id: dinner.id,
          place_id: r.place_id,
          suggested_by: user.id,
          note: null,
          removed_by: null,
          removed_at: null,
        }))
      );

      if (optionsError) {
        setError("Failed to seed restaurant suggestions.");
        setLoading(false);
        return;
      }
    }

    // TODO: send email — notify club members that a dinner poll is open

    setCreatedDinnerId(dinner.id);
    setConfirmedDates(selectedDates);
    setConfirmedRestaurants(selectedRestaurants);
    setLoading(false);
    setStep(3);
  }

  // ── Step 1: Pick nights ────────────────────────────────────────

  if (step === 1) {
    return (
      <main className="min-h-screen bg-snow">
        <Nav onBack={() => router.back()} />
        <div className="max-w-lg mx-auto px-6 py-8">
          <StepDots step={1} />

          <div className="mt-4 mb-6">
            {clubName && (
              <p className="text-ink-muted text-sm mb-1">
                {clubEmoji} {clubName}
              </p>
            )}
            <h2 className="font-sans text-2xl font-bold text-ink">When should we eat?</h2>
            <p className="text-ink-muted text-sm mt-1">
              {clubId ? "Pick up to 3 nights. The club will vote." : "Pick a night for the dinner."}
            </p>
          </div>

          {/* Paginated calendar */}
          <div className="bg-white border border-black/8 rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={prevMonth}
                disabled={isPrevDisabled}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:bg-black/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-ink">
                {new Date(calYear, calMonth - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:bg-black/5 transition-colors"
              >
                ›
              </button>
            </div>
            <CalendarMonth
              year={calYear}
              month={calMonth}
              selected={selectedDates}
              onToggle={toggleDate}
              minDate={today}
              maxDates={maxDates}
            />
          </div>

          {/* Selected date chips */}
          {selectedDates.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {selectedDates.map((d) => (
                <div
                  key={d}
                  className="flex items-center gap-1.5 bg-slate text-white text-sm font-medium px-3 py-1.5 rounded-full"
                >
                  <span>{formatDate(d)}</span>
                  <button
                    type="button"
                    onClick={() => toggleDate(d)}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <button
            type="button"
            disabled={selectedDates.length === 0}
            onClick={() => {
              if (!selectedDates.length) {
                setError("Pick at least one date.");
                return;
              }
              setError(null);
              setStep(2);
            }}
            className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {clubId ? "Send date poll to club →" : "Next →"}
          </button>
        </div>
      </main>
    );
  }

  // ── Step 2: Seed a restaurant ──────────────────────────────────

  if (step === 2) {
    return (
      <main className="min-h-screen bg-snow">
        <Nav onBack={() => setStep(1)} />
        <div className="max-w-lg mx-auto px-6 py-8">
          <StepDots step={2} />

          <div className="mt-4 mb-6">
            <h2 className="font-sans text-2xl font-bold text-ink">Add a restaurant idea</h2>
            <p className="text-ink-muted text-sm mt-1">
              Optional — your crew can add more during voting.
            </p>
          </div>

          {/* Pre-populated suggestion cards */}
          {suggestionsLoading ? (
            <div className="flex flex-col gap-2 mb-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 bg-black/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="flex flex-col gap-2 mb-4">
              {suggestions.map((r) => (
                <RestaurantCard
                  key={r.place_id}
                  restaurant={r}
                  selected={!!selectedRestaurants.find((x) => x.place_id === r.place_id)}
                  onToggle={() => toggleRestaurant(r)}
                />
              ))}
            </div>
          ) : null}

          {/* Restaurant search */}
          <div className="relative mb-2">
            <div className="flex items-center gap-3 bg-white border border-black/10 rounded-xl px-4 py-3">
              <Search className="w-4 h-4 text-ink-muted shrink-0" />
              <input
                type="text"
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-ink text-sm outline-none placeholder-ink-faint"
              />
              {searching && (
                <div className="w-4 h-4 border-2 border-ink-muted/30 border-t-ink-muted rounded-full animate-spin shrink-0" />
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden z-10">
                {searchResults.slice(0, 5).map((r) => (
                  <button
                    key={r.place_id}
                    type="button"
                    onClick={() => selectFromSearch(r)}
                    className="w-full flex flex-col px-4 py-3 text-left hover:bg-black/5 transition-colors border-b border-black/5 last:border-0"
                  >
                    <span className="text-sm font-semibold text-ink">{r.name}</span>
                    {r.address && (
                      <span className="text-xs text-ink-muted mt-0.5">{r.address}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm mb-4 mt-4">{error}</p>}

          <div className="mt-6">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Creating…" : "Start the poll →"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Step 3: Confirmation ───────────────────────────────────────

  return (
    <main className="min-h-screen bg-snow">
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-8">
        <StepDots step={3} />

        <div className="mt-4 mb-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="font-sans text-2xl font-bold text-ink">{clubId ? "Dinner poll is live" : "Dinner created!"}</h2>
          <p className="text-ink-muted text-sm mt-1">{clubId ? "Share it with your group so they can vote on dates." : "Share it so your crew can vote on where to eat."}</p>
        </div>

        {/* Read-only preview */}
        <div className="bg-white border border-black/8 rounded-2xl p-5 mb-6">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
            {clubId ? "Date options" : "Date"}
          </p>
          <div className="flex flex-col gap-3 mb-1">
            {confirmedDates.map((d) => (
              <div key={d} className="flex items-center gap-3">
                <span className="text-sm text-ink w-36 shrink-0">{formatDate(d)}</span>
                {clubId && (
                  <>
                    <div className="flex-1 bg-black/5 rounded-full h-1.5" />
                    <span className="text-xs text-ink-faint w-6 text-right">0%</span>
                  </>
                )}
              </div>
            ))}
          </div>

          {confirmedRestaurants.length > 0 && (
            <>
              <div className="border-t border-black/5 my-4" />
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
                Restaurant ideas
              </p>
              <div className="flex flex-col gap-3">
                {confirmedRestaurants.map((r) => (
                  <div key={r.place_id} className="flex items-center gap-3">
                    <span className="text-sm text-ink truncate flex-1">{r.name}</span>
                    <div className="w-16 bg-black/5 rounded-full h-1.5" />
                    <span className="text-xs text-ink-faint w-6 text-right">0%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <ShareActions
          message={clubId ? `Hey! Vote on dates for our next dinner 🍽` : `Planning a dinner — vote on where we should eat! 🍽`}
          url={`${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "")}${clubId ? `/clubs/${clubId}/dinners/${createdDinnerId}` : `/dinners/${createdDinnerId}`}`}
        />

        <button
          type="button"
          onClick={() => router.push(clubId ? `/clubs/${clubId}/dinners/${createdDinnerId}` : `/dinners/${createdDinnerId}`)}
          className="w-full mt-3 bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors"
        >
          View dinner →
        </button>
      </div>
    </main>
  );
}
