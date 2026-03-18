// ============================================================
// Reservation Deep Links
// Opens Resy or OpenTable app (or website as fallback).
// No API needed — just smart URL construction.
// ============================================================

export type ReservationPlatform = "resy" | "opentable" | "tock" | "other";

interface ReservationLinkOptions {
  platform: ReservationPlatform;
  reservationUrl?: string; // from Google Places — use this if available
  restaurantSlug?: string; // fallback if no direct URL
  partySize?: number;
  date?: Date;
}

// Generate the best available reservation URL
export function getReservationURL(options: ReservationLinkOptions): string {
  // If Google Places gave us a direct URL, use it — it's the most accurate
  if (options.reservationUrl) {
    return options.reservationUrl;
  }

  // Fallback: construct URL from platform + slug
  switch (options.platform) {
    case "resy":
      return buildResyURL(options);
    case "opentable":
      return buildOpenTableURL(options);
    case "tock":
      // Tock is merging with Resy — treat as Resy for new integrations
      return buildResyURL(options);
    default:
      return "";
  }
}

function buildResyURL(options: ReservationLinkOptions): string {
  if (options.restaurantSlug) {
    const base = `https://resy.com/cities/ny/${options.restaurantSlug}`;
    const params = new URLSearchParams();
    if (options.partySize) params.set("seats", String(options.partySize));
    if (options.date) params.set("date", formatDateForResy(options.date));
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }
  return "https://resy.com";
}

function buildOpenTableURL(options: ReservationLinkOptions): string {
  if (options.restaurantSlug) {
    return `https://www.opentable.com/r/${options.restaurantSlug}`;
  }
  return "https://www.opentable.com/dining-diary";
}

function formatDateForResy(date: Date): string {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

// Get the display name for a platform
export function getPlatformName(platform: ReservationPlatform | null): string {
  const names: Record<ReservationPlatform, string> = {
    resy: "Resy",
    opentable: "OpenTable",
    tock: "Tock",
    other: "Reserve",
  };
  return platform ? names[platform] : "Reserve";
}

// Get platform color for UI badges
export function getPlatformColor(platform: ReservationPlatform | null): string {
  const colors: Record<ReservationPlatform, string> = {
    resy: "#E8845A",
    opentable: "#DA3743",
    tock: "#1C1C1A",
    other: "#6B6660",
  };
  return platform ? colors[platform] : "#6B6660";
}
