import { createClient } from "@/lib/supabase/server";

type MilestoneEvent = {
  icon: string;
  label: string;
  timestamp: string;
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
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: dinners }, { data: members }] = await Promise.all([
    supabase
      .from("dinners")
      .select("id, status, created_at, winning_restaurant_place_id, theme_cuisine, theme_neighborhood")
      .eq("club_id", clubId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("club_members")
      .select("user_id, joined_at, users ( name, email )")
      .eq("club_id", clubId)
      .gte("joined_at", since)
      .order("joined_at", { ascending: false })
      .limit(10),
  ]);

  // Fetch restaurant names for dinners with a winner
  const placeIds = (dinners ?? [])
    .map((d) => d.winning_restaurant_place_id)
    .filter(Boolean) as string[];

  const restaurantNameMap: Record<string, string> = {};
  if (placeIds.length > 0) {
    const { data: restaurants } = await supabase
      .from("restaurant_cache")
      .select("place_id, name")
      .in("place_id", placeIds);
    for (const r of restaurants ?? []) {
      restaurantNameMap[r.place_id] = r.name;
    }
  }

  const events: MilestoneEvent[] = [];

  // Dinner milestones — one event per dinner at its most advanced state
  for (const d of dinners ?? []) {
    const restaurantName = d.winning_restaurant_place_id
      ? restaurantNameMap[d.winning_restaurant_place_id]
      : null;
    const theme = [d.theme_cuisine, d.theme_neighborhood].filter(Boolean).join(" · ");

    if (d.status === "completed" && restaurantName) {
      events.push({ icon: "🍽️", label: `Had dinner at ${restaurantName}`, timestamp: d.created_at });
    } else if (d.status === "confirmed" && restaurantName) {
      events.push({ icon: "✅", label: `Reservation confirmed at ${restaurantName}`, timestamp: d.created_at });
    } else if (d.winning_restaurant_place_id && restaurantName) {
      events.push({ icon: "🏆", label: `Winner picked: ${restaurantName}`, timestamp: d.created_at });
    } else {
      events.push({ icon: "🍴", label: `Dinner poll started${theme ? ` · ${theme}` : ""}`, timestamp: d.created_at });
    }
  }

  // Member joined milestones
  for (const m of (members as any[]) ?? []) {
    const name = (m.users?.name ?? m.users?.email?.split("@")[0]) ?? "Someone";
    events.push({ icon: "👋", label: `${name} joined the club`, timestamp: m.joined_at });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const LIMIT = 5;
  const feed = events.slice(0, LIMIT);
  const hasMore = events.length > LIMIT;

  if (feed.length === 0) return null;

  return (
    <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-black/5">
        <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Recent Activity</h3>
      </div>
      <div className="divide-y divide-black/5">
        {feed.map((event, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <span className="text-base shrink-0">{event.icon}</span>
            <p className="flex-1 text-sm text-ink leading-snug">{event.label}</p>
            <span className="text-xs text-ink-faint shrink-0 whitespace-nowrap">{timeAgo(event.timestamp)}</span>
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="px-5 py-3 border-t border-black/5">
          <span className="text-xs text-ink-faint">See all activity in the club settings</span>
        </div>
      )}
    </section>
  );
}
