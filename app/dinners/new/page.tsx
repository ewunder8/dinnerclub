import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CreateDinnerForm from "@/app/clubs/[id]/dinners/new/CreateDinnerForm";

export default async function NewOneOffDinnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return <CreateDinnerForm />;
}
