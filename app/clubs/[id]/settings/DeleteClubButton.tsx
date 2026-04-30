"use client";

import { useState } from "react";
import { deleteClub } from "./actions";

export default function DeleteClubButton({ clubId, clubName }: { clubId: string; clubName: string }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${clubName}"? This will permanently remove the club and all its dinners. This can't be undone.`)) return;
    setLoading(true);
    await deleteClub(clubId);
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
