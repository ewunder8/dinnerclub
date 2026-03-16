"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function OnboardingForm({
  userId,
  email,
  next = "/dashboard",
}: {
  userId: string;
  email: string;
  next?: string;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
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
      avatar_url: null,
      beli_connected: false,
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
          City <span className="text-ink-muted font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. New York"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full py-3 px-4 border border-slate/20 rounded-xl text-ink placeholder-ink-faint focus:outline-none focus:border-slate bg-surface"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full py-3 bg-slate text-white font-bold rounded-xl hover:bg-slate-light transition-colors disabled:opacity-50 mt-2"
      >
        {loading ? "Saving..." : "Let's eat →"}
      </button>
    </form>
  );
}
