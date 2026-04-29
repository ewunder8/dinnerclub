"use client";

import ShareActions from "@/components/ShareActions";

export default function ShareInviteLink({
  link,
  dinnerName,
}: {
  link: string;
  dinnerName: string;
}) {
  return (
    <div className="bg-citrus/8 border border-citrus/20 rounded-2xl px-5 py-4 mb-6">
      <p className="text-sm font-bold text-ink mb-0.5">Invite your crew</p>
      <p className="text-xs text-ink-muted mb-4">Share this link so everyone can RSVP.</p>
      <ShareActions
        message={`You're invited to ${dinnerName}! RSVP here 🎉`}
        url={link}
      />
    </div>
  );
}
