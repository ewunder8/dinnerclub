// ============================================================
// Google Places API Helper
// All Places API calls go through here.
// Results are cached in Supabase restaurant_cache table.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import type { Json, RestaurantCache } from "@/lib/supabase/database.types";

const PLACES_API_BASE = "https://places.googleapis.com/v1";
const CACHE_TTL_HOURS = 48;

// Field masks for search endpoints (each field needs "places." prefix)
const SEARCH_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "priceLevel",
  "rating",
].map((f) => `places.${f}`).join(",");

// Fields for full place detail lookups (no prefix — single place endpoint)
const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "nationalPhoneNumber",
  "websiteUri",
  "priceLevel",
  "rating",
  "userRatingCount",
  "currentOpeningHours",
  "photos",
  "reservable",
  "editorialSummary",
].join(",");

// Search restaurants near a location
export async function searchNearbyRestaurants(
  lat: number,
  lng: number,
  radiusMeters = 5000
) {
  const response = await fetch(`${PLACES_API_BASE}/places:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ["restaurant"],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    }),
  });

  const data = await response.json();
  return data.places || [];
}

// Text search — powers the Discover search bar
export async function searchRestaurantsByText(
  query: string,
  locationBias?: { lat: number; lng: number }
) {
  const body: Record<string, unknown> = {
    textQuery: query,
    includedType: "restaurant",
    pageSize: 10,
  };

  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.lat, longitude: locationBias.lng },
        radius: 10000,
      },
    };
  }

  const response = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Places API error ${response.status}`);
  }
  return data.places || [];
}

// Get full place details by Place ID
// Checks cache first — only calls Google if stale
export async function getPlaceDetails(placeId: string): Promise<RestaurantCache | null> {
  const supabase = await createClient();

  // Check cache first
  const { data: cached } = await supabase
    .from("restaurant_cache")
    .select("*")
    .eq("place_id", placeId)
    .single();

  if (cached) {
    const cachedAt = new Date(cached.cached_at);
    const hoursSinceCached = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);

    // Return cached data if fresh
    if (hoursSinceCached < CACHE_TTL_HOURS) {
      return cached;
    }
  }

  // Fetch fresh from Google
  const response = await fetch(
    `${PLACES_API_BASE}/places/${placeId}?fields=${DETAIL_FIELDS}`,
    {
      headers: {
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      },
    }
  );

  if (!response.ok) return cached || null;

  const place = await response.json();
  const normalized = normalizePlaceData(place);
  const withCachedAt: RestaurantCache = { ...normalized, cached_at: new Date().toISOString() };

  // Upsert into cache
  await supabase
    .from("restaurant_cache")
    .upsert(withCachedAt);

  return withCachedAt;
}

// Normalize Google Places API response to our schema
function normalizePlaceData(place: Record<string, unknown>): Omit<RestaurantCache, "cached_at"> {
  const location = place.location as { latitude: number; longitude: number } | undefined;
  const displayName = place.displayName as { text: string } | undefined;

  return {
    place_id: place.id as string,
    name: displayName?.text || "",
    address: place.formattedAddress as string || null,
    lat: location?.latitude || null,
    lng: location?.longitude || null,
    phone: place.nationalPhoneNumber as string || null,
    website: place.websiteUri as string || null,
    price_level: parsePriceLevel(place.priceLevel as string),
    rating: place.rating as number || null,
    reservation_url: null, // populated separately from Place Details reservable field
    reservation_platform: null,
    photo_urls: null, // Google photo refs need separate handling
    hours: (place.currentOpeningHours as Json) ?? null,
    beli_url: null,
  };
}

// Convert Google's price level string to 1-4 number
function parsePriceLevel(level: string | undefined): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return level ? (map[level] || null) : null;
}

// Format price level as $ symbols
export function formatPriceLevel(level: number | null): string {
  if (!level) return "";
  return "$".repeat(level);
}
