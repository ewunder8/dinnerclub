import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Client-side Supabase client
// Use this in React components and client-side code
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "pkce" } }
  );
}
