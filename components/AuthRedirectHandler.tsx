"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Handles implicit-flow OAuth tokens that land as URL hash fragments.
// Only activates when #access_token is present in the URL — safe for all pages.
export default function AuthRedirectHandler() {
  const supabase = createClient();

  useEffect(() => {
    // Only activate when OAuth tokens are present in the URL hash
    if (!window.location.hash.includes("access_token")) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const match = document.cookie
            .split(";")
            .find((c) => c.trim().startsWith("dc_return_to="));
          const returnTo = match
            ? decodeURIComponent(match.split("=")[1])
            : null;

          if (returnTo) {
            document.cookie = "dc_return_to=; path=/; max-age=0";
          }

          window.location.href = `/auth/session-check?next=${encodeURIComponent(returnTo ?? "/dashboard")}`;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
