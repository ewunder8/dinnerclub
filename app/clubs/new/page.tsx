"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateInviteToken, getInviteExpiry } from "@/lib/utils";

const FOOD_EMOJIS = [
  "🍜", "🍣", "🍕", "🥩", "🌮", "🍱",
  "🥗", "🍔", "🍝", "🥟", "🦞", "🍗",
  "🥘", "🍛", "🍲", "🫕", "🥙", "🌯",
  "🍤", "🥂", "🍷", "🧆", "🥞", "🍖",
];

export default function CreateClubPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍜");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    // Create the club
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .insert({ name: name.trim(), emoji, city: city.trim() || null, vibe: null, frequency: null, owner_id: user.id })
      .select()
      .single();

    if (clubError || !club) {
      setError(clubError?.message || "Failed to create club");
      setLoading(false);
      return;
    }

    // Add creator as owner
    await supabase.from("club_members").insert({
      club_id: club.id,
      user_id: user.id,
      role: "owner",
    });

    // Create the first invite link
    await supabase.from("invite_links").insert({
      club_id: club.id,
      created_by: user.id,
      token: generateInviteToken(),
      expires_at: getInviteExpiry().toISOString(),
      status: "active",
    });

    router.push(`/clubs/${club.id}`);
  };

  return (
    <main className="min-h-screen bg-snow">
      {/* Nav */}
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <button onClick={() => router.back()} className="text-white/60 hover:text-white transition-colors text-2xl font-light">‹</button>
        </div>
        <h1 className="font-sans text-base font-bold text-white">New club</h1>
        <div className="flex-1" />
      </nav>

      <div className="max-w-lg mx-auto px-6 py-12">
        <h2 className="font-sans text-3xl font-bold mb-2">Create a club</h2>
        <p className="text-ink-muted text-sm mb-10">
          Give your dinner crew a name and a vibe.
        </p>

        <form onSubmit={handleCreate} className="flex flex-col gap-8">
          {/* Emoji picker */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-3">
              Pick an emoji
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
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-ink mb-2"
            >
              Club name <span className="text-citrus-dark">*</span>
            </label>
            <div className="flex items-center gap-3 bg-white border border-black/10 rounded-xl px-4 py-3 focus-within:border-slate transition-colors">
              <span className="text-2xl">{emoji}</span>
              <input
                id="name"
                type="text"
                placeholder="e.g. Ramen Rats, Friday Night Crew"
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
            <label
              htmlFor="city"
              className="block text-sm font-semibold text-ink mb-2"
            >
              City <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <input
              id="city"
              type="text"
              placeholder="e.g. New York, Chicago"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={50}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors"
            />
          </div>

          {/* Preview */}
          {name && (
            <div className="bg-slate rounded-2xl p-6 flex items-center gap-4">
              <span className="text-4xl">{emoji}</span>
              <div>
                <p className="font-sans text-xl font-bold text-white">{name}</p>
                {city && <p className="text-white/60 text-sm">{city}</p>}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Create club →"}
          </button>
        </form>
      </div>
    </main>
  );
}
