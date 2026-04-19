import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";
import SignOutButton from "./SignOutButton";
import type { User } from "@/lib/supabase/database.types";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!profile) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <a href="/dashboard" className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition-colors text-white text-sm font-semibold px-3 py-1.5 rounded-full"><span className="text-base leading-none">←</span><span>Back</span></a>
        </div>
        <h1 className="font-sans text-base font-bold text-white">Profile</h1>
        <div className="flex-1" />
      </nav>

      <div className="max-w-md mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="font-sans text-3xl font-bold text-ink">Your profile</h2>
          <p className="text-ink-muted text-sm mt-2">
            This is how your name appears to club members.
          </p>
        </div>

        <div className="bg-white border border-black/8 rounded-2xl p-6">
          <ProfileForm user={profile as User} />
        </div>

        <div className="mt-6 border-t border-black/8 pt-6">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
