"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import UserAvatar from "./UserAvatar";

type Props = {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export default function NavUser({ name, email, avatarUrl }: Props) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="flex items-center gap-3">
      <a href="/profile" title="Profile">
        <UserAvatar name={name} email={email} avatarUrl={avatarUrl} />
      </a>
      <button
        onClick={handleSignOut}
        className="text-xs text-white/60 hover:text-white transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
