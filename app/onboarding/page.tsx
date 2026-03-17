import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const next = searchParams.next ?? "/dashboard";

  // If they already have a profile with a name, skip onboarding
  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.name) redirect(next);

  const googleAvatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  const googleName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  return (
    <main className="min-h-screen bg-snow flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-sans text-4xl font-extrabold text-ink">
            dinner<span className="text-citrus">club</span>
          </h1>
          <p className="text-ink-muted text-sm mt-2">Let&apos;s set up your profile</p>
        </div>
        <OnboardingForm userId={user.id} email={user.email ?? ""} googleAvatarUrl={googleAvatarUrl} googleName={googleName} next={next} />
      </div>
    </main>
  );
}
