"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { SUPPORTED_CITIES } from "@/lib/editorial";
import { FOOD_EMOJIS } from "@/lib/emojis";

export default function OnboardingForm({
  userId,
  email,
  googleAvatarUrl = null,
  googleName = null,
  next = "/dashboard",
}: {
  userId: string;
  email: string;
  googleAvatarUrl?: string | null;
  googleName?: string | null;
  next?: string;
}) {
  const [name, setName] = useState(googleName ?? "");
  const [city, setCity] = useState("");
  const [emojiAvatar, setEmojiAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.from("users").upsert({
      id: userId,
      email,
      name: name.trim(),
      city: city.trim() || null,
      avatar_url: emojiAvatar ?? googleAvatarUrl,
      beli_connected: false,
      email_notifications: { reservation_confirmed: true, dinner_reminder: true, voting_open: true, rating_prompt: true, open_seat_posted: true, open_seat_update: true, dinner_cancelled: true },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = next;
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">
          Your name <span className="text-citrus-dark">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Alex Chen"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full py-3 px-4 border border-slate/20 rounded-xl text-ink placeholder-ink-faint focus:outline-none focus:border-slate bg-surface"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink mb-1">
          City <span className="text-citrus-dark">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. New York"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
          list="city-suggestions"
          className="w-full py-3 px-4 border border-slate/20 rounded-xl text-ink placeholder-ink-faint focus:outline-none focus:border-slate bg-surface"
        />
        <datalist id="city-suggestions">
          {SUPPORTED_CITIES.map((c) => (
            <option key={c} value={c.replace(/\b\w/g, (l) => l.toUpperCase())} />
          ))}
        </datalist>
      </div>

      {/* Emoji avatar — shown when no Google photo, or as an override */}
      {!googleAvatarUrl || emojiAvatar ? (
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Pick a profile emoji <span className="text-ink-muted font-normal">(optional)</span>
          </label>
          <div className="grid grid-cols-8 gap-2">
            {FOOD_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmojiAvatar(emojiAvatar === e ? null : e)}
                className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                  emojiAvatar === e
                    ? "bg-citrus/15 ring-2 ring-citrus-dark scale-110"
                    : "bg-white border border-black/8 hover:border-slate/30"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-ink-muted mb-2">Profile photo from Google</p>
          <div className="flex items-center gap-3">
            <img src={googleAvatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            <button
              type="button"
              onClick={() => setEmojiAvatar(FOOD_EMOJIS[0])}
              className="text-xs text-citrus-dark font-semibold hover:underline"
            >
              Use an emoji instead
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim() || !city.trim()}
        className="w-full py-3 bg-slate text-white font-bold rounded-xl hover:bg-slate-light transition-colors disabled:opacity-50 mt-2"
      >
        {loading ? "Saving..." : "Let's eat →"}
      </button>
    </form>
  );
}
