const FROM = "DinnerClub <noreply@dinnerclub.app>";
const API_URL = "https://api.resend.com/emails";

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

// ─── Templates ────────────────────────────────────────────────

const RESERVATION_CONFIRMED_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reservation Confirmed — DinnerClub</title>
</head>
<body style="margin:0;padding:0;background-color:#1e2a3a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e2a3a;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:40px;">
              <span style="font-family:Georgia,serif;font-size:30px;font-weight:700;color:#ffffff;letter-spacing:-1px;">dinner<span style="color:#c8952a;">club</span></span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#253447;border-radius:16px;padding:48px 40px;">
              <p style="margin:0 0 4px 0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#c8952a;letter-spacing:2px;text-transform:uppercase;">You're going to dinner</p>
              <p style="margin:0 0 24px 0;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">Reservation confirmed.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e2a3a;border-radius:10px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 16px 0;font-family:Arial,sans-serif;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:12px;">
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Restaurant</p>
                          <p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:17px;font-weight:700;color:#ffffff;">{{RESTAURANT_NAME}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:12px;">
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Date &amp; Time</p>
                          <p style="margin:4px 0 0 0;font-family:Arial,sans-serif;font-size:16px;color:#ffffff;">{{DINNER_DATE}} at {{DINNER_TIME}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:12px;">
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Party Size</p>
                          <p style="margin:4px 0 0 0;font-family:Arial,sans-serif;font-size:16px;color:#ffffff;">{{PARTY_SIZE}} people</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Address</p>
                          <p style="margin:4px 0 0 0;font-family:Arial,sans-serif;font-size:16px;color:#ffffff;">{{RESTAURANT_ADDRESS}}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <a href="{{DINNER_URL}}" style="display:inline-block;background-color:#c8952a;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;">View dinner details →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-align:center;">See you there. Don't be late.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#475569;">© 2026 DinnerClub · <a href="https://www.dinnerclub.app" style="color:#c8952a;text-decoration:none;">dinnerclub.app</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const DINNER_REMINDER_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dinner Tomorrow — DinnerClub</title>
</head>
<body style="margin:0;padding:0;background-color:#1e2a3a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e2a3a;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:40px;">
              <span style="font-family:Georgia,serif;font-size:30px;font-weight:700;color:#ffffff;letter-spacing:-1px;">dinner<span style="color:#c8952a;">club</span></span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#253447;border-radius:16px;padding:48px 40px;">
              <p style="margin:0 0 4px 0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#c8952a;letter-spacing:2px;text-transform:uppercase;">Reminder</p>
              <p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">Dinner is tomorrow.</p>
              <p style="margin:0 0 28px 0;font-family:Arial,sans-serif;font-size:15px;color:#94a3b8;line-height:1.6;">Just a heads up — your club is eating out tomorrow night. Here's what you need to know.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e2a3a;border-radius:10px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:12px;">
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Restaurant</p>
                          <p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:17px;font-weight:700;color:#ffffff;">{{RESTAURANT_NAME}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:12px;">
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Time</p>
                          <p style="margin:4px 0 0 0;font-family:Arial,sans-serif;font-size:16px;color:#ffffff;">{{DINNER_TIME}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Address</p>
                          <p style="margin:4px 0 0 0;font-family:Arial,sans-serif;font-size:16px;color:#ffffff;">{{RESTAURANT_ADDRESS}}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <a href="{{DINNER_URL}}" style="display:inline-block;background-color:#c8952a;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;">View dinner details →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-align:center;">Don't leave your crew hanging. Show up.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#475569;">© 2026 DinnerClub · <a href="https://www.dinnerclub.app" style="color:#c8952a;text-decoration:none;">dinnerclub.app</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const VOTING_OPEN_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Time to Vote — DinnerClub</title>
</head>
<body style="margin:0;padding:0;background-color:#1e2a3a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e2a3a;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:40px;">
              <span style="font-family:Georgia,serif;font-size:30px;font-weight:700;color:#ffffff;letter-spacing:-1px;">dinner<span style="color:#c8952a;">club</span></span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#253447;border-radius:16px;padding:48px 40px;">
              <p style="margin:0 0 4px 0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#c8952a;letter-spacing:2px;text-transform:uppercase;">Poll Open</p>
              <p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">Time to pick a restaurant.</p>
              <p style="margin:0 0 28px 0;font-family:Arial,sans-serif;font-size:15px;color:#94a3b8;line-height:1.6;"><strong style="color:#ffffff;">{{CLUB_NAME}}</strong> has opened voting for the next dinner. Cast your vote before the poll closes.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e2a3a;border-radius:10px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:12px;">
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Dinner</p>
                          <p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:17px;font-weight:700;color:#ffffff;">{{DINNER_NAME}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:12px;">
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Theme</p>
                          <p style="margin:4px 0 0 0;font-family:Arial,sans-serif;font-size:16px;color:#ffffff;">{{DINNER_THEME}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Options</p>
                          <p style="margin:4px 0 0 0;font-family:Arial,sans-serif;font-size:16px;color:#ffffff;">{{RESTAURANT_COUNT}} restaurants to choose from</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <a href="{{POLL_URL}}" style="display:inline-block;background-color:#c8952a;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;">Cast my vote →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-align:center;">One vote per member. Choose wisely.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#475569;">© 2026 DinnerClub · <a href="https://www.dinnerclub.app" style="color:#c8952a;text-decoration:none;">dinnerclub.app</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const RATING_PROMPT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>How was dinner? — DinnerClub</title>
</head>
<body style="margin:0;padding:0;background-color:#1e2a3a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e2a3a;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:40px;">
              <span style="font-family:Georgia,serif;font-size:30px;font-weight:700;color:#ffffff;letter-spacing:-1px;">dinner<span style="color:#c8952a;">club</span></span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#253447;border-radius:16px;padding:48px 40px;">
              <p style="margin:0 0 4px 0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#c8952a;letter-spacing:2px;text-transform:uppercase;">Post-Dinner</p>
              <p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">How was {{RESTAURANT_NAME}}?</p>
              <p style="margin:0 0 28px 0;font-family:Arial,sans-serif;font-size:15px;color:#94a3b8;line-height:1.6;">The dinner window is open. Rate the food, the vibe, and the value — it only takes a minute and helps your crew pick better next time.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e2a3a;border-radius:10px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:12px;">
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Restaurant</p>
                          <p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:17px;font-weight:700;color:#ffffff;">{{RESTAURANT_NAME}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Dinner</p>
                          <p style="margin:4px 0 0 0;font-family:Arial,sans-serif;font-size:16px;color:#ffffff;">{{DINNER_NAME}} · {{DINNER_DATE}}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <a href="{{RATING_URL}}" style="display:inline-block;background-color:#c8952a;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;">Leave my rating →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-align:center;">Rating window closes in 7 days.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#475569;">© 2026 DinnerClub · <a href="https://www.dinnerclub.app" style="color:#c8952a;text-decoration:none;">dinnerclub.app</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const INVITE_TO_CLUB_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>You're invited — DinnerClub</title>
</head>
<body style="margin:0;padding:0;background-color:#1e2a3a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e2a3a;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:40px;">
              <span style="font-family:Georgia,serif;font-size:30px;font-weight:700;color:#ffffff;letter-spacing:-1px;">dinner<span style="color:#c8952a;">club</span></span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#253447;border-radius:16px;padding:48px 40px;">
              <p style="margin:0 0 4px 0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#c8952a;letter-spacing:2px;text-transform:uppercase;">You're Invited</p>
              <p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">{{INVITER_NAME}} wants you at the table.</p>
              <p style="margin:0 0 28px 0;font-family:Arial,sans-serif;font-size:15px;color:#94a3b8;line-height:1.6;">You've been invited to join <strong style="color:#ffffff;">{{CLUB_NAME}}</strong> on DinnerClub — where friend groups stop debating and start eating.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e2a3a;border-radius:10px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:12px;">
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Club</p>
                          <p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:17px;font-weight:700;color:#ffffff;">{{CLUB_NAME}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Invited by</p>
                          <p style="margin:4px 0 0 0;font-family:Arial,sans-serif;font-size:16px;color:#ffffff;">{{INVITER_NAME}}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <a href="{{INVITE_URL}}" style="display:inline-block;background-color:#c8952a;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;">Accept my invite →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-align:center;">Invite-only clubs. Free to use.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#475569;">© 2026 DinnerClub · <a href="https://www.dinnerclub.app" style="color:#c8952a;text-decoration:none;">dinnerclub.app</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
  const html = RESERVATION_CONFIRMED_TEMPLATE
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
  const html = DINNER_REMINDER_TEMPLATE
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
  const html = VOTING_OPEN_TEMPLATE
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
  const html = RATING_PROMPT_TEMPLATE
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
  const html = INVITE_TO_CLUB_TEMPLATE
    .replace(/{{INVITER_NAME}}/g, inviterName)
    .replace(/{{CLUB_NAME}}/g, clubName)
    .replace(/{{INVITE_URL}}/g, inviteUrl);

  return send(to, `${inviterName} invited you to join ${clubName} on DinnerClub`, html);
}
