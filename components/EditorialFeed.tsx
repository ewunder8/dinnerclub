"use client";

import { useEffect, useState } from "react";
import type { Article } from "@/lib/editorial";

const SOURCE_META: Record<
  Article["source"],
  { label: string; badgeClass: string }
> = {
  eater: {
    label: "Eater Chicago",
    badgeClass: "bg-red-600 text-white",
  },
  chicagomag: {
    label: "Chicago Magazine",
    badgeClass: "bg-slate text-white",
  },
  blockclub: {
    label: "Block Club Eats",
    badgeClass: "bg-emerald-700 text-white",
  },
};

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-black/8 rounded-2xl p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="h-3 bg-black/8 rounded w-20 mb-2" />
          <div className="h-4 bg-black/8 rounded w-full mb-1" />
          <div className="h-4 bg-black/8 rounded w-3/4 mb-3" />
          <div className="h-3 bg-black/8 rounded w-full mb-1" />
          <div className="h-3 bg-black/8 rounded w-2/3" />
        </div>
        <div className="w-20 h-20 bg-black/8 rounded-xl shrink-0" />
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function EditorialFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch("/api/editorial")
      .then((r) => r.json())
      .then((data) => {
        setArticles(data.articles ?? []);
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  }, []);

  const shown = articles.slice(0, visible);
  const hasMore = visible < articles.length;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="font-sans text-2xl font-bold text-ink">From the Press</h2>
          <p className="text-ink-muted text-sm mt-0.5">Chicago dining, recently covered</p>
        </div>
      </div>

      {status === "loading" && (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {status === "error" && (
        <div className="bg-white border border-black/8 rounded-2xl p-6 text-center">
          <p className="text-2xl mb-2">📰</p>
          <p className="text-sm text-ink-muted">Couldn&apos;t load articles right now.</p>
        </div>
      )}

      {status === "done" && articles.length === 0 && (
        <div className="bg-white border border-black/8 rounded-2xl p-6 text-center">
          <p className="text-2xl mb-2">📰</p>
          <p className="text-sm text-ink-muted">No articles available right now.</p>
        </div>
      )}

      {status === "done" && articles.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {shown.map((article, i) => {
              const meta = SOURCE_META[article.source];
              return (
                <a
                  key={i}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white border border-black/8 rounded-2xl p-4 hover:border-black/20 hover:shadow-sm transition-all block"
                >
                  <div className="flex gap-3 items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-ink-faint">
                          {formatRelativeDate(article.publishedAt)}
                        </span>
                      </div>
                      <p className="font-sans text-sm font-bold text-ink leading-snug mb-1 line-clamp-2">
                        {article.title}
                      </p>
                      {article.excerpt && (
                        <p className="font-body text-xs text-ink-muted line-clamp-2 leading-relaxed">
                          {article.excerpt}
                        </p>
                      )}
                    </div>

                    {article.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={article.imageUrl}
                        alt=""
                        className="w-20 h-20 object-cover rounded-xl shrink-0 bg-black/5"
                      />
                    )}
                  </div>
                </a>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mt-4 w-full py-3 rounded-2xl border border-black/8 bg-white text-sm font-semibold text-ink-muted hover:border-black/20 hover:text-ink transition-all"
            >
              Load more
            </button>
          )}
        </>
      )}
    </section>
  );
}
