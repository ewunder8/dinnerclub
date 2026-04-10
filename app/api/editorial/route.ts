import { getEditorialArticles, normalizeCityKey } from "@/lib/editorial";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cityParam = req.nextUrl.searchParams.get("city") ?? "";
  const city = normalizeCityKey(cityParam);

  if (!city) {
    return NextResponse.json({ articles: [] });
  }

  try {
    const articles = await getEditorialArticles(city);
    return NextResponse.json(
      { articles },
      { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json(
      { articles: [], error: "Failed to fetch editorial" },
      { status: 500 }
    );
  }
}
