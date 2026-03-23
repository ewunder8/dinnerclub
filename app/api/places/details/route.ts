import { getPlaceDetails } from "@/lib/places";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ place: null, error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ place: null, error: "Missing id" }, { status: 400 });

  try {
    const place = await getPlaceDetails(id);
    return NextResponse.json({ place });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ place: null, error: message }, { status: 500 });
  }
}
