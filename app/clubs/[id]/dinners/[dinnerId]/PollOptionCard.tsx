"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { RankedOption } from "@/lib/poll";
import type { PollState } from "@/lib/supabase/database.types";

type Props = {
  option: RankedOption;
  pollState: PollState;
  myVoteOptionId: string | null;
  userId: string;
  isOwner: boolean;
  dinnerId: string;
  showRemove: boolean;
};

const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

export default function PollOptionCard({
  option,
  pollState,
  myVoteOptionId,
  userId,
  isOwner,
  dinnerId,
  showRemove,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beliInput, setBeliInput] = useState("");
  const [showBeliInput, setShowBeliInput] = useState(false);
  const [beliSaving, setBeliSaving] = useState(false);

  const r = option.restaurant_cache;
  const isMyVote = myVoteOptionId === option.id;
  const canVote = pollState === "voting_open";
  const canPickWinner =
    isOwner &&
    (pollState === "voting_closed" || pollState === "voting_open");

  const handleVote = async () => {
    if (!canVote || loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();

    await supabase
      .from("votes")
      .delete()
      .eq("dinner_id", dinnerId)
      .eq("user_id", userId);

    if (!isMyVote) {
      const { error: insertError } = await supabase.from("votes").insert({
        option_id: option.id,
        user_id: userId,
        dinner_id: dinnerId,
      });
      if (insertError) { setError("Failed to vote. Try again."); setLoading(false); return; }
    }

    router.refresh();
    setLoading(false);
  };

  const handleRemove = async () => {
    if (!showRemove || loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: removeError } = await supabase
      .from("poll_options")
      .update({ removed_by: userId, removed_at: new Date().toISOString() })
      .eq("id", option.id);

    if (removeError) { setError("Failed to remove. Try again."); setLoading(false); return; }
    router.refresh();
    setLoading(false);
  };

  const handleSaveBeliUrl = async () => {
    const raw = beliInput.trim();
    if (!raw) return;
    try {
      const url = new URL(raw);
      if (url.hostname !== "beliapp.co") { setError("Paste a beliapp.co link."); return; }
      const clean = `${url.origin}${url.pathname}`;
      setBeliSaving(true);
      const supabase = createClient();
      await supabase.from("restaurant_cache").update({ beli_url: clean }).eq("place_id", r.place_id);
      setShowBeliInput(false);
      setBeliInput("");
      router.refresh();
    } catch {
      setError("Invalid URL.");
    } finally {
      setBeliSaving(false);
    }
  };

  const handlePickWinner = async () => {
    if (!canPickWinner || loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("dinners")
      .update({
        winning_restaurant_place_id: option.place_id,
        status: "seeking_reservation",
        voting_open: false,
      })
      .eq("id", dinnerId);

    if (updateError) { setError("Failed to pick winner. Try again."); setLoading(false); return; }
    router.refresh();
    setLoading(false);
  };

  return (
    <div
      className={cn(
        "bg-white border rounded-2xl p-5 transition-all",
        pollState === "winner_selected" && option.place_id === r.place_id &&
          "border-green-500 bg-green-50",
        isMyVote && pollState !== "winner_selected" && "border-citrus-dark/60",
        !isMyVote && pollState !== "winner_selected" && "border-black/8"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Vote count bubble */}
        <div
          className={cn(
            "shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
            isMyVote ? "bg-citrus-dark text-white" : "bg-black/5 text-ink"
          )}
        >
          {option.vote_count}
        </div>

        {/* Restaurant info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-ink">{r.name}</p>
            {option.is_tied && pollState !== "winner_selected" && (
              <span className="text-xs bg-citrus/20 text-citrus-dark font-semibold px-2 py-0.5 rounded-full">
                Tied
              </span>
            )}
            {pollState === "winner_selected" && (
              <span className="text-xs bg-green-100 text-green-600 font-semibold px-2 py-0.5 rounded-full">
                Winner
              </span>
            )}
          </div>

          {r.address && (
            <p className="text-xs text-ink-muted mt-0.5 truncate">{r.address}</p>
          )}
          <p className="text-xs text-ink-muted mt-0.5">
            {[
              r.price_level ? PRICE_LABELS[r.price_level] : null,
              r.rating ? `★ ${r.rating}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {option.note && (
            <p className="text-sm text-ink-muted italic mt-1.5">"{option.note}"</p>
          )}

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {r.beli_url ? (
              <>
                <a
                  href={r.beli_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-citrus-dark hover:underline"
                >
                  View on Beli →
                </a>
                <button
                  onClick={() => setShowBeliInput((v) => !v)}
                  className="text-xs text-ink-muted hover:text-ink transition-colors"
                >
                  Edit
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowBeliInput((v) => !v)}
                className="text-xs text-ink-muted hover:text-citrus-dark transition-colors"
              >
                + Add Beli link
              </button>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.place_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink hover:underline transition-colors"
            >
              Google Maps →
            </a>
          </div>

          {showBeliInput && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="url"
                placeholder="https://beliapp.co/…"
                value={beliInput}
                onChange={(e) => setBeliInput(e.target.value)}
                className="flex-1 text-xs bg-surface border border-slate/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-slate"
              />
              <button
                onClick={handleSaveBeliUrl}
                disabled={beliSaving}
                className="text-xs font-semibold text-white bg-slate px-3 py-1.5 rounded-lg hover:bg-slate-light transition-colors disabled:opacity-40"
              >
                {beliSaving ? "…" : "Save"}
              </button>
            </div>
          )}

          {(pollState === "voting_open" || pollState === "voting_closed" || pollState === "winner_selected") &&
            option.vote_pct > 0 && (
              <div className="mt-3">
                <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isMyVote ? "bg-citrus-dark" : "bg-black/20"
                    )}
                    style={{ width: `${option.vote_pct}%` }}
                  />
                </div>
                <p className="text-xs text-ink-muted mt-1">{option.vote_pct}% of votes</p>
              </div>
            )}

          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>

        {/* Action column */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {canVote && (
            <button
              onClick={handleVote}
              disabled={loading}
              className={cn(
                "text-sm font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-40",
                isMyVote
                  ? "bg-citrus/10 text-citrus-dark border border-citrus-dark/30 hover:bg-citrus/20"
                  : "bg-citrus-dark text-white hover:bg-citrus"
              )}
            >
              {loading ? "…" : isMyVote ? "Voted ✓" : "Vote"}
            </button>
          )}

          {canPickWinner && (
            <button
              onClick={handlePickWinner}
              disabled={loading}
              className="text-xs font-semibold text-green-600 border border-green-300 px-3 py-1.5 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-40"
            >
              {loading ? "…" : "Pick winner"}
            </button>
          )}

          {showRemove && (
            <button
              onClick={handleRemove}
              disabled={loading}
              className="text-xs text-ink-muted hover:text-red-500 transition-colors disabled:opacity-40"
            >
              {loading ? "…" : "Remove"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
