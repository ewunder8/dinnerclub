import { getEditorialArticles } from "@/lib/editorial";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const articles = await getEditorialArticles();
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
