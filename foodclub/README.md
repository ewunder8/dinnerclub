# 🍽 Food Club

> Dinner is better together.

Discover restaurants, vote with your crew, book reservations, and build a real food culture with the people you love eating with.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 14 (App Router) |
| Database + Auth + Storage | Supabase (Postgres) |
| Hosting | Vercel |
| Restaurant Data | Google Places API |
| Maps | Google Maps JavaScript API |
| Styling | Tailwind CSS |

**Monthly cost at hobby scale: ~$0**

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/foodclub.git
cd foodclub
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **SQL Editor** and run the contents of `supabase/migrations/001_initial_schema.sql`
4. Go to **Settings → API** and copy your Project URL and anon key

### 3. Set up Google

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project called "Food Club"
3. Enable these APIs:
   - Maps JavaScript API
   - Places API (New)
   - Geocoding API
4. Go to **Credentials → Create Credentials → API Key**
5. Create two keys: one for the browser (restrict to HTTP referrers), one for the server (restrict to IP)

### 4. Set up Auth Providers in Supabase

**Google:**
1. Go to Supabase → Authentication → Providers → Google
2. Enable it and paste in your Google OAuth client ID and secret
3. (Get these from Google Cloud Console → APIs & Services → OAuth consent screen)

**Apple:**
1. Go to Supabase → Authentication → Providers → Apple
2. Follow Supabase's Apple setup guide (requires Apple Developer account - $99/year)

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your keys from steps 2 and 3.

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

```bash
# Push to GitHub first
git add .
git commit -m "Initial scaffold"
git push origin main
```

Then:
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project** and import your `foodclub` repo
3. Add all your environment variables from `.env.local`
4. Click **Deploy**

Your app is live. Every `git push` auto-deploys.

---

## Project Structure

```
foodclub/
├── app/
│   ├── page.tsx                  # Landing / redirect to dashboard
│   ├── dashboard/page.tsx        # Main dashboard (clubs list)
│   ├── auth/
│   │   ├── login/page.tsx        # Sign in page
│   │   └── callback/route.ts     # OAuth callback handler
│   ├── clubs/[clubId]/page.tsx   # Club detail
│   ├── discover/page.tsx         # Restaurant discovery
│   └── join/[token]/page.tsx     # Invite link landing page
│
├── components/                   # Reusable UI components (build these as you go)
│   ├── ui/                       # Generic: Button, Card, Modal, etc.
│   ├── clubs/                    # ClubCard, MemberList, InviteModal
│   ├── polls/                    # PollCard, VoteButton, PollResults
│   ├── restaurants/              # RestaurantCard, RatingModal
│   └── auth/                     # AuthButton, AvatarPicker
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   ├── server.ts             # Server Supabase client
│   │   └── database.types.ts     # TypeScript types (matches schema exactly)
│   ├── places.ts                 # Google Places API helpers + caching
│   ├── calendar.ts               # .ics file generator for Add to Calendar
│   ├── reservations.ts           # Resy / OpenTable deep link builder
│   └── utils.ts                  # Shared utilities
│
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql  # Full database schema — run this first
```

---

## Key Concepts

**Invite Links** expire after 7 days. Tokens are random 8-character strings stored in `invite_links`. The `/join/[token]` page checks expiry server-side before rendering.

**Restaurant data** comes from Google Places API and is cached in `restaurant_cache` for 48 hours. Always check the cache before calling Google — keeps costs near zero.

**Reservation coordination** — multiple members can attempt to get a reservation simultaneously via `reservation_attempts`. First to confirm flips the dinner to `confirmed` status.

**Taste profile** is built from `dinner_ratings` — post-dinner ratings from every member. This is the data flywheel that makes Discover smarter over time.

---

## Development Roadmap

- [x] Project scaffold
- [x] Database schema
- [x] Auth (Google, Apple, email)
- [x] Invite link flow
- [ ] Club creation + management
- [ ] Poll creation + voting
- [ ] Google Places search
- [ ] Restaurant cards + detail view
- [ ] Reservation deep links (Resy / OpenTable)
- [ ] Add to Calendar (.ics)
- [ ] Post-dinner rating flow
- [ ] Discover page with taste profile
- [ ] Onboarding flow

---

## Questions / Notes

Keep a running list of decisions and questions here as you build.

- [ ] Onboarding: what's the minimum viable profile to get started?
- [ ] Polls: should the poll winner be automatic (most votes) or does an admin confirm?
- [ ] Notifications: email for now, push notifications when going mobile
