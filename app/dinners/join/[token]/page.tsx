import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  }) + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function JoinOneOffDinnerPage({
  params,
}: {
  params: { token: string };
}) {
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invite_links")
    .select("id, dinner_id, status, expires_at")
    .eq("token", params.token)
    .is("club_id", null)
    .maybeSingle();

  // Invalid token — soft message, no 404
  if (!invite || !invite.dinner_id) {
    return (
      <main className="min-h-screen bg-snow flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <h1 className="font-sans text-2xl font-bold text-ink mb-3">DinnerClub</h1>
          <p className="text-ink-muted text-sm">You need an invite to view this dinner.</p>
        </div>
      </main>
    );
  }

  const isExpired = invite.status !== "active" || new Date(invite.expires_at) < new Date();

  // Fetch dinner preview
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, title, emoji, target_date, created_by, status, winning_restaurant_place_id")
    .eq("id", invite.dinner_id)
    .single();

  if (!dinner) notFound();

  // Fetch organizer name and restaurant in parallel
  const [organizerResult, restaurantResult] = await Promise.all([
    dinner.created_by
      ? admin.from("users").select("name").eq("id", dinner.created_by).single()
      : Promise.resolve({ data: null }),
    dinner.winning_restaurant_place_id
      ? admin.from("restaurant_cache").select("name, address").eq("place_id", dinner.winning_restaurant_place_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const organizerName = organizerResult.data?.name ?? null;
  const restaurantName = restaurantResult.data?.name ?? null;
  const dateLabel = dinner.target_date ? formatDateTime(dinner.target_date) : null;
  const dinnerTitle = dinner.title ?? "Dinner";
  const dinnerEmoji = dinner.emoji ?? "🍽️";

  // ── Expired or invalid invite ────────────────────────────────
  if (isExpired) {
    return (
      <main className="min-h-screen bg-snow flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <p className="text-5xl mb-5">🔗</p>
          <h1 className="font-sans text-xl font-bold text-ink mb-2">This link has expired</h1>
          <p className="text-ink-muted text-sm">
            Ask {organizerName ?? "the organizer"} to send you a fresh invite link.
          </p>
        </div>
      </main>
    );
  }

  // ── RSVPs locked — dinner is confirmed ─────────────────────
  if (dinner.status === "confirmed") {
    return (
      <main className="min-h-screen bg-snow flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <p className="text-5xl mb-5">🔒</p>
          <h1 className="font-sans text-xl font-bold text-ink mb-2">RSVPs are closed</h1>
          <p className="text-ink-muted text-sm">
            {organizerName ?? "The organizer"} has locked the guest list for this dinner.
          </p>
        </div>
      </main>
    );
  }

  // ── Authenticated: process the join ─────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await admin
      .from("rsvps")
      .upsert(
        { dinner_id: invite.dinner_id, user_id: user.id, status: "going" },
        { onConflict: "dinner_id,user_id" }
      );

    redirect(`/dinners/${invite.dinner_id}`);
  }

  // ── Not logged in: show teaser + join CTA ───────────────────
  const loginUrl = `/auth/login?next=${encodeURIComponent(`/dinners/join/${params.token}`)}`;

  return (
    <main className="min-h-screen bg-snow flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-sans text-3xl font-black tracking-tight text-ink">
            dinner<span className="text-citrus-dark">club</span>
          </h1>
        </div>

        {/* Teaser card */}
        <div className="bg-white border border-black/8 rounded-2xl px-6 py-7 mb-6">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-4 text-center">
            You&apos;re invited
          </p>

          <div className="text-center mb-5">
            <p className="text-5xl mb-3">{dinnerEmoji}</p>
            <h2 className="font-sans text-2xl font-bold text-ink">{dinnerTitle}</h2>
            {organizerName && (
              <p className="text-xs text-ink-muted mt-2">
                Organized by <span className="font-semibold text-ink">{organizerName}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-black/5 pt-5">
            {restaurantName && (
              <div className="flex items-center gap-3">
                <span className="text-base">🍴</span>
                <p className="text-sm font-semibold text-ink">{restaurantName}</p>
              </div>
            )}
            {dateLabel && (
              <div className="flex items-center gap-3">
                <span className="text-base">📅</span>
                <p className="text-sm text-ink">{dateLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Link
            href={`${loginUrl}&signup=1`}
            className="block w-full bg-citrus text-slate font-bold py-4 rounded-xl text-center hover:bg-citrus/90 transition-colors text-sm"
          >
            Create a free account to join →
          </Link>
          <Link
            href={loginUrl}
            className="block w-full text-center text-sm font-semibold text-ink-muted hover:text-ink transition-colors py-2"
          >
            I already have an account
          </Link>
        </div>

        <p className="text-center text-ink-faint text-xs mt-6 leading-relaxed">
          dinnerclub helps friends coordinate where to eat. Free forever.
        </p>
      </div>
    </main>
  );
}
