import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import NavUser from "@/components/NavUser";
import Link from "next/link";
import { isRatingWindowOpen } from "@/lib/countdown";
import type { RestaurantCache, RSVP, User } from "@/lib/supabase/database.types";
import RatingsForm from "@/app/clubs/[id]/dinners/[dinnerId]/RatingsForm";
import CountdownView from "@/app/clubs/[id]/dinners/[dinnerId]/CountdownView";
import DinnerComments from "@/app/clubs/[id]/dinners/[dinnerId]/DinnerComments";
import OneOffDinnerView from "./OneOffDinnerView";
import OneOffDinnerActions from "./OneOffDinnerActions";
import type { DinnerComment } from "@/app/clubs/[id]/dinners/[dinnerId]/DinnerComments";

function Nav({
  title,
  emoji,
  name,
  email,
  avatarUrl,
}: {
  title?: string | null;
  emoji?: string | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  const label = [emoji, title].filter(Boolean).join(" ") || "Dinner";
  return (
    <nav className="bg-slate px-6 py-4 flex items-center">
      <div className="flex-1">
        <Link href="/dashboard" className="inline-flex items-center justify-center border border-white/20 hover:bg-white/10 transition-colors text-white w-9 h-9 rounded-full text-lg leading-none">←</Link>
      </div>
      <h1 className="font-sans text-base font-bold text-white truncate max-w-[180px] text-center">{label}</h1>
      <div className="flex-1 flex justify-end">
        <NavUser name={name} email={email} avatarUrl={avatarUrl} />
      </div>
    </nav>
  );
}

export async function generateMetadata({ params }: { params: { dinnerId: string } }) {
  const supabase = await createClient();
  const { data: dinner } = await supabase
    .from("dinners")
    .select("title, emoji")
    .eq("id", params.dinnerId)
    .is("club_id", null)
    .single();
  if (!dinner) return {};
  const label = [dinner.emoji, dinner.title].filter(Boolean).join(" ") || "Dinner";
  return { title: `${label} | DinnerClub` };
}

export default async function OneOffDinnerPage({
  params,
}: {
  params: { dinnerId: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, avatar_url, city")
    .eq("id", user.id)
    .single();

  // Fetch the one-off dinner (club_id IS NULL)
  const { data: dinner } = await supabase
    .from("dinners")
    .select("*")
    .eq("id", params.dinnerId)
    .is("club_id", null)
    .single();

  if (!dinner) notFound();

  // Access check: must be creator, cohost, or have an RSVP
  const isOriginalCreator = dinner.created_by === user.id;
  const { data: cohostRow } = await supabase
    .from("dinner_cohosts")
    .select("id")
    .eq("dinner_id", params.dinnerId)
    .eq("user_id", user.id)
    .maybeSingle();
  const isCreator = isOriginalCreator || !!cohostRow;

  if (!isCreator) {
    const { data: rsvp } = await supabase
      .from("rsvps")
      .select("user_id")
      .eq("dinner_id", params.dinnerId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!rsvp) {
      const { data: inviteLink } = await supabase
        .from("invite_links")
        .select("token")
        .eq("dinner_id", params.dinnerId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inviteLink) redirect(`/dinners/join/${inviteLink.token}`);
      notFound();
    }
  }

  const dinnerTitle = dinner.title ?? "Dinner";
  const dinnerEmoji = dinner.emoji ?? null;

  // ── Completed ──────────────────────────────────────────────────
  if (dinner.status === "completed") {
    const placeId = dinner.winning_restaurant_place_id ?? "";
    const [{ data: restaurant }, { data: existingRating }, { data: summary }] = await Promise.all([
      supabase.from("restaurant_cache").select("*").eq("place_id", placeId).single(),
      supabase.from("dinner_ratings").select("*").eq("dinner_id", params.dinnerId).eq("user_id", user.id).maybeSingle(),
      supabase.from("dinner_rating_summaries").select("*").eq("dinner_id", params.dinnerId).maybeSingle(),
    ]);

    const windowOpen = isRatingWindowOpen(dinner.ratings_open_until);

    return (
      <main className="min-h-screen bg-snow">
        <Nav title={dinnerTitle} emoji={dinnerEmoji} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="mb-6">
            <span className="inline-block text-xs font-semibold text-ink-muted uppercase tracking-wide bg-black/5 px-3 py-1 rounded-full mb-3">
              Dinner completed
            </span>
            <h2 className="font-sans text-3xl font-bold text-ink">How was it?</h2>
          </div>
          <RatingsForm
            dinner={dinner}
            restaurant={restaurant as RestaurantCache}
            userId={user.id}
            existingRating={existingRating ?? null}
            summary={summary ?? null}
            ratingWindowOpen={windowOpen}
          />
        </div>
      </main>
    );
  }

  // ── Confirmed ──────────────────────────────────────────────────
  if (dinner.status === "confirmed") {
    const placeId = dinner.winning_restaurant_place_id ?? "";
    const [{ data: restaurant }, { data: rawRsvps }, { data: rawComments }] = await Promise.all([
      placeId
        ? supabase.from("restaurant_cache").select("*").eq("place_id", placeId).single()
        : Promise.resolve({ data: null }),
      supabase.from("rsvps").select("*, users ( id, name, email, avatar_url )").eq("dinner_id", params.dinnerId),
      supabase.from("dinner_comments")
        .select("id, user_id, body, created_at, users ( name, email )")
        .eq("dinner_id", params.dinnerId)
        .order("created_at", { ascending: true }),
    ]);

    const { data: creatorProfile } = dinner.created_by
      ? await supabase.from("users").select("name, email").eq("id", dinner.created_by).single()
      : { data: null };

    const creatorName = creatorProfile
      ? (creatorProfile.name || creatorProfile.email?.split("@")[0] || "Host")
      : null;
    const hosts = creatorName ? [{ name: creatorName }] : [];

    const comments: DinnerComment[] = (rawComments ?? []).map((c: any) => ({
      id: c.id,
      user_id: c.user_id,
      body: c.body,
      created_at: c.created_at,
      author_name: c.users?.name || c.users?.email?.split("@")[0] || "Guest",
    }));

    // Use target_date as fallback if reservation_datetime wasn't set (pre-migration data)
    const dinnerForCountdown = {
      ...dinner,
      reservation_datetime: dinner.reservation_datetime ?? dinner.target_date,
    };

    return (
      <main className="min-h-screen bg-snow">
        <Nav title={dinnerTitle} emoji={dinnerEmoji} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-5">
          <CountdownView
            dinner={dinnerForCountdown}
            restaurant={restaurant as RestaurantCache}
            rsvps={(rawRsvps ?? []) as (RSVP & { users: User })[]}
            userId={user.id}
            clubName={dinnerTitle}
            shareUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dinners/${dinner.id}`}
            hosts={hosts}
          />
          <DinnerComments dinnerId={dinner.id} userId={user.id} comments={comments} />
          {isCreator && <OneOffDinnerActions dinnerId={dinner.id} />}
        </div>
      </main>
    );
  }

  // ── Cancelled ──────────────────────────────────────────────────
  if (dinner.status === "cancelled") {
    return (
      <main className="min-h-screen bg-snow">
        <Nav title={dinnerTitle} emoji={dinnerEmoji} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        <div className="max-w-2xl mx-auto px-6 py-10 text-center">
          <p className="text-4xl mb-4">❌</p>
          <h2 className="font-sans text-2xl font-bold text-ink mb-2">Dinner cancelled</h2>
          <p className="text-ink-muted text-sm">This dinner has been cancelled.</p>
          <Link href="/dashboard" className="inline-block mt-6 text-sm font-semibold text-citrus-dark hover:underline">
            Back to dashboard →
          </Link>
        </div>
      </main>
    );
  }

  // ── Active (polling or confirmed-without-full-reservation) ─────
  const [
    { data: rawRsvps },
    { data: rawComments },
    { data: creatorProfile },
    { data: inviteLink },
    { data: restaurant },
  ] = await Promise.all([
    supabase.from("rsvps").select("*, users ( id, name, email, avatar_url )").eq("dinner_id", params.dinnerId),
    supabase.from("dinner_comments")
      .select("id, user_id, body, created_at, users ( name, email )")
      .eq("dinner_id", params.dinnerId)
      .order("created_at", { ascending: true }),
    dinner.created_by
      ? supabase.from("users").select("name, email").eq("id", dinner.created_by).single()
      : Promise.resolve({ data: null }),
    supabase.from("invite_links")
      .select("token")
      .eq("dinner_id", params.dinnerId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    dinner.winning_restaurant_place_id
      ? supabase.from("restaurant_cache").select("*").eq("place_id", dinner.winning_restaurant_place_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const inviteToken = inviteLink?.token ?? null;
  const inviteUrl = inviteToken ? `${appUrl}/dinners/join/${inviteToken}` : null;

  const creatorName = creatorProfile
    ? (creatorProfile.name || creatorProfile.email?.split("@")[0] || "Host")
    : null;
  const hosts = creatorName ? [{ name: creatorName }] : [];

  const comments: DinnerComment[] = (rawComments ?? []).map((c: any) => ({
    id: c.id,
    user_id: c.user_id,
    body: c.body,
    created_at: c.created_at,
    author_name: c.users?.name || c.users?.email?.split("@")[0] || "Guest",
  }));

  return (
    <main className="min-h-screen bg-snow">
      <Nav title={dinnerTitle} emoji={dinnerEmoji} name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <OneOffDinnerView
          dinner={dinner}
          restaurant={(restaurant as RestaurantCache) ?? null}
          rawRsvps={(rawRsvps ?? []) as (RSVP & { users: User })[]}
          userId={user.id}
          isCreator={isCreator}
          inviteUrl={inviteUrl}
          comments={comments}
          hosts={hosts}
          appUrl={appUrl}
          userCity={profile?.city ?? null}
        />
      </div>
    </main>
  );
}
