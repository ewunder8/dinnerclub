"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const FOOD_EMOJIS = [
  "🍜", "🍣", "🍕", "🥩", "🌮", "🍱",
  "🥗", "🍔", "🍝", "🥟", "🦞", "🍗",
  "🥘", "🍛", "🍲", "🫕", "🥙", "🌯",
  "🍤", "🥂", "🍷", "🫙", "🥩", "🍖",
];

export default function EditClubForm({
  clubId,
  initialName,
  initialEmoji,
  initialCity,
}: {
  clubId: string;
  initialName: string;
  initialEmoji: string;
  initialCity: string;
}) {
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [city, setCity] = useState(initialCity);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error } = await supabase
      .from("clubs")
      .update({ name: name.trim(), emoji, city: city.trim() || null })
      .eq("id", clubId);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Emoji picker */}
      <div>
        <label className="block text-sm font-semibold text-charcoal mb-3">
          Emoji
        </label>
        <div className="grid grid-cols-8 gap-2">
          {FOOD_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                emoji === e
                  ? "bg-clay/15 ring-2 ring-clay scale-110"
                  : "bg-white border border-black/8 hover:border-clay/30"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Club name */}
      <div>
        <label className="block text-sm font-semibold text-charcoal mb-2">
          Club name <span className="text-clay">*</span>
        </label>
        <div className="flex items-center gap-3 bg-white border border-black/10 rounded-xl px-4 py-3 focus-within:border-clay transition-colors">
          <span className="text-2xl">{emoji}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={40}
            className="flex-1 text-charcoal placeholder-mid/50 focus:outline-none bg-transparent"
          />
        </div>
      </div>

      {/* City */}
      <div>
        <label className="block text-sm font-semibold text-charcoal mb-2">
          City <span className="text-mid font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. New York, Chicago"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={50}
          className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-charcoal placeholder-mid/50 focus:outline-none focus:border-clay transition-colors"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {saved && <p className="text-green-600 text-sm">Changes saved.</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="flex-1 bg-clay text-white font-bold py-3 rounded-xl hover:bg-clay-dark transition-colors disabled:opacity-40"
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
        <a
          href={`/clubs/${clubId}`}
          className="px-6 py-3 border border-black/10 rounded-xl text-charcoal font-semibold hover:border-black/25 transition-colors text-center"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
