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

  if (!profile) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-warm-white">
      <nav className="bg-charcoal px-8 py-5 flex items-center justify-between">
        <a
          href="/dashboard"
          className="text-cream/50 hover:text-cream transition-colors text-sm"
        >
          ← Dashboard
        </a>
        <h1 className="font-serif text-xl font-black text-cream">
          Dinner<span className="text-clay">Club</span>
        </h1>
        <div className="w-9 h-9" />
      </nav>

      <div className="max-w-md mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="font-serif text-3xl font-bold">Your profile</h2>
          <p className="text-mid text-sm mt-2">
            This is how your name appears to club members.
          </p>
        </div>

        <div className="bg-white border border-black/8 rounded-2xl p-6">
          <ProfileForm user={profile as User} />
        </div>

        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
