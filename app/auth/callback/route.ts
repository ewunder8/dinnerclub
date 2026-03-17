import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Supabase redirects here after Google/Apple OAuth
// We exchange the code for a session then redirect the user
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // next can come from query param (email auth) or cookie (Google OAuth)
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.split(";").find((c) => c.trim().startsWith("dc_return_to="));
  const cookieNext = cookieMatch ? decodeURIComponent(cookieMatch.trim().slice("dc_return_to=".length)) : null;
  const next = searchParams.get("next") ?? cookieNext ?? "/dashboard";

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

        // New user — send to onboarding (skip confirmed page for OAuth users)
        if (!profile?.name) {
          const isOAuth = user.app_metadata?.provider !== "email";
          const onboardingNext = next !== "/dashboard" ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding";
          const destination = isOAuth ? onboardingNext : `/auth/confirmed?next=${encodeURIComponent(onboardingNext)}`;
          const response = NextResponse.redirect(`${origin}${destination}`);
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
