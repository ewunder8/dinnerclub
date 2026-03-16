import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Supabase redirects here after Google/Apple OAuth
// We exchange the code for a session then redirect the user
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // next can come from query param (email auth) or cookie (Google OAuth)
  const cookieNext = request.headers.get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith("dc_return_to="))
    ?.split("=")[1];
  const next = searchParams.get("next") ?? (cookieNext ? decodeURIComponent(cookieNext) : "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has completed onboarding
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("name")
          .eq("id", user.id)
          .single<{ name: string | null }>();

        // New user — show confirmed screen, then onboarding
        if (!profile?.name) {
          const confirmedUrl = new URL(`${origin}/auth/confirmed`);
          const onboardingNext = next !== "/dashboard" ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding";
          confirmedUrl.searchParams.set("next", onboardingNext);
          const response = NextResponse.redirect(confirmedUrl.toString());
          if (cookieNext) response.cookies.delete("dc_return_to");
          return response;
        }
      }

      // Returning user — send to their destination, clear the return cookie
      const response = NextResponse.redirect(`${origin}${next}`);
      if (cookieNext) response.cookies.delete("dc_return_to");
      return response;
    }
  }

  // Auth failed
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
