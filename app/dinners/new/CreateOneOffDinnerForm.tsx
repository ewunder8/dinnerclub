"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { FOOD_EMOJIS } from "@/lib/emojis";
import ShareActions from "@/components/ShareActions";
import { generateInviteToken, getInviteExpiry } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Restaurant = {
  place_id: string;
  name: string;
  address: string | null;
  price_level: number | null;
  rating: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function formatTime(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
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
            step === s ? "w-5 h-2 bg-slate" : s < step ? "w-2 h-2 bg-slate/40" : "w-2 h-2 bg-black/15"
          )}
        />
      ))}
    </div>
  );
}

// ─── CalendarMonth ────────────────────────────────────────────────────────────

function CalendarMonth({
  year, month, selected, onSelect, minDate,
}: {
  year: number; month: number; selected: string | null;
  onSelect: (date: string) => void; minDate: string;
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
          <div key={d} className="text-center text-xs text-ink-faint font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} />;
          const isPast = date < minDate;
          const isSelected = selected === date;
          return (
            <button
              key={date}
              type="button"
              onClick={() => !isPast && onSelect(date)}
              disabled={isPast}
              className={cn(
                "aspect-square w-full rounded-lg text-sm font-medium transition-all",
                isSelected ? "bg-slate text-white font-bold" :
                isPast ? "text-ink-faint cursor-not-allowed" :
                "text-ink hover:bg-black/5"
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

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  return (
    <nav className="bg-slate px-6 py-4 flex items-center">
      <div className="flex-1">
        <button
          onClick={onBack ?? (() => router.back())}
          className="inline-flex items-center justify-center border border-white/20 hover:bg-white/10 transition-colors text-white w-9 h-9 rounded-full text-lg leading-none"
        >←</button>
      </div>
      <h1 className="font-sans text-base font-bold text-white">New dinner</h1>
      <div className="flex-1" />
    </nav>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateOneOffDinnerForm({ userCity }: { userCity: string | null }) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const today = getToday();
  const now = new Date();
  const [selectedEmoji, setSelectedEmoji] = useState("🍽️");
  const [dinnerName, setDinnerName] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState("19:00");
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  // Step 2 state
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [searching, setSearching] = useState(false);

  // Step 3 state (post-create)
  const [createdDinnerId, setCreatedDinnerId] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const isPrevDisabled = calYear === now.getFullYear() && calMonth === now.getMonth() + 1;

  function prevMonth() {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  }

  // ── Restaurant search ──────────────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: searchQuery });
        if (userCity) params.set("city", userCity);
        const res = await fetch(`/api/places/search?${params}`);
        const json = await res.json();
        setSearchResults(json.places ?? []);
      } catch { /* non-fatal */ }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function selectRestaurant(r: Restaurant) {
    setSelectedRestaurant(r);
    setSearchQuery("");
    setSearchResults([]);
  }

  // ── Submit ─────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedDate || !selectedRestaurant) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated."); setLoading(false); return; }

    // Combine date + time into a local datetime ISO string
    const targetDate = new Date(`${selectedDate}T${selectedTime}`).toISOString();

    // Auto-generate title from the date if no name provided
    const [y, m] = selectedDate.split("-").map(Number);
    const autoTitle = dinnerName.trim() || `Dinner · ${new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

    // 1. Ensure restaurant is in cache (ignoreDuplicates = no-op if already there)
    await supabase.from("restaurant_cache").upsert(
      {
        place_id: selectedRestaurant.place_id,
        name: selectedRestaurant.name,
        address: selectedRestaurant.address,
        lat: null, lng: null, phone: null, website: null,
        price_level: selectedRestaurant.price_level,
        rating: selectedRestaurant.rating,
        reservation_url: null, reservation_platform: null,
        photo_urls: null, hours: null, beli_url: null,
        types: null, cached_at: new Date().toISOString(),
      },
      { onConflict: "place_id", ignoreDuplicates: true }
    );

    // 2. Create the dinner row
    const { data: dinner, error: dinnerError } = await supabase
      .from("dinners")
      .insert({
        club_id: null,
        created_by: user.id,
        title: autoTitle,
        emoji: selectedEmoji,
        planning_stage: "restaurant_voting",
        target_date: targetDate,
        winning_restaurant_place_id: selectedRestaurant.place_id,
        voting_open: false,
        suggestion_mode: "members",
        poll_min_options: 2,
        max_suggestions: null,
        poll_closes_at: null,
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

    // 3. Create invite link
    const token = generateInviteToken();
    await supabase.from("invite_links").insert({
      dinner_id: dinner.id,
      club_id: null,
      created_by: user.id,
      token,
      expires_at: getInviteExpiry().toISOString(),
      status: "active",
      used_count: 0,
    });

    setCreatedDinnerId(dinner.id);
    setInviteToken(token);
    setLoading(false);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  const inviteUrl = inviteToken ? `${appUrl}/dinners/join/${inviteToken}` : null;

  // ── Step 1: When + what ────────────────────────────────────────

  if (step === 1) {
    return (
      <main className="min-h-screen bg-snow">
        <Nav />
        <div className="max-w-lg mx-auto px-6 py-8">
          <StepDots step={1} />

          <div className="mt-4 mb-6">
            <h2 className="font-sans text-2xl font-bold text-ink">When is the dinner?</h2>
            <p className="text-ink-muted text-sm mt-1">Pick a date and time for your reservation.</p>
          </div>

          {/* Emoji picker */}
          <div className="bg-white border border-black/8 rounded-2xl p-5 mb-5">
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
              Pick an emoji
            </label>
            <div className="grid grid-cols-8 gap-2">
              {FOOD_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setSelectedEmoji(e)}
                  className={cn(
                    "w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all",
                    selectedEmoji === e
                      ? "bg-citrus/15 ring-2 ring-citrus-dark scale-110"
                      : "bg-white border border-black/8 hover:border-slate/30"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Dinner name */}
          <div className="bg-white border border-black/8 rounded-2xl p-5 mb-5">
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
              Dinner name <span className="font-normal normal-case text-ink-faint">(optional)</span>
            </label>
            <div className="flex items-center gap-3 bg-snow border border-black/10 rounded-xl px-4 py-3 focus-within:border-slate transition-colors">
              <span className="text-2xl">{selectedEmoji}</span>
              <input
                type="text"
                placeholder="e.g. Birthday dinner, Anniversary"
                value={dinnerName}
                onChange={(e) => setDinnerName(e.target.value)}
                maxLength={80}
                className="flex-1 bg-transparent text-ink text-sm outline-none placeholder-ink-faint"
              />
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white border border-black/8 rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={prevMonth} disabled={isPrevDisabled}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:bg-black/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
              <span className="text-sm font-semibold text-ink">
                {new Date(calYear, calMonth - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button type="button" onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:bg-black/5 transition-colors">›</button>
            </div>
            <CalendarMonth
              year={calYear} month={calMonth}
              selected={selectedDate} onSelect={setSelectedDate} minDate={today}
            />
          </div>

          {/* Time picker */}
          {selectedDate && (
            <div className="bg-white border border-black/8 rounded-2xl p-5 mb-5">
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
                Time
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full bg-snow border border-black/10 rounded-xl px-4 py-3 text-ink text-sm focus:outline-none focus:border-slate transition-colors"
              />
              <p className="text-xs text-ink-muted mt-2">
                {formatDateLong(selectedDate)} at {formatTime(selectedTime)}
              </p>
            </div>
          )}

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <button
            type="button"
            disabled={!selectedDate}
            onClick={() => { setError(null); setStep(2); }}
            className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </main>
    );
  }

  // ── Step 2: Where ──────────────────────────────────────────────

  if (step === 2) {
    return (
      <main className="min-h-screen bg-snow">
        <Nav onBack={() => setStep(1)} />
        <div className="max-w-lg mx-auto px-6 py-8">
          <StepDots step={2} />

          <div className="mt-4 mb-6">
            <h2 className="font-sans text-2xl font-bold text-ink">Where are you going?</h2>
            <p className="text-ink-muted text-sm mt-1">Search for the restaurant.</p>
          </div>

          {/* Selected restaurant */}
          {selectedRestaurant && (
            <div className="bg-citrus/8 border border-citrus/20 rounded-2xl px-5 py-4 mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink text-sm">{selectedRestaurant.name}</p>
                {selectedRestaurant.address && (
                  <p className="text-xs text-ink-muted mt-0.5">{selectedRestaurant.address}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedRestaurant(null)}
                className="text-ink-muted hover:text-ink text-lg leading-none shrink-0"
              >×</button>
            </div>
          )}

          {/* Restaurant search */}
          <div className="relative mb-2">
            <div className="flex items-center gap-3 bg-white border border-black/10 rounded-xl px-4 py-3">
              <Search className="w-4 h-4 text-ink-muted shrink-0" />
              <input
                type="text"
                placeholder={selectedRestaurant ? "Search to change restaurant…" : "Search restaurants…"}
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

          {error && <p className="text-red-500 text-sm mb-4 mt-4">{error}</p>}

          <div className="mt-6">
            <button
              type="button"
              disabled={!selectedRestaurant}
              onClick={() => { setError(null); setStep(3); }}
              className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Review →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Step 3: Review → Create → Share ───────────────────────────

  return (
    <main className="min-h-screen bg-snow">
      <Nav onBack={createdDinnerId ? undefined : () => setStep(2)} />
      <div className="max-w-lg mx-auto px-6 py-8">
        <StepDots step={3} />

        {!createdDinnerId ? (
          <>
            <div className="mt-4 mb-6">
              <h2 className="font-sans text-2xl font-bold text-ink">Looks good?</h2>
              <p className="text-ink-muted text-sm mt-1">Review your dinner before creating it.</p>
            </div>

            <div className="bg-white border border-black/8 rounded-2xl p-5 mb-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{selectedEmoji}</span>
                <div>
                  <p className="font-sans font-bold text-ink text-lg leading-tight">
                    {dinnerName.trim() || "Dinner"}
                  </p>
                  {selectedDate && (
                    <p className="text-sm text-ink-muted">
                      {formatDateLong(selectedDate)} at {formatTime(selectedTime)}
                    </p>
                  )}
                </div>
              </div>
              {selectedRestaurant && (
                <>
                  <div className="border-t border-black/5" />
                  <div>
                    <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Restaurant</p>
                    <p className="text-sm font-semibold text-ink">{selectedRestaurant.name}</p>
                    {selectedRestaurant.address && (
                      <p className="text-xs text-ink-muted mt-0.5">{selectedRestaurant.address}</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-citrus text-slate font-bold py-4 rounded-xl hover:bg-citrus/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Creating…" : "Create dinner →"}
            </button>
          </>
        ) : (
          <>
            <div className="mt-4 mb-8 text-center">
              <div className="text-5xl mb-4">{selectedEmoji}</div>
              <h2 className="font-sans text-2xl font-bold text-ink">Dinner created!</h2>
              <p className="text-ink-muted text-sm mt-1">Share the invite link so your crew can RSVP.</p>
            </div>

            <section className="bg-white border border-black/8 rounded-2xl overflow-hidden mb-3">
              <div className="px-5 py-3 border-b border-black/5">
                <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Invite your crew</h3>
              </div>
              <div className="p-5">
                <p className="text-xs text-ink-muted mb-3">Share this link so everyone can RSVP.</p>
                {inviteUrl && (
                  <ShareActions
                    message={`You're invited to ${dinnerName.trim() || "dinner"}! RSVP here 🎉`}
                    url={inviteUrl}
                  />
                )}
              </div>
            </section>

            <button
              type="button"
              onClick={() => router.push(`/dinners/${createdDinnerId}`)}
              className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors"
            >
              View dinner →
            </button>
          </>
        )}
      </div>
    </main>
  );
}
