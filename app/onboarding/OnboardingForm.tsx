"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.from("users").upsert({
      id: userId,
      email,
      name: name.trim(),
      city: city.trim() || null,
      beli_connected: false,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(next);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-semibold text-charcoal mb-1">
          Your name <span className="text-clay">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Alex Chen"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full py-3 px-4 border border-clay/20 rounded-xl text-charcoal placeholder-mid/50 focus:outline-none focus:border-clay"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-charcoal mb-1">
          City <span className="text-mid font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. New York"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full py-3 px-4 border border-clay/20 rounded-xl text-charcoal placeholder-mid/50 focus:outline-none focus:border-clay"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full py-3 bg-charcoal text-cream font-bold rounded-xl hover:bg-black transition-colors disabled:opacity-50 mt-2"
      >
        {loading ? "Saving..." : "Let's eat →"}
      </button>
    </form>
  );
}
