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
      <nav className="bg-slate px-8 py-5 flex items-center justify-between">
        <a
          href="/dashboard"
          className="text-white/60 hover:text-white transition-colors text-sm"
        >
          ← Dashboard
        </a>
        <h1 className="font-sans text-xl font-extrabold tracking-tight text-white">
          dinner<span className="text-citrus">club</span>
        </h1>
        <div className="w-16" />
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
