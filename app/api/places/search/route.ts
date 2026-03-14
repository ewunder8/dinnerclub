import { searchRestaurantsByText } from "@/lib/places";
import { NextRequest, NextResponse } from "next/server";

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE:   1,
  PRICE_LEVEL_MODERATE:      2,
  PRICE_LEVEL_EXPENSIVE:     3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Normalised shape returned to the client
export type PlaceSearchResult = {
  place_id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  price_level: number | null;
  rating: number | null;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ places: [] });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await searchRestaurantsByText(q.trim());

    const places: PlaceSearchResult[] = raw.map((p) => ({
      place_id:    p.id,
      name:        p.displayName?.text ?? "",
      address:     p.formattedAddress ?? null,
      lat:         p.location?.latitude ?? null,
      lng:         p.location?.longitude ?? null,
      price_level: p.priceLevel ? (PRICE_MAP[p.priceLevel] ?? null) : null,
      rating:      p.rating ?? null,
    }));

    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] }, { status: 500 });
  }
}
