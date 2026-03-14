"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateInviteToken, getInviteExpiry } from "@/lib/utils";

export default function GenerateInviteButton({ clubId }: { clubId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.from("invite_links").insert({
      club_id: clubId,
      created_by: (await supabase.auth.getUser()).data.user!.id,
      token: generateInviteToken(),
      expires_at: getInviteExpiry().toISOString(),
      status: "active",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.refresh();
  };

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-3 bg-clay text-white font-bold rounded-xl hover:bg-clay-dark transition-colors disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate invite link"}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}
