"use client";

import { useState } from "react";

export default function InviteButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${token}`
      : `/join/${token}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 bg-white border border-black/10 rounded-xl p-3">
      <p className="flex-1 text-sm text-mid truncate font-mono">
        /join/{token}
      </p>
      <button
        onClick={handleCopy}
        className="shrink-0 bg-clay text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-clay-dark transition-colors"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
