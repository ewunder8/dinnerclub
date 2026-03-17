# DinnerClub — Testing Checklist

## Testers
- **Eric** (owner/admin) — personal email
- **Kandace** — member perspective
- **Shared email** — third member, also used to verify notification emails

---

## Setup

- [ ] All three auth users deleted from Supabase dashboard
- [ ] All app data truncated (see CONTEXT.md for SQL)
- [ ] `RESEND_API_KEY` and `CRON_SECRET` set in Vercel environment variables
- [ ] Production URL confirmed working

---

## 1. Auth & Onboarding

- [ ] Eric signs up → completes onboarding (name, city)
- [ ] Kandace signs up → completes onboarding
- [ ] Shared email signs up → completes onboarding
- [ ] Profile page loads correctly for all three
- [ ] Sign out and back in works

---

## 2. Profile & Avatar

- [ ] Eric uploads a profile photo — appears immediately in profile page
- [ ] Avatar shows in nav bar after upload (no page reload needed)
- [ ] Kandace uploads a photo — her avatar shows in club member list
- [ ] Fallback initials show for shared email (no photo uploaded)
- [ ] Photo over 5MB is rejected with an error message
- [ ] Updating name saves correctly and reflects in nav

---

## 3. Club Creation & Invites

- [ ] Eric creates a club (name, emoji, city)
- [ ] Club appears on Eric's dashboard
- [ ] Eric generates an invite link
- [ ] Eric uses **email invite form** → sends invite to Kandace's email
- [ ] Eric uses **email invite form** → sends invite to shared email
- [ ] Kandace receives invite email, clicks link, joins club
- [ ] Shared email receives invite email, clicks link, joins club
- [ ] All three members appear in the club member list
- [ ] Eric sees ⚙️ settings icon, others do not

---

## 4. Dinner Poll

- [ ] Eric starts a dinner (set theme, target date, poll close date, min suggestions)
- [ ] Target date shows on poll view as "Aiming for [date]"
- [ ] Dinner appears on club page for all three members
- [ ] All three can suggest restaurants via Google Places search
- [ ] Each suggestion shows who added it
- [ ] Kandace can remove her own suggestion before voting opens
- [ ] Eric (owner) can remove any suggestion
- [ ] Eric opens voting → all three receive **voting open email**
- [ ] All three cast a vote (one vote per member enforced)
- [ ] Poll auto-closes at deadline OR Eric closes it manually
- [ ] Eric selects a winner

---

## 5. Seeking Reservation

- [ ] Dinner status shows "Seeking reservation"
- [ ] Top vote-getters ranked (#1, #2, #3) are displayed
- [ ] Kandace clicks "I'll try to get a table"
- [ ] Kandace appears in the "Trying to get a table" list
- [ ] Eric also clicks "I'll try" — both show as attempting
- [ ] Eric clicks "Never mind" — removed from list
- [ ] Kandace clicks "I got it →"
- [ ] Kandace fills out ConfirmReservationForm (date, time, party size, platform, confirmation #)
- [ ] Kandace selects restaurant (test with #2 or #3 if applicable)
- [ ] Kandace submits — crown 👑 appears next to her name
- [ ] All three receive **reservation confirmed email**
- [ ] Email shows correct restaurant, date, time, party size, address

---

## 6. Countdown View

- [ ] Dinner status shows confirmed with countdown
- [ ] Restaurant name, address, time, party size all correct
- [ ] "👑 Reserved by [Kandace's name]" shown
- [ ] All three RSVP — names appear in RSVP list
- [ ] Share button works
- [ ] Add to calendar works (Google + .ics)
- [ ] Reservation platform + confirmation number shown

---

## 7. Dinner Reminder Email

- [ ] Create a confirmed dinner with `reservation_datetime` set to tomorrow
- [ ] Hit the cron endpoint manually:
  ```
  curl https://YOUR_VERCEL_URL/api/cron/dinner-reminder \
    -H "Authorization: Bearer b96228ab82256516fff5a3354dbe9c38915c8c51b7d56be5b195f477ad2c658c"
  ```
- [ ] All three receive **dinner reminder email**
- [ ] Email shows correct restaurant, time, address

---

## 8. Post-Dinner Ratings

- [ ] Eric clicks "Mark as completed"
- [ ] All three receive **rating prompt email**
- [ ] Rating window shows as open (7 days)
- [ ] All three submit ratings (overall, food, vibe, value, would return, tags, note)
- [ ] Aggregate scores appear on dinner page
- [ ] Dinner appears on Discover page with scores, notes, % would return

---

## 9. Club Management

- [ ] Eric can edit club name/emoji/city in settings
- [ ] Eric can transfer ownership to Kandace → Kandace becomes owner
- [ ] Original owner can leave club (non-owner)
- [ ] Eric can remove shared email member
- [ ] Eric can delete club → redirected to dashboard, club gone

---

## 10. Edge Cases

- [ ] Invite link expires after 7 days (or test with a manually expired token)
- [ ] Voting enforces one vote per member
- [ ] Duplicate reservation attempt blocked (upsert behavior)
- [ ] Cancelled dinner shows correct state
- [ ] 404 page works for invalid club/dinner URLs
- [ ] Profile updates (name, city) save and reflect in nav
