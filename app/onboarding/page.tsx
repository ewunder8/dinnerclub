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

  return (
    <main className="min-h-screen bg-warm-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl font-black text-charcoal">
            Dinner<span className="text-clay">Club</span>
          </h1>
          <p className="text-mid text-sm mt-2">Let&apos;s set up your profile</p>
        </div>
        <OnboardingForm userId={user.id} email={user.email ?? ""} next={next} />
      </div>
    </main>
  );
}
