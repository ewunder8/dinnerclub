"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function transferOwnership(clubId: string, newOwnerUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify caller is the current owner
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") throw new Error("Not authorized");

  const admin = createAdminClient();

  // Promote new owner first, then demote current owner
  const { error: e1 } = await admin
    .from("club_members")
    .update({ role: "owner" })
    .eq("club_id", clubId)
    .eq("user_id", newOwnerUserId);

  if (e1) throw new Error("Failed to promote new owner");

  const { error: e2 } = await admin
    .from("club_members")
    .update({ role: "member" })
    .eq("club_id", clubId)
    .eq("user_id", user.id);

  if (e2) throw new Error("Failed to update your role");
}
