"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import UserAvatar from "@/components/UserAvatar";
import type { User } from "@/lib/supabase/database.types";
import { toast } from "sonner";

type Props = {
  user: User;
};

export default function ProfileForm({ user }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const DIETARY_OPTIONS = [
    { emoji: "🌱", label: "Vegetarian" },
    { emoji: "🌿", label: "Vegan" },
    { emoji: "🐟", label: "Pescatarian" },
    { emoji: "🌾", label: "Gluten-free" },
    { emoji: "🥛", label: "Dairy-free" },
    { emoji: "🥜", label: "Nut allergy" },
    { emoji: "🦐", label: "Shellfish allergy" },
    { emoji: "🍖", label: "Halal" },
    { emoji: "✡️", label: "Kosher" },
    { emoji: "🚫🐷", label: "No pork" },
    { emoji: "🚫🥩", label: "No beef" },
  ];

  const [name, setName] = useState(user.name ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [beliUsername, setBeliUsername] = useState(user.beli_username ?? "");
  const [dietary, setDietary] = useState<string[]>(user.dietary_restrictions ?? []);
  const [dietaryPublic, setDietaryPublic] = useState(user.dietary_public ?? true);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? null);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5MB.");
      return;
    }

    setAvatarLoading(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setAvatarLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

    await supabase.from("users").update({ avatar_url: publicUrl }).eq("id", user.id);

    setAvatarUrl(publicUrl);
    toast.success("Photo updated!");
    router.refresh();
    setAvatarLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }

    setLoading(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({ name: name.trim(), city: city.trim() || null, beli_username: beliUsername.trim() || null, dietary_restrictions: dietary, dietary_public: dietaryPublic })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSaved(true);
    toast.success("Profile saved!");
    router.refresh();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <UserAvatar name={name} email={user.email} avatarUrl={avatarUrl} size="lg" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarLoading}
            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity disabled:opacity-60"
          >
            <span className="text-white text-xs font-semibold">
              {avatarLoading ? "…" : "Edit"}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        <div>
          <p className="font-semibold text-ink">{name || user.email}</p>
          <p className="text-sm text-ink-muted">{user.email}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarLoading}
            className="text-xs text-citrus-dark font-semibold mt-1 hover:underline disabled:opacity-40"
          >
            {avatarLoading ? "Uploading…" : "Change photo"}
          </button>
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
          placeholder="e.g. Chicago"
          maxLength={60}
          className="w-full border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate bg-surface transition-colors"
        />
      </div>

      {/* Beli */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">
          Beli username <span className="text-ink-muted font-normal">(optional)</span>
        </label>
        <div className="flex items-center border border-slate/20 rounded-xl bg-surface focus-within:border-slate transition-colors overflow-hidden">
          <span className="pl-4 pr-1 text-ink-muted text-sm select-none">beliapp.co/app/</span>
          <input
            type="text"
            value={beliUsername}
            onChange={(e) => setBeliUsername(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ""))}
            placeholder="username"
            maxLength={60}
            className="flex-1 pr-4 py-3 text-ink placeholder-ink-faint focus:outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Dietary restrictions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-ink">
            Dietary restrictions <span className="text-ink-muted font-normal">(optional)</span>
          </label>
          <button
            type="button"
            onClick={() => setDietaryPublic(!dietaryPublic)}
            className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
          >
            <span className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${dietaryPublic ? "bg-slate" : "bg-black/20"}`}>
              <span className={`w-3 h-3 rounded-full bg-white transition-transform ${dietaryPublic ? "translate-x-3" : "translate-x-0"}`} />
            </span>
            {dietaryPublic ? "Visible to club members" : "Only visible to you"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map(({ emoji, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setDietary((prev) => prev.includes(label) ? prev.filter((d) => d !== label) : [...prev, label])}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all ${
                dietary.includes(label)
                  ? "bg-slate text-white border-slate font-semibold"
                  : "bg-surface border-slate/20 text-ink hover:border-slate/40"
              }`}
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
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
