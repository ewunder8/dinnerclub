import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import Link from "next/link";

const VALID_KEYS = [
  "reservation_confirmed",
  "dinner_reminder",
  "voting_open",
  "rating_prompt",
  "open_seat_posted",
  "open_seat_update",
  "dinner_cancelled",
] as const;

const LABELS: Record<string, string> = {
  reservation_confirmed: "Reservation confirmed",
  dinner_reminder: "Dinner reminder",
  voting_open: "Voting open",
  rating_prompt: "Dinner rating prompt",
  open_seat_posted: "Open seat available",
  open_seat_update: "Seat request updates",
  dinner_cancelled: "Dinner cancelled",
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { uid?: string; key?: string; sig?: string };
}) {
  const { uid, key, sig } = searchParams;

  const isValid =
    uid && key && sig &&
    VALID_KEYS.includes(key as typeof VALID_KEYS[number]) &&
    verifyUnsubscribeToken(uid, key, sig);

  if (!isValid) {
    return (
      <div className="min-h-screen bg-snow flex items-center justify-center px-4">
        <div className="bg-white border border-black/8 rounded-2xl px-8 py-10 max-w-sm w-full text-center">
          <p className="text-3xl mb-4">🚫</p>
          <p className="font-semibold text-ink text-lg mb-2">Invalid link</p>
          <p className="text-sm text-ink-muted">This unsubscribe link is invalid or has expired.</p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-citrus-dark hover:underline">
            Go to dinnerclub →
          </Link>
        </div>
      </div>
    );
  }

  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("email_notifications")
    .eq("id", uid)
    .single();

  const currentNotifs = (user?.email_notifications as Record<string, boolean>) ?? {};
  const updatedNotifs = { ...currentNotifs, [key]: false };

  await supabase
    .from("users")
    .update({ email_notifications: updatedNotifs })
    .eq("id", uid);

  return (
    <div className="min-h-screen bg-snow flex items-center justify-center px-4">
      <div className="bg-white border border-black/8 rounded-2xl px-8 py-10 max-w-sm w-full text-center">
        <p className="text-3xl mb-4">✓</p>
        <p className="font-semibold text-ink text-lg mb-2">Unsubscribed</p>
        <p className="text-sm text-ink-muted mb-1">
          You&apos;ll no longer receive <strong>{LABELS[key]}</strong> emails.
        </p>
        <p className="text-xs text-ink-faint mt-2">
          You can re-enable this in your{" "}
          <Link href="/profile" className="text-citrus-dark hover:underline">
            profile settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
