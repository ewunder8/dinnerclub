"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <main className="min-h-screen bg-snow flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-sans text-4xl font-black tracking-tight text-ink mb-10">
          dinner<span className="text-citrus-dark">club</span>
        </h1>

        <div className="bg-white border border-black/8 rounded-3xl p-10 shadow-sm">
          <div className="w-16 h-16 bg-citrus/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
            ✉️
          </div>
          <h2 className="font-sans text-2xl font-bold text-ink mb-3">
            Check your inbox
          </h2>
          <p className="text-ink-muted text-sm leading-relaxed mb-2">
            We sent a confirmation link to
          </p>
          {email && (
            <p className="font-semibold text-ink text-sm mb-4">{email}</p>
          )}
          <p className="text-ink-muted text-sm leading-relaxed">
            Click the link in that email to confirm your account and continue.
          </p>
        </div>

        <p className="text-ink-faint text-xs mt-6">
          Wrong email?{" "}
          <a href="/auth/login?signup=1" className="text-citrus-dark font-semibold">
            Go back
          </a>
        </p>
      </div>
    </main>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailContent />
    </Suspense>
  );
}
