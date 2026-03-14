"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <main className="min-h-screen bg-warm-white flex flex-col items-center justify-center p-6 text-center">
      <p className="text-6xl mb-6">😬</p>
      <h1 className="font-serif text-4xl font-black text-charcoal mb-3">
        Something went wrong
      </h1>
      <p className="text-mid text-sm mb-8 max-w-xs">
        An unexpected error occurred. Try again or head back to the dashboard.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-clay text-white font-bold py-3 px-6 rounded-xl hover:bg-clay-dark transition-colors"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="border border-black/10 text-charcoal font-semibold py-3 px-6 rounded-xl hover:border-black/25 transition-colors"
        >
          Dashboard
        </a>
      </div>
    </main>
  );
}
