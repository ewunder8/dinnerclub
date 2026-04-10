"use client";

import { useState } from "react";
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
  clubId?: string | null;
  clubName?: string | null;
  clubEmoji?: string | null;
};

function DatePickerButton({
  label,
  value,
  onChange,
  required,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  min?: string;
}) {
  return (
    <div>
      <p className="text-xs text-ink-muted mb-1.5">{label}</p>
      <div className="flex items-center gap-3 bg-surface border border-slate/20 rounded-xl px-4 py-3">
        <Calendar className="w-4 h-4 text-ink-muted shrink-0" />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          min={min}
          className="flex-1 bg-transparent text-ink text-sm outline-none min-w-0"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-ink-faint hover:text-ink-muted text-base leading-none shrink-0"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export default function CreateDinnerForm({ clubId, clubName, clubEmoji }: Props) {
  const router = useRouter();
  const isOneOff = !clubId;

  // Date state — controlled inputs
  const [date1, setDate1] = useState("");
  const [date2, setDate2] = useState("");
  const [date3, setDate3] = useState("");

  // Dinner details
  const [title, setTitle] = useState("");
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

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date1) {
      setError("Pick at least one date option.");
      return;
    }

    if (isOneOff && date1 < today) {
      setError("Date must be today or in the future.");
      return;
    }

    if (!isOneOff) {
      const validDatesCheck = [date1, date2, date3].filter(Boolean);
      if (validDatesCheck.some((d) => d < today)) {
        setError("All dates must be today or in the future.");
        return;
      }
    }

    if (isOneOff && !title.trim()) {
      setError("Please give this dinner a title.");
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
        club_id: clubId ?? null,
        created_by: user.id,
        title: title.trim() || null,
        theme_price: price,
        theme_vibe: vibe.trim() || null,
        theme_neighborhood: neighborhood.trim() || null,
        suggestion_mode: suggestionMode,
        poll_min_options: minSuggestions,
        max_suggestions: maxSuggestions,
        // One-off: skip date voting, set target_date directly
        planning_stage: isOneOff ? "restaurant_voting" : "date_voting",
        target_date: isOneOff ? new Date(date1).toISOString() : null,
        voting_open: isOneOff ? true : false,
        // Nullable fields required by Insert type
        poll_closes_at: null,
        winning_restaurant_place_id: null,
        reservation_datetime: null,
        party_size: null,
        confirmation_number: null,
        reservation_platform: null,
        reserved_by: null,
        ratings_open_until: null,
        theme_cuisine: null,
      })
      .select()
      .single();

    if (dinnerError || !dinner) {
      setError(dinnerError?.message || "Failed to create dinner");
      setLoading(false);
      return;
    }

    if (!isOneOff) {
      // Create availability poll linked to the dinner
      const { data: poll, error: pollError } = await supabase
        .from("availability_polls")
        .insert({
          club_id: clubId!,
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
    } else {
      // One-off: generate invite link
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase.from("invite_links").insert({
        club_id: null,
        dinner_id: dinner.id,
        created_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
        status: "active",
      });

      router.push(`/dinners/${dinner.id}`);
    }
  };

  const stepMinSuggestions = (delta: number) => {
    setMinSuggestions((v) => Math.max(1, Math.min(maxSuggestions, v + delta)));
  };

  const stepMaxSuggestions = (delta: number) => {
    setMaxSuggestions((v) => Math.max(minSuggestions, Math.min(20, v + delta)));
  };

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
          {!isOneOff && (
            <p className="text-ink-muted text-sm mb-1">{clubEmoji} {clubName}</p>
          )}
          <h2 className="font-sans text-3xl font-bold text-ink">Start a dinner</h2>
          <p className="text-ink-muted text-sm mt-2">
            {isOneOff
              ? "Plan a one-off dinner and share the link with your guests."
              : "Propose some dates so the group can say when they're free."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-10">

          {/* ── Dinner title ── */}
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-ink mb-1">
                Dinner title {isOneOff
                  ? <span className="text-red-400">*</span>
                  : <span className="text-ink-muted font-normal">(optional)</span>}
              </h3>
              <p className="text-xs text-ink-muted">
                {isOneOff
                  ? "Give your dinner a name — e.g. \"Eric's Birthday\" or \"Pre-wedding dinner\"."
                  : "Give the dinner a name, theme, or cuisine — e.g. \"Date night\" or \"Japanese\"."}
              </p>
            </div>
            <input
              type="text"
              placeholder={isOneOff ? "e.g. Eric's Birthday, Pre-wedding dinner" : "e.g. Date night, Japanese, anything goes"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              required={isOneOff}
              className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors"
            />

            {/* Price */}
            <div>
              <p className="text-xs text-ink-muted mb-2">Price range <span className="font-normal">(optional)</span></p>
              <div className="grid grid-cols-4 gap-2">
                {PRICE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPrice(price === opt.value ? null : opt.value)}
                    className={cn(
                      "flex flex-col items-center py-3 rounded-xl border text-sm font-bold transition-all",
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
                <button
                  type="button"
                  onClick={() => { setShowVibeNeighborhood(false); setVibe(""); setNeighborhood(""); }}
                  className="text-xs text-ink-faint hover:text-ink-muted transition-colors self-start"
                >
                  − Remove vibe / neighborhood
                </button>
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

          {/* ── Date ── */}
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-ink mb-1">
                {isOneOff ? "Dinner date" : "Proposed dates"} <span className="text-red-400">*</span>
              </h3>
              <p className="text-xs text-ink-muted">
                {isOneOff
                  ? "Set the date for this dinner."
                  : "Suggest up to 3 dates. The group votes, then you lock one in."}
              </p>
            </div>
            <DatePickerButton
              label={isOneOff ? "Date" : "Option 1"}
              value={date1}
              onChange={setDate1}
              required
              min={today}
            />
            {!isOneOff && (
              <>
                <DatePickerButton
                  label="Option 2 (optional)"
                  value={date2}
                  onChange={setDate2}
                  min={today}
                />
                <DatePickerButton
                  label="Option 3 (optional)"
                  value={date3}
                  onChange={setDate3}
                  min={today}
                />
              </>
            )}
          </section>

          {/* ── Suggestion settings ── */}
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-ink mb-1">
                Who can suggest restaurants?
              </h3>
            </div>

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
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 shrink-0 transition-colors",
                    suggestionMode === mode
                      ? "border-citrus-dark bg-citrus-dark"
                      : "border-black/20 bg-white"
                  )} />
                  <p className={cn(
                    "text-sm font-semibold",
                    suggestionMode === mode ? "text-citrus-dark" : "text-ink"
                  )}>
                    {getSuggestionModeLabel(mode)}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-black/10 rounded-xl p-4">
                <p className="text-xs text-ink-muted mb-3">Min to open voting</p>
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => stepMinSuggestions(-1)} disabled={minSuggestions <= 1}
                    className="w-8 h-8 rounded-lg bg-black/5 text-ink font-bold hover:bg-black/10 disabled:opacity-30 transition-colors">−</button>
                  <span className="font-bold text-lg text-ink">{minSuggestions}</span>
                  <button type="button" onClick={() => stepMinSuggestions(1)} disabled={minSuggestions >= maxSuggestions}
                    className="w-8 h-8 rounded-lg bg-black/5 text-ink font-bold hover:bg-black/10 disabled:opacity-30 transition-colors">+</button>
                </div>
              </div>

              <div className="bg-white border border-black/10 rounded-xl p-4">
                <p className="text-xs text-ink-muted mb-3">Max suggestions</p>
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => stepMaxSuggestions(-1)} disabled={maxSuggestions <= minSuggestions}
                    className="w-8 h-8 rounded-lg bg-black/5 text-ink font-bold hover:bg-black/10 disabled:opacity-30 transition-colors">−</button>
                  <span className="font-bold text-lg text-ink">{maxSuggestions}</span>
                  <button type="button" onClick={() => stepMaxSuggestions(1)} disabled={maxSuggestions >= 20}
                    className="w-8 h-8 rounded-lg bg-black/5 text-ink font-bold hover:bg-black/10 disabled:opacity-30 transition-colors">+</button>
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
