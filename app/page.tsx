import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// This is the entry point.
// Logged-in users see their dashboard.
// Logged-out users see the marketing/login page.
export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect logged-in users to their dashboard
  if (user) {
    redirect("/dashboard");
  }

  // Logged-out: show landing page
  return (
    <main className="min-h-screen bg-charcoal flex flex-col items-center justify-center p-8">
      <div className="max-w-lg text-center">
        {/* Logo */}
        <h1 className="font-serif text-5xl font-black text-cream mb-2">
          Food<span className="text-clay">Club</span>
        </h1>
        <p className="text-cream/50 text-lg mb-12">
          Dinner is better together.
        </p>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <a
            href="/auth/login"
            className="bg-clay text-white font-semibold py-4 px-8 rounded-xl hover:bg-clay-dark transition-colors text-center"
          >
            Get Started
          </a>
          <a
            href="/auth/login"
            className="border border-white/20 text-cream/70 font-medium py-4 px-8 rounded-xl hover:border-white/40 hover:text-cream transition-colors text-center"
          >
            Log In
          </a>
        </div>

        <p className="text-cream/30 text-sm mt-8">
          Invite-only clubs. Start yours free.
        </p>
      </div>
    </main>
  );
}
