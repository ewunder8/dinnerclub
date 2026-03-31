"use client";

import { useState } from "react";
import { shareViaNative, copyToClipboard } from "@/lib/sharing";

type Props = {
  label?: string;
  message: string;
  url: string;
};

export default function ShareButton({ label = "Share", message, url }: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const text = `${message}\n${url}`;

  const handleShare = async () => {
    const shared = await shareViaNative({ title: label, text, url });
    if (!shared) setOpen((o) => !o);
  };

  const handleCopy = async () => {
    await copyToClipboard(url);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <button
        onClick={handleShare}
        className="w-full text-sm font-semibold text-ink-muted border border-black/10 py-3 rounded-xl hover:bg-black/5 transition-colors"
      >
        {copied ? "Link copied!" : label}
      </button>
      {open && (
        <div className="mt-2 bg-white border border-black/8 rounded-2xl p-4 flex flex-col gap-2">
          <button
            onClick={handleCopy}
            className="text-left text-sm font-semibold text-ink hover:text-citrus-dark transition-colors px-2 py-1.5"
          >
            Copy link
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-left text-sm font-semibold text-ink hover:text-citrus-dark transition-colors px-2 py-1.5"
            onClick={() => setOpen(false)}
          >
            WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
