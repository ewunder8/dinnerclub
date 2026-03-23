import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-slate text-white flex flex-col">

      {/* Nav */}
      <nav className="px-8 py-6 flex items-center justify-between max-w-5xl mx-auto w-full">
        <h1 className="font-sans text-2xl font-extrabold">
          dinner<span className="text-citrus">club</span>
        </h1>
        <a
          href="/auth/login"
          className="text-sm font-semibold text-white/70 hover:text-white transition-colors"
        >
          Log in
        </a>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-3xl mx-auto w-full">
        <p className="text-citrus text-sm font-semibold uppercase tracking-widest mb-6">
          For friend groups who eat well
        </p>
        <h2 className="font-sans text-5xl md:text-7xl font-black leading-tight mb-6">
          Stop debating.<br />Start eating.
        </h2>
        <p className="text-white/60 text-lg md:text-xl max-w-xl leading-relaxed mb-10">
          DinnerClub makes it effortless to pick a restaurant, book a reservation,
          and actually show up — together.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <a
            href="/auth/login"
            className="flex-1 bg-citrus-dark text-white font-bold py-4 px-8 rounded-xl hover:bg-citrus transition-colors text-center"
          >
            Start your club →
          </a>
          <a
            href="/auth/login"
            className="flex-1 border border-white/20 text-white/70 font-semibold py-4 px-8 rounded-xl hover:border-white/40 hover:text-white transition-colors text-center"
          >
            Log in
          </a>
        </div>
        <p className="text-white/30 text-sm mt-5">Invite-only clubs. Free to use.</p>
      </section>

      {/* How it works */}
      <section className="border-t border-white/8 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-white/40 text-xs uppercase tracking-widest font-semibold mb-12">
            How it works
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {[
              {
                step: "01",
                emoji: "❤️",
                title: "Wishlist",
                desc: "Save restaurants your group has been eyeing. Pull from the list when it's time to vote.",
              },
              {
                step: "02",
                emoji: "🗳️",
                title: "Vote",
                desc: "Open a poll, set a theme, and let the crew suggest. See who's voted in real time.",
              },
              {
                step: "03",
                emoji: "📅",
                title: "Find a time",
                desc: "Run an availability poll so everyone marks when they're free before committing.",
              },
              {
                step: "04",
                emoji: "🍽️",
                title: "Show up",
                desc: "RSVP, sync to your calendar, or pass your seat to another member if plans change.",
              },
              {
                step: "05",
                emoji: "⭐",
                title: "Rate",
                desc: "After dinner, everyone rates the meal. Your club builds a real food history over time.",
              },
            ].map(({ step, emoji, title, desc }) => (
              <div key={step} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{emoji}</span>
                  <span className="text-white/20 text-xs font-mono">{step}</span>
                </div>
                <h3 className="font-sans text-xl font-bold">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-white/8 py-20 px-6 bg-white/3">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-white/40 text-xs uppercase tracking-widest font-semibold mb-12">
            Built for friend groups
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                emoji: "🔒",
                title: "Invite-only clubs",
                desc: "Private by default. Share a link to let friends in — no account required to join.",
              },
              {
                emoji: "❤️",
                title: "Club wishlist",
                desc: "Members save restaurants they want to try. Pull from the wishlist when it's time to vote.",
              },
              {
                emoji: "🎯",
                title: "Themed polls",
                desc: "Set a cuisine, price range, vibe, or neighborhood before the crew starts suggesting.",
              },
              {
                emoji: "📅",
                title: "Availability polls",
                desc: "Find a date that actually works. Members mark when they're free before dinner is planned.",
              },
              {
                emoji: "🪑",
                title: "Open seats",
                desc: "Can't make it? Post your reservation spot so another member can take your place.",
              },
              {
                emoji: "⭐",
                title: "Track your taste",
                desc: "Post-dinner ratings build a shared history of where your group has eaten and loved.",
              },
            ].map(({ emoji, title, desc }) => (
              <div
                key={title}
                className="bg-white/5 border border-white/8 rounded-2xl p-5"
              >
                <p className="text-2xl mb-3">{emoji}</p>
                <h3 className="font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-white/8 py-20 px-6 text-center">
        <div className="max-w-lg mx-auto">
          <h2 className="font-sans text-4xl font-black mb-4">
            Ready to eat?
          </h2>
          <p className="text-white/50 mb-8">
            Create a club, invite your crew, and never argue about where to eat again.
          </p>
          <a
            href="/auth/login"
            className="inline-block bg-citrus-dark text-white font-bold py-4 px-10 rounded-xl hover:bg-citrus transition-colors"
          >
            Start your club →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8 px-6 text-center">
        <p className="text-white/20 text-xs">
          © {new Date().getFullYear()} DinnerClub. Dinner is better together.
        </p>
      </footer>

    </main>
  );
}
