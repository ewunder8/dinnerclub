# 🍽 Dinner Club

> Dinner is better together.

Coordinate dinners with your crew — poll restaurants, book reservations, rate the meal, and build a real food history with the people you love eating with.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 14 (App Router) |
| Database + Auth + Storage | Supabase (Postgres) |
| Hosting | Vercel |
| Restaurant Data | Google Places API |
| Styling | Tailwind CSS |

**Monthly cost at hobby scale: ~$0**

---

## Features

- **Clubs** — Create a dinner club, invite members via share link, manage co-owners
- **Polls** — Suggest restaurants, vote on options, auto-close polls by deadline
- **Reservations** — Coordinate who's booking; track Resy/OpenTable attempts
- **Countdown** — Confirmed dinner view with RSVP, countdown timer, and booking links
- **Ratings** — Post-dinner rating flow (overall, food, vibe, value, notes, tags)
- **Past Dinners** — Browse every place your club has eaten with group ratings and verdicts
- **Profiles** — Name, photo, city, and Beli username per member

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/dinnerclub.git
cd dinnerclub
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **SQL Editor** and run all migrations in order from `supabase/migrations/`
4. Go to **Settings → API** and copy your Project URL and anon key

### 3. Set up Google

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable these APIs:
   - Maps JavaScript API
   - Places API (New)
   - Geocoding API
4. Create two API keys: one for the browser (restrict to HTTP referrers), one for the server (restrict to IP)

### 4. Set up Auth Providers in Supabase

**Google:**
1. Supabase → Authentication → Providers → Google
2. Enable it and paste in your Google OAuth client ID and secret

**Apple:**
1. Supabase → Authentication → Providers → Apple
2. Follow Supabase's Apple setup guide (requires Apple Developer account)

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_PLACES_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com), import your repo
3. Add all environment variables
4. Deploy — every `git push` auto-deploys after that

---

## Project Structure

```
dinnerclub/
├── app/
│   ├── page.tsx                          # Landing / redirect
│   ├── dashboard/page.tsx                # Clubs list + nav
│   ├── auth/                             # Login, callback, session check
│   ├── onboarding/                       # First-time profile setup
│   ├── profile/                          # Edit name, photo, city, Beli username
│   ├── clubs/
│   │   ├── new/                          # Create a club
│   │   └── [id]/
│   │       ├── page.tsx                  # Club detail + members + invite
│   │       ├── settings/                 # Edit club, transfer ownership
│   │       └── dinners/
│   │           ├── new/                  # Create a dinner poll
│   │           └── [dinnerId]/           # Dinner detail (poll → reservation → countdown → ratings)
│   ├── discover/page.tsx                 # Past dinners + group ratings
│   └── join/[token]/                     # Invite link flow
│
├── components/
│   ├── UserAvatar.tsx
│   └── NavUser.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Browser Supabase client
│   │   ├── server.ts                     # Server Supabase client
│   │   └── database.types.ts             # TypeScript types (kept in sync with migrations)
│   ├── places.ts                         # Google Places API + restaurant cache
│   ├── poll.ts                           # Poll state machine helpers
│   ├── countdown.ts                      # Countdown + rating helpers
│   ├── sharing.ts                        # Invite link helpers
│   └── utils.ts                          # Shared utilities
│
└── supabase/
    └── migrations/                       # Run in order — full schema history
```

---

## Key Concepts

**Dinner lifecycle:** `polling` → `seeking_reservation` → `confirmed` (or `waitlisted`) → `completed` → ratings open for 7 days

**Invite links** expire after 7 days. Random 8-character tokens stored in `invite_links`, checked server-side on the `/join/[token]` page.

**Restaurant data** comes from Google Places API and is cached in `restaurant_cache`. Always check cache before calling Google — keeps costs near zero.

**Reservation coordination** — multiple members can attempt simultaneously via `reservation_attempts`. First to confirm flips the dinner to `confirmed`.

**Ratings** — each member rates overall (required), food/vibe/value (optional), would go back, tags, and notes. Group averages are materialized in `dinner_rating_summaries` and shown on the Past Dinners page.

**Beli** — members can save their Beli username on their profile. It shows as a clickable link on member cards and on restaurant cards in Past Dinners.
