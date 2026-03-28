import Parser from "rss-parser";

export type Article = {
  title: string;
  url: string;
  excerpt: string;
  imageUrl: string | null;
  publishedAt: string; // ISO string for serialization
  source: "eater" | "chicagomag" | "blockclub";
};

const SOURCES = [
  {
    key: "eater" as const,
    url: "https://chicago.eater.com/rss/index.xml",
  },
  {
    key: "chicagomag" as const,
    url: "https://chicagomag.com/dining-drinking/feed",
  },
  {
    // /category/restaurants-bars/ scopes to Block Club Eats content
    key: "blockclub" as const,
    url: "https://blockclubchicago.org/category/restaurants-bars/feed/",
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parser = new Parser<Record<string, any>, Record<string, any>>({
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

async function fetchFeed(source: (typeof SOURCES)[number]): Promise<Article[]> {
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items ?? [])
      .slice(0, 15)
      .map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mediaItem = item as any;
        const imageUrl: string | null =
          mediaItem.mediaContent?.$.url ??
          mediaItem.mediaThumbnail?.$.url ??
          mediaItem.enclosure?.url ??
          null;

        const rawExcerpt: string =
          item.contentSnippet ?? item.summary ?? item.content ?? "";
        const excerpt = rawExcerpt.replace(/<[^>]+>/g, "").slice(0, 200).trim();

        const publishedAt =
          item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : new Date(0).toISOString());

        return {
          title: (item.title ?? "").trim(),
          url: item.link ?? "",
          excerpt,
          imageUrl,
          publishedAt,
          source: source.key,
        };
      })
      .filter((a) => a.title && a.url);
  } catch {
    // Gracefully skip failed feeds
    return [];
  }
}

type CacheEntry = { articles: Article[]; fetchedAt: number };
let cache: CacheEntry | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getEditorialArticles(): Promise<Article[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL) {
    return cache.articles;
  }

  const results = await Promise.allSettled(SOURCES.map(fetchFeed));
  const articles = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  cache = { articles, fetchedAt: now };
  return articles;
}
