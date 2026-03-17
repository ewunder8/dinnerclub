// ============================================================
// DinnerClub — Sharing Utilities
// Invite links + reservation details via Web Share, WhatsApp,
// iMessage, and clipboard.
// ============================================================

/** Build invite share text for a club. */
export function getInviteShareText(clubName: string, inviteUrl: string): string {
  return `Join ${clubName} on DinnerClub!\n${inviteUrl}`;
}

/** Build a celebratory reservation summary for sharing. */
export function getReservationShareText(params: {
  restaurantName: string;
  datetime: string;
  partySize: number;
  confirmationNumber?: string | null;
  url?: string;
}): string {
  const time = new Date(params.datetime).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const lines = [
    "🎉 Dinner is booked!",
    "",
    `🍽️ ${params.restaurantName}`,
    `📅 ${time}`,
    `👥 Party of ${params.partySize}`,
  ];
  if (params.url) lines.push(`🔗 RSVP here: ${params.url}`);
  return lines.join("\n");
}

/** Open native system share sheet (mobile preferred). Returns false if not supported. */
export async function shareViaNative(data: {
  title: string;
  text: string;
  url?: string;
}): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}

/** Share via WhatsApp (works on all platforms). */
export function shareViaWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

/** Share via iMessage (mobile only). */
export function shareViaSMS(text: string): void {
  window.open(`sms:&body=${encodeURIComponent(text)}`);
}

/** Copy text to clipboard. Returns true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
