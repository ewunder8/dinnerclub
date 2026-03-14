# DinnerClub — AI Context

Paste this file at the start of any Cursor or Claude conversation for better suggestions.

## What is DinnerClub?

A web app for friend groups to organize dinner outings together. Core loop:
1. Club members vote on where to eat (poll)
2. Someone grabs a reservation (coordination)
3. Everyone RSVPs and adds to calendar
4. After dinner, everyone rates the restaurant (builds taste profile)

## Key Product Decisions

- **Invite-only clubs** — no public discovery of clubs, friends only
- **Invite links expire in 7 days** — regeneratable by any member
- **Anyone can try to get a reservation** — first to confirm wins, tracked via reservation_attempts table
- **Restaurant data from Google Places** — cached locally for 48 hours
- **No reservation API integration** — deep links to Resy/OpenTable app only
- **Post-dinner ratings** are the data flywheel for Discover recommendations

## Tech Stack

- Next.js 14 App Router + TypeScript
- Supabase (Postgres + Auth + Storage)
- Tailwind CSS with custom DinnerClub design tokens
- Google Places API (server-side, cached)
- Google Maps JavaScript API (client-side)
- Hosted on Vercel

## Design Tokens (Tailwind) — Slate & Citrus palette

- `slate` / `slate-light` / `slate-faint` — primary dark navy (navs, buttons, borders)
- `citrus` / `citrus-dark` / `citrus-light` — accent yellow-gold (wordmark span, highlights, stars)
- `ink` — primary text (#1a1f30)
- `ink-muted` — secondary text (#4a5270)
- `ink-faint` — placeholder / disabled text (#8a90a8)
- `snow` — page background (#f2f3f6)
- `surface` — card / input background (#ffffff)
- Font: `font-sans` = Syne (headings, wordmark, nav); body = Plus Jakarta Sans

## Database Tables

users, clubs, club_members, invite_links, dinners, reservation_attempts,
poll_options, votes, rsvps, restaurant_cache, dinner_ratings

Full types in: lib/supabase/database.types.ts
Full schema in: supabase/migrations/001_initial_schema.sql
Migrations: 002_poll_themes.sql, 003_vote_uniqueness.sql, 004_ratings_and_countdown.sql

## Poll & Suggestion Flow

**Creating a dinner (owner):**
1. Owner creates dinner, optionally sets a theme (cuisine, price, vibe, neighborhood)
2. Sets poll close date and minimum suggestions required (default 2)
3. Members get notified to suggest restaurants

**Suggesting restaurants (any member):**
- Search by name → Google Places autocomplete
- Add from Discover page via "+ Poll" button
- Add from club's past dinners ("we loved this, go back?")
- Each suggestion shows who added it and optional note
- Owner can remove off-theme suggestions

**Voting:**
- One vote per member per dinner — enforced via unique constraint on (dinner_id, user_id)
- Owner opens voting once enough suggestions are in
- Poll auto-closes at deadline
- Winner = most votes; ties broken by owner
- Results show vote counts, percentages, and who voted for what

**Suggestion modes:**
- `owner_only` — owner curates the shortlist, no member suggestions
- `members` — any member can suggest
- `hybrid` — owner seeds it, members can add more
- Set at dinner creation, stored on `dinners.suggestion_mode`
- Max suggestions capped by `dinners.max_suggestions` (default 8)

**Key files:**
- `lib/poll.ts` — theme formatting, poll state machine, vote counting, tie detection
- `supabase/migrations/002_poll_themes.sql` — theme fields on dinners, removal fields on poll_options
- `supabase/migrations/003_vote_uniqueness.sql` — one vote per dinner per user, suggestion mode

**Poll states:** `needs_suggestions` → `ready_to_open` → `voting_open` → `voting_closed` → `winner_selected`

## Coming Up (Countdown View)

Shown when a dinner has status `confirmed` and `reservation_datetime` is in the future.

**What it shows:**
- Restaurant name, address, time, party size
- Countdown: "3 days" / "Tomorrow" / "Tonight in 2h 30m"
- RSVP list — who's going
- Reservation platform + confirmation number + deep link to manage it
- Share button — resend details to group chat via ReservationShareSheet

**Key file:** `lib/countdown.ts` — `getCountdown()`, `formatReservationTime()`, urgency levels (`far` / `soon` / `imminent` / `past`)

**Urgency for UI styling:**
- `far` — 8+ days out, show calm/neutral
- `soon` — 2–7 days, show with some energy
- `imminent` — today or tomorrow, show prominently
- `past` — dinner has passed, trigger rating flow

**Auto-complete:** Owner manually marks dinner completed via `MarkCompletedButton`, which sets `status = completed` and `ratings_open_until = now() + 7 days`.

## Post-Dinner Ratings

Triggered when `status = 'completed'` and `ratings_open_until` is in the future (7-day window). One rating per member per dinner.

**Rating dimensions:**
- `overall_score` — 1–5, required
- `food_score`, `vibe_score`, `value_score` — 1–5, optional
- `would_return` — boolean
- `recommend` — would you suggest this to the club?
- `tags` — quick multi-select (e.g. "Great for groups", "Hidden gem", "Loud / lively")
- `note` — optional free text, max 500 chars

**Aggregate view:** `dinner_rating_summaries` — pre-aggregated per dinner. Use for Past Dinners list and Discover cards. Query via Supabase views.

**Key helpers in `lib/countdown.ts`:** `isRatingWindowOpen()`, `validateRating()`, `scoreToStars()`, `RATING_TAGS`, `wouldReturnPct()`

**Past Dinners display:** avg scores, % would return, member notes, each member's individual rating — fun to see where the group agreed or diverged.

## Sharing & Deep Links

- `lib/sharing.ts` — invite link sharing via WhatsApp, iMessage, Telegram, email, clipboard, and native Web Share API
- `lib/reservations.ts` — Resy/OpenTable/Tock deep links (opens app if installed, website if not)
- Beli links use `beliapp.co` share URLs stored in `restaurant_cache.beli_url` — opens Beli app if installed, App Store if not
- Native Web Share API (`navigator.share`) is preferred on mobile — pulls up system share sheet covering all apps
- iMessage uses `sms:&body=` URL scheme — mobile only
- WhatsApp uses `https://wa.me/?text=` — works on all platforms

## Future Features (Post-MVP)

### Seat Claiming
Instead of traditional RSVPs, the person who secures a reservation shares available seats and group members claim them first-come first-served.

How it works:
- Member gets reservation for N people, confirms in DinnerClub
- Shares "X seats available" to the group instead of a standard notification
- Members claim seats until full — late claimers go to auto-waitlist
- If someone unclaims, next person on waitlist gets notified automatically
- Push notification creates urgency: "Jamie got a table at Atomix for 4 — 3 slots open"

Data model additions needed:
- `reservation_seats` table (dinner_id, total_seats, claimed_seats)
- `seat_claims` table (dinner_id, user_id, status: claimed/waitlisted/released, claimed_at)
- Waitlist ordering by claim timestamp
- Auto-notify next waitlisted user on unclaim

Deferred because: adds meaningful complexity on top of MVP reservation flow. Build when real users ask for it.

## TODO

### Post User-Testing (Bigger Lifts)

- [ ] **Email notifications** — notify members when poll closes, someone books, or dinner is confirmed. Needs Supabase Edge Functions + email provider (Resend recommended).
- [ ] **Push notifications** — real-time alerts via web push or a service like OneSignal. Pairs with the booking / poll-close events above.
- [ ] **Avatar upload** — profile page shows initials only; allow photo upload via Supabase Storage.
- [ ] **Seat claiming** — see "Seat Claiming" section below. Deferred until real users request it.
- [ ] **RLS policy audit** — verify leave club, non-owner creating dinners, and delete club all work correctly under production RLS rules.

### Known Minor Gaps

- No in-app notification when someone books the reservation — members must check the app manually.
- No way to re-open a cancelled dinner (must create a new one).
- Suggestion removal by non-owners: members can remove their own suggestion before voting opens, but not after.

### Done (Selected highlights)
- [x] Auth — Google OAuth + email/password, onboarding flow, middleware session refresh
- [x] Full Slate & Citrus palette migration across all pages and components
- [x] Dashboard — upcoming dinners, "Rate your dinner" nudge, sign out
- [x] Club management — create, edit, delete, transfer ownership, leave, remove members
- [x] Invite links — generate, share, expire in 7 days, join flow with `?next=` threading
- [x] Dinner poll — suggest (Google Places), vote, auto-close on deadline, owner controls, winner selection
- [x] Any member can start a dinner (not just owners)
- [x] Members can remove their own suggestions before voting opens
- [x] Seeking reservation — attempts list, "I got it" → crown badge, ConfirmReservationForm
- [x] `reserved_by` stored on dinner; "Reserved by [name] 👑" shown on confirmed view
- [x] Countdown view — RSVP, share sheet, add to calendar (Google + .ics)
- [x] Post-dinner ratings — overall + food/vibe/value, would_return, recommend, tags, notes, 7-day window
- [x] Discover page — past dinners with group scores, clickable to dinner detail
- [x] Beli deep links — store `beli_url` on restaurant_cache, "View on Beli →" throughout
- [x] Profile page — edit name/city, sign out
- [x] 404 and error boundary pages
- [x] Landing page — Slate & Citrus, correct copy (book not lock, American spelling)

## File Conventions

- Server components fetch data directly via lib/supabase/server.ts
- Client components use lib/supabase/client.ts
- All Google Places calls go through lib/places.ts (handles caching)
- Always use the `cn()` utility from lib/utils.ts for className merging
