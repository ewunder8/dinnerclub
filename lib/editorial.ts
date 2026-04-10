import Parser from "rss-parser";

export type Article = {
  title: string;
  url: string;
  excerpt: string;
  imageUrl: string | null;
  publishedAt: string; // ISO string for serialization
  source: "eater" | "chicagomag" | "blockclub" | "resy";
};

// Canonical city keys (lowercase). Club city field should match one of these.
export const SUPPORTED_CITIES = [
  "chicago",
  "los angeles",
  "new york",
  "san francisco",
  "miami",
  "austin",
  "seattle",
  "boston",
  "washington dc",
  "dallas",
  "denver",
  "las vegas",
  "new orleans",
  "philadelphia",
  "atlanta",
  "houston",
  "nashville",
  "portland",
  "minneapolis",
] as const;

export type SupportedCity = (typeof SUPPORTED_CITIES)[number];

// Common aliases that should map to a canonical key
const CITY_ALIASES: Record<string, SupportedCity> = {
  "la":              "los angeles",
  "nyc":             "new york",
  "new york city":   "new york",
  "sf":              "san francisco",
  "dc":              "washington dc",
  "washington":      "washington dc",
  "washington, dc":  "washington dc",
  "washington, d.c.": "washington dc",
  "nola":            "new orleans",
  "philly":          "philadelphia",
  "pdx":             "portland",
  "portland, or":    "portland",
};

export function normalizeCityKey(city: string | null | undefined): SupportedCity | null {
  if (!city) return null;
  const lower = city.toLowerCase().trim();
  if (CITY_ALIASES[lower]) return CITY_ALIASES[lower];
  if ((SUPPORTED_CITIES as readonly string[]).includes(lower)) return lower as SupportedCity;
  return null;
}

export function isSupportedCity(city: string | null | undefined): boolean {
  return normalizeCityKey(city) !== null;
}

type Source = { key: Article["source"]; url: string };

const SOURCES_BY_CITY: Record<SupportedCity, Source[]> = {
  chicago: [
    { key: "eater",      url: "https://chicago.eater.com/rss/index.xml" },
    { key: "chicagomag", url: "https://chicagomag.com/dining-drinking/feed" },
    { key: "blockclub",  url: "https://blockclubchicago.org/category/restaurants-bars/feed/" },
    { key: "resy",       url: "https://blog.resy.com/city/chicago/feed/" },
  ],
  "los angeles":   [{ key: "eater", url: "https://la.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/los-angeles/feed/" }],
  "new york":      [{ key: "eater", url: "https://ny.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/new-york/feed/" }],
  "san francisco": [{ key: "eater", url: "https://sf.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/san-francisco/feed/" }],
  "miami":         [{ key: "eater", url: "https://miami.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/miami/feed/" }],
  "austin":        [{ key: "eater", url: "https://austin.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/austin/feed/" }],
  "seattle":       [{ key: "eater", url: "https://seattle.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/seattle/feed/" }],
  "boston":        [{ key: "eater", url: "https://boston.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/boston/feed/" }],
  "washington dc": [{ key: "eater", url: "https://dc.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/washington-dc/feed/" }],
  "dallas":        [{ key: "eater", url: "https://dallas.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/dallas/feed/" }],
  "denver":        [{ key: "eater", url: "https://denver.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/denver/feed/" }],
  "las vegas":     [{ key: "eater", url: "https://vegas.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/las-vegas/feed/" }],
  "new orleans":   [{ key: "eater", url: "https://nola.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/new-orleans/feed/" }],
  "philadelphia":  [{ key: "eater", url: "https://philly.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/philadelphia/feed/" }],
  "atlanta":       [{ key: "eater", url: "https://atlanta.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/atlanta/feed/" }],
  "houston":       [{ key: "eater", url: "https://houston.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/houston/feed/" }],
  "nashville":     [{ key: "eater", url: "https://nashville.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/nashville/feed/" }],
  "portland":      [{ key: "eater", url: "https://pdx.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/portland/feed/" }],
  "minneapolis":   [{ key: "eater", url: "https://minneapolis.eater.com/rss/index.xml" }, { key: "resy", url: "https://blog.resy.com/city/minneapolis/feed/" }],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parser = new Parser<Record<string, any>, Record<string, any>>({
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

async function fetchFeed(source: Source): Promise<Article[]> {
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
    return [];
  }
}

type CacheEntry = { articles: Article[]; fetchedAt: number };
const cache = new Map<SupportedCity, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getEditorialArticles(city: SupportedCity): Promise<Article[]> {
  const now = Date.now();
  const cached = cache.get(city);
  if (cached && now - cached.fetchedAt < CACHE_TTL) return cached.articles;

  const sources = SOURCES_BY_CITY[city] ?? [];
  const results = await Promise.allSettled(sources.map(fetchFeed));
  const articles = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  cache.set(city, { articles, fetchedAt: now });
  return articles;
}
