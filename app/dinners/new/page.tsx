import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewOneOffDinnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // One-off dinners are no longer supported — redirect to dashboard
  redirect("/");
}
