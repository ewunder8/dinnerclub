import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavUser from "@/components/NavUser";
import EditorialFeed from "@/components/EditorialFeed";

export default async function PressPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1">
          <a href="/dashboard" className="text-white/60 hover:text-white transition-colors text-2xl font-light">‹</a>
        </div>
        <h1 className="font-sans text-base font-bold text-white">From the Press</h1>
        <div className="flex-1 flex justify-end">
          <NavUser name={profile?.name} email={user.email} avatarUrl={profile?.avatar_url} />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <EditorialFeed />
      </div>
    </main>
  );
}
