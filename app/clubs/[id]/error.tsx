"use client";

import { useEffect } from "react";

export default function ClubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <a href="/dashboard" className="text-white/60 hover:text-white transition-colors text-2xl font-light">‹</a>
        </div>
        <h1 className="font-sans text-base font-bold text-white">Club</h1>
        <div className="flex-1" />
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-5xl mb-4">😬</p>
        <h2 className="font-sans text-2xl font-bold text-ink mb-2">Couldn't load this club</h2>
        <p className="text-ink-muted text-sm mb-8">Something went wrong. Try again or head back to your dashboard.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-slate text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-light transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="border border-black/10 text-ink font-semibold py-3 px-6 rounded-xl hover:border-black/25 transition-colors"
          >
            Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
