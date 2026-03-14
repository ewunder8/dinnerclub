"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/supabase/database.types";

type Props = {
  user: User;
};

export default function ProfileForm({ user }: Props) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }

    setLoading(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({ name: name.trim(), city: city.trim() || null })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSaved(true);
    router.refresh();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Avatar initials preview */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-slate flex items-center justify-center text-white text-2xl font-bold">
          {(name || user.email).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-ink">{name || user.email}</p>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">
          Name <span className="text-citrus-dark">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={80}
          required
          className="w-full border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate bg-surface transition-colors"
        />
      </div>

      {/* City */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">
          City <span className="text-ink-muted font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. New York"
          maxLength={60}
          className="w-full border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate bg-surface transition-colors"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {saved && <p className="text-green-600 text-sm font-semibold">Profile saved!</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-slate text-white font-bold py-4 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Saving…" : "Save changes →"}
      </button>
    </form>
  );
}
