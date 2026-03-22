"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const FOOD_EMOJIS = [
  "🍜", "🍣", "🍕", "🥩", "🌮", "🍱",
  "🥗", "🍔", "🍝", "🥟", "🦞", "🍗",
  "🥘", "🍛", "🍲", "🫕", "🥙", "🌯",
  "🍤", "🥂", "🍷", "🧆", "🥞", "🍖",
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

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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

    toast.success("Changes saved.");
    setLoading(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Emoji picker */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-3">
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
                  ? "bg-citrus/15 ring-2 ring-citrus-dark scale-110"
                  : "bg-white border border-black/8 hover:border-slate/30"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Club name */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-2">
          Club name <span className="text-citrus-dark">*</span>
        </label>
        <div className="flex items-center gap-3 bg-white border border-black/10 rounded-xl px-4 py-3 focus-within:border-slate transition-colors">
          <span className="text-2xl">{emoji}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={40}
            className="flex-1 text-ink placeholder-ink-faint focus:outline-none bg-transparent"
          />
        </div>
      </div>

      {/* City */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-2">
          City <span className="text-ink-muted font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. New York, Chicago"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={50}
          className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full bg-slate text-white font-bold py-3 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
