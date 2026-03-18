"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function MembersCanInviteToggle({
  clubId,
  initialValue,
}: {
  clubId: string;
  initialValue: boolean;
}) {
  const [enabled, setEnabled] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggle = async () => {
    setLoading(true);
    const next = !enabled;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("clubs") as any).update({ members_can_invite: next }).eq("id", clubId);
    setEnabled(next);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-ink text-sm">Members can invite</p>
        <p className="text-ink-muted text-xs mt-0.5">
          {enabled ? "All members can share the invite link." : "Only you can invite new members."}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
          enabled ? "bg-slate" : "bg-black/15"
        }`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
