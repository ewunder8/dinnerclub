import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type FeedEvent = {
  type: "rsvp" | "vote" | "suggested" | "wishlist" | "rating";
  userName: string;
  label: string;
  timestamp: string;
  link?: string;
};

const EVENT_CONFIG: Record<FeedEvent["type"], { icon: string; verb: string }> = {
  rsvp:      { icon: "🙋", verb: "RSVP'd to" },
  vote:      { icon: "🗳", verb: "voted on" },
  suggested: { icon: "💡", verb: "suggested" },
  wishlist:  { icon: "❤️", verb: "added to wishlist" },
  rating:    { icon: "⭐", verb: "rated" },
};

function timeAgo(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ActivityFeed({ clubId }: { clubId: string }) {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: dinners }, { data: members }] = await Promise.all([
    supabase
      .from("dinners")
      .select("id, theme_cuisine, theme_neighborhood, winning_restaurant_place_id")
      .eq("club_id", clubId)
      .neq("status", "cancelled"),
    supabase
      .from("club_members")
      .select("user_id, users ( name, email )")
      .eq("club_id", clubId),
  ]);

  const dinnerIds = (dinners ?? []).map((d) => d.id);

  const memberNameMap: Record<string, string> = {};
  for (const m of (members as any[]) ?? []) {
    memberNameMap[m.user_id] = (m.users?.name ?? m.users?.email?.split("@")[0]) ?? "Someone";
  }

  const [rsvpRes, voteRes, suggestRes, wishlistRes, ratingRes] = await Promise.all([
    dinnerIds.length > 0
      ? supabase.from("rsvps").select("user_id, dinner_id, created_at").in("dinner_id", dinnerIds).eq("status", "going").gte("created_at", since).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as any[] }),
    dinnerIds.length > 0
      ? supabase.from("votes").select("user_id, dinner_id, created_at").in("dinner_id", dinnerIds).gte("created_at", since).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as any[] }),
    dinnerIds.length > 0
      ? supabase.from("poll_options").select("suggested_by, dinner_id, place_id, created_at").in("dinner_id", dinnerIds).not("suggested_by", "is", null).gte("created_at", since).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("club_wishlist").select("added_by, place_id, created_at").eq("club_id", clubId).gte("created_at", since).order("created_at", { ascending: false }).limit(20),
    dinnerIds.length > 0
      ? supabase.from("dinner_ratings").select("user_id, dinner_id, created_at").in("dinner_id", dinnerIds).gte("created_at", since).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Collect all place_ids needed for restaurant names
  const allPlaceIds = [
    ...(dinners ?? []).map((d) => d.winning_restaurant_place_id),
    ...(suggestRes.data ?? []).map((s: any) => s.place_id),
    ...(wishlistRes.data ?? []).map((w: any) => w.place_id),
  ].filter(Boolean) as string[];

  const restaurantNameMap: Record<string, string> = {};
  if (allPlaceIds.length > 0) {
    const { data: restaurants } = await supabase
      .from("restaurant_cache")
      .select("place_id, name")
      .in("place_id", allPlaceIds.filter((id, i) => allPlaceIds.indexOf(id) === i));
    for (const r of restaurants ?? []) {
      restaurantNameMap[r.place_id] = r.name;
    }
  }

  // Build dinner label + URL map
  const dinnerMap: Record<string, { label: string; url: string }> = {};
  for (const d of dinners ?? []) {
    const name = d.winning_restaurant_place_id ? restaurantNameMap[d.winning_restaurant_place_id] : null;
    const theme = [d.theme_cuisine, d.theme_neighborhood].filter(Boolean).join(" · ");
    const label = name ?? (theme || "a dinner");
    dinnerMap[d.id] = { label, url: `/clubs/${clubId}/dinners/${d.id}` };
  }

  // Merge all events
  const events: FeedEvent[] = [];

  for (const r of (rsvpRes.data as any[]) ?? []) {
    const dinner = dinnerMap[r.dinner_id];
    if (!dinner) continue;
    events.push({ type: "rsvp", userName: memberNameMap[r.user_id] ?? "Someone", label: dinner.label, timestamp: r.created_at, link: dinner.url });
  }
  for (const v of (voteRes.data as any[]) ?? []) {
    const dinner = dinnerMap[v.dinner_id];
    if (!dinner) continue;
    events.push({ type: "vote", userName: memberNameMap[v.user_id] ?? "Someone", label: dinner.label, timestamp: v.created_at, link: dinner.url });
  }
  for (const s of (suggestRes.data as any[]) ?? []) {
    if (!s.suggested_by) continue;
    const dinner = dinnerMap[s.dinner_id];
    const restaurantName = s.place_id ? restaurantNameMap[s.place_id] : null;
    const label = restaurantName
      ? `${restaurantName} for ${dinner?.label ?? "a dinner"}`
      : `a restaurant for ${dinner?.label ?? "a dinner"}`;
    events.push({ type: "suggested", userName: memberNameMap[s.suggested_by] ?? "Someone", label, timestamp: s.created_at, link: dinner?.url });
  }
  for (const w of (wishlistRes.data as any[]) ?? []) {
    const name = w.place_id ? restaurantNameMap[w.place_id] : null;
    events.push({ type: "wishlist", userName: memberNameMap[w.added_by] ?? "Someone", label: name ?? "a restaurant", timestamp: w.created_at });
  }
  for (const r of (ratingRes.data as any[]) ?? []) {
    const dinner = dinnerMap[r.dinner_id];
    if (!dinner) continue;
    events.push({ type: "rating", userName: memberNameMap[r.user_id] ?? "Someone", label: dinner.label, timestamp: r.created_at, link: dinner.url });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const feed = events.slice(0, 20);

  if (feed.length === 0) return null;

  return (
    <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-black/5">
        <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Recent Activity</h3>
      </div>
      <div className="divide-y divide-black/5">
        {feed.map((event, i) => {
          const config = EVENT_CONFIG[event.type];
          return (
            <div key={i} className="flex items-start gap-3 px-5 py-3">
              <span className="text-base mt-0.5 shrink-0">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink leading-snug">
                  <span className="font-semibold">{event.userName}</span>
                  {" "}{config.verb}{" "}
                  {event.link ? (
                    <Link href={event.link} className="text-citrus-dark hover:underline font-medium">
                      {event.label}
                    </Link>
                  ) : (
                    <span className="font-medium">{event.label}</span>
                  )}
                </p>
              </div>
              <span className="text-xs text-ink-faint shrink-0 mt-0.5 whitespace-nowrap">{timeAgo(event.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
