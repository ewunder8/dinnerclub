import { autocompleteRestaurants } from "@/lib/places";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type AutocompleteResult = {
  place_id: string;
  name: string;
  address: string;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ suggestions: [], error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ suggestions: [] });

  try {
    const raw = await autocompleteRestaurants(q.trim());
    const suggestions: AutocompleteResult[] = raw.map((s) => ({
      place_id: s.placePrediction.placeId,
      name: s.placePrediction.structuredFormat.mainText.text,
      address: s.placePrediction.structuredFormat.secondaryText?.text ?? "",
    }));
    return NextResponse.json({ suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ suggestions: [], error: message }, { status: 500 });
  }
}
