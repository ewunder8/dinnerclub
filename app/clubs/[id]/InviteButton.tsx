"use client";

import { useState } from "react";
import { toast } from "sonner";
import { refreshInviteLink } from "./actions";

export default function InviteButton({
  token: initialToken,
  expiresAt: initialExpiresAt,
  clubId,
}: {
  token: string;
  expiresAt: string;
  clubId: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [refreshing, setRefreshing] = useState(false);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dinnerclub.app";
  const inviteUrl = `${appUrl}/join/${token}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    toast.success("Link copied!", { description: `Valid until ${expiryDate}` });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await refreshInviteLink(clubId);
      setToken(fresh.token);
      setExpiresAt(fresh.expires_at);
      toast.success("New link generated", { description: "The previous link will no longer work." });
    } catch {
      toast.error("Failed to refresh link");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 bg-white border border-black/10 rounded-xl p-3">
        <p className="flex-1 text-sm text-ink-muted truncate font-mono">
          /join/{token}
        </p>
        <button
          onClick={handleCopy}
          className="shrink-0 bg-slate text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-slate-light transition-colors"
        >
          Copy link
        </button>
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="text-xs text-ink-muted hover:text-ink transition-colors self-start disabled:opacity-40"
      >
        {refreshing ? "Refreshing…" : "↺ Refresh link"}
      </button>
    </div>
  );
}
