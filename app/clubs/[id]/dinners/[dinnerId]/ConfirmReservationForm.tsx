"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Dinner } from "@/lib/supabase/database.types";

type Platform = NonNullable<Dinner["reservation_platform"]>;

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "resy",      label: "Resy" },
  { value: "opentable", label: "OpenTable" },
  { value: "tock",      label: "Tock" },
  { value: "other",     label: "Other" },
];

type Props = {
  dinnerId: string;
  userId: string;
};

export default function ConfirmReservationForm({ dinnerId, userId }: Props) {
  const router = useRouter();

  const [datetime, setDatetime] = useState("");
  const [partySize, setPartySize] = useState(4);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Min datetime: at least 30 minutes from now
  const minDatetime = new Date(Date.now() + 30 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const stepPartySize = (delta: number) => {
    setPartySize((v) => Math.max(1, Math.min(50, v + delta)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datetime) { setError("Reservation date and time is required."); return; }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("dinners")
      .update({
        status: "confirmed",
        reservation_datetime: new Date(datetime).toISOString(),
        party_size: partySize,
        reservation_platform: platform,
        confirmation_number: confirmationNumber.trim() || null,
        reserved_by: userId,
      })
      .eq("id", dinnerId);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-black/8 rounded-2xl p-5 flex flex-col gap-5"
    >
      <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide">
        Confirm reservation
      </h3>

      {/* Date & time */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">
          Date & time <span className="text-citrus-dark">*</span>
        </label>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          min={minDatetime}
          required
          className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-slate transition-colors"
        />
      </div>

      {/* Party size */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">
          Party size
        </label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => stepPartySize(-1)}
            disabled={partySize <= 1}
            className="w-10 h-10 rounded-xl bg-black/5 text-ink font-bold hover:bg-black/10 disabled:opacity-30 transition-colors text-lg"
          >
            −
          </button>
          <span className="font-bold text-xl text-ink w-6 text-center">
            {partySize}
          </span>
          <button
            type="button"
            onClick={() => stepPartySize(1)}
            disabled={partySize >= 50}
            className="w-10 h-10 rounded-xl bg-black/5 text-ink font-bold hover:bg-black/10 disabled:opacity-30 transition-colors text-lg"
          >
            +
          </button>
        </div>
      </div>

      {/* Platform */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-2">
          Reserved via <span className="text-ink-muted font-normal">(optional)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPlatform(platform === p.value ? null : p.value)}
              className={cn(
                "py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all",
                platform === p.value
                  ? "bg-citrus/10 border-citrus-dark text-citrus-dark"
                  : "bg-white border-slate/20 text-ink hover:border-slate/30"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Confirmation number */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">
          Confirmation number <span className="text-ink-muted font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. RES-12345"
          value={confirmationNumber}
          onChange={(e) => setConfirmationNumber(e.target.value)}
          maxLength={50}
          className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Confirming…" : "Confirm reservation →"}
      </button>
    </form>
  );
}
