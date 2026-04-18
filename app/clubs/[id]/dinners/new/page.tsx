import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import CreateDinnerForm from "./CreateDinnerForm";

export default async function NewDinnerPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch club + membership role
  const { data: club } = await supabase
    .from("clubs")
    .select(`
      id, name, emoji, city,
      club_members ( user_id, role )
    `)
    .eq("id", params.id)
    .single();

  if (!club) notFound();

  const membership = club.club_members.find(
    (m: { user_id: string; role: string }) => m.user_id === user.id
  );

  // Any club member can create a dinner
  if (!membership) notFound();

  return (
    <CreateDinnerForm
      clubId={club.id}
      clubName={club.name}
      clubEmoji={club.emoji}
      clubCity={club.city}
    />
  );
}
