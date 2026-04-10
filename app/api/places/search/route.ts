import { searchRestaurantsByText } from "@/lib/places";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE:   1,
  PRICE_LEVEL_MODERATE:      2,
  PRICE_LEVEL_EXPENSIVE:     3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Module-level cache: city name → {lat, lng}
const cityCoordCache = new Map<string, { lat: number; lng: number }>();

async function getCityCoords(city: string): Promise<{ lat: number; lng: number } | null> {
  const key = city.toLowerCase();
  if (cityCoordCache.has(key)) return cityCoordCache.get(key)!;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const loc = data.results?.[0]?.geometry?.location;
    if (!loc) return null;
    const coords = { lat: loc.lat, lng: loc.lng };
    cityCoordCache.set(key, coords);
    return coords;
  } catch {
    return null;
  }
}

// Normalised shape returned to the client
export type PlaceSearchResult = {
  place_id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  price_level: number | null;
  rating: number | null;
  types: string[] | null;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ places: [], error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const city = req.nextUrl.searchParams.get("city") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ places: [] });
  }

  try {
    const coords = city ? await getCityCoords(city) : null;
    const searchQuery = city ? `${q.trim()} in ${city}` : q.trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await searchRestaurantsByText(searchQuery, coords ?? undefined);

    const places: PlaceSearchResult[] = raw.map((p) => ({
      place_id:    p.id,
      name:        p.displayName?.text ?? "",
      address:     p.formattedAddress ?? null,
      lat:         p.location?.latitude ?? null,
      lng:         p.location?.longitude ?? null,
      price_level: p.priceLevel ? (PRICE_MAP[p.priceLevel] ?? null) : null,
      rating:      p.rating ?? null,
      types:       p.types ?? null,
    }));

    return NextResponse.json({ places });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ places: [], error: message }, { status: 500 });
  }
}
