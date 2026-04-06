import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function JoinOneOffDinnerPage({
  params,
}: {
  params: { token: string };
}) {
  // Use admin client to read invite + dinner preview without requiring auth
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invite_links")
    .select("id, dinner_id, status, expires_at")
    .eq("token", params.token)
    .is("club_id", null)
    .maybeSingle();

  if (!invite || !invite.dinner_id) notFound();

  const isExpired = invite.status !== "active" || new Date(invite.expires_at) < new Date();

  // Fetch dinner preview (title, date) and organizer name
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, title, target_date, created_by")
    .eq("id", invite.dinner_id)
    .single();

  if (!dinner) notFound();

  let organizerName: string | null = null;
  if (dinner.created_by) {
    const { data: organizer } = await admin
      .from("users")
      .select("name")
      .eq("id", dinner.created_by)
      .single();
    organizerName = organizer?.name ?? null;
  }

  const dateLabel = dinner.target_date
    ? new Date(dinner.target_date).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : null;

  // ── Expired invite ──────────────────────────────────────────
  if (isExpired) {
    return (
      <main className="min-h-screen bg-snow flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <p className="text-5xl mb-5">🔗</p>
          <h1 className="font-sans text-xl font-bold text-ink mb-2">This link has expired</h1>
          <p className="text-ink-muted text-sm">Ask {organizerName ?? "the organizer"} to send you a fresh invite link.</p>
        </div>
      </main>
    );
  }

  // ── Authenticated: process the join ─────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Add RSVP so they have access
    await supabase
      .from("rsvps")
      .upsert(
        { dinner_id: invite.dinner_id, user_id: user.id, status: "going" },
        { onConflict: "dinner_id,user_id" }
      );

    redirect(`/dinners/${invite.dinner_id}`);
  }

  // ── Not logged in: show dinner preview + join CTA ───────────
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

        {/* Dinner card */}
        <div className="bg-white border border-black/8 rounded-2xl px-6 py-6 mb-6 text-center">
          <p className="text-3xl mb-3">🍽️</p>
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-2">
            You&apos;re invited
          </p>
          <h2 className="font-sans text-2xl font-bold text-ink mb-1">
            {dinner.title ?? "Dinner"}
          </h2>
          {dateLabel && (
            <p className="text-ink-muted text-sm mt-1">{dateLabel}</p>
          )}
          {organizerName && (
            <p className="text-xs text-ink-muted mt-3">
              Organized by <span className="font-semibold text-ink">{organizerName}</span>
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <Link
            href={`${loginUrl}&signup=1`}
            className="block w-full bg-slate text-white font-bold py-4 rounded-xl text-center hover:bg-slate-light transition-colors text-sm"
          >
            Create a free account to join →
          </Link>
          <Link
            href={loginUrl}
            className="block w-full bg-white border border-black/10 text-ink font-semibold py-4 rounded-xl text-center hover:border-slate/30 transition-colors text-sm"
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
