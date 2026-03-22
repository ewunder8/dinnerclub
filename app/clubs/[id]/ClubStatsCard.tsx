type ClubStats = {
  mostDinnersAttended: { name: string; count: number } | null;
  topVoter: { name: string; count: number } | null;
  mostSuggestionsAccepted: { name: string; count: number } | null;
  cuisineBreakdown: { cuisine: string; count: number }[];
  avgRating: number | null;
};

export default function ClubStatsCard({ stats }: { stats: ClubStats }) {
  const hasPersonStats =
    stats.mostDinnersAttended || stats.topVoter || stats.mostSuggestionsAccepted;
  const hasAnyStats =
    hasPersonStats || stats.cuisineBreakdown.length > 0 || stats.avgRating !== null;

  if (!hasAnyStats) return null;

  return (
    <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-black/5">
        <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">Stats</h3>
      </div>
      <div className="p-5 flex flex-col gap-4">
        {hasPersonStats && (
          <div className="flex flex-col gap-3">
            {stats.mostDinnersAttended && (
              <StatRow
                icon="🍽"
                label="Most dinners attended"
                value={stats.mostDinnersAttended.name}
                sub={`${stats.mostDinnersAttended.count} dinner${stats.mostDinnersAttended.count !== 1 ? "s" : ""}`}
              />
            )}
            {stats.topVoter && (
              <StatRow
                icon="🗳"
                label="Top voter"
                value={stats.topVoter.name}
                sub={`${stats.topVoter.count} vote${stats.topVoter.count !== 1 ? "s" : ""}`}
              />
            )}
            {stats.mostSuggestionsAccepted && (
              <StatRow
                icon="💡"
                label="Most picks chosen"
                value={stats.mostSuggestionsAccepted.name}
                sub={`${stats.mostSuggestionsAccepted.count} pick${stats.mostSuggestionsAccepted.count !== 1 ? "s" : ""} won`}
              />
            )}
          </div>
        )}

        {stats.avgRating !== null && (
          <div className="flex items-center justify-between py-2 border-t border-black/5">
            <span className="text-sm text-ink-muted">Avg club rating</span>
            <span className="font-bold text-ink text-sm">
              ★ {stats.avgRating.toFixed(1)}
            </span>
          </div>
        )}

        {stats.cuisineBreakdown.length > 0 && (
          <div className="border-t border-black/5 pt-3">
            <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-3">
              Cuisines
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.cuisineBreakdown.map(({ cuisine, count }) => (
                <span
                  key={cuisine}
                  className="text-xs font-semibold bg-surface px-3 py-1.5 rounded-full text-ink"
                >
                  {cuisine} · {count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StatRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg w-6 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="font-semibold text-ink text-sm truncate">{value}</p>
      </div>
      <span className="text-xs text-ink-muted shrink-0">{sub}</span>
    </div>
  );
}
