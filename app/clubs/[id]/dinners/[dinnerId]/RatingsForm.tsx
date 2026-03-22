"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  RATING_TAGS,
  scoreToStars,
  validateRating,
  wouldReturnPct,
} from "@/lib/countdown";
import type {
  Dinner,
  RestaurantCache,
  DinnerRating,
  DinnerRatingSummary,
} from "@/lib/supabase/database.types";

type Props = {
  dinner: Dinner;
  restaurant: RestaurantCache;
  userId: string;
  existingRating: DinnerRating | null;
  summary: DinnerRatingSummary | null;
  ratingWindowOpen: boolean;
};

function StarPicker({
  value,
  onChange,
  label,
  size = "md",
}: {
  value: number | null;
  onChange: (v: number) => void;
  label: string;
  size?: "md" | "lg";
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <p className={cn("text-ink-muted mb-1.5", size === "lg" ? "text-sm font-semibold" : "text-xs")}>{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "leading-none transition-transform hover:scale-110",
              size === "lg" ? "text-4xl" : "text-2xl"
            )}
          >
            <span className={(hover ?? value ?? 0) >= n ? "text-citrus-dark" : "text-black/15"}>
              ★
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RatingsForm({
  dinner,
  restaurant,
  userId,
  existingRating,
  summary,
  ratingWindowOpen,
}: Props) {
  const router = useRouter();

  const [overall, setOverall] = useState<number | null>(existingRating?.overall_score ?? null);
  const [food, setFood] = useState<number | null>(existingRating?.food_score ?? null);
  const [vibe, setVibe] = useState<number | null>(existingRating?.vibe_score ?? null);
  const [value, setValue] = useState<number | null>(existingRating?.value_score ?? null);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(
    existingRating?.would_return ?? null
  );
  const [tags, setTags] = useState<string[]>(existingRating?.tags ?? []);
  const [note, setNote] = useState(existingRating?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRating] = useState(!!existingRating);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateRating({ overall_score: overall });
    if (validationError) { setError(validationError); return; }

    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      dinner_id: dinner.id,
      user_id: userId,
      place_id: restaurant.place_id,
      stars: overall!,
      overall_score: overall,
      food_score: food,
      vibe_score: vibe,
      value_score: value,
      would_return: wouldReturn,
      tags: tags.length > 0 ? tags : null,
      note: note.trim() || null,
    };

    if (existingRating) {
      await supabase.from("dinner_ratings").update(payload).eq("id", existingRating.id);
    } else {
      await supabase.from("dinner_ratings").insert(payload);
    }

    setJustSubmitted(true);
    setSubmitting(false);
    toast.success("Rating saved! Thanks for rating.");
    setTimeout(() => router.push("/discover"), 1500);
  };

  return (
    <div className="flex flex-col gap-8 pb-28">

      {/* Restaurant header */}
      <div className="bg-white border border-black/8 rounded-2xl p-5">
        <p className="text-xs text-ink-muted mb-1">You went to</p>
        <p className="font-sans text-xl font-bold text-ink">{restaurant.name}</p>
        {restaurant.address && (
          <p className="text-sm text-ink-muted mt-0.5">{restaurant.address.replace(/, USA$/, "")}</p>
        )}
      </div>

      {/* Rating form or closed message */}
      {!ratingWindowOpen && !existingRating ? (
        <div className="border-2 border-dashed border-black/10 rounded-2xl p-10 text-center">
          <p className="text-3xl mb-3">⏰</p>
          <p className="font-semibold text-ink mb-1">Rating window closed</p>
          <p className="text-ink-muted text-sm">Ratings were open for 7 days after the dinner.</p>
        </div>
      ) : (
        <form id="rating-form" onSubmit={handleSubmit} className="bg-white border border-black/8 rounded-2xl p-5 flex flex-col gap-6">
          <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide">
            {hasRating ? "Your rating" : "Rate this dinner"}
          </h3>

          {/* Overall — required, large */}
          <StarPicker
            value={overall}
            onChange={setOverall}
            label="Overall *"
            size="lg"
          />

          {/* Optional scores */}
          <div className="flex flex-col gap-4 pt-1 border-t border-black/5">
            <StarPicker value={food}  onChange={setFood}  label="Food" />
            <StarPicker value={vibe}  onChange={setVibe}  label="Vibe" />
            <StarPicker value={value} onChange={setValue} label="Value" />
          </div>

          {/* Would return */}
          <div>
            <p className="text-xs text-ink-muted mb-2">Would you go back?</p>
            <div className="flex gap-2">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setWouldReturn(wouldReturn === v ? null : v)}
                  className={cn(
                    "px-4 py-2 rounded-xl border text-sm font-semibold transition-all",
                    wouldReturn === v
                      ? v
                        ? "bg-green-100 border-green-300 text-green-600"
                        : "bg-black/10 border-black/20 text-ink"
                      : "bg-white border-black/10 text-ink-muted hover:border-black/20"
                  )}
                >
                  {v ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-xs text-ink-muted mb-2">Tags (optional)</p>
            <div className="flex flex-wrap gap-2">
              {RATING_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm transition-all",
                    tags.includes(tag)
                      ? "bg-citrus/10 border-citrus-dark text-citrus-dark font-semibold"
                      : "bg-white border-black/10 text-ink hover:border-slate/30"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="text-xs text-ink-muted mb-2">Notes (optional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Any standout dishes, moments, or thoughts…"
              className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm resize-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {justSubmitted && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
              <p className="font-semibold text-green-700">Rating saved!</p>
              <p className="text-sm text-green-600 mt-0.5">Thanks for rating — heading to past dinners…</p>
            </div>
          )}
        </form>
      )}

      {/* Community summary — shown after submitting or when revisiting a rated dinner */}
      {(justSubmitted || hasRating) && summary && summary.rating_count > 0 && (
        <div className="bg-slate/5 border border-slate/10 rounded-2xl p-5">
          <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide mb-3">
            Group verdict · {summary.rating_count} {summary.rating_count === 1 ? "rating" : "ratings"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {summary.avg_overall && (
              <div>
                <p className="text-xs text-ink-muted">Overall</p>
                <p className="font-bold text-ink">
                  {scoreToStars(summary.avg_overall)}{" "}
                  <span className="text-sm font-normal text-ink-muted">
                    {summary.avg_overall.toFixed(1)}
                  </span>
                </p>
              </div>
            )}
            {summary.avg_food && (
              <div>
                <p className="text-xs text-ink-muted">Food</p>
                <p className="font-semibold text-ink text-sm">
                  {summary.avg_food.toFixed(1)} / 5
                </p>
              </div>
            )}
            {summary.avg_vibe && (
              <div>
                <p className="text-xs text-ink-muted">Vibe</p>
                <p className="font-semibold text-ink text-sm">
                  {summary.avg_vibe.toFixed(1)} / 5
                </p>
              </div>
            )}
            {summary.avg_value && (
              <div>
                <p className="text-xs text-ink-muted">Value</p>
                <p className="font-semibold text-ink text-sm">
                  {summary.avg_value.toFixed(1)} / 5
                </p>
              </div>
            )}
          </div>
          {summary.would_return_count > 0 && (
            <p className="text-sm text-ink mt-3">
              <span className="font-bold">{wouldReturnPct(summary)}%</span>{" "}
              <span className="text-ink-muted">would go back</span>
            </p>
          )}
        </div>
      )}

      {/* Back to club */}
      <a href="/discover" className="block text-center text-sm text-ink-muted hover:text-ink transition-colors py-2">
        ← Back to past dinners
      </a>

      {/* Sticky submit button */}
      {ratingWindowOpen && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-snow/90 backdrop-blur-sm border-t border-black/8">
          <button
            type="submit"
            form="rating-form"
            disabled={submitting || justSubmitted}
            className="w-full max-w-2xl mx-auto block bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving…" : justSubmitted ? "Rating saved!" : hasRating ? "Update rating →" : "Submit rating →"}
          </button>
        </div>
      )}
    </div>
  );
}
