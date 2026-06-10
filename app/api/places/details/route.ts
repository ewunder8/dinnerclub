import { getPlaceDetails } from "@/lib/places";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ place: null, error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`places-details:${user.id}`, 30)) {
    return NextResponse.json({ place: null, error: "Too many requests" }, { status: 429 });
  }

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ place: null, error: "Missing id" }, { status: 400 });

  try {
    const place = await getPlaceDetails(id);
    return NextResponse.json({ place });
  } catch (e) {
    console.error("places/details error:", e);
    return NextResponse.json({ place: null, error: "Lookup failed" }, { status: 500 });
  }
}
