"use client";

import { useState } from "react";
import { emailInvite } from "./actions";

type Props = {
  token: string;
  clubName: string;
  inviterName: string;
};

export default function EmailInviteForm({ token, clubName, inviterName }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      await emailInvite({ to: email, token, clubName, inviterName });
      setStatus("sent");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
      <p className="text-sm font-semibold text-ink">Invite by email</p>
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
          required
          className="flex-1 bg-surface border border-slate/20 rounded-xl px-4 py-2.5 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors"
        />
        <button
          type="submit"
          disabled={status === "loading" || status === "sent"}
          className="shrink-0 bg-slate text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40"
        >
          {status === "loading" ? "Sending…" : status === "sent" ? "Sent ✓" : "Send"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-red-500 text-xs">Failed to send. Try again.</p>
      )}
    </form>
  );
}
