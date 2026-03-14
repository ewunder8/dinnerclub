// ============================================================
// Calendar File Generator
// Generates .ics files for Add to Calendar functionality.
// Works with Apple Calendar, Google Calendar, Outlook — everything.
// ============================================================

interface CalendarEvent {
  title: string;
  startTime: Date;
  endTime?: Date; // defaults to 2 hours after startTime
  location?: string;
  description?: string;
  url?: string;
}

// Generate a .ics file string
export function generateICSFile(event: CalendarEvent): string {
  const end = event.endTime || new Date(event.startTime.getTime() + 2 * 60 * 60 * 1000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DinnerClub//DinnerClub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${generateUID()}`,
    `DTSTART:${formatICSDate(event.startTime)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    event.location ? `LOCATION:${escapeICS(event.location)}` : null,
    event.description ? `DESCRIPTION:${escapeICS(event.description)}` : null,
    event.url ? `URL:${event.url}` : null,
    `DTSTAMP:${formatICSDate(new Date())}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return lines;
}

// Trigger a .ics file download in the browser
export function downloadICSFile(event: CalendarEvent): void {
  const icsContent = generateICSFile(event);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(event.title)}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Google Calendar URL — opens in browser pre-filled
export function generateGoogleCalendarURL(event: CalendarEvent): string {
  const end = event.endTime || new Date(event.startTime.getTime() + 2 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatGoogleDate(event.startTime)}/${formatGoogleDate(end)}`,
    ...(event.location && { location: event.location }),
    ...(event.description && { details: event.description }),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Build a dinner calendar event from DinnerClub data
export function buildDinnerCalendarEvent({
  clubName,
  restaurantName,
  restaurantAddress,
  restaurantPhone,
  reservationDatetime,
  confirmationNumber,
  appUrl,
}: {
  clubName: string;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  reservationDatetime: Date;
  confirmationNumber?: string;
  appUrl?: string;
}): CalendarEvent {
  const descriptionLines = [
    `${clubName} dinner at ${restaurantName}`,
    restaurantPhone ? `📞 ${restaurantPhone}` : null,
    confirmationNumber ? `Confirmation: ${confirmationNumber}` : null,
    appUrl ? `View on DinnerClub: ${appUrl}` : null,
  ].filter(Boolean);

  return {
    title: `${clubName} — ${restaurantName} 🍽`,
    startTime: reservationDatetime,
    location: restaurantAddress,
    description: descriptionLines.join("\n"),
    url: appUrl,
  };
}

// ---- Helpers ----

function formatICSDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");
}

function escapeICS(str: string): string {
  return str.replace(/[,;\\]/g, "\\$&").replace(/\n/g, "\\n");
}

function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@dinnerclub.app`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
}
