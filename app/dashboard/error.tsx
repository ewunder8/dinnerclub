"use client";

import { useEffect } from "react";

export default function DashboardError({
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
      <nav className="bg-slate px-6 py-4 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-white">
          dinner<span className="text-citrus">club</span>
        </h1>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-5xl mb-4">😬</p>
        <h2 className="font-sans text-2xl font-bold text-ink mb-2">Couldn't load your dashboard</h2>
        <p className="text-ink-muted text-sm mb-8">Something went wrong fetching your clubs and dinners.</p>
        <button
          onClick={reset}
          className="bg-slate text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-light transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
