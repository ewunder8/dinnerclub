"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteClubButton({ clubId, clubName }: { clubId: string; clubName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${clubName}"? This will permanently remove the club and all its dinners. This can't be undone.`)) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("clubs").delete().eq("id", clubId);
    router.push("/dashboard");
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="w-full py-3 rounded-xl border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors disabled:opacity-40"
    >
      {loading ? "Deleting…" : "Delete club"}
    </button>
  );
}
