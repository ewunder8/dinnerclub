"use client";

import { useState } from "react";

export default function ShareInviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-citrus/8 border border-citrus/20 rounded-2xl px-5 py-4 mb-6">
      <p className="text-xs font-semibold text-citrus-dark mb-1">Share this dinner</p>
      <p className="text-xs text-ink-muted mb-3">Send this link to your guests so they can join.</p>
      <div className="flex items-center gap-2 bg-white border border-black/10 rounded-xl px-3 py-2">
        <p className="flex-1 text-xs text-ink truncate">{link}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-semibold text-citrus-dark shrink-0"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
