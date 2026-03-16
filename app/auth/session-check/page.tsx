import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Landing point after implicit-flow OAuth (tokens processed client-side).
// Session is already in cookies — just do the onboarding check and redirect.
export default async function SessionCheckPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?error=auth_failed");

  const next = searchParams.next ?? "/dashboard";

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.name) {
    const onboardingNext =
      next !== "/dashboard"
        ? `/onboarding?next=${encodeURIComponent(next)}`
        : "/onboarding";
    redirect(`/auth/confirmed?next=${encodeURIComponent(onboardingNext)}`);
  }

  redirect(next);
}
