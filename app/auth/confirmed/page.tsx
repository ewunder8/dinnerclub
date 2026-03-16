"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ConfirmedContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/onboarding";

  return (
    <main className="min-h-screen bg-snow flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-sans text-4xl font-black tracking-tight text-ink mb-10">
          dinner<span className="text-citrus-dark">club</span>
        </h1>

        <div className="bg-white border border-black/8 rounded-3xl p-10 shadow-sm">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
            ✅
          </div>
          <h2 className="font-sans text-2xl font-bold text-ink mb-3">
            Email confirmed!
          </h2>
          <p className="text-ink-muted text-sm leading-relaxed mb-8">
            You're all set. Let's get your account set up.
          </p>
          <a
            href={next}
            className="block w-full bg-slate text-white text-center font-bold py-4 rounded-xl hover:bg-slate-light transition-colors"
          >
            Continue →
          </a>
        </div>
      </div>
    </main>
  );
}

export default function ConfirmedPage() {
  return (
    <Suspense>
      <ConfirmedContent />
    </Suspense>
  );
}
