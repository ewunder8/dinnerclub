import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Supabase redirects here after Google/Apple OAuth
// We exchange the code for a session then redirect the user
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

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

        // New user — send to onboarding, preserving next destination
        if (!profile?.name) {
          const onboardingUrl = new URL(`${origin}/onboarding`);
          if (next !== "/dashboard") onboardingUrl.searchParams.set("next", next);
          return NextResponse.redirect(onboardingUrl.toString());
        }
      }

      // Returning user — send to their destination
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth failed
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
