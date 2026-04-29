import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CreateOneOffDinnerForm from "./CreateOneOffDinnerForm";

export default async function NewOneOffDinnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("city")
    .eq("id", user.id)
    .single();

  return <CreateOneOffDinnerForm userCity={profile?.city ?? null} />;
}
