"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton({ variant = "light" }: { variant?: "light" | "dark" }) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <button
      onClick={handleSignOut}
      className={
        variant === "dark"
          ? "text-sm text-white/60 hover:text-white transition-colors"
          : "w-full text-center text-sm text-ink-muted hover:text-red-500 transition-colors py-2"
      }
    >
      Sign out
    </button>
  );
}
