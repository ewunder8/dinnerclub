import fs from "fs";
import path from "path";

const FROM = "DinnerClub <noreply@dinnerclub.app>";
const API_URL = "https://api.resend.com/emails";

function loadTemplate(filename: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), "lib/emails", filename),
    "utf-8"
  );
}

async function send(to: string, subject: string, html: string) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  return res.json();
}

// ─── Email senders ────────────────────────────────────────────

export async function sendReservationConfirmed({
  to,
  restaurantName,
  dinnerDate,
  dinnerTime,
  partySize,
  restaurantAddress,
  dinnerUrl,
}: {
  to: string;
  restaurantName: string;
  dinnerDate: string;
  dinnerTime: string;
  partySize: number;
  restaurantAddress: string;
  dinnerUrl: string;
}) {
  const html = loadTemplate("reservationConfirmed.html")
    .replace(/{{RESTAURANT_NAME}}/g, restaurantName)
    .replace(/{{DINNER_DATE}}/g, dinnerDate)
    .replace(/{{DINNER_TIME}}/g, dinnerTime)
    .replace(/{{PARTY_SIZE}}/g, String(partySize))
    .replace(/{{RESTAURANT_ADDRESS}}/g, restaurantAddress)
    .replace(/{{DINNER_URL}}/g, dinnerUrl);

  return send(to, `You're booked at ${restaurantName} 🎉`, html);
}

export async function sendDinnerReminder({
  to,
  restaurantName,
  dinnerTime,
  restaurantAddress,
  dinnerUrl,
}: {
  to: string;
  restaurantName: string;
  dinnerTime: string;
  restaurantAddress: string;
  dinnerUrl: string;
}) {
  const html = loadTemplate("dinnerReminder.html")
    .replace(/{{RESTAURANT_NAME}}/g, restaurantName)
    .replace(/{{DINNER_TIME}}/g, dinnerTime)
    .replace(/{{RESTAURANT_ADDRESS}}/g, restaurantAddress)
    .replace(/{{DINNER_URL}}/g, dinnerUrl);

  return send(to, `Tonight at ${restaurantName} 🍽️`, html);
}

export async function sendVotingOpen({
  to,
  clubName,
  dinnerName,
  dinnerTheme,
  restaurantCount,
  pollUrl,
}: {
  to: string;
  clubName: string;
  dinnerName: string;
  dinnerTheme: string;
  restaurantCount: number;
  pollUrl: string;
}) {
  const html = loadTemplate("votingOpen.html")
    .replace(/{{CLUB_NAME}}/g, clubName)
    .replace(/{{DINNER_NAME}}/g, dinnerName)
    .replace(/{{DINNER_THEME}}/g, dinnerTheme)
    .replace(/{{RESTAURANT_COUNT}}/g, String(restaurantCount))
    .replace(/{{POLL_URL}}/g, pollUrl);

  return send(to, `Vote on where ${clubName} is eating 🗳️`, html);
}

export async function sendRatingPrompt({
  to,
  restaurantName,
  dinnerName,
  dinnerDate,
  ratingUrl,
}: {
  to: string;
  restaurantName: string;
  dinnerName: string;
  dinnerDate: string;
  ratingUrl: string;
}) {
  const html = loadTemplate("ratingPrompt.html")
    .replace(/{{RESTAURANT_NAME}}/g, restaurantName)
    .replace(/{{DINNER_NAME}}/g, dinnerName)
    .replace(/{{DINNER_DATE}}/g, dinnerDate)
    .replace(/{{RATING_URL}}/g, ratingUrl);

  return send(to, `How was ${restaurantName}? Leave a rating ⭐`, html);
}

export async function sendInviteToClub({
  to,
  inviterName,
  clubName,
  inviteUrl,
}: {
  to: string;
  inviterName: string;
  clubName: string;
  inviteUrl: string;
}) {
  const html = loadTemplate("inviteToClub.html")
    .replace(/{{INVITER_NAME}}/g, inviterName)
    .replace(/{{CLUB_NAME}}/g, clubName)
    .replace(/{{INVITE_URL}}/g, inviteUrl);

  return send(to, `${inviterName} invited you to join ${clubName} on DinnerClub`, html);
}
